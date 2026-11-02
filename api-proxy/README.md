# vybe-api

Função serverless (Vercel, plano grátis) que entrega o histórico completo de uma música nos charts do Spotify,
lido das páginas de faixa do kworb.net. O site do GitHub Pages não consegue ler o kworb direto (CORS), então passa por aqui.

    GET /api/track?id=<spotifyId>&m=global,br,us,kr,jp,gb
    GET /api/track?apple=<appleId>      # id do Spotify resolvido via Odesli (song.link)
    GET /api/track?deezer=<deezerId>

Resposta: `daily` e `weekly`, cada um com `dates`, `pos[mercado][]`, `streams[mercado][]`, `total` e `peak`.
Cache de 12 h na CDN da Vercel. Não usa chave nem segredo.

Deploy: projeto `vybe-api` na Vercel com Root Directory `api-proxy`.
