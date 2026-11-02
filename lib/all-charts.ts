// Todos os charts de uma vez (Apple 5 países + Spotify por mercado), com cache curto em memória.
// Usado pelas páginas de música e de artista pra achar onde uma faixa está.
import { getAppleChart, getAppleHistory, getSpotifyChart, getSpotifyHistory, spotifyMarkets, type Point } from './data-source';
import { matchKey, splitArtists } from './sources/match.ts';
import { markets, type Chart, type SpotifyPayload } from './vybe';
import type { Song } from './search';

export type MarketId = `ap:${string}` | `sp:${string}`;

export type ChartHit = {
  market: MarketId;
  label: string;
  rank: number;
  change: number | null;
  isNew: boolean;
  streams?: number | null;
  /** id da faixa naquela fonte (Apple ou Spotify) */
  id: string;
  name: string;
  artist: string;
  artwork?: string;
};

type All = { apple: Record<string, Chart>; spotify: Record<string, SpotifyPayload> };

const TTL = 5 * 60_000;
let cache: { at: number; data: Promise<All> } | null = null;

export function marketLabel(m: string) {
  const [src, id] = m.split(':');
  const flag = id === 'global' ? '🌍' : (markets[id]?.flag ?? id.toUpperCase());
  return `${src === 'ap' ? 'Apple' : 'Spotify'} ${flag}`;
}

export function loadAllCharts(): Promise<All> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const data = (async () => {
    const appleIds = Object.keys(markets);
    const [apple, spotify] = await Promise.all([
      Promise.allSettled(appleIds.map((c) => getAppleChart(c))),
      Promise.allSettled(spotifyMarkets.map((m) => getSpotifyChart(m))),
    ]);
    const out: All = { apple: {}, spotify: {} };
    apple.forEach((r, i) => r.status === 'fulfilled' && (out.apple[appleIds[i]] = r.value));
    spotify.forEach((r, i) => r.status === 'fulfilled' && (out.spotify[spotifyMarkets[i]] = r.value));
    return out;
  })();
  cache = { at: Date.now(), data };
  data.catch(() => (cache = null));
  return data;
}

/** Onde a música está agora: casa pelo id da fonte e, sem id, pelo nome + artista. */
export function findHits(all: All, song: Pick<Song, 'key' | 'appleId' | 'spotifyId'>): ChartHit[] {
  const hits: ChartHit[] = [];
  for (const [cc, chart] of Object.entries(all.apple)) {
    const t = chart.tracks.find((x) => (song.appleId && x.id === song.appleId) || matchKey(x.name, x.artistName) === song.key);
    if (t)
      hits.push({ market: `ap:${cc}`, label: marketLabel(`ap:${cc}`), rank: t.rank, change: chart.previousDate ? t.change : null, isNew: !!t.isNew, id: t.id, name: t.name, artist: t.artistName, artwork: t.artworkUrl100 });
  }
  for (const [m, chart] of Object.entries(all.spotify)) {
    const e = chart.entries.find((x) => (song.spotifyId && x.spotifyId === song.spotifyId) || matchKey(x.trackName, x.artist) === song.key);
    if (e)
      hits.push({
        market: `sp:${m}`,
        label: marketLabel(`sp:${m}`),
        rank: e.rank,
        change: e.previousRank === null ? null : e.previousRank - e.rank,
        isNew: e.entryStatus ? e.entryStatus === 'NEW_ENTRY' || e.entryStatus === 'RE_ENTRY' : e.previousRank === null,
        streams: e.streams,
        id: e.spotifyId,
        name: e.trackName,
        artist: e.artist,
        artwork: e.artworkUrl ?? undefined,
      });
  }
  return hits.sort((a, b) => a.rank - b.rank);
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/** Faixas de um artista nos charts agora, agrupadas por música. */
export function artistHits(all: All, artist: string) {
  const a = norm(artist);
  const songs = new Map<string, { key: string; name: string; artist: string; artwork?: string; appleId?: string; spotifyId?: string; hits: ChartHit[] }>();
  const add = (key: string, base: { name: string; artist: string; artwork?: string; appleId?: string; spotifyId?: string }, hit: ChartHit) => {
    const row = songs.get(key) ?? { key, ...base, hits: [] };
    row.artwork ??= base.artwork;
    row.appleId ??= base.appleId;
    row.spotifyId ??= base.spotifyId;
    row.hits.push(hit);
    songs.set(key, row);
  };
  for (const [cc, chart] of Object.entries(all.apple))
    for (const t of chart.tracks)
      if (splitArtists(t.artistName).some((x) => norm(x) === a))
        add(matchKey(t.name, t.artistName), { name: t.name, artist: t.artistName, artwork: t.artworkUrl100, appleId: t.id }, { market: `ap:${cc}`, label: marketLabel(`ap:${cc}`), rank: t.rank, change: t.change, isNew: !!t.isNew, id: t.id, name: t.name, artist: t.artistName });
  for (const [m, chart] of Object.entries(all.spotify))
    for (const e of chart.entries)
      if (splitArtists(e.artist).some((x) => norm(x) === a))
        add(matchKey(e.trackName, e.artist), { name: e.trackName, artist: e.artist, artwork: e.artworkUrl ?? undefined, spotifyId: e.spotifyId }, { market: `sp:${m}`, label: marketLabel(`sp:${m}`), rank: e.rank, change: e.previousRank === null ? null : e.previousRank - e.rank, isNew: e.previousRank === null, streams: e.streams, id: e.spotifyId, name: e.trackName, artist: e.artist });
  return [...songs.values()]
    .map((s) => ({ ...s, hits: s.hits.sort((x, y) => x.rank - y.rank) }))
    .sort((x, y) => x.hits[0].rank - y.hits[0].rank || y.hits.length - x.hits.length);
}

/** Histórico de posição da música em cada mercado onde temos id dela. */
export async function songHistory(all: All, song: Song, hits: ChartHit[]) {
  const appleId = song.appleId ?? hits.find((h) => h.market.startsWith('ap:'))?.id;
  const spotifyId = song.spotifyId ?? hits.find((h) => h.market.startsWith('sp:'))?.id;
  const wanted = new Set<string>([...hits.map((h) => h.market), ...(song.markets ?? [])]);
  const jobs: Promise<[string, Point[]]>[] = [];
  for (const m of wanted) {
    const [src, id] = m.split(':');
    if (src === 'ap' && appleId && all.apple[id]) jobs.push(getAppleHistory(id, appleId).then((p) => [m, p] as [string, Point[]]));
    if (src === 'sp' && spotifyId && all.spotify[id]) jobs.push(getSpotifyHistory(all.spotify[id].chart, spotifyId).then((p) => [m, p] as [string, Point[]]));
  }
  const series = (await Promise.allSettled(jobs)).flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  return series.filter(([, pts]) => pts.some((p) => p.rank !== null));
}
