import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilterBar, useFiltros } from '../components/FilterBar'
import { Badge, Card, useLinkCandidato } from '../components/Ui'
import { COR_ESPECTRO } from '../config/espectro'
import { useData } from '../data/DataContext'
import { CARGOS, type Candidato } from '../data/types'
import { downloadCsv, num, pct, titulo } from '../lib/format'
import { filtrar } from '../lib/query'

type Col = 'urna' | 'cargo' | 'uf' | 'partido' | 'votos' | 'pct' | 'idade'
const PAGINA = 100

export default function Candidatos() {
  const { candidatos, espectroDe } = useData()
  const [f] = useFiltros()
  const nav = useNavigate()
  const link = useLinkCandidato()
  const [ord, setOrd] = useState<{ col: Col; desc: boolean }>({ col: 'votos', desc: true })
  const [limite, setLimite] = useState(PAGINA)

  const lista = useMemo(() => {
    const xs = filtrar(candidatos, f, { espectroDe })
    const k = ord.col
    const val = (c: Candidato) => (k === 'cargo' ? c.cargo : c[k] ?? -1)
    return xs.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const r = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return ord.desc ? -r : r
    })
  }, [candidatos, f, espectroDe, ord])

  const th = (col: Col, nome: string, numCol = false) => (
    <th className={`sortable ${numCol ? 'num' : ''}`} onClick={() => setOrd((o) => ({ col, desc: o.col === col ? !o.desc : numCol }))}>
      {nome} {ord.col === col ? (ord.desc ? '↓' : '↑') : ''}
    </th>
  )

  const exportar = () =>
    downloadCsv('candidatos-2026.csv', [
      ['Nome de urna', 'Nome', 'Número', 'Cargo', 'UF', 'Partido', 'Espectro', 'Situação', 'Votos', '% válidos', 'Gênero', 'Cor/raça', 'Idade', 'Escolaridade', 'Ocupação'],
      ...lista.map((c) => [c.urna, c.nome, c.nr, CARGOS[c.cargo].nome, c.uf, c.partido, espectroDe(c.partido), c.situacao, c.votos, String(c.pct).replace('.', ','), c.genero ?? '', c.raca ?? '', c.idade ?? '', c.instrucao ?? '', c.ocupacao ?? '']),
    ])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Candidatos</h1>
          <p>Busque por nome ou número e filtre por qualquer atributo. Clique numa linha para abrir a ficha com a votação por município.</p>
        </div>
      </div>
      <FilterBar busca />
      <Card
        title={`${num(lista.length)} candidaturas`}
        actions={
          <button className="btn" onClick={exportar}>
            Baixar CSV
          </button>
        }
      >
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead>
              <tr>
                {th('urna', 'Nome')}
                {th('cargo', 'Cargo')}
                {th('uf', 'UF')}
                {th('partido', 'Partido')}
                <th>Situação</th>
                {th('votos', 'Votos', true)}
                {th('pct', '% válidos', true)}
                <th>Gênero</th>
                <th>Cor/raça</th>
                {th('idade', 'Idade', true)}
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, limite).map((c) => (
                <tr key={c.sq} className="clickable" onClick={() => nav(link(c.sq))}>
                  <td>
                    <b>{c.urna}</b> <span className="tiny">{c.nr}</span>
                  </td>
                  <td>{CARGOS[c.cargo].curto}</td>
                  <td>{c.uf}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i className="sw" style={{ background: COR_ESPECTRO[espectroDe(c.partido)] }} />
                      {c.partido}
                    </span>
                  </td>
                  <td>
                    <Badge situacao={c.situacao} />
                  </td>
                  <td className="num">{num(c.votos)}</td>
                  <td className="num">{pct(c.pct)}</td>
                  <td>{c.genero ? titulo(c.genero) : '—'}</td>
                  <td>{c.raca ? titulo(c.raca) : '—'}</td>
                  <td className="num">{c.idade ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length > limite && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn" onClick={() => setLimite((l) => l + PAGINA * 5)}>
              Mostrar mais ({num(lista.length - limite)} restantes)
            </button>
          </div>
        )}
      </Card>
    </>
  )
}
