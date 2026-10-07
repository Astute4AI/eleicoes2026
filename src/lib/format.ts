const nf = new Intl.NumberFormat('pt-BR')
const pf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const cf = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export const num = (n: number) => nf.format(n)
export const pct = (n: number) => `${pf.format(n)}%`
export const share = (a: number, b: number) => (b ? pct((a / b) * 100) : '—')
export const compact = (n: number) => cf.format(n)

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
export const titulo = (s: string) =>
  s
    .toLowerCase()
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')

/** Remove acentos para busca. */
export const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function downloadCsv(nome: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((l) => l.map((v) => (typeof v === 'string' && /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}
