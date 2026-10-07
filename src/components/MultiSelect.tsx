import { useEffect, useRef, useState } from 'react'
import { normaliza, num } from '../lib/format'

export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { chave: string; n: number }[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const set = new Set(value)
  const filtradas = q ? options.filter((o) => normaliza(o.chave).includes(normaliza(q))) : options
  const toggle = (k: string) => onChange(set.has(k) ? value.filter((v) => v !== k) : [...value, k])

  return (
    <div className="ms" ref={ref}>
      <button className={`chip ${value.length ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {label}
        {value.length ? `: ${value.length === 1 ? value[0] : `${value.length} selecionados`}` : ''}
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="ms-pop">
          {options.length > 10 && <input type="search" placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />}
          {value.length > 0 && (
            <div className="ms-opt" onClick={() => onChange([])} style={{ color: 'var(--accent)' }}>
              Limpar seleção
            </div>
          )}
          {filtradas.map((o) => (
            <label key={o.chave} className="ms-opt">
              <input type="checkbox" checked={set.has(o.chave)} onChange={() => toggle(o.chave)} />
              {o.chave}
              <span className="n">{num(o.n)}</span>
            </label>
          ))}
          {!filtradas.length && <div className="ms-opt muted">Nada encontrado</div>}
        </div>
      )}
    </div>
  )
}
