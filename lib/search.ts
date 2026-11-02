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
  deezerId?: string;
  deezerUrl?: string;
  /** prévia de 30 s (Apple ou Deezer) */
  preview?: string;
  /** catálogos onde foi encontrada */
  from?: ('apple' | 'deezer' | 'vybe')[];
};

export type Artist = { name: string; artistId?: string; deezerId?: string; genre?: string; url?: string; picture?: string; fans?: number };

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
      Object.entries(rows).map(([key, r]) => ({ key, name: r.n, artist: r.a, artwork: r.img, appleId: r.ap, spotifyId: r.sp, markets: r.mk, from: ['vybe'] as Song['from'] })),
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
// Cada país tem um catálogo um pouco diferente (lançamentos regionais, K-pop/J-pop), então buscamos em várias lojas.

export const STOREFRONTS = ['BR', 'US', 'JP', 'KR', 'GB'];

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
  previewUrl?: string;
};

async function itunes(path: string, params: Record<string, string>, signal?: AbortSignal, country = 'BR') {
  const qs = new URLSearchParams({ country, ...params });
  const r = await fetch(`https://itunes.apple.com/${path}?${qs}`, { signal });
  if (!r.ok) throw new Error(`Catálogo indisponível (${r.status})`);
  return ((await r.json()) as { results?: ItunesItem[] }).results ?? [];
}

/** Mesma consulta em várias lojas; ignora as que falharem (só falha se todas falharem). */
async function itunesMany(path: string, params: Record<string, string>, signal: AbortSignal | undefined, stores: string[]) {
  const res = await Promise.allSettled(stores.map((c) => itunes(path, params, signal, c)));
  if (res.every((r) => r.status === 'rejected')) throw (res[0] as PromiseRejectedResult).reason;
  return res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
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
    preview: i.previewUrl,
    from: ['apple'],
  });

export async function searchCatalogSongs(query: string, signal?: AbortSignal, limit = 15, stores = ['BR', 'US']): Promise<Song[]> {
  const items = await itunesMany('search', { term: query, media: 'music', entity: 'song', limit: String(limit) }, signal, stores);
  return mergeSongs(items.filter((i) => i.kind === 'song' && i.trackName).map(toSong));
}

export async function searchCatalogArtists(query: string, signal?: AbortSignal, limit = 5): Promise<Artist[]> {
  const items = await itunesMany('search', { term: query, media: 'music', entity: 'musicArtist', limit: String(limit) }, signal, ['BR', 'US']);
  const seen = new Set<string>();
  return items
    .filter((i) => i.artistName && !seen.has(String(i.artistId)) && seen.add(String(i.artistId)))
    .map((i) => ({ name: i.artistName!, artistId: i.artistId ? String(i.artistId) : undefined, genre: i.primaryGenreName, url: i.artistLinkUrl }));
}

/* ---------- Deezer (grátis, sem chave, 100+ milhões de faixas) ---------- */
// A API do Deezer não libera CORS, mas aceita JSONP (output=jsonp), que funciona num site estático.

let jsonpSeq = 0;
function jsonp<T>(url: string, signal?: AbortSignal, timeout = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `__vybeDz${Date.now().toString(36)}${jsonpSeq++}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    const done = (fn: () => void) => {
      clearTimeout(timer);
      script.remove();
      delete w[cb];
      signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => done(() => reject(new DOMException('Abortado', 'AbortError')));
    const timer = setTimeout(() => done(() => reject(new Error('Deezer não respondeu'))), timeout);
    w[cb] = (data: T & { error?: { message?: string } }) =>
      done(() => (data?.error ? reject(new Error(`Deezer: ${data.error.message ?? 'erro'}`)) : resolve(data)));
    script.onerror = () => done(() => reject(new Error('Deezer indisponível')));
    signal?.addEventListener('abort', onAbort);
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`;
    document.head.appendChild(script);
  });
}

type DzTrack = {
  id: number;
  title: string;
  title_short?: string;
  link?: string;
  preview?: string;
  rank?: number;
  artist?: { id: number; name: string };
  album?: { title?: string; cover_medium?: string };
};
type DzArtist = { id: number; name: string; link?: string; picture_medium?: string; nb_fan?: number };

const fromDeezer = (t: DzTrack): Song =>
  songFrom({
    name: t.title_short || t.title,
    artist: t.artist?.name ?? '',
    artwork: t.album?.cover_medium,
    album: t.album?.title,
    deezerId: String(t.id),
    deezerUrl: t.link,
    preview: t.preview || undefined,
    from: ['deezer'],
  });

/** Uma página da busca do Deezer. `next` é o índice da próxima página (null no fim). */
export async function searchDeezerSongs(query: string, index = 0, signal?: AbortSignal, limit = 25) {
  const d = await jsonp<{ data?: DzTrack[]; total?: number; next?: string }>(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&index=${index}&limit=${limit}`,
    signal,
  );
  const songs = (d.data ?? []).map(fromDeezer);
  return { songs, total: d.total ?? songs.length, next: d.next ? index + limit : null };
}

export async function searchDeezerArtists(query: string, signal?: AbortSignal, limit = 5): Promise<Artist[]> {
  const d = await jsonp<{ data?: DzArtist[] }>(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`, signal);
  return (d.data ?? []).map((a) => ({ name: a.name, deezerId: String(a.id), url: a.link, picture: a.picture_medium, fans: a.nb_fan }));
}

/** Até 100 músicas mais tocadas do artista no Deezer. */
async function deezerArtistTop(artist: Artist, signal?: AbortSignal): Promise<Song[]> {
  let id = artist.deezerId;
  if (!id) {
    const found = await searchDeezerArtists(artist.name, signal, 5);
    id = found.find((a) => norm(a.name) === norm(artist.name))?.deezerId;
  }
  if (!id) return [];
  const d = await jsonp<{ data?: DzTrack[] }>(`https://api.deezer.com/artist/${id}/top?limit=100`, signal);
  return (d.data ?? []).map(fromDeezer);
}

/** Catálogo do artista: Apple (Brasil + EUA, até 200 cada) + top 100 do Deezer, sem repetir. */
export async function catalogSongsByArtist(artist: Artist, signal?: AbortSignal, limit = 200): Promise<Song[]> {
  const a = norm(artist.name);
  const byArtist = (s: Song) => splitArtists(s.artist).some((x) => norm(x) === a);
  const apple = (async () => {
    if (artist.artistId) {
      const items = await itunesMany('lookup', { id: artist.artistId, entity: 'song', limit: String(limit) }, signal, ['BR', 'US']);
      return items.filter((i) => i.wrapperType === 'track' && i.trackName).map(toSong);
    }
    return (await searchCatalogSongs(artist.name, signal, limit)).filter(byArtist);
  })();
  const [ap, dz] = await Promise.allSettled([apple, deezerArtistTop(artist, signal)]);
  if (ap.status === 'rejected' && dz.status === 'rejected') throw ap.reason;
  // Deezer primeiro: vem ordenado por popularidade
  return mergeSongs(dz.status === 'fulfilled' ? dz.value.filter(byArtist) : [], ap.status === 'fulfilled' ? ap.value : []);
}

/** Junta listas sem repetir a mesma música (mesma chave), mantendo a primeira e completando ids. */
export function mergeSongs(...lists: Song[][]): Song[] {
  const out = new Map<string, Song>();
  for (const list of lists)
    for (const s of list) {
      const prev = out.get(s.key);
      if (!prev) {
        out.set(s.key, s);
        continue;
      }
      const pick = <K extends keyof Song>(k: K) => prev[k] ?? s[k];
      out.set(s.key, {
        ...s,
        ...prev,
        appleId: pick('appleId'),
        spotifyId: pick('spotifyId'),
        deezerId: pick('deezerId'),
        deezerUrl: pick('deezerUrl'),
        artwork: pick('artwork'),
        artistId: pick('artistId'),
        appleUrl: pick('appleUrl'),
        album: pick('album'),
        releaseDate: pick('releaseDate'),
        preview: pick('preview'),
        markets: pick('markets'),
        from: [...new Set([...(prev.from ?? []), ...(s.from ?? [])])],
      });
    }
  return [...out.values()];
}
