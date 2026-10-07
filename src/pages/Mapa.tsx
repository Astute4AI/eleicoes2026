import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { COR_OUTROS, CORES_CAT, HBars, Legend } from '../components/Bars'
import { BrazilMap, SeqLegend, seqColor } from '../components/BrazilMap'
import { FilterBar, useFiltros } from '../components/FilterBar'
import { Parliament } from '../components/Parliament'
import { TipRow } from '../components/Tooltip'
import { Card, PessoaLinha } from '../components/Ui'
import { COR_ESPECTRO, ESPECTROS, para3 } from '../config/espectro'
import { useDadosUF, useData } from '../data/DataContext'
import { CARGOS, UFS, type CargoId, type CargoMunicipal } from '../data/types'
import { num, pct, share } from '../lib/format'
import { bancadasPorPartido, ehMulher } from '../lib/helpers'
import { filtrar } from '../lib/query'

type Camada = 'recorte' | 'espectro' | 'presidente' | 'governador'

const CAMADAS: { id: Camada; nome: string; desc: string }[] = [
  { id: 'recorte', nome: 'Recorte dos eleitos', desc: 'Percentual dos eleitos de cada UF que atendem aos filtros (ex.: % de mulheres)' },
  { id: 'espectro', nome: 'Saldo ideológico', desc: '(direita − esquerda) ÷ total de eleitos dos cargos selecionados' },
  { id: 'presidente', nome: 'Presidente (1º turno)', desc: 'Candidato mais votado em cada UF' },
  { id: 'governador', nome: 'Governador', desc: 'Espectro do partido do eleito (ou do 1º colocado, se houver 2º turno)' },
]

export default function Mapa() {
  const { candidatos, meta, espectroDe, porSq } = useData()
  const [f] = useFiltros()
  const [params, setParams] = useSearchParams()
  const ctx = useMemo(() => ({ espectroDe }), [espectroDe])
  const camada = (params.get('camada') as Camada) || 'recorte'
  const uf = params.get('uf')
  const set = (o: Record<string, string | null>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(o)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    setParams(n, { replace: true })
  }

  // ------------------------------------------------ métricas por UF
  const cargosSel = useMemo(() => (f.cargos.length ? f.cargos : ([3, 5, 6, 7, 8] as CargoId[])), [f.cargos])
  const universo = useMemo(
    () => filtrar(candidatos, { ...f, cargos: cargosSel, dims: {}, busca: '' }, ctx).filter((c) => c.uf !== 'BR'),
    [candidatos, f, cargosSel, ctx],
  )
  const recorte = useMemo(() => filtrar(candidatos, { ...f, cargos: cargosSel }, ctx).filter((c) => c.uf !== 'BR'), [candidatos, f, cargosSel, ctx])
  const temAtributos = Object.values(f.dims).some((v) => v.length)

  const porUF = useMemo(() => {
    const m: Record<string, { tot: number; sel: number; esq: number; dir: number }> = {}
    for (const u of Object.keys(UFS)) m[u] = { tot: 0, sel: 0, esq: 0, dir: 0 }
    universo.forEach((c) => {
      m[c.uf].tot++
      const e = para3(espectroDe(c.partido))
      if (e === 'Esquerda') m[c.uf].esq++
      if (e === 'Direita') m[c.uf].dir++
    })
    recorte.forEach((c) => m[c.uf].sel++)
    return m
  }, [universo, recorte, espectroDe])

  const presUF = useMemo(() => meta.presidente?.uf ?? {}, [meta])
  const presCores = useMemo(() => {
    // até 3 candidatos com cor própria (limite para mapas — demais em "Outros")
    const venc = Object.values(presUF).map((r) => r.candidatos[0]?.sq)
    const ordem = [...new Set(venc)].filter(Boolean).sort((a, b) => venc.filter((x) => x === b).length - venc.filter((x) => x === a).length)
    return Object.fromEntries(ordem.slice(0, 3).map((sq, i) => [sq, CORES_CAT[i]]))
  }, [presUF])

  const govDe = (u: string) =>
    candidatos.filter((c) => c.cargo === 3 && c.uf === u && (c.situacao === 'ELEITO' || c.situacao === '2º TURNO')).sort((a, b) => b.votos - a.votos)

  const valores = Object.entries(porUF).map(([, v]) => (temAtributos ? (v.tot ? v.sel / v.tot : 0) : v.sel))
  const vmin = Math.min(...valores)
  const vmax = Math.max(...valores)

  const fillUF = (id: string): string | undefined => {
    const v = porUF[id]
    if (!v) return undefined
    switch (camada) {
      case 'recorte':
        return seqColor(temAtributos ? (v.tot ? v.sel / v.tot : null) : v.sel, vmin, vmax)
      case 'espectro': {
        if (!v.tot) return undefined
        const s = (v.dir - v.esq) / v.tot
        return COR_ESPECTRO[s <= -0.4 ? 'Esquerda' : s <= -0.12 ? 'Centro-esquerda' : s < 0.12 ? 'Centro' : s < 0.4 ? 'Centro-direita' : 'Direita']
      }
      case 'presidente': {
        const w = presUF[id]?.candidatos[0]
        return w ? presCores[w.sq] ?? COR_OUTROS : undefined
      }
      case 'governador': {
        const g = govDe(id)[0]
        return g ? COR_ESPECTRO[espectroDe(g.partido)] : undefined
      }
    }
  }

  const tipUF = (id: string) => {
    const v = porUF[id]
    const g = govDe(id)
    const p = presUF[id]?.candidatos
    return (
      <>
        <div className="t">{UFS[id]?.nome}</div>
        {camada === 'recorte' && (temAtributos ? <TipRow label="No recorte" value={`${v.sel} de ${v.tot} (${share(v.sel, v.tot)})`} /> : <TipRow label="Eleitos" value={num(v.sel)} />)}
        {camada === 'espectro' && (
          <>
            <TipRow color={COR_ESPECTRO.Esquerda} label="Esquerda + c.-esq." value={`${v.esq} (${share(v.esq, v.tot)})`} />
            <TipRow color={COR_ESPECTRO.Direita} label="Direita + c.-dir." value={`${v.dir} (${share(v.dir, v.tot)})`} />
            <TipRow label="Total de eleitos" value={v.tot} />
          </>
        )}
        {camada === 'presidente' && p?.slice(0, 3).map((c) => <TipRow key={c.sq} color={presCores[c.sq] ?? COR_OUTROS} label={`${c.urna} (${c.partido})`} value={pct(c.pct)} />)}
        {camada === 'governador' &&
          g.map((c) => <TipRow key={c.sq} color={COR_ESPECTRO[espectroDe(c.partido)]} label={`${c.urna} (${c.partido})`} value={c.situacao === 'ELEITO' ? `eleito · ${pct(c.pct)}` : `2º turno · ${pct(c.pct)}`} />)}
        <div className="tiny" style={{ marginTop: 4 }}>Clique para ver os municípios</div>
      </>
    )
  }

  const legenda = () => {
    switch (camada) {
      case 'recorte':
        return <SeqLegend min={vmin} max={vmax} fmt={(n) => (temAtributos ? pct(n * 100) : num(n))} />
      case 'espectro':
        return <Legend items={ESPECTROS.map((e) => ({ key: e === 'Esquerda' ? 'Muito à esquerda' : e === 'Direita' ? 'Muito à direita' : e, cor: COR_ESPECTRO[e] }))} />
      case 'presidente':
        return <Legend items={[...Object.entries(presCores).map(([sq, cor]) => ({ key: porSq.get(sq)?.urna ?? sq, cor })), ...(Object.keys(presCores).length < new Set(Object.values(presUF).map((r) => r.candidatos[0]?.sq)).size ? [{ key: 'Outros', cor: COR_OUTROS }] : [])]} />
      case 'governador':
        return <Legend items={ESPECTROS.map((e) => ({ key: e, cor: COR_ESPECTRO[e] }))} />
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mapa</h1>
          <p>Escolha uma camada e os filtros. Clique num estado para ver os eleitos daquela UF e a votação por município.</p>
        </div>
        <div className="seg">
          {CAMADAS.map((c) => (
            <button key={c.id} className={camada === c.id ? 'on' : ''} onClick={() => set({ camada: c.id })} title={c.desc}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {(camada === 'recorte' || camada === 'espectro') && <FilterBar dims={['genero', 'raca', 'negros', 'espectro', 'partido', 'idade', 'instrucao']} />}

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card
          title={uf ? `${UFS[uf].nome} — municípios` : CAMADAS.find((c) => c.id === camada)!.nome}
          sub={uf ? undefined : CAMADAS.find((c) => c.id === camada)!.desc}
          actions={uf ? <button className="btn" onClick={() => set({ uf: null, mcargo: null, mitem: null })}>← Brasil</button> : undefined}
        >
          {uf ? (
            <MapaMunicipal uf={uf} />
          ) : (
            <>
              <BrazilMap nivel="uf" labels fill={fillUF} tooltip={tipUF} onSelect={(id) => set({ uf: id })} />
              <div style={{ marginTop: 10 }}>{legenda()}</div>
              {camada === 'recorte' && (
                <p className="tiny" style={{ marginTop: 6 }}>
                  {temAtributos ? 'Cor = % dos eleitos da UF que atendem aos filtros de atributos.' : 'Cor = número de eleitos. Adicione filtros (ex.: Gênero = Feminino) para ver percentuais.'}
                </p>
              )}
            </>
          )}
        </Card>
        {uf ? <PainelUF uf={uf} /> : <RankingUF porUF={porUF} temAtributos={temAtributos} onSelect={(u) => set({ uf: u })} />}
      </div>
    </>
  )
}

function RankingUF({ porUF, temAtributos, onSelect }: { porUF: Record<string, { tot: number; sel: number; esq: number; dir: number }>; temAtributos: boolean; onSelect: (uf: string) => void }) {
  const linhas = Object.entries(porUF)
    .map(([uf, v]) => ({ uf, ...v, val: temAtributos ? (v.tot ? v.sel / v.tot : 0) : v.sel }))
    .sort((a, b) => b.val - a.val)
  return (
    <Card title="Ranking por UF" sub={temAtributos ? '% dos eleitos que atendem ao recorte' : 'Eleitos nos cargos selecionados'}>
      <HBars
        labelWidth={130}
        onClick={onSelect}
        rows={linhas.map((l) => ({
          chave: l.uf,
          label: UFS[l.uf].nome,
          segs: [{ key: l.uf, n: temAtributos ? l.val * 100 : l.val, cor: 'var(--s1)' }],
          valor: temAtributos ? `${pct(l.val * 100)} (${l.sel})` : num(l.val),
          nota: `Esquerda ${l.esq} · Direita ${l.dir} · Total ${l.tot}`,
        }))}
        fmt={(n) => (temAtributos ? pct(n) : num(n))}
      />
    </Card>
  )
}

// ------------------------------------------------------------------ UF

function PainelUF({ uf }: { uf: string }) {
  const { candidatos, espectroDe, meta } = useData()
  const daUF = candidatos.filter((c) => c.uf === uf)
  const eleitos = daUF.filter((c) => c.situacao === 'ELEITO' || c.situacao === '2º TURNO')
  const por = (cargo: CargoId) => eleitos.filter((c) => c.cargo === cargo).sort((a, b) => b.votos - a.votos)
  const assembleia: CargoId = uf === 'DF' ? 8 : 7
  const fed = por(6)
  const est = por(assembleia).filter((c) => c.situacao === 'ELEITO')
  const todosEleitos = daUF.filter((c) => c.situacao === 'ELEITO')
  const pres = meta.presidente?.uf[uf]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title={UFS[uf].nome} sub={`${UFS[uf].regiao} · ${num(todosEleitos.length)} eleitos · ${share(todosEleitos.filter(ehMulher).length, todosEleitos.length)} mulheres`}>
        <h3 style={{ marginBottom: 4 }}>Governador</h3>
        <ul className="list-reset">{por(3).map((c) => <PessoaLinha key={c.sq} c={c} />)}</ul>
        <h3 style={{ margin: '12px 0 4px' }}>Senado</h3>
        <ul className="list-reset">{por(5).map((c) => <PessoaLinha key={c.sq} c={c} />)}</ul>
        {pres && (
          <>
            <h3 style={{ margin: '12px 0 4px' }}>Presidente na UF (1º turno)</h3>
            <HBars
              labelWidth={150}
              fmt={pct}
              rows={pres.candidatos.slice(0, 4).map((c) => ({ chave: c.sq, label: `${c.urna} (${c.partido})`, segs: [{ key: c.urna, n: c.pct, cor: COR_ESPECTRO[espectroDe(c.partido)] }], valor: pct(c.pct), nota: `${num(c.votos)} votos` }))}
            />
          </>
        )}
      </Card>
      <Card title={`Bancada federal — ${fed.length} deputados`} actions={<Link className="small" to={`/explorar?cargos=6&uf=${uf}&g=partido&s=genero`}>Explorar →</Link>}>
        <Parliament bancadas={bancadasPorPartido(fed, espectroDe)} />
      </Card>
      <Card title={`${uf === 'DF' ? 'Câmara Legislativa' : 'Assembleia Legislativa'} — ${est.length} deputados`} actions={<Link className="small" to={`/explorar?cargos=${assembleia}&uf=${uf}&g=partido&s=genero`}>Explorar →</Link>}>
        <Parliament bancadas={bancadasPorPartido(est, espectroDe)} />
        <div style={{ marginTop: 8 }}>
          <Legend items={ESPECTROS.map((e) => ({ key: e, cor: COR_ESPECTRO[e] }))} />
        </div>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ Municípios

function MapaMunicipal({ uf }: { uf: string }) {
  const { data, loading } = useDadosUF(uf)
  const { porSq, espectroDe } = useData()
  const [params, setParams] = useSearchParams()
  const set = (o: Record<string, string | null>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(o)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    setParams(n, { replace: true })
  }

  const cargosDisp = data ? (Object.keys(data.cargos).map(Number) as CargoId[]).sort((a, b) => a - b) : []
  const mcargo = (Number(params.get('mcargo')) || (cargosDisp.includes(1) ? 1 : 3)) as CargoId
  const g = data?.cargos[mcargo]
  const majoritario = mcargo === 1 || mcargo === 3 || mcargo === 5
  const mitem = params.get('mitem') // sq do candidato ou sigla do partido

  const idx = useMemo(() => new Map(data?.municipios.map((m, i) => [m[1], i]) ?? []), [data])

  // vencedores por município (candidato p/ majoritários, partido p/ proporcionais)
  const venc = useMemo(() => {
    if (!g) return { porMun: [] as (string | null)[], cores: {} as Record<string, string>, ordem: [] as string[] }
    const porMun = g.total.map((_, i) => {
      if (majoritario) return g.top[i]?.[0]?.[0] ?? null
      let best: string | null = null
      let bv = 0
      for (const [p, arr] of Object.entries(g.partidos)) if (arr[i] > bv) [best, bv] = [p, arr[i]]
      return best
    })
    const cont: Record<string, number> = {}
    porMun.forEach((k) => k && (cont[k] = (cont[k] || 0) + 1))
    const ordem = Object.keys(cont).sort((a, b) => cont[b] - cont[a])
    return { porMun, cores: Object.fromEntries(ordem.slice(0, 3).map((k, i) => [k, CORES_CAT[i]])), ordem }
  }, [g, majoritario])

  const serie = (m: CargoMunicipal, item: string) => (majoritario ? m.cand?.[item] : m.partidos[item])
  const share_i = (i: number) => {
    if (!g || !mitem) return null
    const s = serie(g, mitem)
    return s && g.total[i] ? s[i] / g.total[i] : null
  }
  const shares = g && mitem ? g.total.map((_, i) => share_i(i) ?? 0) : []
  const smax = Math.max(0.01, ...shares)

  const nome = (k: string) => (majoritario ? porSq.get(k)?.urna ?? k : k)

  if (loading || !data) return <div className="loading" style={{ minHeight: 300 }}><div className="spinner" /></div>

  const opcoes = g
    ? majoritario
      ? Object.keys(g.cand ?? {}).map((sq) => ({ k: sq, v: g.cand![sq].reduce((a, b) => a + b, 0) })).sort((a, b) => b.v - a.v)
      : Object.entries(g.partidos).map(([p, arr]) => ({ k: p, v: arr.reduce((a, b) => a + b, 0) })).sort((a, b) => b.v - a.v)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="filterbar">
        <div className="seg">
          {cargosDisp.map((c) => (
            <button key={c} className={mcargo === c ? 'on' : ''} onClick={() => set({ mcargo: String(c), mitem: null })}>
              {CARGOS[c].curto}
            </button>
          ))}
        </div>
        <select value={mitem ?? ''} onChange={(e) => set({ mitem: e.target.value || null })} aria-label="Candidato ou partido">
          <option value="">Mais votado em cada município</option>
          {opcoes.map((o) => (
            <option key={o.k} value={o.k}>
              % de {majoritario ? `${nome(o.k)} (${porSq.get(o.k)?.partido ?? ''})` : `votos nominais no ${o.k}`}
            </option>
          ))}
        </select>
      </div>
      {!g ? (
        <p className="muted small">Sem dados de votação municipal para este cargo.</p>
      ) : (
        <>
          <BrazilMap
            nivel={uf}
            height={520}
            fill={(ibge) => {
              const i = idx.get(ibge)
              if (i === undefined) return undefined
              if (mitem) return seqColor(share_i(i), 0, smax)
              const k = venc.porMun[i]
              return k ? venc.cores[k] ?? COR_OUTROS : undefined
            }}
            tooltip={(ibge) => {
              const i = idx.get(ibge)
              if (i === undefined) return 'Sem dados'
              const [, , nm] = data.municipios[i]
              const linhas = majoritario
                ? (g.top[i] ?? []).map(([sq, v]) => ({ k: sq, v }))
                : Object.entries(g.partidos).map(([p, arr]) => ({ k: p, v: arr[i] })).sort((a, b) => b.v - a.v).slice(0, 4)
              return (
                <>
                  <div className="t">{nm}</div>
                  {mitem && <TipRow label={nome(mitem)} value={pct((share_i(i) ?? 0) * 100)} />}
                  {linhas.map((l) => (
                    <TipRow key={l.k} color={majoritario ? venc.cores[l.k] ?? COR_OUTROS : COR_ESPECTRO[espectroDe(l.k)]} label={nome(l.k)} value={share(l.v, g.total[i])} />
                  ))}
                  <div className="tiny">{num(g.total[i])} votos nominais válidos</div>
                </>
              )
            }}
          />
          {mitem ? (
            <SeqLegend min={0} max={smax} fmt={(n) => pct(n * 100)} />
          ) : (
            <Legend
              items={[
                ...Object.entries(venc.cores).map(([k, cor]) => ({ key: nome(k), cor, n: venc.porMun.filter((x) => x === k).length })),
                ...(venc.ordem.length > 3 ? [{ key: 'Outros', cor: COR_OUTROS, n: venc.porMun.filter((x) => x && !venc.cores[x]).length }] : []),
              ]}
            />
          )}
          <p className="tiny">
            {mitem ? 'Percentual dos votos nominais válidos no município.' : `Cor = ${majoritario ? 'candidato' : 'partido'} mais votado; número = municípios vencidos.`}
            {!majoritario && ' Para cargos proporcionais considera apenas votos nominais (votos de legenda não são publicados por município neste conjunto).'}
          </p>
        </>
      )}
    </div>
  )
}

