import { useEffect, useState } from 'react'

/**
 * Resultados ao vivo do 2º turno, lidos direto da API de divulgação do TSE
 * (resultados.tse.jus.br responde com CORS liberado e cache de ~16 s na CDN).
 */
const RESULTADOS = 'https://resultados.tse.jus.br/oficial/ele2026'
// Códigos de eleição do 2º turno (resultados.tse.jus.br/oficial/comum/config/ele-c.json)
const ELEICAO = { federal: '6258', estadual: '6260' }
// Pleito do 2º turno (arquivos de urna por seção)
const PLEITO = '3221'

/** Fechamento das urnas: 17h de Brasília (UTC−3) em 25/10/2026. */
export const INICIO_APURACAO = Date.UTC(2026, 9, 25, 20)
/** Depois disso a página não fica mais consultando o TSE em intervalos. */
const FIM_APURACAO = Date.UTC(2026, 9, 28)
export const INTERVALO_MS = 30_000

export const urlPresidente = (abr: string) => {
  const a = abr.toLowerCase()
  return `${RESULTADOS}/${ELEICAO.federal}/dados/${a}/${a}-c0001-e00${ELEICAO.federal}-u.json`
}
/** Presidente num município (código TSE de 5 dígitos). */
export const urlPresidenteMun = (uf: string, mun: string) => {
  const a = uf.toLowerCase()
  return `${RESULTADOS}/${ELEICAO.federal}/dados/${a}/${a}${mun}-c0001-e00${ELEICAO.federal}-u.json`
}
/** Municípios de todas as UFs: código TSE, código IBGE, nome e zonas. */
export const URL_MUNICIPIOS = `${RESULTADOS}/${ELEICAO.federal}/config/mun-e00${ELEICAO.federal}-cm.json`
/** Municípios → zonas → seções de uma UF. */
export const urlSecoes = (uf: string) => {
  const a = uf.toLowerCase()
  return `${RESULTADOS}/arquivo-urna/${PLEITO}/config/${a}/${a}-p00${PLEITO}-cs.json`
}
const urlSecao = (uf: string, mun: string, zona: string, secao: string) => {
  const a = uf.toLowerCase()
  return `${RESULTADOS}/arquivo-urna/${PLEITO}/dados/${a}/${mun}/${zona}/${secao}/p00${PLEITO}-${a}-m${mun}-z${zona}-s${secao}-aux.json`
}
export const urlsSecoes = (uf: string, mun: string, zona: string, secoes: string[]) =>
  Object.fromEntries(secoes.map((s) => [s, urlSecao(uf, mun, zona, s)]))

export interface MunicipiosTSE {
  abr: { cd: string; mu: { cd: string; cdi: string; nm: string; z: string[] }[] }[]
}
export interface SecoesTSE {
  abr: { cd: string; mu: { cd: string; nm: string; zon: { cd: string; sec: { ns: string }[] }[] }[] }[]
}

export const urlGovernador = (uf: string) => {
  const a = uf.toLowerCase()
  return `${RESULTADOS}/${ELEICAO.estadual}/dados/${a}/${a}-c0003-e00${ELEICAO.estadual}-u.json`
}

export interface CandAoVivo {
  sq: string
  nr: number
  urna: string
  partido: string
  votos: number
  pct: number
  eleito: boolean
}

export interface ResultadoAoVivo {
  secoes: number
  secoesTotalizadas: number
  /** % das seções totalizadas */
  pctTotalizado: number
  eleitorado: number
  comparecimento: number
  abstencao: number
  validos: number
  brancos: number
  nulos: number
  /** horário da última totalização informado pelo TSE */
  atualizacao: string
  /** totalização encerrada */
  final: boolean
  candidatos: CandAoVivo[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const dec = (s: unknown) => +String(s ?? 0).replace(',', '.') || 0

export function parseResultado(j: any): ResultadoAoVivo {
  const candidatos: CandAoVivo[] = (j.carg?.[0]?.agr ?? []).flatMap((a: any) =>
    a.par.flatMap((p: any) =>
      p.cand.map((c: any) => ({ sq: c.sqcand, nr: +c.n, urna: c.nmu, partido: p.sg, votos: +c.vap || 0, pct: dec(c.pvap), eleito: /^eleito/i.test(c.st ?? '') })),
    ),
  )
  candidatos.sort((a, b) => b.votos - a.votos || a.nr - b.nr)
  return {
    secoes: +j.s?.ts || 0,
    secoesTotalizadas: +j.s?.st || 0,
    pctTotalizado: dec(j.s?.pst),
    eleitorado: +j.e?.te || 0,
    comparecimento: +j.e?.c || 0,
    abstencao: +j.e?.a || 0,
    validos: +j.v?.vv || 0,
    brancos: +j.v?.vb || 0,
    nulos: +j.v?.tvn || 0,
    atualizacao: j.dt ? `${j.dt} ${j.ht}` : '',
    final: j.tf === 's',
    candidatos,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface SecaoAoVivo {
  /** situação informada pelo TSE (ex.: Totalizada) */
  situacao: string
  /** recebimento do boletim de urna */
  recebida: string
  final: boolean
}

export function parseSecao(j: any): SecaoAoVivo {
  const h = j.hashes?.[j.hashes.length - 1]
  return { situacao: j.st ?? '', recebida: h ? `${h.dr} ${h.hr}` : '', final: /^totalizad/i.test(j.st ?? '') }
}

/** null = arquivo inexistente (sem disputa); undefined = falha temporária. */
async function buscar<T>(url: string, parse: (j: any) => T): Promise<T | null | undefined> {
  try {
    // no-cache revalida com ETag: barato quando nada mudou
    const r = await fetch(url, { cache: 'no-cache' })
    if (r.status === 403 || r.status === 404) return null
    if (!r.ok) return undefined
    return parse(await r.json())
  } catch {
    return undefined
  }
}

/** Executa `fn` em todos os itens com no máximo `n` em paralelo. */
async function emLotes<I, O>(itens: I[], n: number, fn: (i: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(itens.length)
  let prox = 0
  const trabalhador = async () => {
    while (prox < itens.length) {
      const i = prox++
      out[i] = await fn(itens[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador))
  return out
}

export type Fase = 'aguardando' | 'ao-vivo' | 'final' | 'encerrado'

export interface AoVivo<T = ResultadoAoVivo> {
  dados: Record<string, T | null>
  carregado: boolean
  atualizadoEm: Date | null
  /** timestamp da próxima consulta agendada */
  proxima: number | null
  fase: Fase
  erro: string | null
  atualizar: () => void
}

/**
 * Consulta os arquivos do TSE uma vez ao abrir; até as 17h fica aguardando e,
 * a partir daí, repete a cada 30 s (pausando com a aba em segundo plano) até
 * todos os arquivos indicarem totalização final.
 */
export function useAoVivo<T extends { final: boolean } = ResultadoAoVivo>(
  urls: Record<string, string>,
  { intervalo = INTERVALO_MS, parse = parseResultado as unknown as (j: any) => T } = {},
): AoVivo<T> {
  const chave = JSON.stringify(urls)
  const [estado, setEstado] = useState<Omit<AoVivo<T>, 'atualizar'> & { chave: string }>({ chave, dados: {}, carregado: false, atualizadoEm: null, proxima: null, fase: 'aguardando', erro: null })
  const [rodada, setRodada] = useState(0)

  useEffect(() => {
    const alvos: Record<string, string> = JSON.parse(chave)
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let pendente = false

    async function carregar() {
      clearTimeout(timer)
      const pares = await emLotes(Object.entries(alvos), 32, async ([k, u]) => [k, await buscar(u, parse)] as const)
      if (!vivo) return
      const falhas = pares.filter(([, r]) => r === undefined).length
      const existentes = pares.map(([, r]) => r).filter((r): r is T => !!r)
      const agora = Date.now()
      const final = existentes.length > 0 && existentes.every((r) => r.final)
      const fase: Fase = final ? 'final' : agora < INICIO_APURACAO ? 'aguardando' : agora > FIM_APURACAO ? 'encerrado' : 'ao-vivo'
      const espera = fase === 'aguardando' ? INICIO_APURACAO - agora : fase === 'ao-vivo' ? intervalo : null
      setEstado((prev) => {
        // falha temporária mantém o último valor recebido daquele arquivo
        const anteriores = prev.chave === chave ? prev.dados : {}
        const dados: Record<string, T | null> = {}
        for (const [k, r] of pares) {
          if (r !== undefined) dados[k] = r
          else if (k in anteriores) dados[k] = anteriores[k]
        }
        return {
          chave,
          dados,
          carregado: true,
          atualizadoEm: new Date(),
          proxima: espera == null ? null : agora + espera,
          fase,
          erro: falhas ? `${falhas} arquivo(s) do TSE não responderam; mantendo os últimos dados recebidos.` : null,
        }
      })
      if (espera == null) return
      timer = setTimeout(() => {
        if (document.hidden) {
          pendente = true
          setEstado((prev) => ({ ...prev, proxima: null }))
        } else carregar()
      }, espera)
    }

    const aoVoltar = () => {
      if (!document.hidden && pendente) {
        pendente = false
        carregar()
      }
    }
    document.addEventListener('visibilitychange', aoVoltar)
    carregar()
    return () => {
      vivo = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [chave, intervalo, parse, rodada])

  const { chave: chaveEstado, ...resto } = estado
  // trocou o conjunto de arquivos: não mostra dados do conjunto anterior
  const atual = chaveEstado === chave ? resto : { ...resto, dados: {}, carregado: false }
  return { ...atual, atualizar: () => setRodada((n) => n + 1) }
}

/** Re-renderiza a cada `ms` (para contagens regressivas). */
export function useAgora(ms = 1000) {
  const [agora, setAgora] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return agora
}
