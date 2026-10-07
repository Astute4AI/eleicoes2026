import { COR_ESPECTRO, ESPECTROS, type Espectro } from '../config/espectro'
import type { Bancada } from '../components/Parliament'
import type { Candidato } from '../data/types'

/** Bancadas por partido ordenadas da esquerda para a direita (para hemiciclos). */
export function bancadasPorPartido(eleitos: Candidato[], espectroDe: (p: string) => Espectro): Bancada[] {
  const m = new Map<string, number>()
  for (const c of eleitos) m.set(c.partido, (m.get(c.partido) || 0) + 1)
  return [...m]
    .map(([p, n]) => ({ chave: p, n, esp: espectroDe(p) }))
    .sort((a, b) => ESPECTROS.indexOf(a.esp) - ESPECTROS.indexOf(b.esp) || b.n - a.n)
    .map((b) => ({ chave: b.chave, n: b.n, cor: COR_ESPECTRO[b.esp], detalhe: b.esp }))
}

export function contar<T>(xs: T[], f: (x: T) => string) {
  const m: Record<string, number> = {}
  for (const x of xs) {
    const k = f(x)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

export const ehMulher = (c: Candidato) => c.genero === 'FEMININO'
export const ehNegro = (c: Candidato) => c.raca === 'PRETA' || c.raca === 'PARDA'

export const COR_GENERO: Record<string, string> = { Feminino: 'var(--s2)', Masculino: 'var(--s1)', 'Não informado': 'var(--s-outros)' }
export const COR_RACA: Record<string, string> = {
  Branca: 'var(--s1)',
  Parda: 'var(--s2)',
  Preta: 'var(--s3)',
  Indígena: 'var(--s4)',
  Amarela: 'var(--s5)',
  'Não informado': 'var(--s-outros)',
}

export function situacaoBadge(s: string) {
  if (s === 'ELEITO') return { cls: 'badge eleito', txt: '✓ Eleito' }
  if (s === '2º TURNO') return { cls: 'badge turno2', txt: '◐ 2º turno' }
  if (s === 'SUPLENTE') return { cls: 'badge', txt: 'Suplente' }
  if (s === 'NÃO CONSTA NA URNA') return { cls: 'badge', txt: 'Fora da urna' }
  return { cls: 'badge', txt: 'Não eleito' }
}
