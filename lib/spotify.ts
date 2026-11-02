// Spotify Charts (Top 200). Roda no Worker da Cloudflare: sem dependência de Node e sem `next.revalidate`.
//
// Não existe API oficial de charts do Spotify. Tentamos duas rotas, nesta ordem:
//   1. CSV diário (regional-global-daily). Historicamente aberto, hoje costuma pedir login.
//   2. JSON público usado pelo próprio charts.spotify.com. Sem login, só o Global Semanal costuma vir.
// Se as duas falharem, o erro sobe com o motivo real. Nada de devolver [] calado.

import { database } from './chart';

export interface SpotifyEntry {
  rank: number;
  previousRank: number | null;
  peakRank: number | null;
  daysOnChart: number | null;
  trackName: string;
  artist: string;
  streams: number | null;
  spotifyId: string;
  artworkUrl: string | null;
}

export interface SpotifyChart {
  chart: string; // ex.: regional-global-daily | regional-global-weekly
  label: string;
  date: string; // AAAA-MM-DD da parada (não da coleta)
  fetched: number;
  source: 'csv' | 'json';
  entries: SpotifyEntry[];
  stale: boolean;
  historyAvailable: boolean;
}

const BASE = 'https://charts-spotify-com-service.spotify.com/public/v0/charts';
const CACHE_MS = 3600_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const labels: Record<string, string> = {
  'regional-global-daily': 'Top 200 Global · Diário',
  'regional-global-weekly': 'Top 200 Global · Semanal',
};

/** Parser CSV (RFC 4180): aspas, vírgula e quebra de linha dentro de campo ("Song, Pt. 2"). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);

  const header = rows.shift()?.map((h) => h.trim());
  if (!header) return [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const int = (v: unknown) => {
  const n = Number.parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const idFromUri = (uri: unknown) => String(uri ?? '').split(':').pop() ?? '';

async function fromCsv(): Promise<Omit<SpotifyChart, 'fetched' | 'stale' | 'historyAvailable'>> {
  const r = await fetch(`${BASE}/regional-global-daily/latest/download`, {
    headers: { 'User-Agent': UA, Accept: 'text/csv,*/*' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`CSV diário respondeu ${r.status}`);
  const text = await r.text();
  // O arquivo às vezes vem com linhas de metadados antes do cabeçalho real.
  const start = text.indexOf('rank,uri,artist_names');
  if (start < 0) throw new Error('CSV diário veio sem o cabeçalho esperado');
  const entries = parseCsv(text.slice(start))
    .map((row) => ({
      rank: int(row.rank) ?? 0,
      previousRank: int(row.previous_rank),
      peakRank: int(row.peak_rank),
      daysOnChart: int(row.days_on_chart),
      trackName: row.track_name,
      artist: row.artist_names,
      streams: int(row.streams),
      spotifyId: idFromUri(row.uri),
      artworkUrl: null,
    }))
    .filter((e) => e.rank > 0 && e.trackName);
  if (!entries.length) throw new Error('CSV diário veio vazio');
  // previous_rank = -1 significa estreia.
  for (const e of entries) if (e.previousRank !== null && e.previousRank < 1) e.previousRank = null;
  return { chart: 'regional-global-daily', label: labels['regional-global-daily'], // O "latest" diário é a parada de ontem (UTC).
  date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), source: 'csv', entries };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- payload não documentado; validamos campo a campo */
async function fromJson(): Promise<Omit<SpotifyChart, 'fetched' | 'stale' | 'historyAvailable'>> {
  const r = await fetch(BASE, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`JSON público respondeu ${r.status}`);
  const data = (await r.json()) as any;
  const views: any[] = Array.isArray(data?.chartEntryViewResponses) ? data.chartEntryViewResponses : [];
  const alias = (v: any) => String(v?.displayChart?.chartMetadata?.alias ?? '');
  const view =
    views.find((v) => alias(v) === 'regional-global-daily') ??
    views.find((v) => alias(v) === 'regional-global-weekly') ??
    views.find((v) => alias(v).startsWith('regional-global'));
  if (!view) throw new Error('JSON público sem chart Global');

  const entries: SpotifyEntry[] = (Array.isArray(view.entries) ? view.entries : [])
    .map((e: any) => {
      const d = e?.chartEntryData ?? {};
      const t = e?.trackMetadata ?? {};
      return {
        rank: int(d.currentRank) ?? 0,
        previousRank: (int(d.previousRank) ?? 0) > 0 ? int(d.previousRank) : null,
        peakRank: int(d.peakRank),
        daysOnChart: int(d.appearancesOnChart),
        trackName: String(t.trackName ?? ''),
        artist: Array.isArray(t.artists) ? t.artists.map((a: any) => String(a?.name ?? '')).filter(Boolean).join(', ') : '',
        streams: d.rankingMetric?.type === 'STREAMS' ? int(d.rankingMetric.value) : null,
        spotifyId: idFromUri(t.trackUri),
        artworkUrl: typeof t.displayImageUri === 'string' ? t.displayImageUri : null,
      };
    })
    .filter((e: SpotifyEntry) => e.rank > 0 && e.trackName);
  if (!entries.length) throw new Error('JSON público veio sem faixas');

  const chart = alias(view);
  const date = String(view.displayChart?.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return { chart, label: labels[chart] ?? 'Top Global', date, source: 'json', entries };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
    label: labels[row.chart] ?? 'Top Global',
    date: row.date,
    fetched: row.fetched,
    source: row.source,
    entries: JSON.parse(row.payload),
    stale,
    historyAvailable,
  });
  if (cached && Date.now() - cached.fetched < CACHE_MS) return fromRow(cached, false);

  const errors: string[] = [];
  for (const attempt of [fromCsv, fromJson]) {
    try {
      const result = await attempt();
      const fetched = Date.now();
      try {
        await db
          ?.prepare(
            'INSERT INTO spotify_snapshots (chart,date,fetched,source,payload) VALUES (?,?,?,?,?) ON CONFLICT(chart,date) DO UPDATE SET fetched=excluded.fetched,source=excluded.source,payload=excluded.payload',
          )
          .bind(result.chart, result.date, fetched, result.source, JSON.stringify(result.entries))
          .run();
      } catch {
        historyAvailable = false;
      }
      return { ...result, fetched, stale: false, historyAvailable };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  console.error('[VYBE/Spotify] todas as fontes falharam:', errors.join(' | '));
  if (cached) return fromRow(cached, true);
  throw new Error(`Spotify Charts indisponível (${errors.join('; ')})`);
}
