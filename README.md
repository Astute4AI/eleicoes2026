# Eleições 2026 — Análise dos Resultados

Site em React (Vite + TypeScript) para analisar os eleitos nas Eleições Gerais de 2026 no Brasil (Presidente, Governador, Senador e Deputados Federais, Estaduais e Distritais), com dados oficiais do TSE.

## Páginas

| Rota | O que faz |
|---|---|
| `/` Painel | KPIs, Presidente, governadores, hemiciclos da Câmara e do Senado, gênero, raça e espectro por cargo |
| `/segundo-turno` | Apuração do 2º turno (Presidente e governadores) ao vivo, lida no navegador direto de `resultados.tse.jus.br`; a partir das 17h de 25/10 atualiza a cada 30 s até a totalização final. Clique numa UF para ver os municípios (ao vivo) e, num município, a situação de cada seção por zona e o local de votação (nome, endereço e link para o mapa) |
| `/variacao` | Votos ganhos e perdidos por cada finalista a Presidente do 1º para o 2º turno, em mapa de círculos proporcionais (Brasil ou UF) e ranking. Por município até o TSE publicar os boletins de urna do 2º turno (`bweb_2t`); depois, por zona eleitoral (zona posicionada no centro dos seus locais de votação) |
| `/secoes` | Seções com resultado atípico entre os turnos para os finalistas a Presidente: finalista que zerou ou saiu do zero, unanimidade e viradas de 25 p.p. ou mais, com mapa, local de votação e CSV. Seções agregadas em qualquer turno são somadas. Depende dos boletins de urna do 2º turno (`bweb_2t`) |
| `/explorar` | Consulta dinâmica: filtros (cargo, situação, gênero, raça, espectro, partido, federação, UF, região, idade, escolaridade, ocupação) + “agrupar por” e “dividir por”. Tabela e CSV. A consulta fica na URL. |
| `/mapa` | Mapa por UF (recorte filtrado, saldo ideológico, Presidente, Governador) → clique para ver municípios por cargo, candidato ou partido |
| `/presidente` | 1º turno nacional, por UF, por região e exterior; 2º turno quando disponível |
| `/partidos` | Eleitos, taxa de sucesso, perfil da bancada e mapa por partido |
| `/candidatos` | Busca e lista de todas as candidaturas; ficha com mapa de votos por município (`?c=<sq>`) |
| `/metodologia` | Fontes, tratamento e **editor da classificação ideológica** (salvo no navegador) |

## Dados

Os dados ficam em `public/data` e `public/geo` (JSON estático, servido pela CDN da Vercel). Eles são gerados por `scripts/build-data.mjs`:

```bash
npm run data      # baixa do TSE/IBGE (~1,5 GB de zips na 1ª vez) e regenera public/data e public/geo
```

- Os arquivos brutos ficam em `.cache/tse` (ignorado pelo git). Para usar outra pasta: `TSE_CACHE=/caminho npm run data`.
- Fontes: Portal de Dados Abertos do TSE (`consulta_cand`, `votacao_candidato_munzona`, `consulta_vagas`, `votacao_secao_BR` para Presidente), API de divulgação `resultados.tse.jus.br` (comparecimento/abstenção e 2º turno) e API de malhas do IBGE.
- `public/data/locais/{UF}.json` liga cada seção ao seu local de votação, com bairro, coordenadas, eleitores e seção principal das agregadas, a partir do cadastro `eleitorado_local_votacao` (2º turno). Se o CDN não liberar o download, usa os locais da votação por seção do 1º turno.
- `public/data/secoes.json` só é gerado quando o TSE publica o `bweb_2t`: compara a votação por seção do 1º turno com os boletins do 2º turno e guarda apenas as seções atípicas.
- A API de divulgação aplica limite de taxa (HTTP 429). O script espaça as requisições, faz backoff e guarda as respostas em cache.
- **2º turno (25/10/2026):** rode `npm run data` de novo depois da totalização. O script consulta as eleições 6258/6260 e atualiza a situação de Presidente e dos governadores. Para a votação municipal do 2º turno, apague `.cache/tse/votacao_secao_2026_BR*` e `.cache/tse/consulta_cand_2026*` para baixar as versões novas.

A classificação ideológica padrão está em `src/config/espectro.ts`.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```

## Deploy na Vercel

O projeto já tem `vercel.json` (SPA rewrites e cache dos JSON). Basta importar o repositório na Vercel (framework: Vite) ou rodar `npx vercel --prod`. O build **não** baixa dados do TSE: os JSON de `public/` precisam estar commitados.
