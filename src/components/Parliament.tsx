import { useMemo } from 'react'
import { useTooltip } from './Tooltip'

export interface Bancada {
  chave: string
  n: number
  cor: string
  detalhe?: string
}

/**
 * Hemiciclo: um assento por eleito, distribuído em fileiras concêntricas,
 * preenchido da esquerda para a direita na ordem das bancadas recebidas.
 */
export function Parliament({ bancadas, total }: { bancadas: Bancada[]; total?: number }) {
  const tip = useTooltip()
  const n = total ?? bancadas.reduce((a, b) => a + b.n, 0)

  const seats = useMemo(() => {
    if (!n) return []
    const rows = Math.max(1, Math.round(Math.sqrt(n / 4.2)))
    const r0 = 0.38
    const radii = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * (i + 0.5)) / rows)
    const sum = radii.reduce((a, b) => a + b, 0)
    let counts = radii.map((r) => Math.round((n * r) / sum))
    counts[counts.length - 1] += n - counts.reduce((a, b) => a + b, 0)
    counts = counts.map((c) => Math.max(c, 1))
    const pts: { x: number; y: number; a: number }[] = []
    radii.forEach((r, i) => {
      const k = counts[i]
      for (let j = 0; j < k; j++) {
        const a = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1)
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a })
      }
    })
    // ordena pelo ângulo para preencher em "fatias" da esquerda à direita
    pts.sort((p, q) => q.a - p.a)
    const size = Math.min(0.9 / rows, (Math.PI * radii[radii.length - 1]) / counts[counts.length - 1]) * 0.42
    return pts.slice(0, n).map((p) => ({ ...p, size }))
  }, [n])

  let idx = 0
  const owner: number[] = []
  bancadas.forEach((b, bi) => {
    for (let i = 0; i < b.n; i++) owner[idx++] = bi
  })

  return (
    <div>
      <svg viewBox="-1.05 -1.05 2.1 1.12" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Composição por bancada">
        <g transform="scale(1,-1)">
          {seats.map((s, i) => {
            const b = bancadas[owner[i]]
            return (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.size}
                fill={b ? b.cor : 'var(--map-empty)'}
                onMouseMove={(e) => b && tip.show(e, <><div className="t">{b.chave}</div>{b.n} cadeira{b.n > 1 ? 's' : ''}{b.detalhe ? <div className="tiny">{b.detalhe}</div> : null}</>)}
                onMouseLeave={tip.hide}
              />
            )
          })}
        </g>
        <text x="0" y="-0.04" textAnchor="middle" fontSize="0.2" fontWeight="700" fill="var(--text)">
          {bancadas.reduce((a, b) => a + b.n, 0)}
        </text>
        <text x="0" y="0.05" textAnchor="middle" fontSize="0.065" fill="var(--text-2)">
          {total ? `de ${total} cadeiras` : 'cadeiras'}
        </text>
      </svg>
      {tip.node}
    </div>
  )
}
