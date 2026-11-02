// Spotify Charts (Top 200). Roda no Worker da Cloudflare: sem dependência de Node e sem `next.revalidate`.
//
// Não existe API oficial de charts do Spotify. Tentamos duas rotas, nesta ordem:
//   1. CSV diário (regional-global-daily). Historicamente aberto, hoje costuma pedir login.
//   2. JSON público usado pelo próprio charts.spotify.com. Sem login, só o Global Semanal costuma vir.
// Se as duas falharem, o erro sobe com o motivo real. Nada de devolver [] calado.
//
// Módulo puro (sem Cloudflare, sem alias): usado pelo Worker e pelo coletor do GitHub Pages.

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
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
export const spotifyLabels: Record<string, string> = {
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

export async function fromCsv(): Promise<Omit<SpotifyChart, 'fetched' | 'stale' | 'historyAvailable'>> {
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
  return { chart: 'regional-global-daily', label: spotifyLabels['regional-global-daily'], // O "latest" diário é a parada de ontem (UTC).
  date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), source: 'csv', entries };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- payload não documentado; validamos campo a campo */
export async function fromJson(): Promise<Omit<SpotifyChart, 'fetched' | 'stale' | 'historyAvailable'>> {
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
  return { chart, label: spotifyLabels[chart] ?? 'Top Global', date, source: 'json', entries };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Capas: reaproveita do snapshot anterior e busca as que faltam no oEmbed público (sem login). */
export async function fillArtwork(entries: SpotifyEntry[], previous: SpotifyEntry[], limit = 30) {
  const known = new Map(previous.filter((e) => e.artworkUrl).map((e) => [e.spotifyId, e.artworkUrl]));
  for (const e of entries) if (!e.artworkUrl) e.artworkUrl = known.get(e.spotifyId) ?? null;
  // Limite baixo pra caber no teto de subrequests do Worker; o resto entra nas próximas coletas.
  const missing = entries.filter((e) => !e.artworkUrl && e.spotifyId).slice(0, limit);
  for (let i = 0; i < missing.length; i += 10) {
    await Promise.all(
      missing.slice(i, i + 10).map(async (e) => {
        try {
          const track = encodeURIComponent(`https://open.spotify.com/track/${e.spotifyId}`);
          const r = await fetch(`https://open.spotify.com/oembed?url=${track}`, { signal: AbortSignal.timeout(5000) });
          if (!r.ok) return;
          const d = (await r.json()) as { thumbnail_url?: unknown };
          if (typeof d.thumbnail_url === 'string') e.artworkUrl = d.thumbnail_url;
        } catch {
          /* sem capa, segue o jogo */
        }
      }),
    );
  }
}


export type SpotifyResult = Omit<SpotifyChart, 'fetched' | 'stale' | 'historyAvailable'>;

/** Tenta CSV diário e depois o JSON público. Devolve o primeiro que funcionar ou a lista de erros. */
export async function fetchSpotifyChart(): Promise<{ result: SpotifyResult } | { errors: string[] }> {
  const errors: string[] = [];
  for (const attempt of [fromCsv, fromJson]) {
    try {
      return { result: await attempt() };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { errors };
}
