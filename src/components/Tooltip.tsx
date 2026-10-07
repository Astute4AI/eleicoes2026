import { useState, type ReactNode } from 'react'

export interface TipState {
  x: number
  y: number
  content: ReactNode
}

/** Tooltip flutuante que segue o ponteiro (fora do fluxo, sem cortar no container). */
export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = (e: { clientX: number; clientY: number }, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content })
  const hide = () => setTip(null)
  const node = tip ? <FloatingTip {...tip} /> : null
  return { show, hide, node }
}

function FloatingTip({ x, y, content }: TipState) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200
  const left = x + 300 > w ? x - 290 : x + 14
  return (
    <div className="tooltip" style={{ left, top: y + 14 }}>
      {content}
    </div>
  )
}

export function TipRow({ color, label, value }: { color?: string; label: ReactNode; value: ReactNode }) {
  return (
    <div className="row">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {color && <i className="sw" style={{ background: color }} />}
        {label}
      </span>
      <b>{value}</b>
    </div>
  )
}
