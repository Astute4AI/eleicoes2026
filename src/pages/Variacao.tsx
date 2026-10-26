import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { useMemo, useState } from 'react'
import { CORES_CAT } from '../components/Bars'
import { TipRow, useTooltip } from '../components/Tooltip'
import { Card, Stat } from '../components/Ui'
import { useJSON } from '../data/DataContext'
import { UFS } from '../data/types'
import { compact, num, pct } from '../lib/format'

/** public/data/variacao.json — linhas por UF: [id, nome, lat, lon, a1, a2, b1, b2, válidos1, válidos2]. */
interface VariacaoJSON {
  nivel: 'zona' | 'municipio'
  candidatos: { sq: string; nr: number; urna: string; partido: string }[]
  fonte: string
  uf: Record<string, [number, string, number, number, number, number, number, number, number, number][]>
}

interface Unidade {
  chave: string
  uf: string
  nome: string
  lat: number
  lon: number
  v1: number
  v2: number
  pct1: number
  pct2: number
  /** votos ganhos (+) ou perdidos (−) do 1º para o 2º turno */
  delta: number
  /** variação da participação nos votos válidos, em pontos percentuais */
  dpp: number
}

type Medida = 'votos' | 'pp'

const COR_GANHO = 'var(--s3)'
const COR_PERDA = 'var(--s8)'
const sinal = (n: number, fmt: (n: number) => string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`
const fmtPP = (n: number) => `${sinal(n, (x) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }))} p.p.`

export default function Variacao() {
  const { data, loading, error } = useJSON<VariacaoJSON>('/data/variacao.json')
  const [ci, setCi] = useState(0)
  const [medida, setMedida] = useState<Medida>('votos')
  const [uf, setUf] = useState<string | null>(null)

  const unidades = useMemo<Unidade[]>(() => {
    if (!data) return []
    return Object.entries(data.uf)
      .filter(([sg]) => !uf || sg === uf)
      .flatMap(([sg, linhas]) =>
        linhas.map(([id, nome, lat, lon, a1, a2, b1, b2, val1, val2]) => {
          const [v1, v2] = ci === 0 ? [a1, a2] : [b1, b2]
          const pct1 = val1 ? (v1 / val1) * 100 : 0
          const pct2 = val2 ? (v2 / val2) * 100 : 0
          return { chave: `${sg}-${id}`, uf: sg, nome, lat, lon, v1, v2, pct1, pct2, delta: v2 - v1, dpp: pct2 - pct1 }
        }),
      )
  }, [data, ci, uf])

  if (error) return <Card title="Variação de votos">Não foi possível carregar os dados de variação.</Card>
  if (loading || !data) return <div className="loading"><div className="spinner" /></div>

  const cand = data.candidatos[ci]
  const porZona = data.nivel === 'zona'
  const unidade = porZona ? 'zona eleitoral' : 'município'
  const valor = (u: Unidade) => (medida === 'votos' ? u.delta : u.dpp)
  const fmtValor = (n: number) => (medida === 'votos' ? `${sinal(n, num)} votos` : fmtPP(n))

  const tot = (k: 'v1' | 'v2') => unidades.reduce((s, u) => s + u[k], 0)
  const [t1, t2] = [tot('v1'), tot('v2')]
  const ganharam = unidades.filter((u) => valor(u) > 0).length
  const perderam = unidades.filter((u) => valor(u) < 0).length
  const ranking = [...unidades].sort((x, y) => Math.abs(valor(y)) - Math.abs(valor(x))).slice(0, 100)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Variação de votos do 1º para o 2º turno</h1>
          <p>
            Quanto cada finalista a Presidente ganhou ou perdeu em cada {unidade}
            {uf ? ` de ${UFS[uf]?.nome}` : ''}. Círculos verdes = ganhou, vermelhos = perdeu; a área é proporcional à variação.
            {!porZona && ' Por enquanto os dados são por município: a visão por zona eleitoral entra automaticamente quando o TSE publicar os boletins de urna do 2º turno.'}
          </p>
        </div>
      </div>

      <div className="filterbar">
        <div className="seg">
          {data.candidatos.map((c, i) => (
            <button key={c.sq} className={i === ci ? 'on' : ''} onClick={() => setCi(i)}>
              <i className="sw" style={{ background: CORES_CAT[i], marginRight: 6 }} />
              {c.urna}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={medida === 'votos' ? 'on' : ''} onClick={() => setMedida('votos')}>Votos</button>
          <button className={medida === 'pp' ? 'on' : ''} onClick={() => setMedida('pp')}>% dos válidos (p.p.)</button>
        </div>
        <select value={uf ?? ''} onChange={(e) => setUf(e.target.value || null)} aria-label="Estado">
          <option value="">Brasil</option>
          {Object.keys(UFS).map((sg) => (
            <option key={sg} value={sg}>{UFS[sg].nome}</option>
          ))}
        </select>
      </div>

      <div className="grid g4">
        <Stat label={`${cand.urna} no 1º turno`} value={compact(t1)} sub={`${num(t1)} votos`} />
        <Stat label="No 2º turno" value={compact(t2)} sub={`${num(t2)} votos`} />
        <Stat label="Variação" value={sinal(t2 - t1, compact)} sub={t1 ? `${sinal(((t2 - t1) / t1) * 100, (x) => pct(x))} sobre o 1º turno` : undefined} />
        <Stat label={`${porZona ? 'Zonas' : 'Municípios'} em que ${medida === 'votos' ? 'ganhou votos' : 'subiu'}`} value={num(ganharam)} sub={`${num(perderam)} em que ${medida === 'votos' ? 'perdeu' : 'caiu'} · ${num(unidades.length)} no total`} />
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card
          title={`${cand.urna}: ${medida === 'votos' ? 'votos ganhos e perdidos' : 'variação da participação'} por ${unidade}`}
          sub={uf ? 'Contorno dos municípios ao fundo.' : 'Clique num estado para aproximar.'}
          actions={uf && <button className="btn" onClick={() => setUf(null)}>Brasil</button>}
        >
          <MapaVariacao uf={uf} unidades={unidades} valor={valor} fmt={fmtValor} onUF={setUf} />
        </Card>
        <Card title={`Maiores variações${uf ? ` — ${UFS[uf]?.nome}` : ''}`} sub={`As 100 ${porZona ? 'zonas' : 'cidades'} com maior variação ${medida === 'votos' ? 'em votos' : 'em pontos percentuais'}, para mais ou para menos. Fonte: ${data.fonte}.`}>
          <div className="table-wrap" style={{ maxHeight: 640 }}>
            <table>
              <thead>
                <tr>
                  <th>{porZona ? 'Zona' : 'Município'}</th>
                  <th className="num">1º turno</th>
                  <th className="num">2º turno</th>
                  <th className="num">Variação</th>
                  <th className="num">Var. % válidos</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((u) => (
                  <tr key={u.chave}>
                    <td title={u.nome}>
                      {u.nome.length > 26 ? `${u.nome.slice(0, 25)}…` : u.nome} <span className="tiny">{u.uf}</span>
                    </td>
                    <td className="num">{num(u.v1)}</td>
                    <td className="num">{num(u.v2)}</td>
                    <td className="num" style={{ color: u.delta >= 0 ? 'var(--text)' : COR_PERDA, fontWeight: medida === 'votos' ? 600 : 400 }}>{sinal(u.delta, num)}</td>
                    <td className="num" title={`${pct(u.pct1)} → ${pct(u.pct2)} dos válidos`} style={{ color: u.dpp >= 0 ? 'var(--text)' : COR_PERDA, fontWeight: medida === 'pp' ? 600 : 400 }}>
                      {fmtPP(u.dpp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

interface Feature {
  type: 'Feature'
  id: string
  geometry: unknown
}

const W = 600

/** Mapa de símbolos proporcionais: um círculo por zona/município sobre o contorno do Brasil ou da UF. */
function MapaVariacao({ uf, unidades, valor, fmt, onUF }: { uf: string | null; unidades: Unidade[]; valor: (u: Unidade) => number; fmt: (n: number) => string; onUF: (uf: string) => void }) {
  const H = uf ? 520 : 560
  const geo = useJSON<{ type: 'FeatureCollection'; features: Feature[] }>(uf ? `/geo/mun/${uf}.json` : '/geo/uf.json')
  const tip = useTooltip()

  const desenho = useMemo(() => {
    if (!geo.data) return null
    const proj = geoMercator().fitSize([W, H], geo.data as unknown as GeoPermissibleObjects)
    const path = geoPath(proj)
    return { proj, formas: geo.data.features.map((f) => ({ id: String(f.id), d: path(f as unknown as GeoPermissibleObjects) ?? '' })) }
  }, [geo.data, H])

  const pontos = useMemo(() => {
    if (!desenho) return []
    const max = Math.max(1, ...unidades.map((u) => Math.abs(valor(u))))
    const rMax = uf ? 14 : 16
    return unidades
      .filter((u) => valor(u) !== 0)
      .map((u) => {
        const [x, y] = desenho.proj([u.lon, u.lat]) ?? [0, 0]
        return { u, x, y, r: Math.max(1.2, rMax * Math.sqrt(Math.abs(valor(u)) / max)), v: valor(u) }
      })
      .sort((a, b) => b.r - a.r)
  }, [desenho, unidades, valor, uf])

  if (geo.error) return <div className="muted small">Erro ao carregar o mapa.</div>
  if (!desenho) return <div className="loading" style={{ minHeight: H / 1.6 }}><div className="spinner" /></div>

  const max = Math.max(1, ...pontos.map((p) => Math.abs(p.v)))
  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa de variação de votos">
        {desenho.formas.map((f) => (
          <path key={f.id} d={f.d} fill="var(--map-empty)" style={{ cursor: uf ? undefined : 'pointer' }} onClick={() => !uf && onUF(f.id)} />
        ))}
        {pontos.map(({ u, x, y, r, v }) => (
          <circle
            key={u.chave}
            cx={x}
            cy={y}
            r={r}
            className="bolha"
            fill={v > 0 ? COR_GANHO : COR_PERDA}
            onMouseMove={(e) =>
              tip.show(
                e,
                <>
                  <div className="t">{u.nome}</div>
                  <TipRow label="1º turno" value={`${num(u.v1)} (${pct(u.pct1)})`} />
                  <TipRow label="2º turno" value={`${num(u.v2)} (${pct(u.pct2)})`} />
                  <TipRow color={v > 0 ? COR_GANHO : COR_PERDA} label="Variação" value={`${sinal(u.delta, num)} · ${fmtPP(u.dpp)}`} />
                </>,
              )
            }
            onMouseLeave={tip.hide}
            onClick={() => !uf && onUF(u.uf)}
          />
        ))}
      </svg>
      {tip.node}
      <div className="legend" style={{ marginTop: 8, alignItems: 'center' }}>
        <span><i className="sw" style={{ background: COR_GANHO, borderRadius: '50%' }} />Ganhou</span>
        <span><i className="sw" style={{ background: COR_PERDA, borderRadius: '50%' }} />Perdeu</span>
        <span className="tiny">Maior círculo: {fmt(max)}</span>
      </div>
    </div>
  )
}
