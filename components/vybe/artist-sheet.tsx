'use client';

import { useEffect, useState } from 'react';
import { Disc3, ExternalLink, Radar } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { artistHits, loadAllCharts } from '@/lib/all-charts';
import { buildDeepLink } from '@/lib/deep-link';
import { artistKey } from '@/lib/follow';
import { FollowButton } from './follow-button';
import { ShareButton } from './share-button';
import { catalogSongsByArtist, matchesWords, mergeSongs, songFrom, type Artist, type Song } from '@/lib/search';
import { artwork, shortDate } from '@/lib/vybe';
import { PreviewButton } from './preview';
import { Cover, CrossBadges } from './ui';

type Charted = Awaited<ReturnType<typeof artistHits>>[number];

export function ArtistSheet({ artist, onClose, onSong }: { artist: Artist | null; onClose: () => void; onSong: (s: Song) => void }) {
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
  const cover = artist?.picture ?? charted.find((s) => s.artwork)?.artwork ?? catalog.find((s) => s.artwork)?.artwork;
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
              <Cover src={cover ? artwork(cover, 300) : ''} alt="" className="h-20 w-20 shrink-0 rounded-full" />
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
                      <Cover src={s.artwork ?? ''} alt="" className="h-10 w-10 shrink-0" />
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
                        <Cover src={s.artwork ?? ''} alt="" className="h-9 w-9 shrink-0" />
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
