export type CargoId = 1 | 3 | 5 | 6 | 7 | 8

export const CARGOS: Record<CargoId, { nome: string; plural: string; curto: string }> = {
  1: { nome: 'Presidente', plural: 'Presidente', curto: 'Presidente' },
  3: { nome: 'Governador', plural: 'Governadores', curto: 'Governador' },
  5: { nome: 'Senador', plural: 'Senadores', curto: 'Senador' },
  6: { nome: 'Deputado Federal', plural: 'Deputados Federais', curto: 'Dep. Federal' },
  7: { nome: 'Deputado Estadual', plural: 'Deputados Estaduais', curto: 'Dep. Estadual' },
  8: { nome: 'Deputado Distrital', plural: 'Deputados Distritais', curto: 'Dep. Distrital' },
}
export const CARGO_IDS: CargoId[] = [1, 3, 5, 6, 7, 8]

export type Situacao = 'ELEITO' | '2º TURNO' | 'SUPLENTE' | 'NÃO ELEITO' | 'NÃO CONSTA NA URNA'

export interface Candidato {
  sq: string
  nr: number
  urna: string
  nome: string
  cargo: CargoId
  uf: string
  partido: string
  federacao: string | null
  coligacao: string | null
  composicao: string | null
  genero: string | null
  raca: string | null
  instrucao: string | null
  estadoCivil: string | null
  ocupacao: string | null
  idade: number | null
  situacao: Situacao
  situacaoDetalhe: string | null
  votos: number
  /** % dos votos nominais válidos do cargo na circunscrição */
  pct: number
  apto: boolean
}

export interface ResumoAbrangencia {
  eleitorado: number
  comparecimento: number
  abstencao: number
  validos: number
  brancos: number
  nulos: number
  totalizacao: string
  candidatos: { sq: string; nr: number; urna: string; partido: string; votos: number; pct: number; situacao: string }[]
}

export interface Meta {
  ano: number
  dataEleicao: string
  dataSegundoTurno: string
  geradoEm: string
  processadoEm: string
  vagas: Record<string, Record<string, number>>
  partidos: Record<string, { nr: number; nome: string; federacao: string | null }>
  presidente: { br: ResumoAbrangencia; uf: Record<string, ResumoAbrangencia> } | null
  segundoTurno: { presidente?: ResumoAbrangencia; governador?: Record<string, ResumoAbrangencia> } | null
  votosValidosUF: Record<string, Record<string, number>>
  fontes: string[]
}

export interface CargoMunicipal {
  /** votos nominais válidos por município (mesma ordem de `municipios`) */
  total: number[]
  partidos: Record<string, number[]>
  /** [sq, votos] dos mais votados em cada município */
  top: [string, number][][]
  /** votos por município de cada candidato (apenas cargos majoritários) */
  cand?: Record<string, number[]>
}

export interface DadosUF {
  /** [código TSE, código IBGE, nome] */
  municipios: [number, string, string][]
  cargos: Partial<Record<CargoId, CargoMunicipal>>
}

export const UFS: Record<string, { nome: string; regiao: string }> = {
  AC: { nome: 'Acre', regiao: 'Norte' },
  AL: { nome: 'Alagoas', regiao: 'Nordeste' },
  AM: { nome: 'Amazonas', regiao: 'Norte' },
  AP: { nome: 'Amapá', regiao: 'Norte' },
  BA: { nome: 'Bahia', regiao: 'Nordeste' },
  CE: { nome: 'Ceará', regiao: 'Nordeste' },
  DF: { nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
  ES: { nome: 'Espírito Santo', regiao: 'Sudeste' },
  GO: { nome: 'Goiás', regiao: 'Centro-Oeste' },
  MA: { nome: 'Maranhão', regiao: 'Nordeste' },
  MG: { nome: 'Minas Gerais', regiao: 'Sudeste' },
  MS: { nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  MT: { nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
  PA: { nome: 'Pará', regiao: 'Norte' },
  PB: { nome: 'Paraíba', regiao: 'Nordeste' },
  PE: { nome: 'Pernambuco', regiao: 'Nordeste' },
  PI: { nome: 'Piauí', regiao: 'Nordeste' },
  PR: { nome: 'Paraná', regiao: 'Sul' },
  RJ: { nome: 'Rio de Janeiro', regiao: 'Sudeste' },
  RN: { nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  RO: { nome: 'Rondônia', regiao: 'Norte' },
  RR: { nome: 'Roraima', regiao: 'Norte' },
  RS: { nome: 'Rio Grande do Sul', regiao: 'Sul' },
  SC: { nome: 'Santa Catarina', regiao: 'Sul' },
  SE: { nome: 'Sergipe', regiao: 'Nordeste' },
  SP: { nome: 'São Paulo', regiao: 'Sudeste' },
  TO: { nome: 'Tocantins', regiao: 'Norte' },
}
