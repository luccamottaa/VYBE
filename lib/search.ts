// Busca global: índice do vybe (faixas que passaram pelos charts) + catálogo do iTunes (todas as músicas).
import { isStatic } from './data-source';
import { matchKey, splitArtists } from './sources/match.ts';

/** Uma música, de qualquer origem (chart, índice ou catálogo). */
export type Song = {
  key: string;
  name: string;
  artist: string;
  artwork?: string;
  appleId?: string;
  spotifyId?: string;
  artistId?: string;
  appleUrl?: string;
  album?: string;
  releaseDate?: string;
  /** mercados onde já apareceu ("ap:br", "sp:global"...), quando vem do índice */
  markets?: string[];
};

export type Artist = { name: string; artistId?: string; genre?: string; url?: string };

type IndexRow = { n: string; a: string; img?: string; ap?: string; sp?: string; mk: string[]; seen: string };

const base = import.meta.env.BASE_URL ?? '/';

export const songFrom = (s: Omit<Song, 'key'>): Song => ({ ...s, key: matchKey(s.name, s.artist) });

let indexPromise: Promise<Song[]> | null = null;
/** Faixas que passaram por algum chart do vybe nos últimos 120 dias (só no Pages). */
export function getIndex(): Promise<Song[]> {
  if (!isStatic) return Promise.resolve([]);
  indexPromise ??= fetch(`${base}data/tracks.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, IndexRow>>) : ({} as Record<string, IndexRow>)))
    .then((rows) =>
      Object.entries(rows).map(([key, r]) => ({ key, name: r.n, artist: r.a, artwork: r.img, appleId: r.ap, spotifyId: r.sp, markets: r.mk })),
    )
    .catch(() => {
      indexPromise = null;
      return [];
    });
  return indexPromise;
}

/** Linha do índice pela chave (pra completar ids e mercados de uma música vinda do catálogo). */
export async function findInIndex(key: string) {
  return (await getIndex()).find((s) => s.key === key);
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Todas as palavras da busca precisam começar alguma palavra de `text` ("tate" acha Tate McRae, não "Stateside"). */
export function matchesWords(text: string, query: string) {
  const tokens = norm(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const words = norm(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.length > 0 && words.every((w) => tokens.some((t) => t.startsWith(w)));
}

/** Busca no índice local: todas as palavras precisam aparecer em "música + artista". */
export async function searchIndex(query: string, limit = 8): Promise<Song[]> {
  if (!query.trim()) return [];
  const hits = (await getIndex()).filter((s) => matchesWords(`${s.name} ${s.artist}`, query));
  // quem aparece em mais mercados primeiro
  return hits.sort((a, b) => (b.markets?.length ?? 0) - (a.markets?.length ?? 0)).slice(0, limit);
}

/** Artistas do índice cujo nome bate com a busca. */
export async function searchIndexArtists(query: string, limit = 4): Promise<Artist[]> {
  const q = norm(query.trim());
  if (q.length < 2) return [];
  const count = new Map<string, { name: string; n: number }>();
  for (const s of await getIndex()) {
    for (const a of splitArtists(s.artist)) {
      if (!matchesWords(a, q)) continue;
      const k = norm(a);
      count.set(k, { name: a, n: (count.get(k)?.n ?? 0) + 1 });
    }
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((a) => ({ name: a.name }));
}

/* ---------- iTunes Search API (grátis, sem chave) ---------- */

type ItunesItem = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistId?: number;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  artistLinkUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
};

async function itunes(path: string, params: Record<string, string>, signal?: AbortSignal) {
  const qs = new URLSearchParams({ country: 'BR', ...params });
  const r = await fetch(`https://itunes.apple.com/${path}?${qs}`, { signal });
  if (!r.ok) throw new Error(`Catálogo indisponível (${r.status})`);
  return ((await r.json()) as { results?: ItunesItem[] }).results ?? [];
}

const toSong = (i: ItunesItem): Song =>
  songFrom({
    name: i.trackName ?? '',
    artist: i.artistName ?? '',
    artwork: i.artworkUrl100,
    appleId: i.trackId ? String(i.trackId) : undefined,
    artistId: i.artistId ? String(i.artistId) : undefined,
    appleUrl: i.trackViewUrl,
    album: i.collectionName,
    releaseDate: i.releaseDate?.slice(0, 10),
  });

export async function searchCatalogSongs(query: string, signal?: AbortSignal, limit = 15): Promise<Song[]> {
  const items = await itunes('search', { term: query, media: 'music', entity: 'song', limit: String(limit) }, signal);
  return items.filter((i) => i.kind === 'song' && i.trackName).map(toSong);
}

export async function searchCatalogArtists(query: string, signal?: AbortSignal, limit = 5): Promise<Artist[]> {
  const items = await itunes('search', { term: query, media: 'music', entity: 'musicArtist', limit: String(limit) }, signal);
  return items
    .filter((i) => i.artistName)
    .map((i) => ({ name: i.artistName!, artistId: i.artistId ? String(i.artistId) : undefined, genre: i.primaryGenreName, url: i.artistLinkUrl }));
}

/** Músicas de um artista no catálogo (pelo id do iTunes; sem id, busca pelo nome). */
export async function catalogSongsByArtist(artist: Artist, signal?: AbortSignal, limit = 50): Promise<Song[]> {
  if (artist.artistId) {
    const items = await itunes('lookup', { id: artist.artistId, entity: 'song', limit: String(limit) }, signal);
    return items.filter((i) => i.wrapperType === 'track' && i.trackName).map(toSong);
  }
  const songs = await searchCatalogSongs(artist.name, signal, limit);
  const a = norm(artist.name);
  return songs.filter((s) => splitArtists(s.artist).some((x) => norm(x) === a));
}

/** Junta listas sem repetir a mesma música (mesma chave), mantendo a primeira e completando ids. */
export function mergeSongs(...lists: Song[][]): Song[] {
  const out = new Map<string, Song>();
  for (const list of lists)
    for (const s of list) {
      const prev = out.get(s.key);
      out.set(s.key, prev ? { ...s, ...prev, appleId: prev.appleId ?? s.appleId, spotifyId: prev.spotifyId ?? s.spotifyId, artwork: prev.artwork ?? s.artwork, artistId: prev.artistId ?? s.artistId, appleUrl: prev.appleUrl ?? s.appleUrl } : s);
    }
  return [...out.values()];
}
