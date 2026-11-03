// Ranking unificado do vybe: Apple Music + Spotify numa lista só.
// Cada fonte dá pontos pela posição (#1 vale 1, o último quase 0); a soma ordena o ranking.
// Quem está bem nas duas plataformas sobe. Módulo puro (testado em tests/combined.test.ts).
import { matchKey } from './sources/match.ts';
import type { Chart, SpotifyPayload, Track } from './vybe';

export type SourceRanks = { apple?: number; spotify?: number; appleCountries?: number };

export type CombinedTrack = Track & {
  key: string;
  appleId?: string;
  spotifyId?: string;
  streams?: number | null;
  totalStreams?: number | null;
  days?: number | null;
  peak?: number | null;
  score: number;
  sources: SourceRanks;
};

const applePoints = (rank: number, size = 100) => (size + 1 - rank) / size;
const spotifyPoints = (rank: number, size = 200) => (size + 1 - rank) / size;

type Row = Omit<CombinedTrack, 'rank' | 'change' | 'isNew' | 'score'> & { now: number; before: number; inBefore: boolean };

/**
 * apple: um chart (país) ou vários (Global = média dos 5 países).
 * spotify: o chart do Spotify do mesmo mercado.
 */
export function combineCharts(apple: Chart[], spotify: SpotifyPayload | null, limit = 100): CombinedTrack[] {
  const rows = new Map<string, Row>();
  const get = (key: string, base: () => Omit<Row, 'now' | 'before' | 'inBefore'>) => {
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { ...base(), now: 0, before: 0, inBefore: false }));
    return r;
  };
  const weight = apple.length ? 1 / apple.length : 1;

  for (const chart of apple) {
    const size = Math.max(chart.tracks.length, 1);
    const hasPrev = !!chart.previousDate;
    for (const t of chart.tracks) {
      const key = matchKey(t.name, t.artistName);
      const r = get(key, () => ({ key, id: t.id, name: t.name, artistName: t.artistName, artworkUrl100: t.artworkUrl100, url: t.url, appleId: t.id, releaseDate: t.releaseDate, genre: t.genre, sources: {} }));
      r.appleId ??= t.id;
      r.artworkUrl100 ||= t.artworkUrl100;
      r.genre ??= t.genre;
      r.releaseDate ??= t.releaseDate;
      r.now += applePoints(t.rank, size) * weight;
      r.sources.apple = Math.min(r.sources.apple ?? Infinity, t.rank);
      r.sources.appleCountries = (r.sources.appleCountries ?? 0) + 1;
      if (hasPrev && t.change !== null && !t.isNew) {
        r.before += applePoints(t.rank + t.change, size) * weight;
        r.inBefore = true;
      }
    }
  }

  if (spotify) {
    const size = Math.max(spotify.entries.length, 1);
    for (const e of spotify.entries) {
      const key = matchKey(e.trackName, e.artist);
      const r = get(key, () => ({ key, id: e.spotifyId, name: e.trackName, artistName: e.artist, artworkUrl100: e.artworkUrl ?? '', url: `https://open.spotify.com/track/${e.spotifyId}`, sources: {} }));
      r.spotifyId ??= e.spotifyId;
      if (!r.artworkUrl100 && e.artworkUrl) r.artworkUrl100 = e.artworkUrl;
      r.releaseDate ??= e.releaseDate;
      r.streams = e.streams;
      r.totalStreams = e.totalStreams ?? null;
      r.days = e.daysOnChart || null;
      r.now += spotifyPoints(e.rank, size);
      r.sources.spotify = e.rank;
      if (e.previousRank !== null && e.previousRank <= size) {
        r.before += spotifyPoints(e.previousRank, size);
        r.inBefore = true;
      }
    }
  }

  const all = [...rows.values()];
  const byNow = [...all].sort((a, b) => b.now - a.now || (a.sources.spotify ?? 999) - (b.sources.spotify ?? 999) || a.name.localeCompare(b.name));
  const prevRank = new Map(
    all
      .filter((r) => r.inBefore)
      .sort((a, b) => b.before - a.before)
      .map((r, i) => [r.key, i + 1] as const),
  );
  const hasMovement = prevRank.size > 0;

  return byNow.slice(0, limit).map((r, i) => {
    const prev = prevRank.get(r.key);
    const { now, before: _b, inBefore: _i, ...rest } = r;
    return {
      ...rest,
      // id preferido: Spotify (a página da música acha o resto)
      id: r.spotifyId ?? r.appleId ?? r.key,
      rank: i + 1,
      score: Math.round(now * 1000) / 1000,
      change: hasMovement && prev !== undefined && prev <= limit * 2 ? prev - (i + 1) : null,
      isNew: hasMovement && prev === undefined,
    };
  });
}
