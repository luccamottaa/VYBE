// Foto de artista pelo nome (Spotify via vybe-api, reserva no Deezer), com cache no aparelho por 7 dias.
import { searchDeezerArtists, searchSpotifyArtists } from './search';

const KEY = 'vybe:artist-photos';
const TTL = 7 * 86400000;
type Cache = Record<string, { url: string | null; at: number }>;

const n = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

let cache: Cache | null = null;
const read = (): Cache => {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Cache;
  } catch {
    cache = {};
  }
  return cache;
};
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* sem espaço */
  }
};

const pending = new Map<string, Promise<string | null>>();

export function artistPhoto(name: string): Promise<string | null> {
  const k = n(name);
  const hit = read()[k];
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.url);
  if (pending.has(k)) return pending.get(k)!;
  const p = (async () => {
    const tries = [() => searchSpotifyArtists(name), () => searchDeezerArtists(name, undefined, 5)];
    for (const t of tries) {
      try {
        const found = (await t()).find((a) => a.picture && n(a.name) === k);
        if (found?.picture) return found.picture;
      } catch {
        /* próxima fonte */
      }
    }
    return null;
  })().then((url) => {
    read()[k] = { url, at: Date.now() };
    save();
    pending.delete(k);
    return url;
  });
  pending.set(k, p);
  return p;
}
