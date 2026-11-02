# VYBE

Painel de charts musicais com rankings por país, busca por música e artista e histórico de posições.

## Site

https://vybe.luccamotta.chatgpt.site — acesso privado nesta primeira versão.

## Funcionalidades

- Apple Music Top 100: Brasil, Estados Unidos, Coreia do Sul, Japão e Reino Unido.
- Spotify Top 200 Global (diário, ou semanal quando o diário pede login), com streams, pico e dias no chart.
- Cruzamento entre fontes: posição da mesma faixa no Spotify e nos 5 países da Apple.
- Coleta automática por Cron Trigger (06:17 e 15:17 UTC).
- Busca dentro do ranking selecionado.
- Painel de cada faixa, com posições e evolução em 7, 30 ou 90 dias.
- Histórico persistente em Cloudflare D1: um registro por data do feed e país.
- Cache de até uma hora e último ranking disponível quando a fonte falha.
- Layout responsivo em português brasileiro.

## Limites desta versão

A coleta roda por Cron Trigger e também ao abrir o ranking. O histórico começa com os registros do VYBE e não é retroativo. Variações comparam o registro atual ao anterior disponível.

O Spotify Charts não tem API pública; o VYBE usa as rotas do próprio charts.spotify.com e pode quebrar se o Spotify mudar algo. MyStreamCount, Last.fm, Billboard, YouTube e Circle ainda não estão integrados.

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
