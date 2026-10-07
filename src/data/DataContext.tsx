import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ESPECTRO_PADRAO, type Espectro } from '../config/espectro'
import type { Candidato, CargoId, DadosUF, Meta, Situacao } from './types'

interface Raw {
  cols: string[]
  dicts: Record<string, string[]>
  rows: (string | number | null)[][]
}

function decode(raw: Raw): Candidato[] {
  const idx = Object.fromEntries(raw.cols.map((c, i) => [c, i]))
  const d = raw.dicts
  const get = (dict: string, v: unknown) => (typeof v === 'number' && v >= 0 ? d[dict][v] : null)
  return raw.rows.map((r) => {
    const col = get('coligacao', r[idx.coligacao])
    const [coligacao, composicao] = col ? col.split('|') : [null, null]
    return {
      sq: String(r[idx.sq]),
      nr: r[idx.nr] as number,
      urna: r[idx.urna] as string,
      nome: r[idx.nome] as string,
      cargo: r[idx.cargo] as CargoId,
      uf: get('uf', r[idx.uf])!,
      partido: get('partido', r[idx.partido])!,
      federacao: get('federacao', r[idx.federacao]),
      coligacao,
      composicao: composicao || null,
      genero: get('genero', r[idx.genero]),
      raca: get('raca', r[idx.raca]),
      instrucao: get('instrucao', r[idx.instrucao]),
      estadoCivil: get('estadoCivil', r[idx.estadoCivil]),
      ocupacao: get('ocupacao', r[idx.ocupacao]),
      idade: r[idx.idade] as number | null,
      situacao: get('situacao', r[idx.situacao]) as Situacao,
      situacaoDetalhe: get('situacaoDetalhe', r[idx.situacaoDetalhe]),
      votos: r[idx.votos] as number,
      pct: r[idx.pct] as number,
      apto: r[idx.apto] === 1,
    }
  })
}

const LS_KEY = 'eleicoes2026:espectro'

function lerEspectro(): Record<string, Espectro> {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s ? { ...ESPECTRO_PADRAO, ...JSON.parse(s) } : ESPECTRO_PADRAO
  } catch {
    return ESPECTRO_PADRAO
  }
}

interface Ctx {
  meta: Meta
  candidatos: Candidato[]
  porSq: Map<string, Candidato>
  espectro: Record<string, Espectro>
  espectroDe: (partido: string) => Espectro
  setEspectro: (m: Record<string, Espectro> | null) => void
}

const DataCtx = createContext<Ctx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ meta: Meta; candidatos: Candidato[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [espectro, setEsp] = useState(lerEspectro)

  useEffect(() => {
    Promise.all([fetchJSON<Meta>('/data/meta.json'), fetchJSON<Raw>('/data/candidatos.json')])
      .then(([meta, raw]) => setData({ meta, candidatos: decode(raw) }))
      .catch((e) => setErro(String(e)))
  }, [])

  const setEspectro = useCallback((m: Record<string, Espectro> | null) => {
    try {
      if (m) localStorage.setItem(LS_KEY, JSON.stringify(m))
      else localStorage.removeItem(LS_KEY)
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
    setEsp(m ? { ...ESPECTRO_PADRAO, ...m } : ESPECTRO_PADRAO)
  }, [])

  const value = useMemo<Ctx | null>(() => {
    if (!data) return null
    return {
      ...data,
      porSq: new Map(data.candidatos.map((c) => [c.sq, c])),
      espectro,
      espectroDe: (p: string) => espectro[p] ?? 'Centro',
      setEspectro,
    }
  }, [data, espectro, setEspectro])

  if (erro) return <div className="loading">Não foi possível carregar os dados: {erro}</div>
  if (!value) return <div className="loading"><div className="spinner" />Carregando dados do TSE…</div>
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export function useData() {
  const c = useContext(DataCtx)
  if (!c) throw new Error('useData fora do DataProvider')
  return c
}

// ------------------------------------------------------------ carregamento sob demanda

const cache = new Map<string, Promise<unknown>>()

export function fetchJSON<T>(url: string): Promise<T> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ao carregar ${url}`)
      return r.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p as Promise<T>
}

export function useJSON<T>(url: string | null): { data: T | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null })
  useEffect(() => {
    if (!url) return
    let vivo = true
    fetchJSON<T>(url)
      .then((data) => vivo && setState({ url, data, error: null }))
      .catch((e) => vivo && setState({ url, data: null, error: String(e) }))
    return () => {
      vivo = false
    }
  }, [url])
  const atual = state.url === url
  return { data: atual ? state.data : null, loading: !!url && !atual, error: atual ? state.error : null }
}

export const useDadosUF = (uf: string | null) => useJSON<DadosUF>(uf && uf !== 'BR' ? `/data/uf/${uf}.json` : null)
