import { getAppleAlbumHistory, getAppleHistory, getSpotifyHistory, type Point } from './data-source';
import { matchKey, splitArtists } from './sources/match.ts';

export { matchKey, splitArtists };

// Tipos e helpers do lado do cliente. Não importar lib/chart.ts aqui (depende do runtime Cloudflare).

export { markets } from './sources/markets.ts';
import { markets } from './sources/markets.ts';

export type Track = {
  id: string;
  name: string;
  artistName: string;
  artworkUrl100: string;
  url: string;
  rank: number;
  change: number | null;
  isNew?: boolean;
  releaseDate?: string;
  genre?: string;
  artistUrl?: string;
};

export type Chart = {
  tracks: Track[];
  updated: string;
  date: string;
  stale: boolean;
  days: number;
  historyAvailable: boolean;
  previousDate: string | null;
};

export type HistoryPoint = { date: string; rank: number | null };

/** Troca a miniatura 100x100 do feed por uma versão maior. */
export const artwork = (url: string, size = 600) =>
  url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${size}x${size}bb.$1`);

export const shortDate = (v: string) =>
  new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/** Dias desde o lançamento, comparado à data do feed (não ao relógio do usuário). */
export function daysSince(release: string | undefined, reference: string) {
  if (!release) return null;
  const diff = Math.floor((Date.parse(reference) - Date.parse(release)) / 86400000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

export function releaseLabel(days: number | null) {
  if (days === null) return null;
  if (days === 0) return 'Lançada hoje';
  if (days === 1) return 'Lançada ontem';
  if (days < 30) return `Lançada há ${days} dias`;
  if (days < 365) return `Lançada há ${Math.round(days / 30)} ${Math.round(days / 30) === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(days / 365);
  return `Lançada há ${y} ${y === 1 ? 'ano' : 'anos'}`;
}

export function summarize(chart: Pick<Chart, 'tracks' | 'updated'>) {
  const { tracks } = chart;
  const artistCount = new Map<string, number>();
  const genreCount = new Map<string, number>();
  for (const t of tracks) {
    for (const a of splitArtists(t.artistName)) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
    if (t.genre) genreCount.set(t.genre, (genreCount.get(t.genre) ?? 0) + 1);
  }
  const topArtists = [...artistCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([artist, count]) => ({ artist, count }));
  const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count }));
  const recent = tracks.filter((t) => {
    const d = daysSince(t.releaseDate, chart.updated);
    return d !== null && d <= 7;
  });
  const climbers = tracks.filter((t) => (t.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  const debuts = tracks.filter((t) => t.isNew);
  return { artistCount: artistCount.size, topArtists, genres, recent, climbers, debuts };
}

/* ---------- Fontes unificadas (Apple Music + Spotify) ---------- */

export type Source = 'apple' | 'spotify';

export type ViewTrack = Track & {
  streams?: number | null;
  totalStreams?: number | null;
  peak?: number | null;
  days?: number | null;
};

export type ChartView = {
  source: Source;
  title: string; // "Top 100 Apple Music · 🇧🇷 Brasil"
  tracks: ViewTrack[];
  updated: string; // data de referência do chart (ISO)
  stale: boolean;
  historyAvailable: boolean;
  /** true quando as variações de posição já são confiáveis (Spotify: sempre; Apple: a partir do 2º registro). */
  hasMovement: boolean;
  compareLabel: string | null; // "vs 01 de nov." / "vs semana anterior"
  footnote: string;
  loadHistory: (id: string, signal?: AbortSignal) => Promise<Point[]>;
  sourceUrl: string;
  chartKey?: string; // alias do Spotify
  /** ranking de álbuns (cada linha é um álbum) */
  albums?: boolean;
};

export type SpotifyPayload = {
  chart: string;
  label: string;
  date: string;
  fetched: number;
  source: 'csv' | 'json' | 'kworb';
  sourceUrl?: string;
  stale: boolean;
  historyAvailable: boolean;
  entries: {
    totalStreams?: number | null;
    rank: number;
    previousRank: number | null;
    peakRank: number | null;
    daysOnChart: number | null;
    entryStatus?: string;
    releaseDate?: string;
    trackName: string;
    artist: string;
    streams: number | null;
    spotifyId: string;
    artworkUrl: string | null;
  }[];
};

export function appleView(chart: Chart & { days: number }, country: string): ChartView {
  const m = markets[country];
  return {
    source: 'apple',
    title: `Top 100 Apple Music · ${m.flag} ${m.name}`,
    tracks: chart.tracks,
    updated: chart.updated,
    stale: chart.stale,
    historyAvailable: chart.historyAvailable,
    hasMovement: !!chart.previousDate,
    compareLabel: chart.previousDate ? `vs ${shortDate(chart.previousDate)}` : null,
    footnote: `Feed de ${shortDate(chart.updated)} · ${chart.days} ${chart.days === 1 ? 'dia registrado' : 'dias registrados'}${
      chart.previousDate ? '' : ' · variações aparecem a partir do 2º dia'
    }`,
    loadHistory: (id, signal) => getAppleHistory(country, id, signal),
    sourceUrl: `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/songs.json`,
  };
}

export function appleAlbumView(chart: Chart & { days: number }, country: string): ChartView {
  const m = markets[country];
  return {
    ...appleView(chart, country),
    title: `Top 100 Álbuns Apple Music · ${m.flag} ${m.name}`,
    loadHistory: (id, signal) => getAppleAlbumHistory(country, id, signal),
    sourceUrl: `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/albums.json`,
    albums: true,
  };
}

export function spotifyView(p: SpotifyPayload): ChartView {
  const weekly = p.chart.includes('weekly');
  return {
    source: 'spotify',
    title: `${p.label} · Spotify`,
    tracks: p.entries.map((e) => ({
      id: e.spotifyId,
      name: e.trackName,
      artistName: e.artist,
      artworkUrl100: e.artworkUrl ?? '',
      url: `https://open.spotify.com/track/${e.spotifyId}`,
      rank: e.rank,
      change: e.previousRank === null ? null : e.previousRank - e.rank,
      isNew: e.entryStatus ? e.entryStatus === 'NEW_ENTRY' || e.entryStatus === 'RE_ENTRY' : e.previousRank === null,
      releaseDate: e.releaseDate,
      streams: e.streams,
      totalStreams: e.totalStreams ?? null,
      peak: e.peakRank || null,
      days: e.daysOnChart || null,
    })),
    updated: `${p.date}T00:00:00Z`,
    stale: p.stale,
    historyAvailable: p.historyAvailable,
    hasMovement: true,
    compareLabel: weekly ? 'vs semana anterior' : 'vs dia anterior',
    footnote: `Parada de ${shortDate(`${p.date}T00:00:00Z`)}${
      p.source === 'kworb'
        ? ' · streams via kworb.net'
        : p.entries.some((e) => e.streams !== null)
          ? ''
          : ` · sem login o Spotify libera só o Top ${p.entries.length}${weekly ? ' semanal' : ''}, sem streams`
    }`,
    loadHistory: (id, signal) => getSpotifyHistory(p.chart, id, signal),
    sourceUrl: p.sourceUrl ?? 'https://charts.spotify.com/charts/overview/global',
    chartKey: p.chart,
  };
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('pt-BR');
export const fmtCompact = (n: number) => compact.format(n);
export const fmtFull = (n: number) => full.format(n);

export function spotifySummary(view: ChartView) {
  const withStreams = view.tracks.filter((t) => typeof t.streams === 'number') as (ViewTrack & { streams: number })[];
  const totalStreams = withStreams.reduce((s, t) => s + t.streams, 0);
  const topStreams = [...withStreams].sort((a, b) => b.streams - a.streams).slice(0, 10);
  const veterans = view.tracks.filter((t) => (t.days ?? 0) > 0).sort((a, b) => (b.days ?? 0) - (a.days ?? 0)).slice(0, 4);
  return { totalStreams, topStreams, veterans, hasStreams: withStreams.length > 0 };
}

/* ---------- Cruzamento entre fontes ---------- */

export type CrossHit = { label: string; rank: number };

/** "1 dia" / "12 dias" / "3 semanas" no chart. */
export const tenure = (n: number, weekly: boolean) => `${n} ${weekly ? (n === 1 ? 'semana' : 'semanas') : n === 1 ? 'dia' : 'dias'}`;
