// Vercel: GET /api/health — diz se a busca do Spotify está configurada.
export default function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.status(200).end(JSON.stringify({ ok: true, spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET), streams: !!process.env.RAPIDAPI_KEY }));
}
