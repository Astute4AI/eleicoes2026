import { Card } from '../components/Ui'
import { COR_ESPECTRO, ESPECTRO_PADRAO, ESPECTROS, type Espectro } from '../config/espectro'
import { useData } from '../data/DataContext'
import { num, titulo } from '../lib/format'

export default function Metodologia() {
  const { meta, espectro, setEspectro, candidatos } = useData()
  const partidos = Object.keys(meta.partidos).sort()
  const alterados = partidos.filter((p) => espectro[p] !== ESPECTRO_PADRAO[p])
  const eleitosPor = (p: string) => candidatos.filter((c) => c.partido === p && c.situacao === 'ELEITO').length

  const mudar = (p: string, e: Espectro) => {
    const custom: Record<string, Espectro> = {}
    for (const k of partidos) if ((k === p ? e : espectro[k]) !== ESPECTRO_PADRAO[k]) custom[k] = k === p ? e : espectro[k]
    setEspectro(Object.keys(custom).length ? custom : null)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Metodologia</h1>
          <p>De onde vêm os dados, como foram tratados e como o espectro político é definido.</p>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Fontes">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meta.fontes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: 12 }}>
            Arquivos do TSE gerados em {meta.geradoEm}; processados em {new Date(meta.processadoEm).toLocaleString('pt-BR')}. Para atualizar (por exemplo, após o 2º turno), rode{' '}
            <code>npm run data</code> e publique de novo.
          </p>
        </Card>
        <Card title="Tratamento">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }} className="small">
            <li>São analisados os cargos titulares (Presidente, Governador, Senador e Deputados). Vices e suplentes de senador ficam de fora.</li>
            <li>
              “Eleito” inclui as situações do TSE <i>Eleito</i>, <i>Eleito por QP</i> (quociente partidário) e <i>Eleito por média</i>. Quem disputa o 2º
              turno aparece como “2º turno” até a totalização final.
            </li>
            <li>Gênero, cor/raça, escolaridade, ocupação e idade são autodeclarados pelos candidatos no registro de candidatura. A idade é calculada na data da eleição.</li>
            <li>“Negros” segue o critério do IBGE: soma de pretos e pardos.</li>
            <li>
              Votos de deputados e senadores são <b>nominais válidos</b>. Os votos de legenda não aparecem por candidato. O percentual de cada candidato é sobre os
              votos nominais válidos do cargo na UF.
            </li>
            <li>
              Presidente: o resumo (comparecimento e abstenção) vem da divulgação oficial. A votação por município é agregada do arquivo por seção, que pode diferir
              da divulgação em menos de 0,01%.
            </li>
            <li>Municípios ligados às malhas do IBGE pelo código IBGE que o TSE publica.</li>
          </ul>
        </Card>
      </div>

      <Card
        title="Classificação ideológica dos partidos"
        sub="Não existe classificação oficial. A padrão é editorial: baseada em levantamentos acadêmicos com cientistas políticos (ex.: Bolognesi, Ribeiro & Codato, 2023) e na atuação recente das bancadas. Altere à vontade: a escolha fica salva neste navegador e vale para o site todo."
        actions={
          alterados.length ? (
            <button className="btn" onClick={() => setEspectro(null)}>
              Restaurar padrão ({alterados.length} alterados)
            </button>
          ) : undefined
        }
      >
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Partido</th>
                <th>Nome</th>
                <th className="num">Eleitos</th>
                {ESPECTROS.map((e) => (
                  <th key={e} style={{ textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i className="sw" style={{ background: COR_ESPECTRO[e] }} />
                      {e}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partidos.map((p) => (
                <tr key={p}>
                  <td>
                    <b>{p}</b> {espectro[p] !== ESPECTRO_PADRAO[p] && <span className="badge turno2">alterado</span>}
                  </td>
                  <td className="small">{titulo(meta.partidos[p].nome)}</td>
                  <td className="num">{num(eleitosPor(p))}</td>
                  {ESPECTROS.map((e) => (
                    <td key={e} style={{ textAlign: 'center' }}>
                      <input type="radio" name={`esp-${p}`} checked={espectro[p] === e} onChange={() => mudar(p, e)} aria-label={`${p}: ${e}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
