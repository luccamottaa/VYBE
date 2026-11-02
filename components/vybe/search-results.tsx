'use client';

import { albumTypeLabel, searchAlbums, type Album } from '@/lib/albums';
import { useEffect, useRef, useState } from 'react';
import { Library, Loader2, Music2, Search, User } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  STOREFRONTS,
  mergeSongs,
  searchCatalogArtists,
  searchCatalogSongs,
  searchDeezerArtists,
  searchDeezerSongs,
  searchIndex,
  searchIndexArtists,
  searchSpotifyArtists,
  searchSpotifySongs,
  type Artist,
  type Song,
} from '@/lib/search';
import { artwork, fmtCompact } from '@/lib/vybe';
import { PreviewButton } from './preview';
import { Cover } from './ui';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/** Todos os resultados: índice do vybe + Apple (5 lojas) + Deezer, com "carregar mais". */
export function SearchResults({
  query: initial,
  onClose,
  onSong,
  onArtist,
  onAlbum,
}: {
  query: string | null;
  onClose: () => void;
  onSong: (s: Song) => void;
  onArtist: (a: Artist) => void;
  onAlbum: (a: Album) => void;
}) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'songs' | 'albums' | 'artists'>('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [spNext, setSpNext] = useState<number | null>(null);
  const [spotifyOn, setSpotifyOn] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initial !== null) setQuery(initial);
  }, [initial]);

  const q = query.trim();
  useEffect(() => {
    if (initial === null || q.length < 2) return;
    const c = new AbortController();
    ctrl.current = c;
    const t = setTimeout(async () => {
      setLoading(true);
      setErrors([]);
      setAlbums([]);
      searchAlbums(q, c.signal, 30)
        .then((a) => !c.signal.aborted && setAlbums(a))
        .catch(() => {});
      const [spotify, spA, idx, apple, deezer, idxA, apA, dzA] = await Promise.allSettled([
        Promise.all([0, 10, 20].map((o) => searchSpotifySongs(q, o, c.signal))),
        searchSpotifyArtists(q, c.signal),
        searchIndex(q, 50),
        searchCatalogSongs(q, c.signal, 50, STOREFRONTS),
        searchDeezerSongs(q, 0, c.signal, 50),
        searchIndexArtists(q, 6),
        searchCatalogArtists(q, c.signal, 10),
        searchDeezerArtists(q, c.signal, 10),
      ]);
      if (c.signal.aborted) return;
      const ok = <T,>(r: PromiseSettledResult<T>, fallback: T) => (r.status === 'fulfilled' ? r.value : fallback);
      const dz = ok(deezer, { songs: [], total: 0, next: null });
      const sp = ok(spotify, []);
      setSongs(mergeSongs(ok(idx, []), ...sp.map((p) => p.songs), ok(apple, []), dz.songs));
      setNext(dz.next);
      setSpNext(sp.length ? sp[sp.length - 1].next : null);
      setTotal(Math.max(dz.total, sp[0]?.total ?? 0));
      // artistas: junta Apple e Deezer pelo nome
      const byName = new Map<string, Artist>();
      for (const a of [...ok(spA, []), ...ok(apA, []), ...ok(dzA, []), ...ok(idxA, [])]) {
        const k = norm(a.name);
        const prev = byName.get(k);
        byName.set(k, prev ? { ...a, ...prev, spotifyId: prev.spotifyId ?? a.spotifyId, deezerId: prev.deezerId ?? a.deezerId, picture: prev.picture ?? a.picture, fans: prev.fans ?? a.fans, artistId: prev.artistId ?? a.artistId } : a);
      }
      setArtists([...byName.values()]);
      setErrors([apple.status === 'rejected' && 'Apple', deezer.status === 'rejected' && 'Deezer'].filter(Boolean) as string[]);
      setSpotifyOn(spotify.status === 'fulfilled');
      setLoading(false);
    }, 350);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q, initial]);

  // "Carregar mais": próximas páginas do Spotify (30 por vez) e do Deezer (50)
  const loadMore = async () => {
    if ((next === null && spNext === null) || !ctrl.current) return;
    const signal = ctrl.current.signal;
    setMore(true);
    const [sp, dz] = await Promise.allSettled([
      spNext !== null ? Promise.all([0, 10, 20].map((d) => searchSpotifySongs(q, spNext + d, signal))) : Promise.resolve([]),
      next !== null ? searchDeezerSongs(q, next, signal, 50) : Promise.resolve(null),
    ]);
    const spPages = sp.status === 'fulfilled' ? sp.value : [];
    setSongs((s) => mergeSongs(s, ...spPages.map((p) => p.songs), dz.status === 'fulfilled' && dz.value ? dz.value.songs : []));
    setSpNext(spPages.length ? spPages[spPages.length - 1].next : null);
    setNext(dz.status === 'fulfilled' && dz.value ? dz.value.next : null);
    setMore(false);
  };

  return (
    <Sheet open={initial !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-white">Buscar no catálogo</SheetTitle>
          <SheetDescription className="text-slate-400">Charts do vybe + Spotify + Apple Music (5 países) + Deezer</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Música, artista, álbum…"
              aria-label="Buscar no catálogo"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />}
          </label>

          <div className="flex items-center justify-between gap-2">
            <div role="tablist" className="flex rounded-xl border border-slate-800 bg-slate-950/80 p-1">
              {(
                [
                  ['songs', `Músicas${songs.length ? ` (${songs.length})` : ''}`],
                  ['albums', `Álbuns${albums.length ? ` (${albums.length})` : ''}`],
                  ['artists', `Artistas${artists.length ? ` (${artists.length})` : ''}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-all ${tab === id ? 'bg-cyan-500 font-bold text-[#020617]' : 'text-slate-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {total > 0 && <span className="text-[11px] text-slate-500">~{fmtCompact(total)} resultados</span>}
          </div>

          {errors.length > 0 && <p className="text-[11px] text-amber-300">Fora do ar agora: {errors.join(' e ')}. Mostrando o resto.</p>}

          {q.length < 2 ? (
            <p className="py-8 text-center text-sm text-slate-500">Digite pelo menos 2 letras.</p>
          ) : tab === 'songs' ? (
            songs.length ? (
              <>
                <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800/60">
                  {songs.map((s) => (
                    <li key={s.key} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-slate-800/30">
                      <button onClick={() => onSong(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Cover src={s.artwork ?? ''} alt="" className="h-10 w-10 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">{s.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {s.artist}
                            {s.album && ` · ${s.album}`}
                          </span>
                        </span>
                        {s.from?.includes('spotify') && !s.markets?.length && (
                          <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">Spotify</span>
                        )}
                        {s.markets?.length ? (
                          <span className="shrink-0 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">
                            {s.markets.length} {s.markets.length === 1 ? 'chart' : 'charts'}
                          </span>
                        ) : null}
                      </button>
                      <PreviewButton src={s.preview} label={s.name} />
                    </li>
                  ))}
                </ul>
                {(next !== null || spNext !== null) && (
                  <button
                    onClick={loadMore}
                    disabled={more}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                  >
                    {more && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Carregar mais músicas
                  </button>
                )}
              </>
            ) : (
              <Empty loading={loading} icon={<Music2 className="h-8 w-8" />} text="Nenhuma música encontrada." />
            )
          ) : tab === 'albums' ? (
            albums.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {albums.map((a) => (
                  <button key={a.key} onClick={() => onAlbum(a)} className="group text-left">
                    <Cover src={a.artwork ? artwork(a.artwork, 300) : ''} alt="" className="aspect-square w-full rounded-2xl transition-transform group-hover:-translate-y-0.5 group-hover:border-cyan-500/40" />
                    <span className="mt-1.5 block truncate text-xs font-bold text-white group-hover:text-cyan-300">{a.name}</span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {a.artist} · {albumTypeLabel(a)}
                      {a.releaseDate && ` · ${a.releaseDate.slice(0, 4)}`}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty loading={loading} icon={<Library className="h-8 w-8" />} text="Nenhum álbum encontrado." />
            )
          ) : artists.length ? (
            <ul className="space-y-2">
              {artists.map((a) => (
                <li key={a.artistId ?? a.deezerId ?? a.name}>
                  <button onClick={() => onArtist(a)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-2.5 text-left hover:border-slate-700">
                    <Cover src={a.picture ?? ''} alt="" className="h-11 w-11 shrink-0 rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{a.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {[a.genre, a.fans ? `${fmtCompact(a.fans)} fãs no Deezer` : null].filter(Boolean).join(' · ') || 'Artista'}
                      </span>
                    </span>
                    <User className="h-4 w-4 text-slate-600" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty loading={loading} icon={<User className="h-8 w-8" />} text="Nenhum artista encontrado." />
          )}

          <p className="text-[10px] text-slate-500">
            Catálogo via {spotifyOn ? 'Spotify Web API, ' : ''}iTunes Search API e Deezer API. Prévias de 30 segundos fornecidas por eles.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Empty({ loading, icon, text }: { loading: boolean; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : icon}
      <p className="text-sm">{loading ? 'Procurando em todos os catálogos…' : text}</p>
    </div>
  );
}
