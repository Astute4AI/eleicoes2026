import { useMemo, useState } from 'react'
import { COR_OUTROS, CORES_CAT, HBars, Legend, StackBar } from '../components/Bars'
import { BrazilMap, SeqLegend, seqColor } from '../components/BrazilMap'
import { TipRow } from '../components/Tooltip'
import { Card, Stat } from '../components/Ui'
import { COR_ESPECTRO } from '../config/espectro'
import { useData } from '../data/DataContext'
import { UFS } from '../data/types'
import { num, pct, share } from '../lib/format'

export default function Presidente() {
  const { meta, espectroDe, porSq } = useData()
  const p = meta.presidente
  const [foco, setFoco] = useState<string | null>(null)

  const cores = useMemo(() => {
    if (!p) return {}
    return Object.fromEntries(p.br.candidatos.slice(0, 2).map((c, i) => [c.sq, CORES_CAT[i]]))
  }, [p])

  if (!p) return <Card title="Presidente">Os resultados de Presidente ainda não foram processados.</Card>
  const br = p.br
  const [a, b] = br.candidatos
  const t2 = meta.segundoTurno?.presidente

  const regiao: Record<string, Record<string, number>> = {}
  for (const [uf, r] of Object.entries(p.uf)) {
    const reg = UFS[uf]?.regiao ?? 'Exterior'
    regiao[reg] ??= {}
    r.candidatos.forEach((c) => (regiao[reg][c.sq] = (regiao[reg][c.sq] || 0) + c.votos))
  }

  const focoSq = foco ?? a.sq
  const pctUF = (uf: string) => p.uf[uf]?.candidatos.find((c) => c.sq === focoSq)?.pct ?? null
  const vals = Object.keys(UFS).map(pctUF).filter((v): v is number => v != null)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Presidente da República</h1>
          <p>
            {a.urna} ({a.partido}) e {b.urna} ({b.partido}) disputam o 2º turno em {meta.dataSegundoTurno}. Totalização do 1º turno: {br.totalizacao}.
          </p>
        </div>
      </div>

      <div className="grid g4">
        <Stat label="Eleitorado" value={num(br.eleitorado)} />
        <Stat label="Comparecimento" value={share(br.comparecimento, br.eleitorado)} sub={`${num(br.comparecimento)} eleitores`} />
        <Stat label="Abstenção" value={share(br.abstencao, br.eleitorado)} sub={`${num(br.abstencao)} eleitores`} />
        <Stat label="Brancos e nulos" value={share(br.brancos + br.nulos, br.comparecimento)} sub={`${num(br.brancos)} brancos · ${num(br.nulos)} nulos`} />
      </div>

      {t2 && t2.validos > 0 && (
        <Card title="2º turno" sub={`Totalização: ${t2.totalizacao}`}>
          <HBars labelWidth={180} fmt={pct} rows={t2.candidatos.map((c) => ({ chave: c.sq, label: `${c.urna} (${c.partido})`, segs: [{ key: c.urna, n: c.pct, cor: cores[c.sq] ?? COR_OUTROS }], valor: `${pct(c.pct)} · ${c.situacao}` }))} />
        </Card>
      )}

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Resultado nacional — 1º turno" sub={`${num(br.validos)} votos válidos. Cor = espectro do partido.`}>
          <HBars
            labelWidth={200}
            fmt={pct}
            selected={[focoSq]}
            onClick={setFoco}
            rows={br.candidatos.map((c) => ({
              chave: c.sq,
              label: (
                <span>
                  {c.urna} <span className="tiny">{c.partido} · {porSq.get(c.sq)?.genero === 'FEMININO' ? 'F' : 'M'}</span>
                </span>
              ),
              segs: [{ key: c.urna, n: c.pct, cor: COR_ESPECTRO[espectroDe(c.partido)] }],
              valor: `${pct(c.pct)}`,
              nota: `${num(c.votos)} votos · ${c.situacao}`,
            }))}
          />
          <p className="tiny" style={{ marginTop: 8 }}>Clique num candidato para vê-lo no mapa.</p>
        </Card>
        <Card title={`Votação de ${porSq.get(focoSq)?.urna ?? ''} por UF`} sub="% dos votos válidos em cada estado">
          <BrazilMap
            nivel="uf"
            labels
            fill={(uf) => seqColor(pctUF(uf), Math.min(...vals), Math.max(...vals))}
            tooltip={(uf) => (
              <>
                <div className="t">{UFS[uf]?.nome}</div>
                {p.uf[uf]?.candidatos.slice(0, 4).map((c) => <TipRow key={c.sq} color={COR_ESPECTRO[espectroDe(c.partido)]} label={c.urna} value={pct(c.pct)} />)}
                <div className="tiny">Abstenção {share(p.uf[uf]?.abstencao ?? 0, p.uf[uf]?.eleitorado ?? 0)}</div>
              </>
            )}
          />
          <SeqLegend min={Math.min(...vals)} max={Math.max(...vals)} fmt={pct} />
          {p.uf.ZZ && (
            <p className="tiny" style={{ marginTop: 8 }}>
              Exterior: {p.uf.ZZ.candidatos.slice(0, 3).map((c) => `${c.urna} ${pct(c.pct)}`).join(' · ')} ({num(p.uf.ZZ.validos)} válidos)
            </p>
          )}
        </Card>
      </div>

      <Card title={`${a.urna} × ${b.urna} por região`} sub="Divisão dos votos válidos dados aos dois primeiros colocados">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Exterior'].filter((r) => regiao[r]).map((r) => {
            const va = regiao[r][a.sq] || 0
            const vb = regiao[r][b.sq] || 0
            return (
              <div key={r} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 160px', gap: 10, alignItems: 'center' }}>
                <span className="small">{r}</span>
                <StackBar height={20} segs={[{ key: a.urna, n: va, cor: cores[a.sq] }, { key: b.urna, n: vb, cor: cores[b.sq] }]} />
                <span className="small muted">{share(va, va + vb)} × {share(vb, va + vb)}</span>
              </div>
            )
          })}
          <Legend items={[a, b].map((c) => ({ key: c.urna, cor: cores[c.sq] }))} />
        </div>
      </Card>

      <Card title="Resultado por UF">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>UF</th>
                {br.candidatos.slice(0, 5).map((c) => <th key={c.sq} className="num">{c.urna}</th>)}
                <th className="num">Válidos</th>
                <th className="num">Abstenção</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(p.uf).sort(([x], [y]) => x.localeCompare(y)).map(([uf, r]) => (
                <tr key={uf}>
                  <td>{UFS[uf]?.nome ?? 'Exterior'}</td>
                  {br.candidatos.slice(0, 5).map((c) => {
                    const v = r.candidatos.find((x) => x.sq === c.sq)
                    const lider = r.candidatos[0]?.sq === c.sq
                    return <td key={c.sq} className="num" style={{ fontWeight: lider ? 700 : 400 }}>{v ? pct(v.pct) : '—'}</td>
                  })}
                  <td className="num">{num(r.validos)}</td>
                  <td className="num">{share(r.abstencao, r.eleitorado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
