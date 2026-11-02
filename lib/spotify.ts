// Spotify Charts (Top 200). Roda no Worker da Cloudflare: sem dependência de Node e sem `next.revalidate`.
//
// Não existe API oficial de charts do Spotify. Tentamos duas rotas, nesta ordem:
//   1. CSV diário (regional-global-daily). Historicamente aberto, hoje costuma pedir login.
//   2. JSON público usado pelo próprio charts.spotify.com. Sem login, só o Global Semanal costuma vir.
// Se as duas falharem, o erro sobe com o motivo real. Nada de devolver [] calado.

import { database } from './chart';
import { fetchSpotifyChart, fillArtwork, spotifyLabels, type SpotifyChart, type SpotifyEntry } from './sources/spotify.ts';

export { spotifyLabels, parseCsv, type SpotifyChart, type SpotifyEntry } from './sources/spotify.ts';

const CACHE_MS = 3600_000;
type Row = { chart: string; date: string; fetched: number; source: 'csv' | 'json'; payload: string };

export async function loadSpotifyChart(): Promise<SpotifyChart> {
  const db = database();
  let historyAvailable = !!db;
  let cached: Row | null = null;
  try {
    cached = (await db?.prepare('SELECT * FROM spotify_snapshots ORDER BY fetched DESC LIMIT 1').first<Row>()) ?? null;
  } catch {
    historyAvailable = false;
  }
  const fromRow = (row: Row, stale: boolean): SpotifyChart => ({
    chart: row.chart,
    label: spotifyLabels[row.chart] ?? 'Top Global',
    date: row.date,
    fetched: row.fetched,
    source: row.source,
    entries: JSON.parse(row.payload),
    stale,
    historyAvailable,
  });
  if (cached && Date.now() - cached.fetched < CACHE_MS) return fromRow(cached, false);

  const fetched = await fetchSpotifyChart();
  const errors = 'errors' in fetched ? fetched.errors : [];
  if ('result' in fetched) {
    const result = fetched.result;
    const now = Date.now();
    let previous: SpotifyEntry[] = [];
    try {
      previous = cached ? JSON.parse(cached.payload) : [];
    } catch {
      /* snapshot antigo ilegível */
    }
    await fillArtwork(result.entries, previous);
    try {
      await db
        ?.prepare(
          'INSERT INTO spotify_snapshots (chart,date,fetched,source,payload) VALUES (?,?,?,?,?) ON CONFLICT(chart,date) DO UPDATE SET fetched=excluded.fetched,source=excluded.source,payload=excluded.payload',
        )
        .bind(result.chart, result.date, now, result.source, JSON.stringify(result.entries))
        .run();
    } catch {
      historyAvailable = false;
    }
    return { ...result, fetched: now, stale: false, historyAvailable };
  }

  console.error('[VYBE/Spotify] todas as fontes falharam:', errors.join(' | '));
  if (cached) return fromRow(cached, true);
  throw new Error(`Spotify Charts indisponível (${errors.join('; ')})`);
}
