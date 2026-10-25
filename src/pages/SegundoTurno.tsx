import { useEffect, useMemo, useRef, useState } from 'react'
import { CORES_CAT, Legend, StackBar } from '../components/Bars'
import { BrazilMap } from '../components/BrazilMap'
import { TipRow } from '../components/Tooltip'
import { Card, Stat } from '../components/Ui'
import { useData, useJSON } from '../data/DataContext'
import { UFS } from '../data/types'
import { num, pct, share, titulo } from '../lib/format'
import {
  INICIO_APURACAO,
  INTERVALO_MS,
  parseSecao,
  URL_MUNICIPIOS,
  urlGovernador,
  urlPresidente,
  urlPresidenteMun,
  urlSecoes,
  urlsSecoes,
  useAgora,
  useAoVivo,
  type AoVivo,
  type CandAoVivo,
  type MunicipiosTSE,
  type ResultadoAoVivo,
  type SecoesTSE,
} from '../lib/aoVivo'

const ABR_PRESIDENTE = [...Object.keys(UFS), 'ZZ']

export default function SegundoTurno() {
  const { meta, candidatos, porSq } = useData()

  // UFs com 2º turno para governador: pela situação do 1º turno ou, depois da totalização, pelo resumo do 2º turno
  const ufsGov = useMemo(() => {
    const s = new Set(candidatos.filter((c) => c.cargo === 3 && c.situacao === '2º TURNO').map((c) => c.uf))
    Object.keys(meta.segundoTurno?.governador ?? {}).forEach((uf) => s.add(uf))
    return [...s].sort()
  }, [candidatos, meta])

  const urls = useMemo(() => {
    const u: Record<string, string> = { BR: urlPresidente('br') }
    ABR_PRESIDENTE.forEach((abr) => (u[`P-${abr}`] = urlPresidente(abr)))
    ufsGov.forEach((uf) => (u[`G-${uf}`] = urlGovernador(uf)))
    return u
  }, [ufsGov])

  const vivo = useAoVivo(urls)
  const br = vivo.dados.BR

  // cores fixas pela ordem do 1º turno, para não trocarem quando a liderança muda
  const ordem: Ordem = (cs) => [...cs.slice(0, 2)].sort((a, b) => (porSq.get(b.sq)?.votos ?? 0) - (porSq.get(a.sq)?.votos ?? 0) || a.nr - b.nr)
  const pct1t = (sq: string) => meta.presidente?.br.candidatos.find((c) => c.sq === sq)?.pct

  return (
    <>
      <div className="page-head">
        <div>
          <h1>2º turno — {meta.dataSegundoTurno}</h1>
          <p>
            Apuração em tempo real de Presidente e dos governadores {ufsGov.length ? `(${ufsGov.join(', ')})` : ''}, lida direto da divulgação
            oficial do TSE. A partir das 17h (Brasília) a página se atualiza sozinha a cada 30 segundos.
          </p>
        </div>
        <StatusAoVivo vivo={vivo} />
      </div>

      {vivo.erro && <div className="callout">{vivo.erro}</div>}
      {!vivo.carregado && <div className="loading" style={{ minHeight: 240 }}><div className="spinner" />Consultando o TSE…</div>}

      {br && (
        <>
          <Card title="Presidente da República" sub={<Totalizado r={br} />}>
            <Duelo r={br} ordem={ordem} nota={(c) => (pct1t(c.sq) != null ? `1º turno: ${pct(pct1t(c.sq)!)}` : null)} grande />
          </Card>

          <div className="grid g4">
            <Stat label="Seções totalizadas" value={pct(br.pctTotalizado)} sub={`${num(br.secoesTotalizadas)} de ${num(br.secoes)}`} />
            <Stat label="Comparecimento" value={share(br.comparecimento, br.eleitorado)} sub={`${num(br.comparecimento)} eleitores`} />
            <Stat label="Abstenção" value={share(br.abstencao, br.eleitorado)} sub={`${num(br.abstencao)} eleitores`} />
            <Stat label="Brancos e nulos" value={share(br.brancos + br.nulos, br.comparecimento)} sub={`${num(br.brancos)} brancos · ${num(br.nulos)} nulos`} />
          </div>

          <PresidentePorUF vivo={vivo} br={br} ordem={ordem} />
        </>
      )}

      {ufsGov.length > 0 && vivo.carregado && (
        <>
          <h2 style={{ marginTop: 8 }}>Governadores</h2>
          <div className="grid g3">
            {ufsGov.map((uf) => {
              const r = vivo.dados[`G-${uf}`]
              return (
                <Card key={uf} title={UFS[uf]?.nome ?? uf} sub={r ? <Totalizado r={r} /> : 'Sem dados do TSE ainda.'}>
                  {r && <Duelo r={r} ordem={ordem} />}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function StatusAoVivo({ vivo }: { vivo: AoVivo }) {
  const agora = useAgora()
  const hora = (d: Date | number) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  let texto: string
  if (vivo.fase === 'final') texto = 'Totalização concluída'
  else if (vivo.fase === 'encerrado') texto = 'Atualização automática encerrada'
  else if (vivo.fase === 'aguardando') texto = `Apuração começa às 17h · em ${duracao(INICIO_APURACAO - agora)}`
  else if (vivo.proxima) texto = `Ao vivo · próxima em ${Math.max(0, Math.ceil((vivo.proxima - agora) / 1000))}s`
  else texto = 'Ao vivo · pausado em segundo plano'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span className={`live ${vivo.fase}`}>
        <i aria-hidden />
        {texto}
      </span>
      <span className="tiny">
        {vivo.atualizadoEm && `Consultado às ${hora(vivo.atualizadoEm)} · `}
        <button className="link-btn" onClick={vivo.atualizar}>Atualizar agora</button>
      </span>
    </div>
  )
}

function duracao(ms: number) {
  const min = Math.max(0, Math.ceil(ms / 60_000))
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`
}

function Totalizado({ r }: { r: ResultadoAoVivo }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span>
        {pct(r.pctTotalizado)} das seções totalizadas{r.atualizacao && ` · TSE ${r.atualizacao}`}
        {r.final && ' · totalização final'}
      </span>
      <span className="prog" style={{ display: 'block', maxWidth: 320 }}>
        <span style={{ display: 'block', height: '100%', width: `${r.pctTotalizado}%`, background: 'var(--accent)' }} />
      </span>
    </span>
  )
}

/** Os dois finalistas na ordem do 1º turno — define a cor (CORES_CAT) e o lado de cada um. */
type Ordem = (cs: CandAoVivo[]) => CandAoVivo[]

/** Placar de dois candidatos: nomes e % nas pontas e barra dividida com marca dos 50%. */
function Duelo({ r, ordem, nota, grande }: { r: ResultadoAoVivo; ordem: Ordem; nota?: (c: CandAoVivo) => string | null; grande?: boolean }) {
  const [a, b] = ordem(r.candidatos)
  if (!a || !b) return null
  const lado = (c: CandAoVivo, i: number) => (
    <div style={{ textAlign: i ? 'right' : 'left' }}>
      <div className={grande ? 'duelo-nome g' : 'duelo-nome'}>
        {c.urna} <span className="tiny">{c.partido}</span>
        {c.eleito && <span className="badge eleito" style={{ marginLeft: 6 }}>Eleito</span>}
      </div>
      <div className={grande ? 'duelo-pct g' : 'duelo-pct'} style={{ color: CORES_CAT[i] }}>
        {pct(c.pct)}
      </div>
      <div className="tiny">
        {num(c.votos)} votos{nota?.(c) ? ` · ${nota(c)}` : ''}
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        {lado(a, 0)}
        {lado(b, 1)}
      </div>
      <div className="duelo-barra">
        {r.validos > 0 ? (
          <StackBar height={grande ? 30 : 18} segs={[a, b].map((c, i) => ({ key: c.urna, n: c.votos, cor: CORES_CAT[i] }))} />
        ) : (
          <div className="bar-h" style={{ height: grande ? 30 : 18, background: 'var(--surface-2)' }} />
        )}
        <i className="meio" aria-hidden />
      </div>
    </div>
  )
}

function PresidentePorUF({ vivo, br, ordem }: { vivo: AoVivo; br: ResultadoAoVivo; ordem: Ordem }) {
  const [sel, setSel] = useState<string | null>(null)
  const detalhe = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (sel) detalhe.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sel])

  const [a, b] = ordem(br.candidatos)
  if (!a || !b) return null
  const uf = (abr: string) => vivo.dados[`P-${abr}`]

  return (
    <>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Quem lidera em cada estado" sub="Cor do candidato à frente; mais intensa quanto maior a vantagem (até 2, 5, 10, 20 p.p. ou mais). Clique num estado para ver os municípios e as seções.">
          <BrazilMap
            nivel="uf"
            labels
            fill={(abr) => corLider(uf(abr), a.sq)}
            onSelect={setSel}
            selected={sel}
            tooltip={(abr) => {
              const r = uf(abr)
              return (
                <>
                  <div className="t">{UFS[abr]?.nome}</div>
                  {[a, b].map((c, i) => <TipRow key={c.sq} color={CORES_CAT[i]} label={c.urna} value={pct(deCand(r, c.sq)?.pct ?? 0)} />)}
                  <div className="tiny">{r ? `${pct(r.pctTotalizado)} das seções totalizadas` : 'Sem dados'}</div>
                </>
              )
            }}
          />
          <Legend items={[a, b].map((c, i) => ({ key: c.urna, cor: CORES_CAT[i] }))} />
        </Card>
        <Card title="Resultado por UF">
          <div className="table-wrap" style={{ maxHeight: 620 }}>
            <table>
              <thead>
                <tr>
                  <th>UF</th>
                  <th className="num">Totalizado</th>
                  <th className="num">{a.urna}</th>
                  <th className="num">{b.urna}</th>
                  <th className="num">Válidos</th>
                </tr>
              </thead>
              <tbody>
                {ABR_PRESIDENTE.map((abr) => {
                  const r = uf(abr)
                  const lider = r?.validos ? r.candidatos[0]?.sq : null
                  return (
                    <tr key={abr} className={UFS[abr] ? 'clickable' : undefined} onClick={() => UFS[abr] && setSel(abr)}>
                      <td>{UFS[abr]?.nome ?? 'Exterior'}</td>
                      <td className="num">{r ? pct(r.pctTotalizado) : '—'}</td>
                      {[a, b].map((c) => (
                        <td key={c.sq} className="num" style={{ fontWeight: lider === c.sq ? 700 : 400 }}>
                          {r ? pct(deCand(r, c.sq)?.pct ?? 0) : '—'}
                        </td>
                      ))}
                      <td className="num">{r ? num(r.validos) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {sel && (
        <div ref={detalhe} style={{ scrollMarginTop: 72 }}>
          <MunicipiosAoVivo key={sel} uf={sel} a={a} b={b} onFechar={() => setSel(null)} />
        </div>
      )}
    </>
  )
}

/** Cor do líder, mais intensa quanto maior a vantagem; `a` é o 1º colocado do 1º turno (CORES_CAT[0]). */
function corLider(r: ResultadoAoVivo | null | undefined, a: string) {
  if (!r?.validos) return undefined
  const [l, s] = r.candidatos
  const margem = l.pct - (s?.pct ?? 0)
  const forca = margem < 2 ? 30 : margem < 5 ? 50 : margem < 10 ? 72 : margem < 20 ? 88 : 100
  return `color-mix(in srgb, ${CORES_CAT[l.sq === a ? 0 : 1]} ${forca}%, var(--map-empty))`
}

const deCand = (r: ResultadoAoVivo | null | undefined, sq: string) => r?.candidatos.find((c) => c.sq === sq)

/** Municípios de uma UF ao vivo (atualiza a cada 60 s) e, ao clicar, zonas e seções do município. */
function MunicipiosAoVivo({ uf, a, b, onFechar }: { uf: string; a: CandAoVivo; b: CandAoVivo; onFechar: () => void }) {
  const cfg = useJSON<MunicipiosTSE>(URL_MUNICIPIOS)
  const muns = useMemo(() => cfg.data?.abr.find((x) => x.cd === uf.toLowerCase())?.mu ?? [], [cfg.data, uf])
  const porIbge = useMemo(() => new Map(muns.map((m) => [m.cdi, m])), [muns])
  const urls = useMemo(() => Object.fromEntries(muns.map((m) => [m.cd, urlPresidenteMun(uf, m.cd)])), [muns, uf])
  const vivo = useAoVivo(urls, { intervalo: 2 * INTERVALO_MS })
  const [sel, setSel] = useState<string | null>(null)
  const mun = sel ? porIbge.get(sel) : undefined
  const r = mun ? vivo.dados[mun.cd] : undefined

  const fechar = (
    <button className="btn" onClick={onFechar}>
      Fechar
    </button>
  )
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Card
        title={`Municípios — ${UFS[uf]?.nome ?? uf}`}
        sub={vivo.carregado ? `${num(muns.length)} municípios · atualiza a cada 60 s. Clique num município para ver zonas e seções.` : `Consultando ${num(muns.length)} municípios no TSE…`}
        actions={fechar}
      >
        {cfg.error ? (
          <p className="muted small">Não foi possível carregar a lista de municípios do TSE.</p>
        ) : (
          <BrazilMap
            nivel={uf}
            height={520}
            fill={(ibge) => {
              const m = porIbge.get(ibge)
              return m ? corLider(vivo.dados[m.cd], a.sq) : undefined
            }}
            onSelect={setSel}
            selected={sel}
            tooltip={(ibge) => {
              const m = porIbge.get(ibge)
              const rm = m ? vivo.dados[m.cd] : null
              return (
                <>
                  <div className="t">{m ? titulo(m.nm) : ibge}</div>
                  {[a, b].map((c, i) => <TipRow key={c.sq} color={CORES_CAT[i]} label={c.urna} value={pct(deCand(rm, c.sq)?.pct ?? 0)} />)}
                  <div className="tiny">{rm ? `${pct(rm.pctTotalizado)} das seções totalizadas (${num(rm.secoesTotalizadas)} de ${num(rm.secoes)})` : 'Sem dados'}</div>
                </>
              )
            }}
          />
        )}
        <Legend items={[a, b].map((c, i) => ({ key: c.urna, cor: CORES_CAT[i] }))} />
      </Card>
      {mun ? (
        <Card title={titulo(mun.nm)} sub={r ? <Totalizado r={r} /> : 'Sem dados do TSE ainda.'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {r && <Duelo r={r} ordem={() => [deCand(r, a.sq) ?? { ...a, votos: 0, pct: 0 }, deCand(r, b.sq) ?? { ...b, votos: 0, pct: 0 }]} />}
            {r && (
              <div className="small muted">
                Comparecimento {share(r.comparecimento, r.eleitorado)} · abstenção {share(r.abstencao, r.eleitorado)} · brancos e nulos {share(r.brancos + r.nulos, r.comparecimento)}
              </div>
            )}
            <ZonasSecoes uf={uf} mun={mun.cd} municipio={titulo(mun.nm)} />
          </div>
        </Card>
      ) : (
        <Card title="Zonas e seções">
          <p className="muted small">Clique num município no mapa para ver o resultado, as zonas eleitorais e a situação de cada seção.</p>
        </Card>
      )}
    </div>
  )
}

/** Zonas do município e situação (totalizada ou não) de cada seção da zona escolhida. */
function ZonasSecoes({ uf, mun, municipio }: { uf: string; mun: string; municipio: string }) {
  const cfg = useJSON<SecoesTSE>(urlSecoes(uf))
  const zonas = useMemo(() => cfg.data?.abr.find((x) => x.cd === uf.toLowerCase())?.mu.find((m) => m.cd === mun)?.zon ?? [], [cfg.data, uf, mun])
  const [escolhida, setZona] = useState<string | null>(null)
  const zona = zonas.find((z) => z.cd === escolhida) ?? zonas[0]
  if (cfg.error) return <p className="muted small">Lista de seções indisponível no TSE.</p>
  if (!cfg.data) return <div className="spinner" />
  if (!zona) return <p className="muted small">Nenhuma seção listada para este município.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="filterbar">
        <span className="small muted">Zona</span>
        {zonas.map((z) => (
          <button key={z.cd} className={`chip ${z.cd === zona.cd ? 'on' : ''}`} onClick={() => setZona(z.cd)}>
            {+z.cd} <span className="tiny">{z.sec.length} seções</span>
          </button>
        ))}
      </div>
      <SecoesZona key={zona.cd} uf={uf} mun={mun} municipio={municipio} zona={zona.cd} secoes={zona.sec.map((s) => s.ns)} />
    </div>
  )
}

/** public/data/locais/{UF}.json: locais [nº, nome, endereço, bairro?, lat?, lon?] e, por "mun-zona", seção → índice do local. */
interface LocaisUF {
  locais: [number, string, string, string?, (number | null)?, (number | null)?][]
  secoes: Record<string, Record<string, number>>
}

function linkMapa(l: LocaisUF['locais'][number], municipio: string, uf: string) {
  const [, nome, endereco, , lat, lon] = l
  const q = lat != null && lon != null ? `${lat},${lon}` : `${nome}, ${endereco}, ${municipio} - ${uf}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

function faixas(ns: number[]) {
  const out: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    out.push(j > i ? `${ns[i]}–${ns[j]}` : `${ns[i]}`)
    i = j
  }
  return out.join(', ')
}

function SecoesZona({ uf, mun, municipio, zona, secoes }: { uf: string; mun: string; municipio: string; zona: string; secoes: string[] }) {
  const urls = useMemo(() => urlsSecoes(uf, mun, zona, secoes), [uf, mun, zona, secoes])
  const vivo = useAoVivo(urls, { intervalo: 2 * INTERVALO_MS, parse: parseSecao })
  const loc = useJSON<LocaisUF>(`/data/locais/${uf}.json`)
  const [sel, setSel] = useState<string | null>(null)
  const totalizadas = secoes.filter((s) => vivo.dados[s]?.final).length

  const daZona = loc.data?.secoes[`${+mun}-${+zona}`]
  const localDe = (s: string) => (daZona?.[+s] != null ? daZona[+s] : null)
  // locais da zona com as seções de cada um
  const locais = useMemo(() => {
    const m = new Map<number, number[]>()
    if (daZona) for (const s of secoes) {
      const i = daZona[+s]
      if (i != null) m.set(i, [...(m.get(i) ?? []), +s])
    }
    return [...m].map(([i, ns]) => ({ i, l: loc.data!.locais[i], ns: ns.sort((x, y) => x - y) })).sort((x, y) => x.ns[0] - y.ns[0])
  }, [daZona, secoes, loc.data])

  const localSel = sel ? localDe(sel) : null
  const info = localSel != null ? locais.find((x) => x.i === localSel) : undefined
  const dSel = sel ? vivo.dados[sel] : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="small">
        <b>{num(totalizadas)}</b> de {num(secoes.length)} seções da zona {+zona} totalizadas
        {!vivo.carregado && <span className="tiny"> · consultando…</span>}
      </div>
      <div className="secoes">
        {secoes.map((s) => {
          const d = vivo.dados[s]
          const cls = ['secao', d?.final && 'ok', s === sel && 'sel', s !== sel && localSel != null && localDe(s) === localSel && 'mesmo'].filter(Boolean).join(' ')
          return (
            <button key={s} className={cls} onClick={() => setSel(s === sel ? null : s)} title={`Seção ${+s}: ${d ? d.situacao || 'sem situação' : 'boletim não publicado (aguardando ou seção agregada)'}${d?.recebida ? ` · boletim recebido em ${d.recebida}` : ''}`}>
              {+s}
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><i className="sw secao-sw ok" />Totalizada</span>
        <span><i className="sw secao-sw" />Aguardando ou sem boletim próprio (seção agregada)</span>
        <span className="tiny">Clique numa seção para ver onde ela fica.</span>
      </div>

      {sel && (
        <div className="callout">
          <b>Seção {+sel}</b> · zona {+zona} — {dSel ? dSel.situacao || 'sem situação' : 'boletim não publicado'}
          {dSel?.recebida && ` · boletim recebido em ${dSel.recebida}`}
          {info ? (
            <LocalVotacao l={info.l} ns={info.ns} municipio={municipio} uf={uf} />
          ) : (
            <div className="small muted" style={{ marginTop: 4 }}>{loc.data ? 'Local de votação não encontrado no cadastro do TSE.' : 'Carregando locais de votação…'}</div>
          )}
        </div>
      )}

      {locais.length > 0 && (
        <details>
          <summary className="small" style={{ cursor: 'pointer' }}>
            {num(locais.length)} locais de votação na zona {+zona}
          </summary>
          <ul className="list-reset" style={{ marginTop: 6 }}>
            {locais.map(({ i, l, ns }) => (
              <li key={i} className="person" style={{ cursor: 'pointer', background: i === localSel ? 'var(--accent-soft)' : undefined }} onClick={() => setSel(String(ns[0]).padStart(4, '0'))}>
                <LocalVotacao l={l} ns={ns} municipio={municipio} uf={uf} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function LocalVotacao({ l, ns, municipio, uf }: { l: LocaisUF['locais'][number]; ns: number[]; municipio: string; uf: string }) {
  const [nr, nome, endereco, bairro] = l
  return (
    <div className="small" style={{ marginTop: 4, flex: 1, minWidth: 0 }}>
      <div>
        <b>{titulo(nome)}</b> <span className="tiny">local nº {nr}</span>
      </div>
      <div className="muted">
        {titulo(endereco)}
        {bairro ? ` · ${titulo(bairro)}` : ''} · {municipio}/{uf}
      </div>
      <div className="tiny">
        Seções {faixas(ns)} ·{' '}
        <a href={linkMapa(l, municipio, uf)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          ver no mapa
        </a>
      </div>
    </div>
  )
}
