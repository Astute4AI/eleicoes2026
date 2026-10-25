import { useEffect, useState } from 'react'

/**
 * Resultados ao vivo do 2º turno, lidos direto da API de divulgação do TSE
 * (resultados.tse.jus.br responde com CORS liberado e cache de ~16 s na CDN).
 */
const RESULTADOS = 'https://resultados.tse.jus.br/oficial/ele2026'
// Códigos de eleição do 2º turno (resultados.tse.jus.br/oficial/comum/config/ele-c.json)
const ELEICAO = { federal: '6258', estadual: '6260' }

/** Fechamento das urnas: 17h de Brasília (UTC−3) em 25/10/2026. */
export const INICIO_APURACAO = Date.UTC(2026, 9, 25, 20)
/** Depois disso a página não fica mais consultando o TSE em intervalos. */
const FIM_APURACAO = Date.UTC(2026, 9, 28)
export const INTERVALO_MS = 30_000

export const urlPresidente = (abr: string) => {
  const a = abr.toLowerCase()
  return `${RESULTADOS}/${ELEICAO.federal}/dados/${a}/${a}-c0001-e00${ELEICAO.federal}-u.json`
}
export const urlGovernador = (uf: string) => {
  const a = uf.toLowerCase()
  return `${RESULTADOS}/${ELEICAO.estadual}/dados/${a}/${a}-c0003-e00${ELEICAO.estadual}-u.json`
}

export interface CandAoVivo {
  sq: string
  nr: number
  urna: string
  partido: string
  votos: number
  pct: number
  eleito: boolean
}

export interface ResultadoAoVivo {
  secoes: number
  secoesTotalizadas: number
  /** % das seções totalizadas */
  pctTotalizado: number
  eleitorado: number
  comparecimento: number
  abstencao: number
  validos: number
  brancos: number
  nulos: number
  /** horário da última totalização informado pelo TSE */
  atualizacao: string
  /** totalização encerrada */
  final: boolean
  candidatos: CandAoVivo[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const dec = (s: unknown) => +String(s ?? 0).replace(',', '.') || 0

function parse(j: any): ResultadoAoVivo {
  const candidatos: CandAoVivo[] = (j.carg?.[0]?.agr ?? []).flatMap((a: any) =>
    a.par.flatMap((p: any) =>
      p.cand.map((c: any) => ({ sq: c.sqcand, nr: +c.n, urna: c.nmu, partido: p.sg, votos: +c.vap || 0, pct: dec(c.pvap), eleito: /^eleito/i.test(c.st ?? '') })),
    ),
  )
  candidatos.sort((a, b) => b.votos - a.votos || a.nr - b.nr)
  return {
    secoes: +j.s?.ts || 0,
    secoesTotalizadas: +j.s?.st || 0,
    pctTotalizado: dec(j.s?.pst),
    eleitorado: +j.e?.te || 0,
    comparecimento: +j.e?.c || 0,
    abstencao: +j.e?.a || 0,
    validos: +j.v?.vv || 0,
    brancos: +j.v?.vb || 0,
    nulos: +j.v?.tvn || 0,
    atualizacao: j.dt ? `${j.dt} ${j.ht}` : '',
    final: j.tf === 's',
    candidatos,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** null = arquivo inexistente (sem disputa); undefined = falha temporária. */
async function buscar(url: string): Promise<ResultadoAoVivo | null | undefined> {
  try {
    // no-cache revalida com ETag: barato quando nada mudou
    const r = await fetch(url, { cache: 'no-cache' })
    if (r.status === 403 || r.status === 404) return null
    if (!r.ok) return undefined
    return parse(await r.json())
  } catch {
    return undefined
  }
}

export type Fase = 'aguardando' | 'ao-vivo' | 'final' | 'encerrado'

export interface AoVivo {
  dados: Record<string, ResultadoAoVivo | null>
  carregado: boolean
  atualizadoEm: Date | null
  /** timestamp da próxima consulta agendada */
  proxima: number | null
  fase: Fase
  erro: string | null
  atualizar: () => void
}

/**
 * Consulta os arquivos do TSE uma vez ao abrir; até as 17h fica aguardando e,
 * a partir daí, repete a cada 30 s (pausando com a aba em segundo plano) até
 * todos os arquivos indicarem totalização final.
 */
export function useAoVivo(urls: Record<string, string>, intervalo = INTERVALO_MS): AoVivo {
  const chave = JSON.stringify(urls)
  const [estado, setEstado] = useState<Omit<AoVivo, 'atualizar'>>({ dados: {}, carregado: false, atualizadoEm: null, proxima: null, fase: 'aguardando', erro: null })
  const [rodada, setRodada] = useState(0)

  useEffect(() => {
    const alvos: Record<string, string> = JSON.parse(chave)
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let pendente = false

    async function carregar() {
      clearTimeout(timer)
      const pares = await Promise.all(Object.entries(alvos).map(async ([k, u]) => [k, await buscar(u)] as const))
      if (!vivo) return
      const falhas = pares.filter(([, r]) => r === undefined).length
      const existentes = pares.map(([, r]) => r).filter((r): r is ResultadoAoVivo => !!r)
      const agora = Date.now()
      const final = existentes.length > 0 && existentes.every((r) => r.final)
      const fase: Fase = final ? 'final' : agora < INICIO_APURACAO ? 'aguardando' : agora > FIM_APURACAO ? 'encerrado' : 'ao-vivo'
      const espera = fase === 'aguardando' ? INICIO_APURACAO - agora : fase === 'ao-vivo' ? intervalo : null
      setEstado((prev) => {
        const dados = { ...prev.dados }
        for (const [k, r] of pares) if (r !== undefined) dados[k] = r
        return {
          dados,
          carregado: true,
          atualizadoEm: new Date(),
          proxima: espera == null ? null : agora + espera,
          fase,
          erro: falhas ? `${falhas} arquivo(s) do TSE não responderam; mantendo os últimos dados recebidos.` : null,
        }
      })
      if (espera == null) return
      timer = setTimeout(() => {
        if (document.hidden) {
          pendente = true
          setEstado((prev) => ({ ...prev, proxima: null }))
        } else carregar()
      }, espera)
    }

    const aoVoltar = () => {
      if (!document.hidden && pendente) {
        pendente = false
        carregar()
      }
    }
    document.addEventListener('visibilitychange', aoVoltar)
    carregar()
    return () => {
      vivo = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [chave, intervalo, rodada])

  return { ...estado, atualizar: () => setRodada((n) => n + 1) }
}

/** Re-renderiza a cada `ms` (para contagens regressivas). */
export function useAgora(ms = 1000) {
  const [agora, setAgora] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return agora
}
