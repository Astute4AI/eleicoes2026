import { useMemo } from 'react'
import { CORES_CAT, Legend, StackBar } from '../components/Bars'
import { BrazilMap } from '../components/BrazilMap'
import { TipRow } from '../components/Tooltip'
import { Card, Stat } from '../components/Ui'
import { useData } from '../data/DataContext'
import { UFS } from '../data/types'
import { num, pct, share } from '../lib/format'
import { INICIO_APURACAO, urlGovernador, urlPresidente, useAgora, useAoVivo, type AoVivo, type CandAoVivo, type ResultadoAoVivo } from '../lib/aoVivo'

const ABR_PRESIDENTE = [...Object.keys(UFS), 'ZZ']

export default function SegundoTurno() {
  const { meta, candidatos, porSq } = useData()

  // UFs com 2º turno para governador: pela situação do 1º turno ou, depois da totalização, pelo resumo do 2º turno
  const ufsGov = useMemo(() => {
    const s = new Set(candidatos.filter((c) => c.cargo === 3 && c.situacao === '2º TURNO').map((c) => c.uf))
    Object.keys(meta.segundoTurno?.governador ?? {}).forEach((uf) => s.add(uf))
    return [...s].sort()
  }, [candidatos, meta])

  const urls = useMemo(() => {
    const u: Record<string, string> = { BR: urlPresidente('br') }
    ABR_PRESIDENTE.forEach((abr) => (u[`P-${abr}`] = urlPresidente(abr)))
    ufsGov.forEach((uf) => (u[`G-${uf}`] = urlGovernador(uf)))
    return u
  }, [ufsGov])

  const vivo = useAoVivo(urls)
  const br = vivo.dados.BR

  // cores fixas pela ordem do 1º turno, para não trocarem quando a liderança muda
  const ordem: Ordem = (cs) => [...cs.slice(0, 2)].sort((a, b) => (porSq.get(b.sq)?.votos ?? 0) - (porSq.get(a.sq)?.votos ?? 0) || a.nr - b.nr)
  const pct1t = (sq: string) => meta.presidente?.br.candidatos.find((c) => c.sq === sq)?.pct

  return (
    <>
      <div className="page-head">
        <div>
          <h1>2º turno — {meta.dataSegundoTurno}</h1>
          <p>
            Apuração em tempo real de Presidente e dos governadores {ufsGov.length ? `(${ufsGov.join(', ')})` : ''}, lida direto da divulgação
            oficial do TSE. A partir das 17h (Brasília) a página se atualiza sozinha a cada 30 segundos.
          </p>
        </div>
        <StatusAoVivo vivo={vivo} />
      </div>

      {vivo.erro && <div className="callout">{vivo.erro}</div>}
      {!vivo.carregado && <div className="loading" style={{ minHeight: 240 }}><div className="spinner" />Consultando o TSE…</div>}

      {br && (
        <>
          <Card title="Presidente da República" sub={<Totalizado r={br} />}>
            <Duelo r={br} ordem={ordem} nota={(c) => (pct1t(c.sq) != null ? `1º turno: ${pct(pct1t(c.sq)!)}` : null)} grande />
          </Card>

          <div className="grid g4">
            <Stat label="Seções totalizadas" value={pct(br.pctTotalizado)} sub={`${num(br.secoesTotalizadas)} de ${num(br.secoes)}`} />
            <Stat label="Comparecimento" value={share(br.comparecimento, br.eleitorado)} sub={`${num(br.comparecimento)} eleitores`} />
            <Stat label="Abstenção" value={share(br.abstencao, br.eleitorado)} sub={`${num(br.abstencao)} eleitores`} />
            <Stat label="Brancos e nulos" value={share(br.brancos + br.nulos, br.comparecimento)} sub={`${num(br.brancos)} brancos · ${num(br.nulos)} nulos`} />
          </div>

          <PresidentePorUF vivo={vivo} br={br} ordem={ordem} />
        </>
      )}

      {ufsGov.length > 0 && vivo.carregado && (
        <>
          <h2 style={{ marginTop: 8 }}>Governadores</h2>
          <div className="grid g3">
            {ufsGov.map((uf) => {
              const r = vivo.dados[`G-${uf}`]
              return (
                <Card key={uf} title={UFS[uf]?.nome ?? uf} sub={r ? <Totalizado r={r} /> : 'Sem dados do TSE ainda.'}>
                  {r && <Duelo r={r} ordem={ordem} />}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function StatusAoVivo({ vivo }: { vivo: AoVivo }) {
  const agora = useAgora()
  const hora = (d: Date | number) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  let texto: string
  if (vivo.fase === 'final') texto = 'Totalização concluída'
  else if (vivo.fase === 'encerrado') texto = 'Atualização automática encerrada'
  else if (vivo.fase === 'aguardando') texto = `Apuração começa às 17h · em ${duracao(INICIO_APURACAO - agora)}`
  else if (vivo.proxima) texto = `Ao vivo · próxima em ${Math.max(0, Math.ceil((vivo.proxima - agora) / 1000))}s`
  else texto = 'Ao vivo · pausado em segundo plano'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span className={`live ${vivo.fase}`}>
        <i aria-hidden />
        {texto}
      </span>
      <span className="tiny">
        {vivo.atualizadoEm && `Consultado às ${hora(vivo.atualizadoEm)} · `}
        <button className="link-btn" onClick={vivo.atualizar}>Atualizar agora</button>
      </span>
    </div>
  )
}

function duracao(ms: number) {
  const min = Math.max(0, Math.ceil(ms / 60_000))
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`
}

function Totalizado({ r }: { r: ResultadoAoVivo }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span>
        {pct(r.pctTotalizado)} das seções totalizadas{r.atualizacao && ` · TSE ${r.atualizacao}`}
        {r.final && ' · totalização final'}
      </span>
      <span className="prog" style={{ display: 'block', maxWidth: 320 }}>
        <span style={{ display: 'block', height: '100%', width: `${r.pctTotalizado}%`, background: 'var(--accent)' }} />
      </span>
    </span>
  )
}

/** Os dois finalistas na ordem do 1º turno — define a cor (CORES_CAT) e o lado de cada um. */
type Ordem = (cs: CandAoVivo[]) => CandAoVivo[]

/** Placar de dois candidatos: nomes e % nas pontas e barra dividida com marca dos 50%. */
function Duelo({ r, ordem, nota, grande }: { r: ResultadoAoVivo; ordem: Ordem; nota?: (c: CandAoVivo) => string | null; grande?: boolean }) {
  const [a, b] = ordem(r.candidatos)
  if (!a || !b) return null
  const lado = (c: CandAoVivo, i: number) => (
    <div style={{ textAlign: i ? 'right' : 'left' }}>
      <div className={grande ? 'duelo-nome g' : 'duelo-nome'}>
        {c.urna} <span className="tiny">{c.partido}</span>
        {c.eleito && <span className="badge eleito" style={{ marginLeft: 6 }}>Eleito</span>}
      </div>
      <div className={grande ? 'duelo-pct g' : 'duelo-pct'} style={{ color: CORES_CAT[i] }}>
        {pct(c.pct)}
      </div>
      <div className="tiny">
        {num(c.votos)} votos{nota?.(c) ? ` · ${nota(c)}` : ''}
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        {lado(a, 0)}
        {lado(b, 1)}
      </div>
      <div className="duelo-barra">
        {r.validos > 0 ? (
          <StackBar height={grande ? 30 : 18} segs={[a, b].map((c, i) => ({ key: c.urna, n: c.votos, cor: CORES_CAT[i] }))} />
        ) : (
          <div className="bar-h" style={{ height: grande ? 30 : 18, background: 'var(--surface-2)' }} />
        )}
        <i className="meio" aria-hidden />
      </div>
    </div>
  )
}

function PresidentePorUF({ vivo, br, ordem }: { vivo: AoVivo; br: ResultadoAoVivo; ordem: Ordem }) {
  const [a, b] = ordem(br.candidatos)
  if (!a || !b) return null
  const uf = (abr: string) => vivo.dados[`P-${abr}`]
  const de = (r: ResultadoAoVivo | null | undefined, sq: string) => r?.candidatos.find((c) => c.sq === sq)

  // cor do líder na UF, mais intensa quanto maior a vantagem
  const fill = (abr: string) => {
    const r = uf(abr)
    if (!r?.validos) return undefined
    const [l, s] = r.candidatos
    const margem = l.pct - (s?.pct ?? 0)
    const forca = margem < 2 ? 30 : margem < 5 ? 50 : margem < 10 ? 72 : margem < 20 ? 88 : 100
    return `color-mix(in srgb, ${CORES_CAT[l.sq === a.sq ? 0 : 1]} ${forca}%, var(--map-empty))`
  }

  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Card title="Quem lidera em cada estado" sub="Cor do candidato à frente; mais intensa quanto maior a vantagem (até 2, 5, 10, 20 p.p. ou mais).">
        <BrazilMap
          nivel="uf"
          labels
          fill={fill}
          tooltip={(abr) => {
            const r = uf(abr)
            return (
              <>
                <div className="t">{UFS[abr]?.nome}</div>
                {[a, b].map((c, i) => <TipRow key={c.sq} color={CORES_CAT[i]} label={c.urna} value={pct(de(r, c.sq)?.pct ?? 0)} />)}
                <div className="tiny">{r ? `${pct(r.pctTotalizado)} das seções totalizadas` : 'Sem dados'}</div>
              </>
            )
          }}
        />
        <Legend items={[a, b].map((c, i) => ({ key: c.urna, cor: CORES_CAT[i] }))} />
      </Card>
      <Card title="Resultado por UF">
        <div className="table-wrap" style={{ maxHeight: 620 }}>
          <table>
            <thead>
              <tr>
                <th>UF</th>
                <th className="num">Totalizado</th>
                <th className="num">{a.urna}</th>
                <th className="num">{b.urna}</th>
                <th className="num">Válidos</th>
              </tr>
            </thead>
            <tbody>
              {ABR_PRESIDENTE.map((abr) => {
                const r = uf(abr)
                const lider = r?.validos ? r.candidatos[0]?.sq : null
                return (
                  <tr key={abr}>
                    <td>{UFS[abr]?.nome ?? 'Exterior'}</td>
                    <td className="num">{r ? pct(r.pctTotalizado) : '—'}</td>
                    {[a, b].map((c) => (
                      <td key={c.sq} className="num" style={{ fontWeight: lider === c.sq ? 700 : 400 }}>
                        {r ? pct(de(r, c.sq)?.pct ?? 0) : '—'}
                      </td>
                    ))}
                    <td className="num">{r ? num(r.validos) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
