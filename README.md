# VYBE

Painel de charts musicais com rankings por país, busca por música e artista e histórico de posições.

## Site

https://vybe.luccamotta.chatgpt.site — acesso privado nesta primeira versão.

## Funcionalidades

- Apple Music Top 100: Brasil, Estados Unidos, Coreia do Sul, Japão e Reino Unido.
- Busca dentro do ranking selecionado.
- Painel de cada faixa, com posições e evolução em 7, 30 ou 90 dias.
- Histórico persistente em Cloudflare D1: um registro por data do feed e país.
- Cache de até uma hora e último ranking disponível quando a fonte falha.
- Layout responsivo em português brasileiro.

## Limites desta versão

A consulta ocorre ao abrir o ranking. Ainda não há coleta diária com o site fechado. O histórico começa com os registros do VYBE e não é retroativo. Variações comparam o registro atual ao anterior disponível.

MyStreamCount/Spotify, Billboard, YouTube e Circle ainda não estão integrados. Contagem de streams não deve ser confundida com posição no ranking.

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
- `lib/chart.ts`: fonte Apple Music, normalização e cache.
- `db/schema.ts`: esquema dos registros.
- `public/favicon.svg`: ícone do VYBE.
