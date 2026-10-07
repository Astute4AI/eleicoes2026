import { ESPECTROS, ESPECTROS3, para3, type Espectro } from '../config/espectro'
import { CARGOS, UFS, type Candidato, type CargoId } from '../data/types'
import { titulo } from './format'

/** Contexto necessário para extrair dimensões derivadas (espectro editável). */
export interface DimCtx {
  espectroDe: (p: string) => Espectro
}

export interface Dimensao {
  id: string
  nome: string
  /** valor da dimensão para um candidato */
  valor: (c: Candidato, ctx: DimCtx) => string
  /** ordem natural das categorias (quando existe); senão ordena por contagem */
  ordem?: string[]
  /** dimensão com muitas categorias: só aparece como filtro por busca */
  muitas?: boolean
}

const FAIXAS = ['18–29', '30–39', '40–49', '50–59', '60–69', '70+']
const faixa = (i: number | null) =>
  i == null ? 'Não informado' : i < 30 ? '18–29' : i < 40 ? '30–39' : i < 50 ? '40–49' : i < 60 ? '50–59' : i < 70 ? '60–69' : '70+'

const INSTRUCAO = [
  'Lê e escreve',
  'Ensino fundamental incompleto',
  'Ensino fundamental completo',
  'Ensino médio incompleto',
  'Ensino médio completo',
  'Superior incompleto',
  'Superior completo',
]

export const SITUACOES = ['Eleito', '2º turno', 'Suplente', 'Não eleito', 'Não consta na urna']
const sit = (s: string) => (s === '2º TURNO' ? '2º turno' : s === 'NÃO CONSTA NA URNA' ? 'Não consta na urna' : s.charAt(0) + s.slice(1).toLowerCase())

const capital = (s: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : 'Não informado')

export const DIMENSOES: Dimensao[] = [
  { id: 'cargo', nome: 'Cargo', valor: (c) => CARGOS[c.cargo].nome, ordem: Object.values(CARGOS).map((c) => c.nome) },
  { id: 'situacao', nome: 'Situação', valor: (c) => sit(c.situacao), ordem: SITUACOES },
  { id: 'genero', nome: 'Gênero', valor: (c) => capital(c.genero), ordem: ['Feminino', 'Masculino', 'Não informado'] },
  { id: 'raca', nome: 'Cor/raça', valor: (c) => capital(c.raca), ordem: ['Branca', 'Parda', 'Preta', 'Indígena', 'Amarela', 'Não informado'] },
  {
    id: 'negros',
    nome: 'Negros (pretos + pardos)',
    valor: (c) => (c.raca === 'PRETA' || c.raca === 'PARDA' ? 'Negros' : c.raca ? 'Não negros' : 'Não informado'),
    ordem: ['Negros', 'Não negros', 'Não informado'],
  },
  { id: 'espectro', nome: 'Espectro político', valor: (c, x) => x.espectroDe(c.partido), ordem: ESPECTROS },
  { id: 'espectro3', nome: 'Espectro (3 grupos)', valor: (c, x) => para3(x.espectroDe(c.partido)), ordem: ESPECTROS3 },
  { id: 'partido', nome: 'Partido', valor: (c) => c.partido },
  { id: 'federacao', nome: 'Federação', valor: (c) => (c.federacao ? titulo(c.federacao.replace(/^FEDERAÇÃO /, '')) : 'Sem federação') },
  { id: 'uf', nome: 'UF', valor: (c) => c.uf, ordem: ['BR', ...Object.keys(UFS)] },
  { id: 'regiao', nome: 'Região', valor: (c) => UFS[c.uf]?.regiao ?? 'Nacional', ordem: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Nacional'] },
  { id: 'idade', nome: 'Faixa etária', valor: (c) => faixa(c.idade), ordem: [...FAIXAS, 'Não informado'] },
  { id: 'instrucao', nome: 'Escolaridade', valor: (c) => capital(c.instrucao), ordem: [...INSTRUCAO, 'Não informado'] },
  { id: 'estadoCivil', nome: 'Estado civil', valor: (c) => capital(c.estadoCivil) },
  { id: 'ocupacao', nome: 'Ocupação declarada', valor: (c) => capital(c.ocupacao), muitas: true },
]
export const DIM = Object.fromEntries(DIMENSOES.map((d) => [d.id, d])) as Record<string, Dimensao>

// ------------------------------------------------------------ filtros

export interface Filtros {
  cargos: CargoId[]
  /** atalho de situação: eleitos (inclui definidos), todos, 2º turno… */
  escopo: 'eleitos' | 'disputa' | 'todos' | 'naoEleitos'
  /** filtros por dimensão: id -> valores aceitos */
  dims: Record<string, string[]>
  busca: string
}

export const FILTROS_VAZIOS: Filtros = { cargos: [], escopo: 'eleitos', dims: {}, busca: '' }

export const ESCOPOS: { id: Filtros['escopo']; nome: string; desc: string }[] = [
  { id: 'eleitos', nome: 'Eleitos', desc: 'Eleitos no 1º turno (ou no 2º, quando houver)' },
  { id: 'disputa', nome: 'Eleitos + 2º turno', desc: 'Inclui quem ainda disputa o 2º turno' },
  { id: 'todos', nome: 'Todos os candidatos', desc: 'Todas as candidaturas que constaram na urna' },
  { id: 'naoEleitos', nome: 'Não eleitos', desc: 'Suplentes e não eleitos' },
]

export function noEscopo(c: Candidato, escopo: Filtros['escopo']) {
  switch (escopo) {
    case 'eleitos':
      return c.situacao === 'ELEITO'
    case 'disputa':
      return c.situacao === 'ELEITO' || c.situacao === '2º TURNO'
    case 'todos':
      return c.apto
    case 'naoEleitos':
      return c.situacao === 'SUPLENTE' || c.situacao === 'NÃO ELEITO'
  }
}

export function filtrar(cands: Candidato[], f: Filtros, ctx: DimCtx, ignorarDim?: string) {
  const dims = Object.entries(f.dims).filter(([id, v]) => v.length && id !== ignorarDim && DIM[id])
  const sets = dims.map(([id, v]) => [DIM[id], new Set(v)] as const)
  const busca = f.busca.trim() ? normalizaBusca(f.busca) : null
  return cands.filter(
    (c) =>
      (!f.cargos.length || f.cargos.includes(c.cargo)) &&
      noEscopo(c, f.escopo) &&
      sets.every(([d, s]) => s.has(d.valor(c, ctx))) &&
      (!busca || normalizaBusca(`${c.urna} ${c.nome} ${c.nr}`).includes(busca)),
  )
}

const normalizaBusca = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ------------------------------------------------------------ agrupamento

export interface Grupo {
  chave: string
  n: number
  votos: number
  /** sub-contagens pela segunda dimensão */
  sub: Record<string, number>
}

export function agrupar(cands: Candidato[], dim: Dimensao, ctx: DimCtx, sub?: Dimensao): Grupo[] {
  const m = new Map<string, Grupo>()
  for (const c of cands) {
    const k = dim.valor(c, ctx)
    let g = m.get(k)
    if (!g) m.set(k, (g = { chave: k, n: 0, votos: 0, sub: {} }))
    g.n++
    g.votos += c.votos
    if (sub) {
      const s = sub.valor(c, ctx)
      g.sub[s] = (g.sub[s] || 0) + 1
    }
  }
  return ordenar([...m.values()], dim)
}

export function ordenar<T extends { chave: string; n: number }>(gs: T[], dim: Dimensao): T[] {
  if (dim.ordem) {
    const o = dim.ordem
    const pos = (k: string) => (o.indexOf(k) === -1 ? 999 : o.indexOf(k))
    return gs.sort((a, b) => pos(a.chave) - pos(b.chave) || b.n - a.n)
  }
  return gs.sort((a, b) => b.n - a.n || a.chave.localeCompare(b.chave))
}

/** Categorias da sub-dimensão na ordem natural, limitadas a `max` (+ "Outros"). */
export function categoriasSub(grupos: Grupo[], sub: Dimensao, max = 7): { cats: string[]; outros: boolean } {
  const tot: Record<string, number> = {}
  for (const g of grupos) for (const [k, v] of Object.entries(g.sub)) tot[k] = (tot[k] || 0) + v
  let cats = Object.keys(tot)
  if (sub.ordem) cats = sub.ordem.filter((k) => k in tot).concat(cats.filter((k) => !sub.ordem!.includes(k)))
  else cats.sort((a, b) => tot[b] - tot[a])
  if (cats.length <= max + 1) return { cats, outros: false }
  return { cats: cats.slice(0, max), outros: true }
}

/** Valores possíveis de cada dimensão dentro de um conjunto (para os seletores). */
export function valoresDim(cands: Candidato[], dim: Dimensao, ctx: DimCtx) {
  const m = new Map<string, number>()
  for (const c of cands) {
    const k = dim.valor(c, ctx)
    m.set(k, (m.get(k) || 0) + 1)
  }
  return ordenar([...m].map(([chave, n]) => ({ chave, n })), dim)
}

// ------------------------------------------------------------ URL

export function filtrosDaUrl(p: URLSearchParams): Filtros {
  const dims: Record<string, string[]> = {}
  for (const d of DIMENSOES) {
    const v = p.get(d.id)
    if (v) dims[d.id] = v.split('~')
  }
  const escopo = p.get('escopo') as Filtros['escopo'] | null
  return {
    cargos: (p.get('cargos')?.split(',').map(Number).filter((n) => n in CARGOS) ?? []) as CargoId[],
    escopo: escopo && ESCOPOS.some((e) => e.id === escopo) ? escopo : 'eleitos',
    dims,
    busca: p.get('q') ?? '',
  }
}

export function filtrosParaUrl(f: Filtros, p: URLSearchParams) {
  const n = new URLSearchParams(p)
  for (const d of DIMENSOES) n.delete(d.id)
  for (const [id, v] of Object.entries(f.dims)) if (v.length) n.set(id, v.join('~'))
  if (f.cargos.length) n.set('cargos', f.cargos.join(','))
  else n.delete('cargos')
  if (f.escopo !== 'eleitos') n.set('escopo', f.escopo)
  else n.delete('escopo')
  if (f.busca) n.set('q', f.busca)
  else n.delete('q')
  return n
}

/** Descrição em linguagem natural do recorte atual. */
export function descreverFiltros(f: Filtros) {
  const partes: string[] = []
  partes.push(f.cargos.length ? f.cargos.map((c) => CARGOS[c].nome).join(', ') : 'todos os cargos')
  for (const [id, v] of Object.entries(f.dims)) if (v.length && DIM[id]) partes.push(`${DIM[id].nome}: ${v.join(', ')}`)
  if (f.busca) partes.push(`busca “${f.busca}”`)
  return partes.join(' · ')
}
