// Apple Music "most played" (RSS da Apple). Módulo puro: usado pelo Worker e pelo coletor do GitHub Pages.

export const countries = ['br', 'us', 'kr', 'jp', 'gb'];

export type AppleTrack = {
  id: string;
  name: string;
  artistName: string;
  artworkUrl100: string;
  url: string;
  rank: number;
  releaseDate?: string;
  genre?: string;
  artistUrl?: string;
};

export type AppleKind = 'songs' | 'albums';
export const appleFeedUrl = (country: string, kind: AppleKind = 'songs') => `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/${kind}.json`;

/* eslint-disable @typescript-eslint/no-explicit-any -- payload externo, validado campo a campo */
export function normalize(feed: any): AppleTrack[] {
  if (!Array.isArray(feed?.results) || !feed.results.length) throw new Error('Resposta inválida');
  return feed.results.slice(0, 100).map((t: any, i: number) => ({
    id: String(t.id),
    name: String(t.name),
    artistName: String(t.artistName),
    artworkUrl100: String(t.artworkUrl100),
    url: String(t.url),
    rank: i + 1,
    releaseDate: typeof t.releaseDate === 'string' ? t.releaseDate : undefined,
    genre: Array.isArray(t.genres)
      ? t.genres.map((g: any) => String(g?.name ?? '')).find((n: string) => n && n !== 'Música' && n !== 'Music')
      : undefined,
    artistUrl: typeof t.artistUrl === 'string' ? t.artistUrl : undefined,
  }));
}

/** Busca o feed e devolve a data da parada (AAAA-MM-DD), o carimbo da Apple e as faixas. */
export async function fetchAppleChart(country: string, attempts = 1, kind: AppleKind = 'songs') {
  let response: Response | undefined;
  for (let i = 1; ; i++) {
    try {
      response = await fetch(appleFeedUrl(country, kind), { signal: AbortSignal.timeout(i === 1 ? 12000 : 25000) });
      if (response.ok || i >= attempts) break;
    } catch (e) {
      if (i >= attempts) throw e;
    }
    await new Promise((r) => setTimeout(r, 4000 * i));
  }
  if (!response?.ok) throw new Error(`Apple respondeu ${response?.status}`);
  const { feed } = (await response.json()) as { feed: any };
  const tracks = normalize(feed);
  const updated = String(feed.updated);
  return { date: new Date(updated).toISOString().slice(0, 10), updated, tracks };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
