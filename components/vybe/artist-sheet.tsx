'use client';

import { useEffect, useRef, useState } from 'react';
import { coverDitherPalette } from './ambient-background';
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

/** Imagem que falhou some em vez de mostrar o ícone de imagem quebrada. */
const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none';
};

export function ArtistSheet({ artist, onClose, onSong, onAlbum }: { artist: Artist | null; onClose: () => void; onSong: (s: Song) => void; onAlbum?: (a: Album) => void }) {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  // cores da foto pro degradê do topo (noite: fundas; dia: pastel)
  const [tint, setTint] = useState<[string, string] | null>(null);
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
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
  useEffect(() => {
    let alive = true;
    coverDitherPalette(cover ? artwork(cover, 300) : undefined, dark).then((p) => alive && setTint(p ? [p[0], p[1]] : null));
    return () => {
      alive = false;
    };
  }, [cover, dark]);
  const rest = catalog.filter((s) => !chartedKeys.has(s.key) && (!filter.trim() || matchesWords(`${s.name} ${s.album ?? ''}`, filter)));
  const markets = new Set(charted.flatMap((s) => s.hits.map((h) => h.market)));

  // parallax: a foto desce mais devagar que a página e apaga conforme rola
  const backdrop = useRef<HTMLDivElement>(null);
  const onScroll = (e: React.UIEvent<HTMLElement>) => backdrop.current?.style.setProperty('--y', String(e.currentTarget.scrollTop));

  return (
    <Sheet open={!!artist} onOpenChange={(o) => !o && onClose()}>
      <SheetContent onScroll={onScroll} className="w-full overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-lg">
        {/* fundo do artista: a foto grande sumindo no escuro + um banho de cor tirado dela */}
        {artist && cover && (
          <div ref={backdrop} aria-hidden className="vy-artist-bg pointer-events-none absolute inset-x-0 top-0 h-[44rem] overflow-hidden">
            {/* manchas de cor da foto flutuando devagar (aurora) */}
            <img src={artwork(cover, 100)} alt="" onError={hideBroken} className="vy-aurora-a absolute left-[-30%] top-[-10%] h-[70%] w-[110%] rounded-full object-cover opacity-70 blur-3xl saturate-200" />
            <img src={artwork(cover, 100)} alt="" onError={hideBroken} className="vy-aurora-b absolute right-[-35%] top-[20%] h-[60%] w-[100%] rounded-full object-cover opacity-60 mix-blend-screen blur-3xl saturate-200 [transform:scaleX(-1)]" />
            <img src={artwork(cover, 100)} alt="" onError={hideBroken} className="vy-aurora-c absolute bottom-[0%] left-[0%] h-[50%] w-[90%] rounded-full object-cover opacity-50 blur-3xl saturate-150 [transform:rotate(180deg)]" />
            <div className="vy-artist-photo absolute inset-x-0 top-0 h-[26rem]">
            <img
              key={cover}
              src={artwork(cover, 600)}
              alt="" onError={hideBroken}
              className="vy-artist-backdrop absolute inset-x-0 top-0 h-[26rem] w-full object-cover object-[50%_20%] opacity-70"
              style={{ maskImage: 'linear-gradient(to bottom, black 35%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent)' }}
            />
            </div>
            <div
              className="absolute inset-0"
              style={{
                background: tint
                  ? `linear-gradient(180deg, ${tint[1]}66 0%, ${tint[0]}b3 45%, var(--popover) 100%)`
                  : 'linear-gradient(180deg, #070a1150 0%, #070a1199 50%, var(--popover) 100%)',
              }}
            />
          </div>
        )}
        <SheetHeader className="relative">
          <SheetTitle className="text-white">Artista</SheetTitle>
          <SheetDescription className="text-slate-400">Músicas nos charts agora e catálogo completo</SheetDescription>
        </SheetHeader>

        {artist && (
          <div className="relative space-y-5 px-4 pb-8">
            <div className="flex flex-col items-center pt-24 text-center">
              <Cover eager src={cover ? artwork(cover, 300) : ''} alt="" className="vy-pop h-28 w-28 shrink-0 rounded-full shadow-2xl shadow-black/60 ring-4 ring-white/10" />
              <div className="mt-4 min-w-0">
                <h2 className="text-4xl font-black leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.5)]">{artist.name}</h2>
                <p className="mt-2 text-xs font-medium text-slate-300">
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

            <div className="flex flex-wrap gap-2">
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
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
                    <Library className="h-4 w-4 text-cyan-400" /> Discografia {albums && <span className="text-xs font-medium text-slate-500">{albums.length}</span>}
                  </h3>
                  {albums && albums.length > 4 && (
                    <div className="flex rounded-lg border border-slate-800 bg-slate-950/70 p-0.5">
                      {([['all', 'Tudo'], ['album', 'Álbuns'], ['single', 'Singles e EPs']] as const).map(([id, label]) => (
                        <button key={id} onClick={() => setAlbumType(id)} className={`rounded-md px-2 py-0.5 text-[0.625rem] transition-all ${albumType === id ? 'bg-cyan-500 font-bold text-[#020617]' : 'text-slate-400 hover:text-white'}`}>
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
                            <p className="truncate text-[0.625rem] text-slate-500">
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
                          <p className="truncate text-[0.6875rem] text-slate-500">
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
              <p className="mt-1 text-[0.625rem] text-slate-500">Catálogo via iTunes Search API e Deezer.</p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
