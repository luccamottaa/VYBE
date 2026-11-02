# vybe-api

Função serverless (Vercel, plano grátis) que entrega o histórico completo de uma música nos charts do Spotify,
lido das páginas de faixa do kworb.net. O site do GitHub Pages não consegue ler o kworb direto (CORS), então passa por aqui.

    GET /api/track?id=<spotifyId>&m=global,br,us,kr,jp,gb
    GET /api/track?name=<música>&artist=<artista>   # id achado pela busca oficial do Spotify
    GET /api/spotify/search?q=<busca>&type=track|artist&offset=0
    GET /api/health

Resposta: `daily` e `weekly`, cada um com `dates`, `pos[mercado][]`, `streams[mercado][]`, `total` e `peak`.
Cache de 12 h (histórico) e 1 h (busca) na CDN da Vercel. A busca usa SPOTIFY_CLIENT_ID/SECRET (variáveis de ambiente).

Deploy: projeto `vybe-api` na Vercel com Root Directory `api-proxy`.
