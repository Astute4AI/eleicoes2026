import type { ReactNode } from 'react'
import { num, pct } from '../lib/format'
import { TipRow, useTooltip } from './Tooltip'

export interface Seg {
  key: string
  n: number
  cor: string
}
export interface BarRow {
  chave: string
  label?: ReactNode
  segs: Seg[]
  /** valor exibido à direita (padrão: soma dos segmentos) */
  valor?: string
  nota?: string
}

/**
 * Barras horizontais (simples ou empilhadas), em HTML, com rótulo à esquerda,
 * valor direto à direita, 2px de respiro entre segmentos e tooltip por linha.
 */
export function HBars({
  rows,
  modo = 'abs',
  onClick,
  labelWidth = 150,
  fmt = num,
  selected,
}: {
  rows: BarRow[]
  /** 'abs' = comprimento proporcional ao total; 'pct' = cada barra soma 100% */
  modo?: 'abs' | 'pct'
  onClick?: (chave: string) => void
  labelWidth?: number
  fmt?: (n: number) => string
  selected?: string[]
}) {
  const tip = useTooltip()
  const totais = rows.map((r) => r.segs.reduce((a, s) => a + s.n, 0))
  const max = Math.max(1, ...totais)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => {
        const tot = totais[i]
        const w = modo === 'pct' ? 100 : (tot / max) * 100
        const on = selected?.includes(r.chave)
        return (
          <div
            key={r.chave}
            style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px 1fr auto`, alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : undefined, opacity: selected?.length && !on ? 0.45 : 1 }}
            onClick={() => onClick?.(r.chave)}
            onMouseMove={(e) =>
              tip.show(
                e,
                <>
                  <div className="t">{r.label ?? r.chave}</div>
                  {r.segs.length > 1
                    ? r.segs.filter((s) => s.n).map((s) => <TipRow key={s.key} color={s.cor} label={s.key} value={`${fmt(s.n)} (${pct((s.n / (tot || 1)) * 100)})`} />)
                    : <TipRow label="Total" value={fmt(tot)} />}
                  {r.nota && <div className="tiny" style={{ marginTop: 4 }}>{r.nota}</div>}
                </>,
              )
            }
            onMouseLeave={tip.hide}
          >
            <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: on ? 700 : 500 }} title={typeof r.label === 'string' ? r.label : r.chave}>
              {r.label ?? r.chave}
            </div>
            <div style={{ height: 18, display: 'flex', gap: 2 }}>
              {r.segs.map((s, j) =>
                s.n > 0 ? (
                  <div
                    key={s.key}
                    style={{
                      width: `${(s.n / (tot || 1)) * w}%`,
                      minWidth: 2,
                      background: s.cor,
                      borderRadius: j === r.segs.length - 1 || r.segs.slice(j + 1).every((x) => !x.n) ? '0 4px 4px 0' : 0,
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="small" style={{ minWidth: 48, textAlign: 'right', color: 'var(--text-2)' }}>
              {r.valor ?? fmt(tot)}
            </div>
          </div>
        )
      })}
      {tip.node}
    </div>
  )
}

/** Barra única 100% empilhada, com rótulos diretos nos segmentos largos. */
export function StackBar({ segs, height = 28, fmt = num }: { segs: Seg[]; height?: number; fmt?: (n: number) => string }) {
  const tip = useTooltip()
  const tot = segs.reduce((a, s) => a + s.n, 0) || 1
  return (
    <>
      <div className="bar-h" style={{ height }}>
        {segs.map((s) =>
          s.n > 0 ? (
            <div
              key={s.key}
              style={{ flex: s.n, background: s.cor }}
              onMouseMove={(e) => tip.show(e, <TipRow color={s.cor} label={s.key} value={`${fmt(s.n)} · ${pct((s.n / tot) * 100)}`} />)}
              onMouseLeave={tip.hide}
            />
          ) : null,
        )}
      </div>
      {tip.node}
    </>
  )
}

export function Legend({ items }: { items: { key: string; cor: string; n?: number }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.key}>
          <i className="sw" style={{ background: i.cor }} />
          {i.key}
          {i.n != null && <b style={{ color: 'var(--text)' }}>{num(i.n)}</b>}
        </span>
      ))}
    </div>
  )
}

export const CORES_CAT = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)']
export const COR_OUTROS = 'var(--s-outros)'
