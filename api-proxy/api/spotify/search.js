// Vercel: GET /api/spotify/search?q=...&type=track|artist&offset=0&market=BR — busca oficial do Spotify.
// Variáveis de ambiente (Vercel → Settings → Environment Variables): SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
import { spotifySearch } from '../../lib/spotify-search.js';

export default async function handler(req, res) {
  const { status, body, cache } = await spotifySearch(req.query, process.env);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'no-store');
  res.status(status).end(JSON.stringify(body));
}
