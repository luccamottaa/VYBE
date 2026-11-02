# vybe

**do play ao topo.** Painel de charts musicais com rankings por país, streams, busca e histórico de posições.

## Site

- GitHub Pages: https://luccamottaa.github.io/VYBE/ (estático, atualizado por GitHub Action)

https://vybe.luccamotta.chatgpt.site — acesso privado nesta primeira versão.

## Funcionalidades

- Apple Music Top 100: Brasil, Estados Unidos, Coreia do Sul, Japão e Reino Unido.
- Spotify Top 200 diário (Global, Brasil, EUA, Coreia do Sul, Japão e Reino Unido) via kworb.net, com streams do dia, total, pico e dias no chart. Se o kworb falhar, o Global usa o Top 50 semanal público do Spotify.
- Last.fm: ouvintes e scrobbles das faixas do topo (opcional, precisa de chave).
- Cruzamento entre fontes: posição da mesma faixa no Spotify e nos 5 países da Apple.
- Coleta automática por Cron Trigger (06:17 e 15:17 UTC).
- Busca dentro do ranking selecionado.
- Painel de cada faixa, com posições e evolução em 7, 30 ou 90 dias.
- Histórico persistente em Cloudflare D1: um registro por data do feed e país.
- Cache de até uma hora e último ranking disponível quando a fonte falha.
- Layout responsivo em português brasileiro, com tema claro e escuro conforme o aparelho.

## Limites desta versão

A coleta roda por Cron Trigger e também ao abrir o ranking. O histórico começa com os registros do VYBE e não é retroativo. Variações comparam o registro atual ao anterior disponível.

O Spotify não tem API pública de charts. Os streams vêm do kworb.net (não oficial, lido do HTML) e o fallback usa o JSON público do charts.spotify.com; os dois podem quebrar se mudarem o formato. MyStreamCount, Last.fm, Billboard, YouTube e Circle ainda não estão integrados.

## GitHub Pages

O Pages não roda servidor, então lá o vybe funciona assim:

1. `.github/workflows/pages.yml` roda às 06:17 e 15:17 UTC (e a cada push na `main`).
2. `scripts/pages/collect.ts` busca Apple Music e Spotify e atualiza o histórico em JSON na branch `data`.
3. O site é gerado com `vite.pages.config.ts` (`VITE_STATIC=1`) e lê `data/*.json` no lugar das rotas `/api`.

Para ativar: Settings → Pages → Source: **GitHub Actions**.

Last.fm (opcional): crie uma chave grátis em https://www.last.fm/api/account/create e salve em Settings → Secrets and variables → Actions → New repository secret, com o nome `LASTFM_API_KEY`. Repositório privado exige GitHub Pro, e o site publicado é público.

```sh
node scripts/pages/collect.ts data-store          # coleta local
VITE_STATIC=1 pnpm exec vite build -c vite.pages.config.ts
```

## vybe-api (Vercel)

`api-proxy/` é o projeto `vybe-api` na Vercel (https://vybe-api-taupe.vercel.app), usado pelo site:

- `GET /api/track?id=<spotifyId>` ou `?name=&artist=`: histórico completo da música nos charts do Spotify (kworb), desde a 1ª entrada.
- `GET /api/spotify/search?q=&type=track|artist&offset=`: busca oficial do Spotify (10 por página).
- `GET /api/health`: diz se a busca do Spotify está configurada.

Variáveis de ambiente na Vercel (projeto `vybe-api` → Settings → Environment Variables): `SPOTIFY_CLIENT_ID` e
`SPOTIFY_CLIENT_SECRET`, do app em developer.spotify.com/dashboard (dono com Premium). Sem elas, só o histórico por id funciona.

## Desenvolvimento

Requer Node.js 22.13 ou superior e pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm exec tsc --noEmit
pnpm build
```

O projeto usa React, TypeScript, Vinext, Tailwind, Recharts, Drizzle e Cloudflare D1. A declaração do banco fica em `.openai/hosting.json`, e as migrações ficam em `drizzle/`.

Detalhes do ambiente e dos modos de execução estão em [docs/development-environment.md](docs/development-environment.md).

## Segurança

Credenciais e arquivos de ambiente não entram no repositório. Chaves futuras do MyStreamCount devem ficar apenas no servidor.

## Estrutura principal

- `app/page.tsx`: interface.
- `app/globals.css`: identidade visual e layout.
- `app/api/chart/route.ts`: consulta e registro do ranking.
- `app/api/history/route.ts`: leitura do histórico.
- `app/api/spotify/route.ts` e `app/api/spotify/history/route.ts`: Spotify Charts e histórico.
- `lib/spotify.ts`: coleta do Spotify (CSV diário → JSON público), capas via oEmbed.
- `lib/collect.ts` + `build/sites-worker.ts`: coleta programada (`scheduled`).
- `lib/vybe.ts`: formato unificado das fontes e cruzamento.
- `lib/chart.ts`: fonte Apple Music, normalização e cache.
- `db/schema.ts`: esquema dos registros.
- `public/favicon.svg`: ícone do VYBE.
