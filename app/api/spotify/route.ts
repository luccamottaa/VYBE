import { loadSpotifyChart } from '@/lib/spotify';

export async function GET() {
  try {
    const chart = await loadSpotifyChart();
    return Response.json(chart, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
