import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HBars, Legend } from '../components/Bars'
import { BrazilMap, SeqLegend, seqColor } from '../components/BrazilMap'
import { useFiltros } from '../components/FilterBar'
import { TipRow } from '../components/Tooltip'
import { Card, PessoaLinha } from '../components/Ui'
import { COR_ESPECTRO, ESPECTROS } from '../config/espectro'
import { useData } from '../data/DataContext'
import { CARGO_IDS, CARGOS, UFS, type CargoId } from '../data/types'
import { num, share, titulo } from '../lib/format'
import { ehMulher, ehNegro } from '../lib/helpers'

interface Linha {
  partido: string
  eleitos: number
  turno2: number
  candidatos: number
  mulheres: number
  negros: number
  idade: number
  votos: number
  porCargo: Record<number, number>
}

export default function Partidos() {
  const { candidatos, espectroDe, meta } = useData()
  const [f, setF] = useFiltros()
  const [params, setParams] = useSearchParams()
  const sel = params.get('p')
  const cargos = f.cargos.length ? f.cargos : CARGO_IDS

  const linhas = useMemo(() => {
    const m = new Map<string, Linha>()
    for (const c of candidatos) {
      if (!cargos.includes(c.cargo) || !c.apto) continue
      let l = m.get(c.partido)
      if (!l) m.set(c.partido, (l = { partido: c.partido, eleitos: 0, turno2: 0, candidatos: 0, mulheres: 0, negros: 0, idade: 0, votos: 0, porCargo: {} }))
      l.candidatos++
      l.votos += c.votos
      if (c.situacao === '2º TURNO') l.turno2++
      if (c.situacao !== 'ELEITO') continue
      l.eleitos++
      l.porCargo[c.cargo] = (l.porCargo[c.cargo] || 0) + 1
      if (ehMulher(c)) l.mulheres++
      if (ehNegro(c)) l.negros++
      l.idade += c.idade ?? 0
    }
    return [...m.values()].sort((a, b) => b.eleitos - a.eleitos || b.votos - a.votos)
  }, [candidatos, cargos])

  const totEleitos = linhas.reduce((a, l) => a + l.eleitos, 0)
  const setSel = (p: string | null) => {
    const n = new URLSearchParams(params)
    if (p) n.set('p', p)
    else n.delete('p')
    setParams(n, { replace: true })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Partidos</h1>
          <p>Desempenho de cada partido: eleitos, perfil da bancada e taxa de sucesso das candidaturas. Clique num partido para ver onde elegeu.</p>
        </div>
        <div className="seg">
          <button className={!f.cargos.length ? 'on' : ''} onClick={() => setF({ ...f, cargos: [] })}>
            Todos
          </button>
          {CARGO_IDS.map((c) => (
            <button key={c} className={f.cargos.length === 1 && f.cargos[0] === c ? 'on' : ''} onClick={() => setF({ ...f, cargos: [c] })}>
              {CARGOS[c].curto}
            </button>
          ))}
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Eleitos por partido" sub={`${num(totEleitos)} eleitos · cor = espectro (editável em Metodologia)`}>
          <HBars
            labelWidth={120}
            onClick={(p) => setSel(p === sel ? null : p)}
            selected={sel ? [sel] : undefined}
            rows={linhas.filter((l) => l.eleitos || l.turno2).map((l) => ({
              chave: l.partido,
              segs: [{ key: l.partido, n: l.eleitos, cor: COR_ESPECTRO[espectroDe(l.partido)] }],
              valor: `${num(l.eleitos)}${l.turno2 ? ` +${l.turno2} no 2º t.` : ''}`,
              nota: `${espectroDe(l.partido)} · ${share(l.eleitos, totEleitos)} dos eleitos · ${share(l.mulheres, l.eleitos)} mulheres`,
            }))}
          />
          <div style={{ marginTop: 10 }}>
            <Legend items={ESPECTROS.map((e) => ({ key: e, cor: COR_ESPECTRO[e] }))} />
          </div>
        </Card>
        {sel ? <DetalhePartido partido={sel} cargos={cargos} onClose={() => setSel(null)} /> : <EspectroCard cargos={cargos} />}
      </div>

      <Card title="Tabela comparativa">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Partido</th>
                <th>Espectro</th>
                {cargos.map((c) => (
                  <th key={c} className="num">{CARGOS[c].curto}</th>
                ))}
                <th className="num">Eleitos</th>
                <th className="num">Candidaturas</th>
                <th className="num">Taxa de sucesso</th>
                <th className="num">% mulheres eleitas</th>
                <th className="num">% negros eleitos</th>
                <th className="num">Idade média</th>
                <th className="num">Votos nominais</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.partido} className="clickable" onClick={() => setSel(l.partido)}>
                  <td>
                    <b>{l.partido}</b> <span className="tiny">{titulo(meta.partidos[l.partido]?.nome ?? '')}</span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <i className="sw" style={{ background: COR_ESPECTRO[espectroDe(l.partido)] }} />
                      {espectroDe(l.partido)}
                    </span>
                  </td>
                  {cargos.map((c) => (
                    <td key={c} className="num">{l.porCargo[c] || '—'}</td>
                  ))}
                  <td className="num"><b>{l.eleitos}</b></td>
                  <td className="num">{num(l.candidatos)}</td>
                  <td className="num">{share(l.eleitos, l.candidatos)}</td>
                  <td className="num">{l.eleitos ? share(l.mulheres, l.eleitos) : '—'}</td>
                  <td className="num">{l.eleitos ? share(l.negros, l.eleitos) : '—'}</td>
                  <td className="num">{l.eleitos ? (l.idade / l.eleitos).toFixed(0) : '—'}</td>
                  <td className="num">{num(l.votos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function EspectroCard({ cargos }: { cargos: CargoId[] }) {
  const { candidatos, espectroDe } = useData()
  const rows = ESPECTROS.map((e) => {
    const xs = candidatos.filter((c) => cargos.includes(c.cargo) && c.situacao === 'ELEITO' && espectroDe(c.partido) === e)
    return { chave: e, segs: [{ key: e, n: xs.length, cor: COR_ESPECTRO[e] }], nota: [...new Set(xs.map((c) => c.partido))].join(', ') }
  })
  return (
    <Card title="Eleitos por espectro" sub="Passe o mouse para ver os partidos de cada grupo">
      <HBars rows={rows} labelWidth={130} />
      <p className="tiny" style={{ marginTop: 10 }}>
        A classificação é editorial. Ajuste-a em <Link to="/metodologia">Metodologia</Link>.
      </p>
    </Card>
  )
}

function DetalhePartido({ partido, cargos, onClose }: { partido: string; cargos: CargoId[]; onClose: () => void }) {
  const { candidatos, espectroDe, meta } = useData()
  const eleitos = candidatos.filter((c) => c.partido === partido && cargos.includes(c.cargo) && (c.situacao === 'ELEITO' || c.situacao === '2º TURNO'))
  const porUF: Record<string, number> = {}
  eleitos.forEach((c) => c.uf !== 'BR' && (porUF[c.uf] = (porUF[c.uf] || 0) + 1))
  const max = Math.max(1, ...Object.values(porUF))
  const destaque = eleitos.filter((c) => c.cargo <= 5).sort((a, b) => a.cargo - b.cargo || b.votos - a.votos)
  const maisVotados = eleitos.filter((c) => c.cargo >= 6).sort((a, b) => b.votos - a.votos).slice(0, 8)

  return (
    <Card
      title={`${partido} — ${titulo(meta.partidos[partido]?.nome ?? '')}`}
      sub={`${espectroDe(partido)}${meta.partidos[partido]?.federacao ? ` · ${titulo(meta.partidos[partido].federacao!)}` : ''} · ${eleitos.length} eleitos ou no 2º turno`}
      actions={
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      }
    >
      <BrazilMap
        nivel="uf"
        labels
        height={420}
        fill={(uf) => (porUF[uf] ? seqColor(porUF[uf], 0, max) : undefined)}
        tooltip={(uf) => (
          <>
            <div className="t">{UFS[uf]?.nome}</div>
            {CARGO_IDS.filter((c) => cargos.includes(c)).map((cg) => {
              const n = eleitos.filter((c) => c.uf === uf && c.cargo === cg).length
              return n ? <TipRow key={cg} label={CARGOS[cg].plural} value={n} /> : null
            })}
            {!porUF[uf] && <span className="tiny">Nenhum eleito</span>}
          </>
        )}
      />
      <SeqLegend min={0} max={max} fmt={num} />
      {destaque.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 4px' }}>Cargos majoritários</h3>
          <ul className="list-reset">{destaque.map((c) => <PessoaLinha key={c.sq} c={c} extra={<span className="tiny">{CARGOS[c.cargo].curto} · {c.uf}</span>} />)}</ul>
        </>
      )}
      {maisVotados.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 4px' }}>Deputados mais votados</h3>
          <ul className="list-reset">{maisVotados.map((c) => <PessoaLinha key={c.sq} c={c} extra={<span className="tiny">{CARGOS[c.cargo].curto} · {c.uf}</span>} />)}</ul>
        </>
      )}
      <p className="small" style={{ marginTop: 10 }}>
        <Link to={`/explorar?partido=${encodeURIComponent(partido)}&g=cargo&s=genero`}>Explorar o perfil dos eleitos do {partido} →</Link>
      </p>
    </Card>
  )
}
