// Vercel: GET /api/track — histórico completo de uma música nos charts do Spotify (ver lib/kworb-track.js).
import { trackHistory } from '../lib/kworb-track.js';

export default async function handler(req, res) {
  const { status, body, cache } = await trackHistory(req.query);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache ? 'public, max-age=600, s-maxage=43200, stale-while-revalidate=86400' : 'no-store');
  res.status(status).end(JSON.stringify(body));
}
