import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { COR_ESPECTRO } from '../config/espectro'
import { useData } from '../data/DataContext'
import type { Candidato } from '../data/types'
import { num, pct } from '../lib/format'
import { situacaoBadge } from '../lib/helpers'

export function Card({ title, sub, actions, children, className = '' }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Badge({ situacao }: { situacao: string }) {
  const b = situacaoBadge(situacao)
  return <span className={b.cls}>{b.txt}</span>
}

/** Link que abre a ficha do candidato (gaveta global controlada por ?c=). */
export function useLinkCandidato() {
  const loc = useLocation()
  return (sq: string) => {
    const p = new URLSearchParams(loc.search)
    p.set('c', sq)
    return `${loc.pathname}?${p}`
  }
}

export function PessoaLinha({ c, extra }: { c: Candidato; extra?: ReactNode }) {
  const { espectroDe } = useData()
  const link = useLinkCandidato()
  return (
    <li className="person">
      <i className="dot" style={{ background: COR_ESPECTRO[espectroDe(c.partido)] }} title={espectroDe(c.partido)} />
      <div className="who">
        <Link to={link(c.sq)} style={{ color: 'inherit', textDecoration: 'none' }}>
          <b>{c.urna}</b>
        </Link>
        <span className="tiny">
          {c.partido} · {num(c.votos)} votos ({pct(c.pct)})
        </span>
      </div>
      {extra}
      <Badge situacao={c.situacao} />
    </li>
  )
}
