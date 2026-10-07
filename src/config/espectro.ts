/**
 * Classificação ideológica dos partidos.
 *
 * Não existe classificação oficial: esta é uma proposta editorial baseada em
 * levantamentos acadêmicos (ex.: Bolognesi, Ribeiro & Codato, 2023 — survey com
 * cientistas políticos) e no posicionamento recente das bancadas. O usuário pode
 * alterá-la na página "Metodologia" — a escolha fica salva no navegador.
 */
export type Espectro = 'Esquerda' | 'Centro-esquerda' | 'Centro' | 'Centro-direita' | 'Direita'
export type Espectro3 = 'Esquerda' | 'Centro' | 'Direita'

export const ESPECTROS: Espectro[] = ['Esquerda', 'Centro-esquerda', 'Centro', 'Centro-direita', 'Direita']
export const ESPECTROS3: Espectro3[] = ['Esquerda', 'Centro', 'Direita']

export const ESPECTRO_PADRAO: Record<string, Espectro> = {
  PT: 'Esquerda',
  PSOL: 'Esquerda',
  PCDOB: 'Esquerda',
  PCB: 'Esquerda',
  PSTU: 'Esquerda',
  PCO: 'Esquerda',
  UP: 'Esquerda',
  REDE: 'Centro-esquerda',
  PSB: 'Centro-esquerda',
  PDT: 'Centro-esquerda',
  PV: 'Centro-esquerda',
  MDB: 'Centro',
  PSDB: 'Centro',
  CIDADANIA: 'Centro',
  PSD: 'Centro',
  SOLIDARIEDADE: 'Centro',
  AVANTE: 'Centro',
  MOBILIZA: 'Centro',
  'UNIÃO': 'Centro-direita',
  PP: 'Centro-direita',
  PODE: 'Centro-direita',
  REPUBLICANOS: 'Centro-direita',
  AGIR: 'Centro-direita',
  DC: 'Centro-direita',
  PRD: 'Direita',
  PL: 'Direita',
  NOVO: 'Direita',
  'MISSÃO': 'Direita',
  PRTB: 'Direita',
  DEMOCRATA: 'Direita',
}

export const para3 = (e: Espectro): Espectro3 =>
  e === 'Esquerda' || e === 'Centro-esquerda' ? 'Esquerda' : e === 'Centro' ? 'Centro' : 'Direita'

/** Cores divergentes: vermelho (esquerda) ↔ cinza ↔ azul (direita). Referenciam tokens CSS. */
export const COR_ESPECTRO: Record<Espectro, string> = {
  Esquerda: 'var(--esp-esq)',
  'Centro-esquerda': 'var(--esp-cesq)',
  Centro: 'var(--esp-centro)',
  'Centro-direita': 'var(--esp-cdir)',
  Direita: 'var(--esp-dir)',
}
export const COR_ESPECTRO3: Record<Espectro3, string> = {
  Esquerda: 'var(--esp-esq)',
  Centro: 'var(--esp-centro)',
  Direita: 'var(--esp-dir)',
}
