'use client';

import { useEffect, useState } from 'react';
import { Disc3, ExternalLink, Library, Radar } from 'lucide-react';
import { albumsByArtist, albumTypeLabel, type Album } from '@/lib/albums';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { artistHits, loadAllCharts } from '@/lib/all-charts';
import { buildDeepLink } from '@/lib/deep-link';
import { artistKey } from '@/lib/follow';
import { FollowButton } from './follow-button';
import { ShareButton } from './share-button';
import { catalogSongsByArtist, matchesWords, mergeSongs, searchDeezerArtists, searchSpotifyArtists, songFrom, type Artist, type Song } from '@/lib/search';
import { artwork, shortDate } from '@/lib/vybe';
import { PreviewButton } from './preview';
import { Cover, CrossBadges } from './ui';

type Charted = Awaited<ReturnType<typeof artistHits>>[number];

export function ArtistSheet({ artist, onClose, onSong, onAlbum }: { artist: Artist | null; onClose: () => void; onSong: (s: Song) => void; onAlbum?: (a: Album) => void }) {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [albumType, setAlbumType] = useState<'all' | 'album' | 'single'>('all');
  const [photo, setPhoto] = useState<string | undefined>();
  const [charted, setCharted] = useState<Charted[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!artist) return;
    const c = new AbortController();
    setCharted([]);
    setCatalog([]);
    setAlbums(null);
    setPhoto(artist.picture);
    // sem foto (veio da Apple ou do ranking): pega no Spotify ou no Deezer
    if (!artist.picture)
      Promise.allSettled([searchSpotifyArtists(artist.name, c.signal), searchDeezerArtists(artist.name, c.signal, 5)]).then((rs) => {
        if (c.signal.aborted) return;
        const n = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const hit = rs.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).find((a) => a.picture && n(a.name) === n(artist.name));
        if (hit?.picture) setPhoto(hit.picture);
      });
    setAlbumType('all');
    albumsByArtist(artist, c.signal)
      .then((a) => !c.signal.aborted && setAlbums(a))
      .catch(() => !c.signal.aborted && setAlbums([]));
    setCatalogError('');
    setFilter('');
    setLoading(true);
    loadAllCharts()
      .then((all) => !c.signal.aborted && setCharted(artistHits(all, artist.name)))
      .catch(() => {});
    catalogSongsByArtist(artist, c.signal)
      .then((songs) => setCatalog(mergeSongs(songs)))
      .catch((e: Error) => e.name !== 'AbortError' && setCatalogError('Não deu pra abrir o catálogo agora.'))
      .finally(() => !c.signal.aborted && setLoading(false));
    return () => c.abort();
  }, [artist]);

  const chartedKeys = new Set(charted.map((s) => s.key));
  const cover = photo ?? artist?.picture ?? charted.find((s) => s.artwork)?.artwork ?? catalog.find((s) => s.artwork)?.artwork;
  const rest = catalog.filter((s) => !chartedKeys.has(s.key) && (!filter.trim() || matchesWords(`${s.name} ${s.album ?? ''}`, filter)));
  const markets = new Set(charted.flatMap((s) => s.hits.map((h) => h.market)));

  return (
    <Sheet open={!!artist} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">Artista</SheetTitle>
          <SheetDescription className="text-slate-400">Músicas nos charts agora e catálogo completo</SheetDescription>
        </SheetHeader>

        {artist && (
          <div className="space-y-5 px-4 pb-8">
            <div className="flex items-center gap-4">
              <Cover eager src={cover ? artwork(cover, 300) : ''} alt="" className="h-20 w-20 shrink-0 rounded-full" />
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold leading-tight text-white">{artist.name}</h2>
                <p className="text-xs text-slate-400">
                  {artist.genre && `${artist.genre} · `}
                  {charted.length ? `${charted.length} ${charted.length === 1 ? 'música' : 'músicas'} em ${markets.size} ${markets.size === 1 ? 'chart' : 'charts'}` : 'Fora dos charts agora'}
                </p>
                {artist.url && (
                  <a href={artist.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                    Apple Music <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <FollowButton className="flex-1" target={{ kind: 'artist', key: artistKey(artist.name), name: artist.name, artwork: cover, artistId: artist.artistId }} />
              <ShareButton
                className="flex-1"
                link={buildDeepLink({ artista: artist.name })}
                data={() => ({
                  kicker: charted.length ? `No vybe · ${markets.size} ${markets.size === 1 ? 'chart' : 'charts'}` : 'No vybe',
                  title: artist.name,
                  subtitle: charted.length ? `${charted.length} ${charted.length === 1 ? 'música' : 'músicas'} nos charts agora` : artist.genre ?? 'Artista',
                  artwork: cover ? artwork(cover, 600) : undefined,
                  round: true,
                  stats: [
                    ...(charted.length ? [{ label: 'Músicas nos charts', value: String(charted.length), tone: 'cyan' as const }] : []),
                    ...(charted.length ? [{ label: 'Melhor posição', value: `#${Math.min(...charted.map((s) => s.hits[0].rank))}`, tone: 'amber' as const }] : []),
                    ...(catalog.length ? [{ label: 'No catálogo', value: String(catalog.length), tone: 'green' as const }] : []),
                  ],
                  positions: charted.slice(0, 6).map((s) => ({ label: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name, rank: s.hits[0].rank })),
                  date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                })}
              />
            </div>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
                <Radar className="h-4 w-4 text-cyan-400" /> Nos charts agora
              </h3>
              {charted.length ? (
                <div className="space-y-2">
                  {charted.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => onSong(songFrom({ name: s.name, artist: s.artist, artwork: s.artwork, appleId: s.appleId, spotifyId: s.spotifyId }))}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-2.5 text-left transition-colors hover:border-slate-700"
                    >
                      <Cover eager src={s.artwork ?? ''} alt="" className="h-10 w-10 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{s.name}</p>
                        <CrossBadges hits={s.hits.map((h) => ({ label: h.label, rank: h.rank }))} max={4} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">{loading ? 'Procurando nos charts…' : 'Nenhuma música desse artista nos charts acompanhados agora.'}</p>
              )}
            </section>

            {(albums === null || albums.length > 0) && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
                    <Library className="h-4 w-4 text-cyan-400" /> Discografia {albums && <span className="text-xs font-medium text-slate-500">{albums.length}</span>}
                  </h3>
                  {albums && albums.length > 4 && (
                    <div className="flex rounded-lg border border-slate-800 bg-slate-950/70 p-0.5">
                      {([['all', 'Tudo'], ['album', 'Álbuns'], ['single', 'Singles e EPs']] as const).map(([id, label]) => (
                        <button key={id} onClick={() => setAlbumType(id)} className={`rounded-md px-2 py-0.5 text-[10px] transition-all ${albumType === id ? 'bg-cyan-500 font-bold text-[#020617]' : 'text-slate-400 hover:text-white'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hscroll -mx-4 snap-x gap-3 pb-1 [--hs-gap:0.75rem] [--hs-pad:1rem]">
                  {albums === null
                    ? Array.from({ length: 4 }, (_, i) => <div key={i} className="h-44 w-32 shrink-0 animate-pulse rounded-2xl bg-slate-800/50" />)
                    : albums
                        .filter((a) => albumType === 'all' || (albumType === 'album' ? albumTypeLabel(a) === 'Álbum' || albumTypeLabel(a) === 'Coletânea' : albumTypeLabel(a) === 'Single' || albumTypeLabel(a) === 'EP'))
                        .map((a) => (
                          <button key={a.key} onClick={() => onAlbum?.(a)} className="group w-32 shrink-0 snap-start text-left">
                            <Cover eager src={a.artwork ? artwork(a.artwork, 300) : ''} alt="" className="aspect-square w-full rounded-2xl transition-transform group-hover:-translate-y-0.5 group-hover:border-cyan-500/40" />
                            <p className="mt-1.5 truncate text-xs font-bold text-white group-hover:text-cyan-300">{a.name}</p>
                            <p className="truncate text-[10px] text-slate-500">
                              {albumTypeLabel(a)}
                              {a.releaseDate && ` · ${a.releaseDate.slice(0, 4)}`}
                            </p>
                          </button>
                        ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
                <Disc3 className="h-4 w-4 text-cyan-400" /> Catálogo
                {catalog.length > 0 && <span className="text-xs font-normal text-slate-500">· {catalog.length} músicas</span>}
              </h3>
              {catalog.length > 12 && (
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar músicas ou álbuns"
                  aria-label="Filtrar catálogo do artista"
                  className="mb-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none"
                />
              )}
              {catalogError ? (
                <p className="text-xs text-amber-300">{catalogError}</p>
              ) : catalog.length ? (
                <div className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800/60">
                  {rest.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 pr-2 transition-colors hover:bg-slate-800/30">
                      <button onClick={() => onSong(s)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
                        <Cover eager src={s.artwork ?? ''} alt="" className="h-9 w-9 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{s.name}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {s.album}
                            {s.releaseDate && ` · ${shortDate(`${s.releaseDate}T00:00:00Z`)}`}
                          </p>
                        </div>
                      </button>
                      <PreviewButton src={s.preview} label={s.name} />
                      </div>
                    ))}
                  {!rest.length && <p className="px-3 py-4 text-xs text-slate-500">Nada com esse filtro.</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-400">{loading ? 'Abrindo catálogo…' : 'Nada encontrado no catálogo.'}</p>
              )}
              <p className="mt-1 text-[10px] text-slate-500">Catálogo via iTunes Search API e Deezer.</p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
