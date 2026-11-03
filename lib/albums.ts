// Álbuns: busca (Apple + Deezer), discografia do artista, faixas do álbum e Top 100 álbuns da Apple.
import { getAppleAlbumChart, isStatic } from './data-source';
import { itunesMany, jsonp, mergeSongs, norm, toSong, fromDeezer, type Artist, type DzTrack, type ItunesItem, type Song } from './search';
import { creditIncludes, matchKey, splitArtists } from './sources/match.ts';
import { markets } from './sources/markets.ts';
import type { Chart } from './vybe';

export type Album = {
  key: string;
  name: string;
  artist: string;
  artwork?: string;
  appleId?: string;
  deezerId?: string;
  releaseDate?: string;
  trackCount?: number;
  genre?: string;
  appleUrl?: string;
  deezerUrl?: string;
  /** "album" | "single" | "ep" | "compile" (Deezer) */
  type?: string;
};

export type AlbumTrack = Song & { number?: number; disc?: number; ms?: number };

export const albumFrom = (a: Omit<Album, 'key'>): Album => ({ ...a, key: matchKey(a.name, a.artist) });

const fromItunes = (i: ItunesItem & { collectionId?: number; collectionViewUrl?: string; trackCount?: number }): Album =>
  albumFrom({
    name: i.collectionName ?? '',
    artist: i.artistName ?? '',
    artwork: i.artworkUrl100,
    appleId: i.collectionId ? String(i.collectionId) : undefined,
    releaseDate: i.releaseDate?.slice(0, 10),
    trackCount: i.trackCount,
    genre: i.primaryGenreName,
    appleUrl: i.collectionViewUrl,
  });

type DzAlbum = { id: number; title: string; cover_medium?: string; cover_big?: string; cover_xl?: string; nb_tracks?: number; link?: string; record_type?: string; release_date?: string; artist?: { id: number; name: string }; genres?: { data?: { name: string }[] }; tracks?: { data?: DzTrack[] } };

const fromDz = (a: DzAlbum, artist?: string): Album =>
  albumFrom({
    name: a.title,
    artist: a.artist?.name ?? artist ?? '',
    artwork: a.cover_big ?? a.cover_medium ?? a.cover_xl,
    deezerId: String(a.id),
    trackCount: a.nb_tracks,
    deezerUrl: a.link,
    releaseDate: a.release_date,
    type: a.record_type,
  });

/** Junta álbuns iguais (mesmo nome + artista) completando ids. */
export function mergeAlbums(...lists: Album[][]): Album[] {
  const out = new Map<string, Album>();
  for (const list of lists)
    for (const a of list) {
      if (!a.name) continue;
      const prev = out.get(a.key);
      if (!prev) out.set(a.key, a);
      else
        out.set(a.key, {
          ...a,
          ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v !== undefined)),
        } as Album);
    }
  return [...out.values()];
}

export async function searchAppleAlbums(q: string, signal?: AbortSignal, limit = 10): Promise<Album[]> {
  const items = await itunesMany('search', { term: q, media: 'music', entity: 'album', limit: String(limit) }, signal, ['BR', 'US']);
  return mergeAlbums(items.filter((i) => i.collectionName).map(fromItunes));
}

export async function searchDeezerAlbums(q: string, signal?: AbortSignal, limit = 10): Promise<Album[]> {
  const d = await jsonp<{ data?: DzAlbum[] }>(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=${limit}`, signal);
  return (d.data ?? []).map((a) => fromDz(a));
}

/** Busca de álbuns: Deezer (ordenado por popularidade) + Apple. */
export async function searchAlbums(q: string, signal?: AbortSignal, limit = 10): Promise<Album[]> {
  const [dz, ap] = await Promise.allSettled([searchDeezerAlbums(q, signal, limit), searchAppleAlbums(q, signal, limit)]);
  if (dz.status === 'rejected' && ap.status === 'rejected') throw ap.reason;
  return mergeAlbums(dz.status === 'fulfilled' ? dz.value : [], ap.status === 'fulfilled' ? ap.value : []);
}

/** Discografia: Apple (por id do artista ou busca) + Deezer, mais novo primeiro. */
export async function albumsByArtist(artist: Artist, signal?: AbortSignal): Promise<Album[]> {
  const a = norm(artist.name);
  const mine = (x: Album) => creditIncludes(x.artist, artist.name);
  const apple = (async () => {
    if (artist.artistId) {
      const items = await itunesMany('lookup', { id: artist.artistId, entity: 'album', limit: '200' }, signal, ['BR', 'US']);
      return items.filter((i) => i.wrapperType === 'collection' && i.collectionName).map(fromItunes);
    }
    return (await searchAppleAlbums(artist.name, signal, 50)).filter(mine);
  })();
  const deezer = (async () => {
    let id = artist.deezerId;
    if (!id) {
      const d = await jsonp<{ data?: { id: number; name: string }[] }>(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist.name)}&limit=5`, signal);
      id = d.data?.find((x) => norm(x.name) === a)?.id.toString();
    }
    if (!id) return [];
    const d = await jsonp<{ data?: DzAlbum[] }>(`https://api.deezer.com/artist/${id}/albums?limit=100`, signal);
    return (d.data ?? []).map((x) => fromDz(x, artist.name));
  })();
  const [ap, dz] = await Promise.allSettled([apple, deezer]);
  if (ap.status === 'rejected' && dz.status === 'rejected') throw ap.reason;
  return mergeAlbums(dz.status === 'fulfilled' ? dz.value : [], ap.status === 'fulfilled' ? ap.value : [])
    .filter(mine)
    .sort((x, y) => (y.releaseDate ?? '').localeCompare(x.releaseDate ?? ''));
}

/** Faixas do álbum (ordem do disco). Completa o álbum com o que vier da fonte. */
export async function albumTracks(album: Album, signal?: AbortSignal): Promise<{ album: Album; tracks: AlbumTrack[] }> {
  let a = album;
  // sem id nenhum: acha na Apple pelo nome
  if (!a.appleId && !a.deezerId) {
    const found = (await searchAppleAlbums(`${a.name} ${splitArtists(a.artist)[0] ?? ''}`, signal, 10).catch(() => [])).find((x) => x.key === a.key);
    if (found) a = { ...found, ...a, appleId: found.appleId };
  }
  if (a.appleId) {
    const items = await itunesMany('lookup', { id: a.appleId, entity: 'song', limit: '200' }, signal, ['BR', 'US']).catch(() => [] as ItunesItem[]);
    const coll = items.find((i) => i.wrapperType === 'collection');
    const seen = new Set<string>();
    const tracks = items
      .filter((i) => i.wrapperType === 'track' && i.trackName && !seen.has(String(i.trackId)) && seen.add(String(i.trackId)))
      .map((i) => ({ ...toSong(i), number: i.trackNumber, disc: i.discNumber, ms: i.trackTimeMillis }))
      .sort((x, y) => (x.disc ?? 1) - (y.disc ?? 1) || (x.number ?? 0) - (y.number ?? 0));
    if (tracks.length) {
      return {
        album: { ...a, ...(coll ? { trackCount: coll.trackCount ?? a.trackCount, genre: a.genre ?? coll.primaryGenreName, releaseDate: a.releaseDate ?? coll.releaseDate?.slice(0, 10), appleUrl: a.appleUrl ?? coll.collectionViewUrl, artwork: a.artwork ?? coll.artworkUrl100 } : {}) },
        tracks: dedupeByKey(tracks),
      };
    }
  }
  let dzId = a.deezerId;
  if (!dzId) dzId = (await searchDeezerAlbums(`${a.name} ${splitArtists(a.artist)[0] ?? ''}`, signal, 10).catch(() => [])).find((x) => x.key === a.key)?.deezerId;
  if (!dzId) return { album: a, tracks: [] };
  const d = await jsonp<DzAlbum>(`https://api.deezer.com/album/${dzId}`, signal);
  const tracks = (d.tracks?.data ?? []).map((t, i) => ({ ...fromDeezer({ ...t, album: { title: d.title, cover_medium: d.cover_medium } }), number: i + 1, ms: (t as DzTrack & { duration?: number }).duration ? (t as DzTrack & { duration?: number }).duration! * 1000 : undefined }));
  return {
    album: { ...a, deezerId: dzId, deezerUrl: a.deezerUrl ?? d.link, trackCount: d.nb_tracks ?? a.trackCount, releaseDate: a.releaseDate ?? d.release_date, genre: a.genre ?? d.genres?.data?.[0]?.name, artwork: a.artwork ?? d.cover_big ?? d.cover_xl },
    tracks,
  };
}

function dedupeByKey(tracks: AlbumTrack[]) {
  const keep = new Map<string, AlbumTrack>();
  for (const t of tracks) if (!keep.has(`${t.disc}|${t.number}`)) keep.set(`${t.disc}|${t.number}`, t);
  const merged = mergeSongs([...keep.values()]) as AlbumTrack[];
  return merged.sort((x, y) => (x.disc ?? 1) - (y.disc ?? 1) || (x.number ?? 0) - (y.number ?? 0));
}

/* ---------- Top 100 álbuns da Apple ---------- */

let albumCharts: Promise<Record<string, Chart>> | null = null;
export function loadAlbumCharts(): Promise<Record<string, Chart>> {
  if (!isStatic) return Promise.resolve({});
  albumCharts ??= (async () => {
    const ids = Object.keys(markets);
    const res = await Promise.allSettled(ids.map((c) => getAppleAlbumChart(c)));
    const out: Record<string, Chart> = {};
    res.forEach((r, i) => r.status === 'fulfilled' && (out[ids[i]] = r.value));
    return out;
  })();
  albumCharts.catch(() => (albumCharts = null));
  return albumCharts;
}

/** Onde o álbum está agora no Top 100 de álbuns da Apple. */
export function albumHits(charts: Record<string, Chart>, album: Pick<Album, 'key' | 'appleId'>) {
  const hits: { country: string; label: string; rank: number; change: number | null; isNew: boolean }[] = [];
  for (const [cc, c] of Object.entries(charts)) {
    const t = c.tracks.find((x) => (album.appleId && x.id === album.appleId) || matchKey(x.name, x.artistName) === album.key);
    if (t) hits.push({ country: cc, label: `${markets[cc]?.flag ?? cc}`, rank: t.rank, change: c.previousDate ? t.change : null, isNew: !!t.isNew });
  }
  return hits.sort((a, b) => a.rank - b.rank);
}

export const fmtDuration = (ms?: number) => {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const fmtLength = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

export const albumTypeLabel = (a: Album) =>
  a.type === 'single' ? 'Single' : a.type === 'ep' ? 'EP' : a.type === 'compile' ? 'Coletânea' : a.trackCount && a.trackCount <= 3 ? 'Single' : a.trackCount && a.trackCount <= 6 ? 'EP' : 'Álbum';
