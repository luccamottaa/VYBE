// Vercel: GET /api/streams?id=<spotifyId> (ou ?name=&artist=) — streams totais e por dia (MyStreamCount via RapidAPI).
// Env: RAPIDAPI_KEY; opcionais MSC_CURRENT_PATH / MSC_HISTORY_PATH.
import { trackStreams } from '../lib/streams.js';
import { findSpotifyId } from '../lib/spotify-search.js';

export default async function handler(req, res) {
  const env = process.env;
  const findId = env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET ? (name, artist) => findSpotifyId(name, artist, env) : undefined;
  const { status, body, cache } = await trackStreams(req.query, env, findId);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // sucesso: 24 h na borda (o Spotify só atualiza o total uma vez por dia, e cada chamada gasta a cota do plano).
  // Se o RapidAPI falhar depois, continua entregando a última boa por até 7 dias. Cota estourada: 5 min.
  res.setHeader(
    'Cache-Control',
    cache === 'short' ? 'public, max-age=60, s-maxage=300' : cache ? 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800' : 'no-store',
  );
  res.status(status).end(JSON.stringify(body));
}
