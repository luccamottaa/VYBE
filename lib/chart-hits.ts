// Onde cada música está nos charts carregados (Apple 5 países + Spotify por mercado). Módulo puro:
// não toca em rede nem em navegador, então dá pra testar no Node.
import { matchKey, splitArtists } from './sources/match.ts';
import { marketLabel } from './sources/markets.ts';
import type { Chart, SpotifyPayload } from './vybe';
import type { Song } from './search';

export { marketLabel };

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

export type All = { apple: Record<string, Chart>; spotify: Record<string, SpotifyPayload> };

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
