#!/usr/bin/env node
/**
 * ETL das Eleições 2026 — baixa os dados abertos do TSE e as malhas do IBGE
 * e gera os JSON estáticos consumidos pelo site em public/data e public/geo.
 *
 * Uso:  node scripts/build-data.mjs            (baixa o que faltar no cache)
 *       TSE_CACHE=/caminho node scripts/build-data.mjs
 *       SKIP_GEO=1 node scripts/build-data.mjs   (sem baixar malhas do IBGE)
 *
 * Fontes:
 *  - https://dadosabertos.tse.jus.br (consulta_cand, votacao_candidato_munzona, consulta_vagas,
 *    votacao_secao_BR — Presidente, que não consta no munzona)
 *  - https://resultados.tse.jus.br   (resumo de comparecimento/abstenção e 2º turno)
 *  - https://servicodados.ibge.gov.br/api/v3/malhas (malhas de UFs e municípios)
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = process.env.TSE_CACHE || path.join(ROOT, '.cache', 'tse')
const OUT = path.join(ROOT, 'public', 'data')
const GEO = path.join(ROOT, 'public', 'geo')
const ANO = 2026
const CDN = 'https://cdn.tse.jus.br/estatistica/sead/odsele'
const RESULTADOS = `https://resultados.tse.jus.br/oficial/ele${ANO}`
// Códigos de eleição publicados em resultados.tse.jus.br/oficial/comum/config/ele-c.json
const ELEICAO = { federal: { t1: '6257', t2: '6258' }, estadual: { t1: '6259', t2: '6260' } }
const DATA_ELEICAO = new Date(Date.UTC(ANO, 9, 4))

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
const UF_IBGE = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 }
// Cargos analisados (vices e suplentes ficam de fora)
const CARGOS = { 1: 'PRESIDENTE', 3: 'GOVERNADOR', 5: 'SENADOR', 6: 'DEPUTADO FEDERAL', 7: 'DEPUTADO ESTADUAL', 8: 'DEPUTADO DISTRITAL' }
const PROPORCIONAIS = new Set([6, 7, 8])

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a)

// ---------------------------------------------------------------- download

async function download(url, dest) {
  if (fs.existsSync(dest)) return dest
  log('baixando', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await fsp.mkdir(path.dirname(dest), { recursive: true })
  const tmp = dest + '.part'
  await fsp.writeFile(tmp, Buffer.from(await res.arrayBuffer()))
  await fsp.rename(tmp, dest)
  return dest
}

async function datasetDir(name, pasta = name.replace(/_\d{4}$/, '')) {
  const dir = path.join(CACHE, name)
  if (fs.existsSync(dir)) return dir
  const zip = await download(`${CDN}/${pasta}/${name}.zip`, path.join(CACHE, `${name}.zip`))
  fs.mkdirSync(dir, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir])
  return dir
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * GET JSON com cache em disco (respostas do TSE são imutáveis após a totalização)
 * e backoff exponencial — resultados.tse.jus.br responde 429 sob carga.
 * Retorna null em 404. Use { cache: false } para dados que ainda podem mudar.
 */
let proximaJanela = 0
/** Espaça as requisições ao TSE (~8/s) para não disparar o limite de taxa. */
async function throttle(url) {
  if (!url.includes('tse.jus.br')) return
  const agora = Date.now()
  const espera = Math.max(0, proximaJanela - agora)
  proximaJanela = Math.max(agora, proximaJanela) + 125
  if (espera) await sleep(espera)
}

async function getJSON(url, { retries = 12, cache = true } = {}) {
  const file = path.join(CACHE, 'http', url.replace(/^https?:\/\//, '').replace(/[?&=%]/g, '_'))
  if (cache && fs.existsSync(file)) return JSON.parse(await fsp.readFile(file, 'utf8'))
  for (let i = 0; ; i++) {
    try {
      await throttle(url)
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) {
        const wait = +(res.headers.get('retry-after') || 0) * 1000
        throw Object.assign(new Error(`HTTP ${res.status}`), { wait })
      }
      const text = await res.text()
      const json = JSON.parse(text)
      if (cache) {
        await fsp.mkdir(path.dirname(file), { recursive: true })
        await fsp.writeFile(file, text)
      }
      return json
    } catch (e) {
      if (i >= retries) throw new Error(`${url}: ${e.message}`)
      const ms = Math.max(e.wait || 0, Math.min(120_000, 2000 * 2 ** i))
      if (i >= 2) log(`aguardando ${ms / 1000}s (${e.message}) ${url}`)
      await sleep(ms)
    }
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

// ---------------------------------------------------------------- CSV

/** Lê um CSV do TSE (latin1, ';', aspas) linha a linha. */
async function* readCsv(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'latin1' }), crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    const cols = splitCsv(line)
    if (!header) { header = cols; continue }
    const row = {}
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i]
    yield row
  }
}

function splitCsv(line) {
  const out = []
  let i = 0
  while (i <= line.length) {
    if (line[i] === '"') {
      let j = i + 1, s = ''
      for (;;) {
        const k = line.indexOf('"', j)
        if (k === -1) { s += line.slice(j); j = line.length; break }
        if (line[k + 1] === '"') { s += line.slice(j, k + 1); j = k + 2; continue }
        s += line.slice(j, k); j = k + 1; break
      }
      out.push(s)
      i = j + 1
    } else {
      const k = line.indexOf(';', i)
      const end = k === -1 ? line.length : k
      out.push(line.slice(i, end))
      i = end + 1
    }
  }
  return out
}

const nulo = (v) => !v || v.startsWith('#NULO') || v === '#NE' || v === 'NÃO DIVULGÁVEL' || v === 'Não divulgável'

// ---------------------------------------------------------------- helpers

/** Dicionário para codificar strings repetidas como índices. */
class Dict {
  constructor() { this.list = []; this.map = new Map() }
  id(v) {
    if (v == null || v === '') return -1
    let i = this.map.get(v)
    if (i === undefined) { i = this.list.length; this.list.push(v); this.map.set(v, i) }
    return i
  }
}

function idade(dt) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dt || '')
  if (!m) return null
  const [d, mo, y] = [+m[1], +m[2], +m[3]]
  let a = DATA_ELEICAO.getUTCFullYear() - y
  if (DATA_ELEICAO.getUTCMonth() + 1 < mo || (DATA_ELEICAO.getUTCMonth() + 1 === mo && DATA_ELEICAO.getUTCDate() < d)) a--
  return a
}

function situacao(ds) {
  if (!ds || nulo(ds)) return null
  if (ds.startsWith('ELEITO')) return 'ELEITO'
  if (ds.startsWith('2')) return '2º TURNO'
  return ds // SUPLENTE, NÃO ELEITO
}

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'(/-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase())

const writeJSON = async (file, data) => {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(data))
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  log('gravado', path.relative(ROOT, file), `${kb} KB`)
}

// ---------------------------------------------------------------- main

async function main() {
  fs.mkdirSync(CACHE, { recursive: true })

  // 1. Municípios (código TSE -> IBGE) a partir da configuração da divulgação
  const munCfg = await getJSON(`${RESULTADOS}/${ELEICAO.estadual.t1}/config/mun-e00${ELEICAO.estadual.t1}-cm.json`)
  const municipios = {} // uf -> [{tse, ibge, nome}]
  const munIndex = {} // uf -> Map(tse -> idx)
  for (const abr of munCfg.abr) {
    const uf = abr.cd.toUpperCase()
    if (!UF_IBGE[uf]) continue
    municipios[uf] = abr.mu.map((m) => ({ tse: +m.cd, ibge: m.cdi, nome: titleCase(m.nm) }))
    munIndex[uf] = new Map(municipios[uf].map((m, i) => [m.tse, i]))
  }

  // 2. Vagas
  const vagasDir = await datasetDir(`consulta_vagas_${ANO}`)
  const vagas = {}
  for await (const r of readCsv(path.join(vagasDir, `consulta_vagas_${ANO}_BRASIL.csv`))) {
    const cargo = +r.CD_CARGO
    if (!CARGOS[cargo]) continue
    ;(vagas[r.SG_UF] ??= {})[cargo] = +r.QT_VAGA
  }

  // 3. Candidatos
  const candDir = await datasetDir(`consulta_cand_${ANO}`)
  const cands = new Map()
  let geradoEm = ''
  for await (const r of readCsv(path.join(candDir, `consulta_cand_${ANO}_BRASIL.csv`))) {
    const cargo = +r.CD_CARGO
    if (!CARGOS[cargo]) continue
    geradoEm ||= `${r.DT_GERACAO} ${r.HH_GERACAO}`
    cands.set(r.SQ_CANDIDATO, {
      sq: r.SQ_CANDIDATO,
      nr: +r.NR_CANDIDATO,
      urna: r.NM_URNA_CANDIDATO,
      nome: r.NM_CANDIDATO,
      cargo,
      uf: cargo === 1 ? 'BR' : r.SG_UF,
      partido: r.SG_PARTIDO,
      nrPartido: +r.NR_PARTIDO,
      nomePartido: r.NM_PARTIDO,
      federacao: nulo(r.NM_FEDERACAO) ? null : r.NM_FEDERACAO,
      coligacao: nulo(r.NM_COLIGACAO) || r.NM_COLIGACAO === 'PARTIDO ISOLADO' ? null : r.NM_COLIGACAO.trim(),
      composicao: nulo(r.DS_COMPOSICAO_COLIGACAO) ? null : r.DS_COMPOSICAO_COLIGACAO,
      genero: nulo(r.DS_GENERO) ? null : r.DS_GENERO,
      raca: nulo(r.DS_COR_RACA) ? null : r.DS_COR_RACA,
      instrucao: nulo(r.DS_GRAU_INSTRUCAO) ? null : r.DS_GRAU_INSTRUCAO,
      estadoCivil: nulo(r.DS_ESTADO_CIVIL) ? null : r.DS_ESTADO_CIVIL,
      ocupacao: nulo(r.DS_OCUPACAO) ? null : r.DS_OCUPACAO,
      ufNasc: nulo(r.SG_UF_NASCIMENTO) ? null : r.SG_UF_NASCIMENTO,
      idade: idade(r.DT_NASCIMENTO),
      situacao: situacao(r.DS_SIT_TOT_TURNO),
      situacaoDetalhe: nulo(r.DS_SIT_TOT_TURNO) ? null : r.DS_SIT_TOT_TURNO,
      votos: 0,
      apto: false, // apareceu na votação
    })
  }
  log('candidatos', cands.size)

  // 4. Votação por município/zona (cargos estaduais/federais exceto Presidente)
  const votosDir = await datasetDir(`votacao_candidato_munzona_${ANO}`)
  // agregados: ufData[uf].cargos[cargo] = { total: Float64Array(nMun), partidos: {sg: arr}, cand: Map(sq -> Map(munIdx -> votos)) }
  const ufData = {}
  for (const uf of UFS) {
    const file = path.join(votosDir, `votacao_candidato_munzona_${ANO}_${uf}.csv`)
    if (!fs.existsSync(file)) { log('sem arquivo de votos para', uf); continue }
    const nMun = municipios[uf].length
    const cargos = {}
    let semMun = 0
    for await (const r of readCsv(file)) {
      const cargo = +r.CD_CARGO
      if (!CARGOS[cargo]) continue
      const mi = munIndex[uf].get(+r.CD_MUNICIPIO)
      const votos = +r.QT_VOTOS_NOMINAIS_VALIDOS || 0
      const c = cands.get(r.SQ_CANDIDATO)
      if (c) {
        c.apto = true
        c.votos += votos
        if (c.situacao == null) c.situacao = situacao(r.DS_SIT_TOT_TURNO)
        if (c.situacaoDetalhe == null && !nulo(r.DS_SIT_TOT_TURNO)) c.situacaoDetalhe = r.DS_SIT_TOT_TURNO
        if (!nulo(r.DS_DETALHE_SITUACAO_CAND)) c.candidatura = r.DS_DETALHE_SITUACAO_CAND
      }
      if (mi === undefined) { semMun++; continue }
      const g = (cargos[cargo] ??= { total: new Array(nMun).fill(0), partidos: {}, cand: new Map() })
      g.total[mi] += votos
      if (!votos) continue
      ;(g.partidos[r.SG_PARTIDO] ??= new Array(nMun).fill(0))[mi] += votos
      let cm = g.cand.get(r.SQ_CANDIDATO)
      if (!cm) g.cand.set(r.SQ_CANDIDATO, (cm = new Map()))
      cm.set(mi, (cm.get(mi) || 0) + votos)
    }
    if (semMun) log(uf, 'linhas sem município mapeado:', semMun)
    ufData[uf] = cargos
    log('votos processados', uf)
  }

  // 5. Presidente via API de resultados (BR, UFs, exterior e municípios)
  const presidente = await carregarPresidente(cands, municipios, munIndex)

  // 6. 2º turno (quando já houver divulgação)
  const segundoTurno = await carregarSegundoTurno(cands)

  // percentual de votos válidos na circunscrição
  const totalUE = new Map()
  for (const c of cands.values()) {
    const k = `${c.cargo}|${c.uf}`
    totalUE.set(k, (totalUE.get(k) || 0) + c.votos)
  }

  // ---------------------------------------------------- candidatos.json (colunar)
  const D = { partido: new Dict(), federacao: new Dict(), coligacao: new Dict(), genero: new Dict(), raca: new Dict(), instrucao: new Dict(), estadoCivil: new Dict(), ocupacao: new Dict(), situacao: new Dict(), situacaoDetalhe: new Dict(), uf: new Dict() }
  const cols = ['sq', 'nr', 'urna', 'nome', 'cargo', 'uf', 'partido', 'federacao', 'coligacao', 'genero', 'raca', 'instrucao', 'estadoCivil', 'ocupacao', 'idade', 'situacao', 'situacaoDetalhe', 'votos', 'pct', 'apto']
  const rows = []
  const partidos = {}
  for (const c of cands.values()) {
    partidos[c.partido] ??= { nr: c.nrPartido, nome: c.nomePartido, federacao: c.federacao }
    const tot = totalUE.get(`${c.cargo}|${c.uf}`) || 0
    rows.push([
      c.sq, c.nr, c.urna, c.nome, c.cargo, D.uf.id(c.uf), D.partido.id(c.partido), D.federacao.id(c.federacao),
      D.coligacao.id(c.coligacao ? `${c.coligacao}|${c.composicao ?? ''}` : null), D.genero.id(c.genero), D.raca.id(c.raca),
      D.instrucao.id(c.instrucao), D.estadoCivil.id(c.estadoCivil), D.ocupacao.id(c.ocupacao), c.idade,
      D.situacao.id(c.apto ? c.situacao ?? 'NÃO ELEITO' : 'NÃO CONSTA NA URNA'), D.situacaoDetalhe.id(c.situacaoDetalhe),
      c.votos, tot ? Math.round((c.votos / tot) * 1e5) / 1e3 : 0, c.apto ? 1 : 0,
    ])
  }
  const dicts = Object.fromEntries(Object.entries(D).map(([k, d]) => [k, d.list]))
  await writeJSON(path.join(OUT, 'candidatos.json'), { cols, dicts, rows })

  // ---------------------------------------------------- uf/{UF}.json e votos/{UF}-{cargo}.json
  const resumoUF = {}
  for (const uf of UFS) {
    const cargos = ufData[uf] || {}
    const outCargos = {}
    resumoUF[uf] = {}
    for (const [cargo, g] of Object.entries(cargos)) {
      const majoritario = !PROPORCIONAIS.has(+cargo)
      const cand = {}
      const top = g.total.map(() => [])
      for (const [sq, cm] of g.cand) {
        for (const [mi, v] of cm) top[mi].push([sq, v])
        if (majoritario) {
          const arr = new Array(g.total.length).fill(0)
          for (const [mi, v] of cm) arr[mi] = v
          cand[sq] = arr
        }
      }
      for (const t of top) { t.sort((a, b) => b[1] - a[1]); t.length = Math.min(t.length, majoritario ? 2 : 5) }
      outCargos[cargo] = { total: g.total, partidos: g.partidos, top, ...(majoritario ? { cand } : {}) }
      resumoUF[uf][cargo] = g.total.reduce((a, b) => a + b, 0)
      if (!majoritario) {
        // votação por município de cada candidato (pares [munIdx, votos] achatados)
        const sparse = {}
        for (const [sq, cm] of g.cand) sparse[sq] = [...cm].sort((a, b) => b[1] - a[1]).flat()
        await writeJSON(path.join(OUT, 'votos', `${uf}-${cargo}.json`), sparse)
      }
    }
    if (presidente.municipios[uf]) outCargos[1] = presidente.municipios[uf]
    await writeJSON(path.join(OUT, 'uf', `${uf}.json`), {
      municipios: municipios[uf].map((m) => [m.tse, m.ibge, m.nome]),
      cargos: outCargos,
    })
  }

  // ---------------------------------------------------- meta.json
  await writeJSON(path.join(OUT, 'meta.json'), {
    ano: ANO,
    dataEleicao: '04/10/2026',
    dataSegundoTurno: '25/10/2026',
    geradoEm,
    processadoEm: new Date().toISOString(),
    cargos: CARGOS,
    vagas,
    partidos,
    presidente: presidente.resumo,
    segundoTurno,
    votosValidosUF: resumoUF,
    fontes: [
      'TSE — Portal de Dados Abertos (consulta_cand, votacao_candidato_munzona, consulta_vagas)',
      'TSE — Divulgação de Resultados (resultados.tse.jus.br): comparecimento, abstenção e 2º turno',
      'IBGE — API de Malhas Territoriais v3',
    ],
  })

  if (!process.env.SKIP_GEO) await baixarMalhas()
  log('concluído')
}

// ---------------------------------------------------------------- Presidente

function resumoAbrangencia(j) {
  const cands = j.carg[0].agr.flatMap((a) => a.par.flatMap((p) => p.cand.map((c) => ({
    sq: c.sqcand, nr: +c.n, urna: c.nmu, partido: p.sg, votos: +c.vap, pct: +String(c.pvapn || c.pvap).replace(',', '.'), situacao: c.st,
  }))))
  cands.sort((a, b) => b.votos - a.votos)
  return {
    eleitorado: +j.e.te,
    comparecimento: +j.e.c,
    abstencao: +j.e.a,
    validos: +j.v.vv,
    brancos: +j.v.vb,
    nulos: +j.v.tvn,
    totalizacao: `${j.dt} ${j.ht}`,
    candidatos: cands,
  }
}

/**
 * Presidente: votação por município agregada do arquivo por seção (CDN de dados
 * abertos — o munzona não traz cargos federais). O resumo (eleitorado, abstenção)
 * vem da API de divulgação; se ela estiver indisponível, é calculado das seções.
 */
async function carregarPresidente(cands, municipios, munIndex) {
  const dir = await datasetDir(`votacao_secao_${ANO}_BR`, 'votacao_secao')
  const agg = {} // uf -> { cand: Map(sq->v), brancos, nulos, mun: Map(mi -> Map(sq->v)) }
  let geracao = ''
  for await (const r of readCsv(path.join(dir, `votacao_secao_${ANO}_BR.csv`))) {
    if (r.CD_CARGO !== '1') continue
    geracao ||= `${r.DT_GERACAO} ${r.HH_GERACAO}`
    const uf = r.SG_UF
    const a = (agg[uf] ??= { cand: new Map(), brancos: 0, nulos: 0, mun: new Map() })
    const v = +r.QT_VOTOS || 0
    if (r.NR_VOTAVEL === '95') { a.brancos += v; continue }
    if (r.NR_VOTAVEL === '96' || !cands.has(r.SQ_CANDIDATO)) { a.nulos += v; continue }
    a.cand.set(r.SQ_CANDIDATO, (a.cand.get(r.SQ_CANDIDATO) || 0) + v)
    const mi = munIndex[uf]?.get(+r.CD_MUNICIPIO)
    if (mi === undefined) continue
    let m = a.mun.get(mi)
    if (!m) a.mun.set(mi, (m = new Map()))
    m.set(r.SQ_CANDIDATO, (m.get(r.SQ_CANDIDATO) || 0) + v)
  }
  if (!Object.keys(agg).length) { log('sem votação de Presidente'); return { resumo: null, municipios: {} } }
  log('votação de Presidente por seção agregada')

  const deSecoes = (ufs) => {
    const tot = new Map()
    let brancos = 0, nulos = 0
    for (const uf of ufs) {
      const a = agg[uf]
      if (!a) continue
      brancos += a.brancos
      nulos += a.nulos
      for (const [sq, v] of a.cand) tot.set(sq, (tot.get(sq) || 0) + v)
    }
    const validos = [...tot.values()].reduce((x, y) => x + y, 0)
    const candidatos = [...tot].map(([sq, votos]) => {
      const c = cands.get(sq)
      return { sq, nr: c.nr, urna: c.urna, partido: c.partido, votos, pct: validos ? Math.round((votos / validos) * 1e7) / 1e5 : 0, situacao: '' }
    }).sort((a, b) => b.votos - a.votos)
    return { eleitorado: null, comparecimento: null, abstencao: null, validos, brancos, nulos, totalizacao: geracao, candidatos }
  }

  const ele = ELEICAO.federal.t1
  const url = (abr) => `${RESULTADOS}/${ele}/dados/${abr}/${abr}-c0001-e00${ele}-u.json`
  const daApi = async (abr) => {
    try {
      const j = await getJSON(url(abr), { retries: 2 })
      return j ? resumoAbrangencia(j) : null
    } catch (e) {
      log('API indisponível para', abr, '— usando totais das seções')
      return null
    }
  }

  const br = (await daApi('br')) ?? deSecoes(Object.keys(agg))
  // situação: da API quando disponível; senão regra da maioria absoluta
  const temSituacao = br.candidatos.some((c) => c.situacao)
  br.candidatos.forEach((c, i) => {
    if (!temSituacao) c.situacao = c.pct > 50 ? 'Eleito' : br.candidatos[0].pct > 50 ? 'Não eleito' : i < 2 ? '2º turno' : 'Não eleito'
    const cand = cands.get(c.sq)
    if (!cand) return
    cand.votos = c.votos
    cand.apto = true
    cand.situacao = /^2/.test(c.situacao) ? '2º TURNO' : /^eleito/i.test(c.situacao) ? 'ELEITO' : 'NÃO ELEITO'
    cand.situacaoDetalhe = cand.situacao
  })
  const resumo = { br, uf: {} }
  for (const uf of [...UFS, 'ZZ']) {
    const r = (await daApi(uf.toLowerCase())) ?? (agg[uf] ? deSecoes([uf]) : null)
    if (r) {
      r.candidatos.forEach((c) => (c.situacao = br.candidatos.find((x) => x.sq === c.sq)?.situacao ?? c.situacao))
      resumo.uf[uf] = r
    }
  }

  const porMun = {}
  for (const uf of UFS) {
    const muns = municipios[uf]
    const a = agg[uf]
    if (!a) continue
    const total = muns.map(() => 0)
    const cand = {}
    const partidos = {}
    const top = muns.map(() => [])
    for (const [mi, m] of a.mun) {
      for (const [sq, v] of m) {
        total[mi] += v
        ;(cand[sq] ??= muns.map(() => 0))[mi] = v
        const p = cands.get(sq).partido
        ;(partidos[p] ??= muns.map(() => 0))[mi] += v
      }
      top[mi] = [...m].sort((x, y) => y[1] - x[1]).slice(0, 2)
    }
    porMun[uf] = { total, partidos, top, cand }
  }
  return { resumo, municipios: porMun }
}

/** Tenta carregar o 2º turno (Presidente e Governador) — retorna null até haver divulgação. */
async function carregarSegundoTurno(cands) {
  const out = {}
  const getJSON2 = (u) => getJSON(u, { cache: false, retries: 2 }).catch(() => null)
  // sem cache: estes arquivos mudam até a totalização do 2º turno
  const pres = await getJSON2(`${RESULTADOS}/${ELEICAO.federal.t2}/dados/br/br-c0001-e00${ELEICAO.federal.t2}-u.json`)
  if (pres && pres.carg?.[0]?.agr?.length) out.presidente = resumoAbrangencia(pres)
  const gov = {}
  for (const uf of UFS) {
    const j = await getJSON2(`${RESULTADOS}/${ELEICAO.estadual.t2}/dados/${uf.toLowerCase()}/${uf.toLowerCase()}-c0003-e00${ELEICAO.estadual.t2}-u.json`)
    if (j && j.carg?.[0]?.agr?.length && +j.v?.vv > 0) gov[uf] = resumoAbrangencia(j)
  }
  if (Object.keys(gov).length) out.governador = gov
  // aplica resultado final ao candidato
  const aplicar = (r) => r.candidatos.forEach((c) => {
    const cand = cands.get(c.sq)
    if (cand && /eleito/i.test(c.situacao)) cand.situacao = /não/i.test(c.situacao) ? 'NÃO ELEITO' : 'ELEITO'
  })
  if (out.presidente && +pres.v.vv > 0) aplicar(out.presidente)
  Object.values(gov).forEach(aplicar)
  return Object.keys(out).length ? out : null
}

// ---------------------------------------------------------------- Malhas IBGE

/** Reduz a precisão das coordenadas para ~100 m e remove pontos repetidos. */
function compactGeo(geo, idKey = 'codarea') {
  const round = (ring) => {
    const out = []
    for (const [x, y] of ring) {
      const p = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]
      const last = out[out.length - 1]
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
    }
    return out
  }
  // d3-geo (geometria esférica) espera o anel externo no sentido horário e furos
  // no anti-horário — o oposto do RFC 7946 usado pelo IBGE.
  const area = (ring) => ring.reduce((s, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]
    return s + (x2 - x1) * (y2 + y1)
  }, 0) // > 0 => horário (em lon/lat)
  const orient = (poly) => poly.map((ring, i) => {
    const r = round(ring)
    const horario = area(r) > 0
    return (i === 0) === horario ? r : r.reverse()
  })
  return {
    type: 'FeatureCollection',
    features: geo.features.map((f) => ({
      type: 'Feature',
      id: f.properties[idKey],
      properties: {},
      geometry: {
        type: f.geometry.type,
        coordinates: f.geometry.type === 'Polygon'
          ? orient(f.geometry.coordinates)
          : f.geometry.coordinates.map(orient),
      },
    })),
  }
}

async function baixarMalhas() {
  const base = 'https://servicodados.ibge.gov.br/api/v3/malhas'
  const q = 'formato=application/vnd.geo%2Bjson&qualidade=minima'
  const br = await getJSON(`${base}/paises/BR?${q}&intrarregiao=UF`)
  const sigla = Object.fromEntries(Object.entries(UF_IBGE).map(([k, v]) => [String(v), k]))
  const uf = compactGeo(br)
  uf.features.forEach((f) => { f.id = sigla[f.id] })
  await writeJSON(path.join(GEO, 'uf.json'), uf)
  await pool(UFS, 6, async (s) => {
    const g = await getJSON(`${base}/estados/${s}?${q}&intrarregiao=municipio`)
    await writeJSON(path.join(GEO, 'mun', `${s}.json`), compactGeo(g))
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
