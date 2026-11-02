// vybe-api (Cloudflare Worker)
//   GET /api/track?id=<spotifyId>  ou  ?name=...&artist=...  (&m=global,br)   histórico completo de charts do Spotify
//   GET /api/spotify/search?q=...&type=track|artist&offset=0&market=BR   busca oficial do Spotify (10 por página)
//   GET /api/health
// Segredos: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET (wrangler secret / GitHub Action).
import { trackHistory } from '../../api-proxy/lib/kworb-track.js';
import { findSpotifyId, spotifySearch } from '../../api-proxy/lib/spotify-search.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (status, body, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=600, s-maxage=${maxAge}` : 'no-store',
    },
  });

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json(405, { error: 'Só GET.' });
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams);

    const routes = {
      '/api/health': async () => ({ status: 200, body: { ok: true, spotify: !!(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET) }, cache: false }),
      '/api/track': () => trackHistory(query, env.SPOTIFY_CLIENT_ID ? (name, artist) => findSpotifyId(name, artist, env) : undefined),
      '/api/spotify/search': () => spotifySearch(query, env),
    };
    const route = routes[url.pathname];
    if (!route) return json(404, { error: 'Rota não encontrada.', rotas: Object.keys(routes) });

    // Cache na borda da Cloudflare: histórico por 12 h, busca por 1 h.
    const cache = caches.default;
    const key = new Request(url.toString(), { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) return hit;

    const { status, body, cache: cacheable } = await route();
    const ttl = cacheable ? (url.pathname === '/api/track' ? 43200 : 3600) : 0;
    const res = json(status, body, ttl);
    if (ttl) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
