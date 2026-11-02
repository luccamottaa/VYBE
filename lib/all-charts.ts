// Todos os charts de uma vez (Apple 5 países + Spotify por mercado), com cache curto em memória.
// Usado pelas páginas de música e de artista pra achar onde uma faixa está.
import { getAppleChart, getAppleHistory, getSpotifyChart, getSpotifyHistory, spotifyMarkets, type Point } from './data-source';
import { markets } from './sources/markets.ts';
import type { All, ChartHit } from './chart-hits';
import type { Song } from './search';

export * from './chart-hits';

const TTL = 5 * 60_000;
let cache: { at: number; data: Promise<All> } | null = null;


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
