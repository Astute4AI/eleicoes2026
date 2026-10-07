import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { COR_ESPECTRO } from '../config/espectro'
import { useDadosUF, useData, useJSON } from '../data/DataContext'
import { CARGOS, UFS } from '../data/types'
import { num, pct, share, titulo } from '../lib/format'
import { BrazilMap, SeqLegend, seqColor } from './BrazilMap'
import { TipRow } from './Tooltip'
import { Badge } from './Ui'

/** Ficha do candidato, aberta em qualquer página via ?c=<sq>. */
export function CandidatoDrawer() {
  const [params, setParams] = useSearchParams()
  const sq = params.get('c')
  const { porSq, espectroDe, candidatos } = useData()
  const c = sq ? porSq.get(sq) : undefined

  const fechar = () => {
    const n = new URLSearchParams(params)
    n.delete('c')
    setParams(n, { replace: true })
  }
  useEffect(() => {
    if (!c) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const ranking = useMemo(() => {
    if (!c) return null
    const pares = candidatos.filter((x) => x.cargo === c.cargo && x.uf === c.uf && x.apto).sort((a, b) => b.votos - a.votos)
    const partido = pares.filter((x) => x.partido === c.partido)
    return { pos: pares.indexOf(c) + 1, de: pares.length, posPartido: partido.indexOf(c) + 1, dePartido: partido.length }
  }, [c, candidatos])

  if (!c) return null
  const esp = espectroDe(c.partido)
  const proporcional = c.cargo >= 6

  return (
    <>
      <div className="drawer-back" onClick={fechar} />
      <aside className="drawer" role="dialog" aria-label={`Ficha de ${c.urna}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="tiny">
              {CARGOS[c.cargo].nome} · {c.uf === 'BR' ? 'Brasil' : UFS[c.uf].nome}
            </div>
            <h1 style={{ fontSize: '1.4rem', marginTop: 2 }}>{c.urna}</h1>
            <div className="small muted">{titulo(c.nome)}</div>
          </div>
          <button className="icon-btn" onClick={fechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="filterbar">
          <Badge situacao={c.situacao} />
          <span className="badge">
            <i className="sw" style={{ background: COR_ESPECTRO[esp] }} /> {c.partido} · {esp}
          </span>
          <span className="badge">nº {c.nr}</span>
        </div>
        <div className="card kpi-inline">
          <div className="stat">
            <div className="label">Votos</div>
            <div className="value" style={{ fontSize: '1.5rem' }}>{num(c.votos)}</div>
          </div>
          <div className="stat">
            <div className="label">% válidos nominais</div>
            <div className="value" style={{ fontSize: '1.5rem' }}>{pct(c.pct)}</div>
          </div>
          {ranking && ranking.pos > 0 && (
            <div className="stat">
              <div className="label">Posição</div>
              <div className="value" style={{ fontSize: '1.5rem' }}>{ranking.pos}º</div>
              <div className="sub">de {num(ranking.de)} · {ranking.posPartido}º no {c.partido}</div>
            </div>
          )}
        </div>
        <dl className="dl card">
          <dt>Situação TSE</dt>
          <dd>{c.situacaoDetalhe ? titulo(c.situacaoDetalhe) : '—'}</dd>
          <dt>Gênero</dt>
          <dd>{c.genero ? titulo(c.genero) : '—'}</dd>
          <dt>Cor/raça</dt>
          <dd>{c.raca ? titulo(c.raca) : '—'}</dd>
          <dt>Idade</dt>
          <dd>{c.idade != null ? `${c.idade} anos` : '—'}</dd>
          <dt>Escolaridade</dt>
          <dd>{c.instrucao ? titulo(c.instrucao) : '—'}</dd>
          <dt>Ocupação</dt>
          <dd>{c.ocupacao ? titulo(c.ocupacao) : '—'}</dd>
          <dt>Estado civil</dt>
          <dd>{c.estadoCivil ? titulo(c.estadoCivil) : '—'}</dd>
          <dt>Federação</dt>
          <dd>{c.federacao ? titulo(c.federacao) : '—'}</dd>
          <dt>Coligação</dt>
          <dd style={{ whiteSpace: 'normal' }}>{c.coligacao ? `${titulo(c.coligacao)}${c.composicao ? ` (${c.composicao})` : ''}` : '—'}</dd>
        </dl>
        {c.uf !== 'BR' && c.votos > 0 && (proporcional ? <VotosProporcional sq={c.sq} uf={c.uf} cargo={c.cargo} /> : <VotosMajoritario sq={c.sq} uf={c.uf} cargo={c.cargo} />)}
      </aside>
    </>
  )
}

function MapaVotos({ uf, porIbge, total }: { uf: string; porIbge: Map<string, { nome: string; v: number; t: number }>; total: number }) {
  const maxShare = Math.max(0.0001, ...[...porIbge.values()].map((x) => (x.t ? x.v / x.t : 0)))
  const top = [...porIbge.values()].sort((a, b) => b.v - a.v).slice(0, 10)
  return (
    <div className="card">
      <h2 style={{ marginBottom: 10 }}>Votação por município</h2>
      <BrazilMap
        nivel={uf}
        height={420}
        fill={(id) => {
          const x = porIbge.get(id)
          return x && x.v ? seqColor(x.t ? x.v / x.t : 0, 0, maxShare) : undefined
        }}
        tooltip={(id) => {
          const x = porIbge.get(id)
          return x ? (
            <>
              <div className="t">{x.nome}</div>
              <TipRow label="Votos" value={num(x.v)} />
              <TipRow label="% do município" value={share(x.v, x.t)} />
              <TipRow label="% da votação total" value={share(x.v, total)} />
            </>
          ) : (
            'Sem votos'
          )
        }}
      />
      <SeqLegend min={0} max={maxShare} fmt={(n) => pct(n * 100)} />
      <h3 style={{ margin: '14px 0 6px' }}>Municípios com mais votos</h3>
      <table>
        <tbody>
          {top.map((m) => (
            <tr key={m.nome}>
              <td>{m.nome}</td>
              <td className="num">{num(m.v)}</td>
              <td className="num tiny">{share(m.v, total)} do total</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VotosProporcional({ sq, uf, cargo }: { sq: string; uf: string; cargo: number }) {
  const { data: ufd } = useDadosUF(uf)
  const { data: votos } = useJSON<Record<string, number[]>>(`/data/votos/${uf}-${cargo}.json`)
  const porIbge = useMemo(() => {
    const m = new Map<string, { nome: string; v: number; t: number }>()
    if (!ufd || !votos) return m
    const tot = ufd.cargos[cargo as 6]?.total ?? []
    ufd.municipios.forEach(([, ibge, nome], i) => m.set(ibge, { nome, v: 0, t: tot[i] ?? 0 }))
    const arr = votos[sq] ?? []
    for (let i = 0; i < arr.length; i += 2) {
      const mun = ufd.municipios[arr[i]]
      if (mun) m.get(mun[1])!.v = arr[i + 1]
    }
    return m
  }, [ufd, votos, sq, cargo])
  if (!ufd || !votos) return <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
  return <MapaVotos uf={uf} porIbge={porIbge} total={[...porIbge.values()].reduce((a, b) => a + b.v, 0)} />
}

function VotosMajoritario({ sq, uf, cargo }: { sq: string; uf: string; cargo: number }) {
  const { data: ufd } = useDadosUF(uf)
  const porIbge = useMemo(() => {
    const m = new Map<string, { nome: string; v: number; t: number }>()
    const g = ufd?.cargos[cargo as 3]
    if (!ufd || !g) return m
    const arr = g.cand?.[sq] ?? []
    ufd.municipios.forEach(([, ibge, nome], i) => m.set(ibge, { nome, v: arr[i] ?? 0, t: g.total[i] ?? 0 }))
    return m
  }, [ufd, sq, cargo])
  if (!ufd) return <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
  return <MapaVotos uf={uf} porIbge={porIbge} total={[...porIbge.values()].reduce((a, b) => a + b.v, 0)} />
}
