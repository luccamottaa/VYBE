import { database } from '@/lib/chart';
import { spotifyLabels, type SpotifyEntry } from '@/lib/spotify';

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const id = p.get('id') ?? '';
  const chart = p.get('chart') ?? 'regional-global-daily';
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !(chart in spotifyLabels)) return Response.json({ error: 'Consulta inválida' }, { status: 400 });
  try {
    const db = database();
    if (!db) throw new Error();
    const rows = await db
      .prepare('SELECT date,payload FROM spotify_snapshots WHERE chart=? ORDER BY date DESC LIMIT 90')
      .bind(chart)
      .all<{ date: string; payload: string }>();
    const points = rows.results.reverse().map((r) => {
      const e = (JSON.parse(r.payload) as SpotifyEntry[]).find((t) => t.spotifyId === id);
      return { date: r.date, rank: e?.rank ?? null, streams: e?.streams ?? null };
    });
    return Response.json({ points });
  } catch {
    return Response.json({ error: 'Não foi possível carregar o histórico' }, { status: 503 });
  }
}
