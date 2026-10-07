import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CARGO_IDS, CARGOS, type CargoId } from '../data/types'
import { DIM, ESCOPOS, filtrar, filtrosDaUrl, filtrosParaUrl, valoresDim, type Filtros } from '../lib/query'
import { MultiSelect } from './MultiSelect'

/** Estado de filtros sincronizado com a URL (links compartilháveis). */
export function useFiltros(): [Filtros, (f: Filtros) => void] {
  const [params, setParams] = useSearchParams()
  const f = useMemo(() => filtrosDaUrl(params), [params])
  const set = (n: Filtros) => setParams(filtrosParaUrl(n, params), { replace: true })
  return [f, set]
}

const DIMS_FILTRO = ['genero', 'raca', 'espectro', 'partido', 'federacao', 'uf', 'regiao', 'idade', 'instrucao', 'ocupacao']

export function FilterBar({
  dims = DIMS_FILTRO,
  cargoUnico = false,
  semEscopo = false,
  busca = false,
}: {
  dims?: string[]
  cargoUnico?: boolean
  semEscopo?: boolean
  busca?: boolean
}) {
  const { candidatos, espectroDe } = useData()
  const [f, setF] = useFiltros()
  const ctx = { espectroDe }

  const toggleCargo = (c: CargoId) => {
    if (cargoUnico) return setF({ ...f, cargos: [c] })
    setF({ ...f, cargos: f.cargos.includes(c) ? f.cargos.filter((x) => x !== c) : [...f.cargos, c] })
  }
  const ativos = Object.values(f.dims).some((v) => v.length) || f.busca || f.cargos.length

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
      <div className="filterbar">
        <div className="seg" role="group" aria-label="Cargo">
          {!cargoUnico && (
            <button className={!f.cargos.length ? 'on' : ''} onClick={() => setF({ ...f, cargos: [] })}>
              Todos
            </button>
          )}
          {CARGO_IDS.map((c) => (
            <button key={c} className={f.cargos.includes(c) ? 'on' : ''} onClick={() => toggleCargo(c)}>
              {CARGOS[c].curto}
            </button>
          ))}
        </div>
        {!semEscopo && (
          <select value={f.escopo} onChange={(e) => setF({ ...f, escopo: e.target.value as Filtros['escopo'] })} aria-label="Situação">
            {ESCOPOS.map((e) => (
              <option key={e.id} value={e.id} title={e.desc}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
        {busca && (
          <input type="search" placeholder="Buscar por nome ou número…" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
        )}
      </div>
      <div className="filterbar">
        {dims.map((id) => {
          const d = DIM[id]
          // opções calculadas com os demais filtros aplicados (facetas)
          const base = filtrar(candidatos, f, ctx, id)
          const opts = valoresDim(base, d, ctx)
          return (
            <MultiSelect
              key={id}
              label={d.nome}
              options={opts}
              value={f.dims[id] ?? []}
              onChange={(v) => setF({ ...f, dims: { ...f.dims, [id]: v } })}
            />
          )
        })}
        {ativos ? (
          <button className="chip" onClick={() => setF({ cargos: cargoUnico ? f.cargos : [], escopo: f.escopo, dims: {}, busca: '' })}>
            Limpar filtros <span className="x">✕</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
