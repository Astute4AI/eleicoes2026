import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { useMemo, useState, type ReactNode } from 'react'
import { useJSON } from '../data/DataContext'
import { useTooltip } from './Tooltip'

interface Feature {
  type: 'Feature'
  id: string
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}
interface FC {
  type: 'FeatureCollection'
  features: Feature[]
}

interface Props {
  /** 'uf' para o Brasil por estados, ou a sigla da UF para os municípios */
  nivel: 'uf' | string
  /** cor de preenchimento por id (sigla da UF ou código IBGE do município) */
  fill: (id: string) => string | undefined
  tooltip?: (id: string) => ReactNode
  onSelect?: (id: string) => void
  selected?: string | null
  /** rótulos sobre as UFs */
  labels?: boolean
  height?: number
}

const W = 600

export function BrazilMap({ nivel, fill, tooltip, onSelect, selected, labels, height = 560 }: Props) {
  const url = nivel === 'uf' ? '/geo/uf.json' : `/geo/mun/${nivel}.json`
  const { data, loading, error } = useJSON<FC>(url)
  const [hover, setHover] = useState<string | null>(null)
  const tip = useTooltip()

  const geo = useMemo(() => {
    if (!data) return null
    const proj = geoMercator().fitSize([W, height], data as unknown as GeoPermissibleObjects)
    const path = geoPath(proj)
    return data.features.map((f) => ({
      id: String(f.id),
      d: path(f as unknown as GeoPermissibleObjects) ?? '',
      c: path.centroid(f as unknown as GeoPermissibleObjects),
    }))
  }, [data, height])

  if (error) return <div className="muted small">Erro ao carregar o mapa.</div>
  if (loading || !geo) return <div className="loading" style={{ minHeight: height / 1.6 }}><div className="spinner" /></div>

  // feições selecionada/hover desenhadas por último para o contorno não ficar escondido
  const ordem = [...geo].sort((a, b) => rank(a.id) - rank(b.id))
  function rank(id: string) {
    return id === selected ? 2 : id === hover ? 1 : 0
  }

  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Mapa">
        {ordem.map((g) => (
          <path
            key={g.id}
            d={g.d}
            fill={fill(g.id) ?? 'var(--map-empty)'}
            className={g.id === selected ? 'sel' : g.id === hover ? 'hover' : undefined}
            style={{ cursor: onSelect ? 'pointer' : undefined }}
            onMouseMove={(e) => {
              setHover(g.id)
              if (tooltip) tip.show(e, tooltip(g.id))
            }}
            onMouseLeave={() => {
              setHover(null)
              tip.hide()
            }}
            onClick={() => onSelect?.(g.id)}
          />
        ))}
        {labels &&
          geo.map((g) => (
            <text key={g.id} x={g.c[0]} y={g.c[1]} textAnchor="middle" dominantBaseline="middle">
              {g.id}
            </text>
          ))}
      </svg>
      {tip.node}
    </div>
  )
}

/** Escala sequencial discreta (7 passos do token --seq-*). */
export function seqColor(v: number | null | undefined, min: number, max: number) {
  if (v == null || Number.isNaN(v)) return undefined
  const t = max > min ? (v - min) / (max - min) : 0.5
  const i = Math.max(0, Math.min(6, Math.floor(t * 7)))
  return `var(--seq-${i})`
}

export function SeqLegend({ min, max, fmt }: { min: number; max: number; fmt: (n: number) => string }) {
  return (
    <div className="map-scale">
      <span>{fmt(min)}</span>
      <div className="bar" style={{ background: `linear-gradient(90deg, ${[0, 1, 2, 3, 4, 5, 6].map((i) => `var(--seq-${i})`).join(',')})` }} />
      <span>{fmt(max)}</span>
    </div>
  )
}
