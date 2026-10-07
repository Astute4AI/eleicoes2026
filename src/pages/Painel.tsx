import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HBars, Legend, StackBar, type BarRow } from '../components/Bars'
import { Parliament } from '../components/Parliament'
import { Badge, Card, Stat, useLinkCandidato } from '../components/Ui'
import { COR_ESPECTRO, ESPECTROS } from '../config/espectro'
import { useData } from '../data/DataContext'
import { CARGOS, UFS, type CargoId } from '../data/types'
import { num, pct, share } from '../lib/format'
import { bancadasPorPartido, COR_GENERO, COR_RACA, ehMulher, ehNegro } from '../lib/helpers'
import { DIM } from '../lib/query'

const CARGOS_PAINEL: CargoId[] = [3, 5, 6, 7, 8]

export default function Painel() {
  const { meta, candidatos, espectroDe } = useData()
  const link = useLinkCandidato()
  const ctx = { espectroDe }

  const eleitos = useMemo(() => candidatos.filter((c) => c.situacao === 'ELEITO'), [candidatos])
  const turno2 = useMemo(() => candidatos.filter((c) => c.situacao === '2º TURNO'), [candidatos])
  const vagasTotais = useMemo(
    () => Object.values(meta.vagas).reduce((a, v) => a + Object.values(v).reduce((x, y) => x + y, 0), 0),
    [meta],
  )
  const mulheres = eleitos.filter(ehMulher).length
  const negros = eleitos.filter(ehNegro).length
  const estados2t = new Set(turno2.filter((c) => c.cargo === 3).map((c) => c.uf))

  const camara = eleitos.filter((c) => c.cargo === 6)
  const senado = eleitos.filter((c) => c.cargo === 5)

  const porCargo = (dim: string, cores: Record<string, string>): BarRow[] =>
    CARGOS_PAINEL.map((cargo) => {
      const xs = eleitos.filter((c) => c.cargo === cargo)
      const ordem = DIM[dim].ordem ?? []
      const cont: Record<string, number> = {}
      xs.forEach((c) => {
        const k = DIM[dim].valor(c, ctx)
        cont[k] = (cont[k] || 0) + 1
      })
      return {
        chave: CARGOS[cargo].plural,
        segs: ordem.filter((k) => cont[k]).map((k) => ({ key: k, n: cont[k], cor: cores[k] ?? 'var(--s-outros)' })),
        valor: num(xs.length),
      }
    })

  const pres = meta.presidente?.br

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Eleições Gerais {meta.ano} — resultado do 1º turno</h1>
          <p>
            Quem foi eleito para Presidente, Governador, Senado, Câmara, Assembleias e Câmara Legislativa do DF, segundo os dados
            oficiais do TSE. Use <Link to="/explorar">Explorar</Link> para cruzar gênero, raça, partido, espectro político e
            estado.
          </p>
        </div>
      </div>

      <div className="grid g4">
        <Stat label="Eleitos no 1º turno" value={num(eleitos.length)} sub={`de ${num(vagasTotais)} vagas · ${num(turno2.length / 2)} vagas vão ao 2º turno`} />
        <Stat label="Mulheres eleitas" value={share(mulheres, eleitos.length)} sub={`${num(mulheres)} eleitas`} />
        <Stat label="Pretos e pardos eleitos" value={share(negros, eleitos.length)} sub={`${num(negros)} eleitos autodeclarados`} />
        <Stat label="2º turno em 25/10" value={`${estados2t.size + 1} disputas`} sub={`Presidente + Governador em ${[...estados2t].sort().join(', ')}`} />
      </div>

      <div className="grid g2">
        {pres && (
          <Card title="Presidente — 1º turno" sub={`${num(pres.validos)} votos válidos · abstenção ${share(pres.abstencao, pres.eleitorado)}`} actions={<Link to="/presidente" className="small">Detalhes →</Link>}>
            <HBars
              labelWidth={170}
              fmt={(n) => pct(n)}
              rows={pres.candidatos.slice(0, 6).map((c) => ({
                chave: c.sq,
                label: (
                  <span>
                    {c.urna} <span className="tiny">{c.partido}</span>
                  </span>
                ),
                segs: [{ key: c.urna, n: c.pct, cor: COR_ESPECTRO[espectroDe(c.partido)] }],
                valor: pct(c.pct),
                nota: `${num(c.votos)} votos · ${c.situacao}`,
              }))}
            />
            <p className="tiny" style={{ marginTop: 10 }}>
              Cor = espectro do partido. {pres.candidatos.filter((c) => /2/.test(c.situacao)).map((c) => c.urna).join(' e ')} disputam o 2º turno.
            </p>
          </Card>
        )}
        <Card title="Governadores" sub={`${eleitos.filter((c) => c.cargo === 3).length} eleitos no 1º turno · ${estados2t.size} estados no 2º turno`} actions={<Link to="/mapa?cargos=3" className="small">Ver no mapa →</Link>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '2px 16px', maxHeight: 330, overflow: 'auto' }}>
            {Object.keys(UFS).map((uf) => {
              const g = candidatos.filter((c) => c.cargo === 3 && c.uf === uf && (c.situacao === 'ELEITO' || c.situacao === '2º TURNO'))
              return (
                <div key={uf} className="person" style={{ alignItems: 'flex-start' }}>
                  <b style={{ width: 28 }}>{uf}</b>
                  <div className="who">
                    {g.map((c) => (
                      <Link key={c.sq} to={link(c.sq)} style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
                        <i className="sw" style={{ background: COR_ESPECTRO[espectroDe(c.partido)] }} />
                        <span className="small" style={{ fontWeight: 600 }}>{c.urna}</span>
                        <span className="tiny">{c.partido}</span>
                      </Link>
                    ))}
                  </div>
                  {g[0] && <Badge situacao={g[0].situacao} />}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Câmara dos Deputados" sub="513 deputados federais eleitos, por partido (esquerda → direita)" actions={<Link to="/partidos?cargos=6" className="small">Partidos →</Link>}>
          <Parliament bancadas={bancadasPorPartido(camara, espectroDe)} total={meta.vagas ? 513 : undefined} />
          <EspectroResumo xs={camara} />
        </Card>
        <Card title="Senado Federal" sub="54 senadores eleitos em 2026 (2/3 da Casa)" actions={<Link to="/partidos?cargos=5" className="small">Partidos →</Link>}>
          <Parliament bancadas={bancadasPorPartido(senado, espectroDe)} total={54} />
          <EspectroResumo xs={senado} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Gênero dos eleitos por cargo" sub="Participação de mulheres e homens entre os eleitos">
          <HBars modo="pct" rows={porCargo('genero', COR_GENERO)} labelWidth={170} />
          <div style={{ marginTop: 10 }}>
            <Legend items={['Feminino', 'Masculino'].map((k) => ({ key: k, cor: COR_GENERO[k] }))} />
          </div>
        </Card>
        <Card title="Cor/raça dos eleitos por cargo" sub="Autodeclaração ao TSE">
          <HBars modo="pct" rows={porCargo('raca', COR_RACA)} labelWidth={170} />
          <div style={{ marginTop: 10 }}>
            <Legend items={['Branca', 'Parda', 'Preta', 'Indígena', 'Amarela'].map((k) => ({ key: k, cor: COR_RACA[k] }))} />
          </div>
        </Card>
        <Card title="Espectro político dos eleitos por cargo" sub="Pela classificação ideológica do partido (editável em Metodologia)" className="span2">
          <HBars modo="pct" rows={porCargo('espectro', COR_ESPECTRO)} labelWidth={170} />
          <div style={{ marginTop: 10 }}>
            <Legend items={ESPECTROS.map((k) => ({ key: k, cor: COR_ESPECTRO[k] }))} />
          </div>
        </Card>
      </div>

      <Card title="Perguntas rápidas" sub="Atalhos para o explorador — todos os filtros podem ser ajustados depois">
        <div className="filterbar">
          {[
            ['Quantas mulheres foram eleitas deputadas federais, por partido?', '/explorar?cargos=6&genero=Feminino&g=partido&s=espectro'],
            ['Mulheres eleitas por cargo e espectro', '/explorar?genero=Feminino&g=cargo&s=espectro'],
            ['Senadores eleitos por estado e espectro', '/explorar?cargos=5&g=uf&s=espectro'],
            ['Deputados estaduais eleitos por raça e espectro', '/explorar?cargos=7,8&g=raca&s=espectro3'],
            ['Faixa etária dos deputados federais', '/explorar?cargos=6&g=idade&s=genero'],
            ['Taxa de sucesso das candidatas', '/explorar?escopo=todos&cargos=6&g=genero&s=situacao'],
            ['Escolaridade dos eleitos', '/explorar?g=instrucao&s=cargo'],
            ['Ocupações mais comuns na Câmara', '/explorar?cargos=6&g=ocupacao&s=espectro3'],
          ].map(([t, to]) => (
            <Link key={to} to={to} className="chip">
              {t}
            </Link>
          ))}
        </div>
      </Card>
    </>
  )
}

function EspectroResumo({ xs }: { xs: { partido: string }[] }) {
  const { espectroDe } = useData()
  const cont: Record<string, number> = {}
  xs.forEach((c) => {
    const e = espectroDe(c.partido)
    cont[e] = (cont[e] || 0) + 1
  })
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <StackBar height={14} segs={ESPECTROS.map((e) => ({ key: e, n: cont[e] || 0, cor: COR_ESPECTRO[e] }))} />
      <Legend items={ESPECTROS.map((e) => ({ key: e, cor: COR_ESPECTRO[e], n: cont[e] || 0 }))} />
    </div>
  )
}
