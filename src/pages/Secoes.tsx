import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { useMemo, useState } from 'react'
import { CORES_CAT } from '../components/Bars'
import { TipRow, useTooltip } from '../components/Tooltip'
import { Card, Stat } from '../components/Ui'
import { useJSON } from '../data/DataContext'
import { UFS } from '../data/types'
import { downloadCsv, num, pct } from '../lib/format'

/**
 * public/data/secoes.json — seções com resultado atípico entre os turnos. Linhas:
 * [uf, mun, município, zona, seções, local, endereço, bairro, lat, lon, aptos2,
 *  comparecimento1, comparecimento2, a1, a2, b1, b2, válidos1, válidos2, tipo de urna no 2º turno]
 */
type Linha = [string, number, string, number, string, string, string, string, number | null, number | null, number, number, number, number, number, number, number, number, number, string]
interface SecoesJSON {
  candidatos: { nr: number; urna: string; partido: string }[]
  comparadas: number
  fonte: string
  linhas: Linha[]
}

interface Secao {
  chave: string
  uf: string
  municipio: string
  zona: number
  secoes: string
  local: string
  endereco: string
  bairro: string
  lat: number | null
  lon: number | null
  aptos: number
  comp: [number, number]
  /** votos de cada finalista: [1º turno, 2º turno] */
  v: [[number, number], [number, number]]
  urna: string
}

type Indicador = 'zerou' | 'surgiu' | 'unanime' | 'virada'

const INDICADORES: { id: Indicador; nome: string; desc: string }[] = [
  { id: 'zerou', nome: 'Zerou no 2º turno', desc: 'O finalista teve votos na seção no 1º turno e nenhum no 2º.' },
  { id: 'surgiu', nome: 'Saiu do zero', desc: 'O finalista não teve votos no 1º turno e recebeu 10 ou mais no 2º.' },
  { id: 'unanime', nome: 'Unanimidade', desc: 'Todos os votos válidos do 2º turno (30 ou mais) foram para o mesmo finalista.' },
  { id: 'virada', nome: 'Virada de 25 p.p.+', desc: 'A divisão dos votos entre os dois finalistas mudou 25 pontos percentuais ou mais (com 50+ votos nos dois em cada turno).' },
]

const fatia = (s: Secao, t: 0 | 1) => {
  const tot = s.v[0][t] + s.v[1][t]
  return tot ? s.v[0][t] / tot : 0
}

/** Finalistas (0, 1) para quem a seção se encaixa no indicador. */
function afetados(s: Secao, ind: Indicador, minimo: number): number[] {
  return [0, 1].filter((i) => {
    const [v1, v2] = s.v[i]
    if (ind === 'zerou') return v1 >= Math.max(1, minimo) && v2 === 0
    if (ind === 'surgiu') return v1 === 0 && v2 >= Math.max(10, minimo)
    const val2 = s.v[0][1] + s.v[1][1]
    if (ind === 'unanime') return val2 >= Math.max(30, minimo) && v2 === val2
    // virada: a favor de i
    const d = (fatia(s, 1) - fatia(s, 0)) * (i === 0 ? 1 : -1)
    return s.v[0][0] + s.v[1][0] >= Math.max(50, minimo) && val2 >= 50 && d >= 0.25
  })
}

/** Quanto pesa a seção no indicador (ordena a tabela e dimensiona o ponto no mapa). */
function peso(s: Secao, ind: Indicador, i: number) {
  if (ind === 'zerou') return s.v[i][0]
  if (ind === 'virada') return Math.abs(fatia(s, 1) - fatia(s, 0)) * 100
  return s.v[i][1]
}

const LIMITE_TABELA = 300

export default function Secoes() {
  const { data, loading, error } = useJSON<SecoesJSON>('/data/secoes.json')
  const [ind, setInd] = useState<Indicador>('zerou')
  const [ci, setCi] = useState<number | null>(0)
  const [uf, setUf] = useState<string | null>(null)
  const [minimo, setMinimo] = useState(10)

  const todas = useMemo<Secao[]>(
    () =>
      (data?.linhas ?? []).map((l) => ({
        chave: `${l[0]}-${l[1]}-${l[3]}-${l[4]}`,
        uf: l[0], municipio: l[2], zona: l[3], secoes: l[4], local: l[5], endereco: l[6], bairro: l[7], lat: l[8], lon: l[9],
        aptos: l[10], comp: [l[11], l[12]], v: [[l[13], l[14]], [l[15], l[16]]], urna: l[19],
      })),
    [data],
  )

  const achadas = useMemo(
    () =>
      todas
        .filter((s) => !uf || s.uf === uf)
        .flatMap((s) => afetados(s, ind, minimo).filter((i) => ci === null || i === ci).map((i) => ({ s, i, peso: peso(s, ind, i) })))
        .sort((a, b) => b.peso - a.peso),
    [todas, uf, ind, minimo, ci],
  )

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (error || !data) {
    return (
      <Card title="Seções com resultado atípico">
        Esta análise compara cada seção eleitoral nos dois turnos e depende dos boletins de urna do 2º turno nos dados abertos do TSE, que
        ainda não foram publicados. A página é preenchida na primeira atualização depois da publicação.
      </Card>
    )
  }

  const nomes = data.candidatos.map((c) => c.urna)
  const indicador = INDICADORES.find((x) => x.id === ind)!
  const votos1 = achadas.reduce((t, a) => t + a.s.v[a.i][0], 0)
  const votos2 = achadas.reduce((t, a) => t + a.s.v[a.i][1], 0)
  const municipios = new Set(achadas.map((a) => `${a.s.uf}|${a.s.municipio}`)).size
  const manuais = achadas.filter((a) => a.s.urna && !/^apurada$/i.test(a.s.urna)).length

  const baixar = () =>
    downloadCsv(`secoes-${ind}${uf ? `-${uf}` : ''}.csv`, [
      ['UF', 'Município', 'Zona', 'Seções', 'Local de votação', 'Endereço', 'Bairro', 'Aptos 2º turno', 'Comparecimento 1º turno', 'Comparecimento 2º turno',
        `${nomes[0]} 1º turno`, `${nomes[0]} 2º turno`, `${nomes[1]} 1º turno`, `${nomes[1]} 2º turno`, 'Tipo de urna 2º turno', 'Finalista afetado'],
      ...achadas.map(({ s, i }) => [s.uf, s.municipio, s.zona, s.secoes, s.local, s.endereco, s.bairro, s.aptos, s.comp[0], s.comp[1],
        s.v[0][0], s.v[0][1], s.v[1][0], s.v[1][1], s.urna, nomes[i]]),
    ])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Seções com resultado atípico entre os turnos</h1>
          <p>
            Compara a votação dos dois finalistas a Presidente em cada seção eleitoral no 1º e no 2º turno e destaca mudanças incomuns. Seções
            agregadas em qualquer dos turnos são comparadas juntas. Um resultado atípico não é, por si só, sinal de irregularidade: veja as
            explicações comuns no fim da página.
          </p>
        </div>
      </div>

      <div className="filterbar">
        <div className="seg">
          {INDICADORES.map((x) => (
            <button key={x.id} className={x.id === ind ? 'on' : ''} onClick={() => setInd(x.id)} title={x.desc}>{x.nome}</button>
          ))}
        </div>
        <div className="seg">
          {data.candidatos.map((c, i) => (
            <button key={c.nr} className={i === ci ? 'on' : ''} onClick={() => setCi(i)}>
              <i className="sw" style={{ background: CORES_CAT[i], marginRight: 6 }} />
              {c.urna}
            </button>
          ))}
          <button className={ci === null ? 'on' : ''} onClick={() => setCi(null)}>Ambos</button>
        </div>
        <select value={uf ?? ''} onChange={(e) => setUf(e.target.value || null)} aria-label="Estado">
          <option value="">Brasil</option>
          {Object.keys(UFS).map((sg) => (
            <option key={sg} value={sg}>{UFS[sg].nome}</option>
          ))}
          <option value="ZZ">Exterior</option>
        </select>
        <label className="small muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {ind === 'zerou' ? 'Mínimo de votos no 1º turno' : 'Mínimo de votos'}
          <input type="number" min={1} value={minimo} onChange={(e) => setMinimo(Math.max(1, +e.target.value || 1))} style={{ width: 72 }} />
        </label>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>{indicador.desc}</p>

      <div className="grid g4">
        <Stat label="Seções encontradas" value={num(achadas.length)} sub={`de ${num(data.comparadas)} seções comparadas`} />
        {ind === 'zerou' ? (
          <Stat label="Votos no 1º turno" value={num(votos1)} sub="que o finalista tinha nessas seções" />
        ) : (
          <Stat label="Votos no 2º turno" value={num(votos2)} sub={`contra ${num(votos1)} no 1º turno`} />
        )}
        <Stat label="Municípios" value={num(municipios)} sub={`${num(new Set(achadas.map((a) => a.s.uf)).size)} UFs`} />
        <Stat label="Urnas não apuradas normalmente" value={num(manuais)} sub="votação manual ou outro tipo no 2º turno" />
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card
          title={`${indicador.nome}: onde estão as seções`}
          sub={uf ? 'Contorno dos municípios ao fundo.' : 'Clique num estado para aproximar.'}
          actions={uf && <button className="btn" onClick={() => setUf(null)}>Brasil</button>}
        >
          <MapaSecoes uf={uf === 'ZZ' ? null : uf} achadas={achadas} ind={ind} nomes={nomes} onUF={setUf} />
        </Card>
        <Card title="Antes de tirar conclusões">
          <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>
              <b>Seções agregadas ou desmembradas.</b> Uma seção pode ser agregada a outra num turno e não no outro, e os votos aparecem só na
              seção principal. A comparação já soma essas seções, mas mudanças que não constam no cadastro do TSE ainda podem gerar falsos
              zeros.
            </li>
            <li>
              <b>Urna substituída ou votação manual.</b> Quando a urna falha, os votos podem ser apurados em cédula e digitados depois; erros de
              digitação aparecem como resultados estranhos. A etiqueta ao lado do local de votação mostra esses casos.
            </li>
            <li>
              <b>Comunidades pequenas e homogêneas.</b> Aldeias indígenas, quilombos e comunidades isoladas costumam votar de forma muito
              concentrada, e unanimidades são comuns.
            </li>
            <li>
              <b>Mudança de eleitorado.</b> Seções de voto em trânsito, presídios e unidades de internação recebem eleitores diferentes a cada
              turno.
            </li>
            <li>
              Os boletins de urna são públicos e podem ser conferidos no site de resultados do TSE. Indícios de irregularidade devem ser
              levados à Justiça Eleitoral, que é quem pode verificá-los.
            </li>
          </ul>
        </Card>
      </div>

      <Card
        title={`Seções${uf ? ` — ${uf === 'ZZ' ? 'Exterior' : UFS[uf]?.nome}` : ''}`}
        sub={`${achadas.length > LIMITE_TABELA ? `As ${LIMITE_TABELA} mais relevantes de ${num(achadas.length)}. ` : ''}Fonte: ${data.fonte}.`}
        actions={achadas.length > 0 && <button className="btn" onClick={baixar}>Baixar CSV</button>}
      >
        {achadas.length === 0 ? (
          <div className="muted small">Nenhuma seção com esses critérios.</div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 640 }}>
            <table>
              <thead>
                <tr>
                  <th>Seção</th>
                  <th className="num">Compar.</th>
                  {nomes.map((n) => (
                    <th key={n} className="num">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {achadas.slice(0, LIMITE_TABELA).map(({ s, i }) => (
                  <tr key={`${s.chave}-${i}`}>
                    <td>
                      <div>
                        {s.municipio} <span className="tiny">{s.uf} · zona {s.zona} · seção {s.secoes}</span>
                      </div>
                      <div className="tiny" title={s.endereco}>
                        {s.local ? (
                          <a href={linkMapa(s)} target="_blank" rel="noreferrer">{s.local.length > 50 ? `${s.local.slice(0, 49)}…` : s.local}</a>
                        ) : 'local não informado'}
                        {s.bairro && ` · ${s.bairro}`}
                        {s.urna && !/^apurada$/i.test(s.urna) && <span className="badge" style={{ marginLeft: 6 }}>{s.urna}</span>}
                      </div>
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{num(s.comp[0])} → {num(s.comp[1])}</td>
                    {[0, 1].map((k) => (
                      <td key={k} className="num" style={{ fontWeight: k === i ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {num(s.v[k][0])} → {num(s.v[k][1])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function linkMapa(s: Secao) {
  const q = s.lat != null && s.lon != null ? `${s.lat},${s.lon}` : `${s.local}, ${s.endereco}, ${s.municipio} - ${s.uf}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

interface Feature {
  type: 'Feature'
  id: string
  geometry: unknown
}

const W = 600

/** Um ponto por seção no local de votação, sobre o contorno do Brasil ou da UF. */
function MapaSecoes({ uf, achadas, ind, nomes, onUF }: { uf: string | null; achadas: { s: Secao; i: number; peso: number }[]; ind: Indicador; nomes: string[]; onUF: (uf: string) => void }) {
  const H = uf ? 520 : 560
  const geo = useJSON<{ type: 'FeatureCollection'; features: Feature[] }>(uf ? `/geo/mun/${uf}.json` : '/geo/uf.json')
  const tip = useTooltip()

  const desenho = useMemo(() => {
    if (!geo.data) return null
    const proj = geoMercator().fitSize([W, H], geo.data as unknown as GeoPermissibleObjects)
    const path = geoPath(proj)
    return { proj, formas: geo.data.features.map((f) => ({ id: String(f.id), d: path(f as unknown as GeoPermissibleObjects) ?? '' })) }
  }, [geo.data, H])

  const pontos = useMemo(() => {
    if (!desenho) return []
    const max = Math.max(1, ...achadas.map((a) => a.peso))
    return achadas
      .filter((a) => a.s.lat != null && a.s.lon != null)
      .map((a) => {
        const [x, y] = desenho.proj([a.s.lon!, a.s.lat!]) ?? [0, 0]
        return { ...a, x, y, r: Math.max(2, (uf ? 9 : 7) * Math.sqrt(a.peso / max)) }
      })
      .sort((a, b) => b.r - a.r)
  }, [desenho, achadas, uf])

  if (geo.error) return <div className="muted small">Erro ao carregar o mapa.</div>
  if (!desenho) return <div className="loading" style={{ minHeight: H / 1.6 }}><div className="spinner" /></div>

  const semLocal = achadas.length - pontos.length
  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa das seções com resultado atípico">
        {desenho.formas.map((f) => (
          <path key={f.id} d={f.d} fill="var(--map-empty)" style={{ cursor: uf ? undefined : 'pointer' }} onClick={() => !uf && onUF(f.id)} />
        ))}
        {pontos.map(({ s, i, x, y, r }) => (
          <circle
            key={`${s.chave}-${i}`}
            cx={x}
            cy={y}
            r={r}
            className="bolha"
            fill={CORES_CAT[i]}
            onMouseMove={(e) =>
              tip.show(
                e,
                <>
                  <div className="t">{s.municipio} ({s.uf}) · zona {s.zona} · seção {s.secoes}</div>
                  {s.local && <div className="tiny">{s.local}</div>}
                  <TipRow label="Comparecimento" value={`${num(s.comp[0])} → ${num(s.comp[1])}`} />
                  {[0, 1].map((k) => (
                    <TipRow key={k} color={CORES_CAT[k]} label={nomes[k]} value={`${num(s.v[k][0])} → ${num(s.v[k][1])}`} />
                  ))}
                  {ind === 'virada' && <TipRow label={`Fatia de ${nomes[0]}`} value={`${pct(fatia(s, 0) * 100)} → ${pct(fatia(s, 1) * 100)}`} />}
                </>,
              )
            }
            onMouseLeave={tip.hide}
            onClick={() => !uf && onUF(s.uf)}
          />
        ))}
      </svg>
      {tip.node}
      <div className="legend" style={{ marginTop: 8, alignItems: 'center' }}>
        {nomes.map((n, k) => (
          <span key={n}><i className="sw" style={{ background: CORES_CAT[k], borderRadius: '50%' }} />{n}</span>
        ))}
        {semLocal > 0 && <span className="tiny">{num(semLocal)} sem coordenadas do local</span>}
      </div>
    </div>
  )
}
