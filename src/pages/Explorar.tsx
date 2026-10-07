import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { COR_OUTROS, CORES_CAT, HBars, Legend, type BarRow } from '../components/Bars'
import { FilterBar, useFiltros } from '../components/FilterBar'
import { Card } from '../components/Ui'
import { COR_ESPECTRO, COR_ESPECTRO3, type Espectro } from '../config/espectro'
import { useData } from '../data/DataContext'
import { downloadCsv, num, pct, share } from '../lib/format'
import { COR_GENERO, COR_RACA } from '../lib/helpers'
import { agrupar, categoriasSub, descreverFiltros, DIM, DIMENSOES, filtrar, type Dimensao } from '../lib/query'

const MAX_GRUPOS = 30

/** Cores semânticas por dimensão; demais usam a paleta categórica em ordem fixa. */
function coresPara(dim: Dimensao, cats: string[], espectroDe: (p: string) => Espectro): Record<string, string> {
  if (dim.id === 'espectro') return COR_ESPECTRO
  if (dim.id === 'espectro3') return COR_ESPECTRO3
  if (dim.id === 'genero') return COR_GENERO
  if (dim.id === 'raca') return COR_RACA
  if (dim.id === 'partido') return Object.fromEntries(cats.map((p) => [p, COR_ESPECTRO[espectroDe(p)]]))
  if (dim.id === 'situacao') return { Eleito: 'var(--s3)', '2º turno': 'var(--s4)', Suplente: 'var(--s1)', 'Não eleito': 'var(--s-outros)' }
  if (dim.id === 'negros') return { Negros: 'var(--s2)', 'Não negros': 'var(--s1)' }
  return Object.fromEntries(cats.map((c, i) => [c, CORES_CAT[i] ?? COR_OUTROS]))
}

export default function Explorar() {
  const { candidatos, espectroDe } = useData()
  const [f] = useFiltros()
  const [params, setParams] = useSearchParams()
  const ctx = useMemo(() => ({ espectroDe }), [espectroDe])

  const g = DIM[params.get('g') ?? 'partido'] ?? DIM.partido
  const s = params.get('s') ? DIM[params.get('s')!] : undefined
  const modo = params.get('modo') === 'pct' ? 'pct' : 'abs'
  const setP = (k: string, v: string | null) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }

  const sel = useMemo(() => filtrar(candidatos, f, ctx), [candidatos, f, ctx])
  // universo de referência: mesmos cargos e situação, sem os filtros de atributos
  const universo = useMemo(() => filtrar(candidatos, { ...f, dims: {}, busca: '' }, ctx), [candidatos, f, ctx])

  const grupos = useMemo(() => agrupar(sel, g, ctx, s && s.id !== g.id ? s : undefined), [sel, g, s, ctx])
  const sub = s && s.id !== g.id ? s : undefined
  const { cats, outros } = sub ? categoriasSub(grupos, sub, sub.id === 'partido' ? 12 : 7) : { cats: [], outros: false }

  const visiveis = grupos.slice(0, MAX_GRUPOS)
  const restantes = grupos.slice(MAX_GRUPOS)
  const coresG = coresPara(g, grupos.map((x) => x.chave), espectroDe)
  const coresS = sub ? coresPara(sub, cats, espectroDe) : {}

  const rows: BarRow[] = visiveis.map((gr) => {
    const segs = sub
      ? [
          ...cats.map((k) => ({ key: k, n: gr.sub[k] || 0, cor: coresS[k] ?? COR_OUTROS })),
          ...(outros ? [{ key: 'Outros', n: Object.entries(gr.sub).filter(([k]) => !cats.includes(k)).reduce((a, [, v]) => a + v, 0), cor: COR_OUTROS }] : []),
        ]
      : [{ key: gr.chave, n: gr.n, cor: g.id === 'partido' || g.id.startsWith('espectro') || g.id in { genero: 1, raca: 1 } ? coresG[gr.chave] ?? 'var(--s1)' : 'var(--s1)' }]
    return {
      chave: gr.chave,
      segs,
      valor: modo === 'pct' ? share(gr.n, sel.length) : num(gr.n),
      nota: `${share(gr.n, sel.length)} do recorte · ${num(gr.votos)} votos`,
    }
  })

  const universoLabel = { eleitos: 'eleitos', disputa: 'eleitos ou no 2º turno', todos: 'candidatos', naoEleitos: 'não eleitos' }[f.escopo]
  const temAtributos = Object.values(f.dims).some((v) => v.length) || !!f.busca
  const top = grupos.slice().sort((a, b) => b.n - a.n).slice(0, 5)

  const exportar = () => {
    const header = [g.nome, ...(sub ? [...cats, ...(outros ? ['Outros'] : [])] : []), 'Total', '% do recorte', 'Votos']
    const linhas = grupos.map((gr) => [
      gr.chave,
      ...(sub ? [...cats.map((k) => gr.sub[k] || 0), ...(outros ? [Object.entries(gr.sub).filter(([k]) => !cats.includes(k)).reduce((a, [, v]) => a + v, 0)] : [])] : []),
      gr.n,
      ((gr.n / (sel.length || 1)) * 100).toFixed(2).replace('.', ','),
      gr.votos,
    ])
    downloadCsv(`eleicoes2026-${g.id}${sub ? '-' + sub.id : ''}.csv`, [header, ...linhas])
  }

  const linkLista = `/candidatos?${new URLSearchParams([...params].filter(([k]) => !['g', 's', 'modo'].includes(k)))}`

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Explorar</h1>
          <p>Combine filtros e escolha como agrupar. Ex.: cargo Deputado Federal + gênero Feminino, agrupado por partido e dividido por espectro. A URL guarda a consulta, então dá para compartilhar o link.</p>
        </div>
      </div>

      <FilterBar />

      <div className="card answer">
        {sel.length === 0 ? (
          <span>Nenhum resultado para este recorte.</span>
        ) : (
          <>
            <b>{num(sel.length)}</b> {universoLabel}
            {temAtributos && (
              <>
                {' '}de <b>{num(universo.length)}</b> ({share(sel.length, universo.length)})
              </>
            )}{' '}
            · <span className="muted">{descreverFiltros(f)}</span>
            <div className="small muted" style={{ marginTop: 6 }}>
              Por {g.nome.toLowerCase()}: {top.map((t) => `${t.chave} ${num(t.n)} (${share(t.n, sel.length)})`).join(' · ')}
              {grupos.length > 5 ? ` · +${grupos.length - 5} grupos` : ''}
            </div>
          </>
        )}
      </div>

      <Card
        title={`${universoLabel[0].toUpperCase() + universoLabel.slice(1)} por ${g.nome.toLowerCase()}${sub ? ` e ${sub.nome.toLowerCase()}` : ''}`}
        actions={
          <div className="filterbar">
            <label className="field">
              Agrupar por
              <select value={g.id} onChange={(e) => setP('g', e.target.value)}>
                {DIMENSOES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Dividir por
              <select value={sub?.id ?? ''} onChange={(e) => setP('s', e.target.value || null)}>
                <option value="">— nenhum —</option>
                {DIMENSOES.filter((d) => d.id !== g.id).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Escala
              <div className="seg">
                <button className={modo === 'abs' ? 'on' : ''} onClick={() => setP('modo', null)}>
                  Quantidade
                </button>
                <button className={modo === 'pct' ? 'on' : ''} onClick={() => setP('modo', 'pct')} disabled={!sub} title={sub ? '' : 'Escolha “Dividir por” para ver a composição em %'}>
                  100%
                </button>
              </div>
            </label>
          </div>
        }
      >
        {sub && (
          <div style={{ marginBottom: 12 }}>
            <Legend items={[...cats.map((k) => ({ key: k, cor: coresS[k] ?? COR_OUTROS })), ...(outros ? [{ key: 'Outros', cor: COR_OUTROS }] : [])]} />
          </div>
        )}
        <HBars rows={rows} modo={sub && modo === 'pct' ? 'pct' : 'abs'} labelWidth={g.id === 'ocupacao' || g.id === 'instrucao' || g.id === 'federacao' ? 230 : 150} />
        {restantes.length > 0 && (
          <p className="tiny" style={{ marginTop: 8 }}>
            + {restantes.length} grupos menores somando {num(restantes.reduce((a, r) => a + r.n, 0))} ({share(restantes.reduce((a, r) => a + r.n, 0), sel.length)}) — veja a tabela.
          </p>
        )}
      </Card>

      <Card
        title="Tabela"
        actions={
          <div className="filterbar">
            <Link className="btn" to={linkLista}>
              Ver candidatos →
            </Link>
            <button className="btn" onClick={exportar}>
              Baixar CSV
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{g.nome}</th>
                {sub && cats.map((k) => <th key={k} className="num">{k}</th>)}
                {outros && <th className="num">Outros</th>}
                <th className="num">Total</th>
                <th className="num">% do recorte</th>
                <th className="num">Votos</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((gr) => (
                <tr key={gr.chave}>
                  <td>{gr.chave}</td>
                  {sub &&
                    cats.map((k) => (
                      <td key={k} className="num">
                        {gr.sub[k] ? (
                          <>
                            {num(gr.sub[k])} <span className="tiny">{pct((gr.sub[k] / gr.n) * 100)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    ))}
                  {outros && <td className="num">{num(Object.entries(gr.sub).filter(([k]) => !cats.includes(k)).reduce((a, [, v]) => a + v, 0))}</td>}
                  <td className="num"><b>{num(gr.n)}</b></td>
                  <td className="num">{share(gr.n, sel.length)}</td>
                  <td className="num">{num(gr.votos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
