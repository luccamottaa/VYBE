// Vercel: GET /api/track — histórico completo de uma música nos charts do Spotify (ver lib/kworb-track.js).
//   ?id=<spotifyId>  ou  ?name=...&artist=...  (o id é achado pela busca oficial do Spotify)
import { trackHistory } from '../lib/kworb-track.js';
import { findSpotifyId } from '../lib/spotify-search.js';

export default async function handler(req, res) {
  const env = process.env;
  const findId = env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET ? (name, artist) => findSpotifyId(name, artist, env) : undefined;
  const { status, body, cache } = await trackHistory(req.query, findId);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache ? 'public, max-age=600, s-maxage=43200, stale-while-revalidate=86400' : 'no-store');
  res.status(status).end(JSON.stringify(body));
}
