'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Disc3, ExternalLink, ListMusic, Radar, User } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { albumHits, albumTracks, albumTypeLabel, fmtDuration, fmtLength, loadAlbumCharts, type Album, type AlbumTrack } from '@/lib/albums';
import { findHits, loadAllCharts, type All } from '@/lib/all-charts';
import { buildDeepLink } from '@/lib/deep-link';
import type { Song } from '@/lib/search';
import { artwork, shortDate, type Chart } from '@/lib/vybe';
import { cn } from '@/lib/utils';
import { PreviewButton } from './preview';
import { ShareButton } from './share-button';
import { Cover, Movement } from './ui';

/** Painel do álbum: capa, faixas (com quem está nos charts), posição no Top 100 de álbuns da Apple. */
export function AlbumSheet({ album, onClose, onSong, onArtist }: { album: Album | null; onClose: () => void; onSong: (s: Song) => void; onArtist: (name: string) => void }) {
  const [full, setFull] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [charts, setCharts] = useState<Record<string, Chart>>({});
  const [all, setAll] = useState<All | null>(null);

  useEffect(() => {
    loadAlbumCharts().then(setCharts).catch(() => {});
    loadAllCharts().then(setAll).catch(() => {});
  }, []);

  useEffect(() => {
    if (!album) return;
    const c = new AbortController();
    setFull(album);
    setTracks([]);
    setError('');
    setLoading(true);
    albumTracks(album, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setFull(r.album);
        setTracks(r.tracks);
        if (!r.tracks.length) setError('Não achei as faixas desse álbum no catálogo.');
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError('O catálogo não respondeu agora. Tenta de novo daqui a pouco.'))
      .finally(() => !c.signal.aborted && setLoading(false));
    return () => c.abort();
  }, [album]);

  const hits = useMemo(() => (full ? albumHits(charts, full) : []), [charts, full]);
  const trackHits = useMemo(() => new Map(tracks.map((t) => [t.key, all ? findHits(all, t) : []])), [tracks, all]);
  const charting = tracks.filter((t) => (trackHits.get(t.key) ?? []).length > 0);
  const total = tracks.reduce((s, t) => s + (t.ms ?? 0), 0);
  const discs = new Set(tracks.map((t) => t.disc ?? 1)).size;
  const cover = full?.artwork ? artwork(full.artwork, 600) : '';

  return (
    <Sheet open={!!album} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">{full ? albumTypeLabel(full) : 'Álbum'}</SheetTitle>
          <SheetDescription className="text-slate-400">Faixas, charts de álbuns e quem do disco está bombando</SheetDescription>
        </SheetHeader>

        {full && (
          <div className="space-y-5 px-4 pb-8">
            {/* capa com fundo desfocado */}
            <div className="theme-dark relative overflow-hidden rounded-3xl border border-slate-800 p-5">
              {cover && <img src={cover} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl" />}
              <div className="absolute inset-0 bg-gradient-to-b from-[#070a11]/30 to-[#070a11]/90" />
              <div className="relative flex flex-col items-center text-center">
                <Cover eager src={cover} alt={`Capa de ${full.name}`} className="vy-pop h-48 w-48 rounded-2xl shadow-2xl shadow-black/50" />
                <h2 className="mt-4 text-2xl font-extrabold leading-tight text-white">{full.name}</h2>
                <button onClick={() => onArtist(full.artist.split(/,|&| feat/i)[0].trim())} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                  <User className="h-3.5 w-3.5" /> {full.artist}
                </button>
                <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-xs text-slate-300">
                  {full.releaseDate && <span>{shortDate(`${full.releaseDate}T00:00:00Z`)} {full.releaseDate.slice(0, 4)}</span>}
                  {(tracks.length || full.trackCount) && <span>· {tracks.length || full.trackCount} faixas</span>}
                  {total > 0 && <span>· {fmtLength(total)}</span>}
                  {full.genre && <span>· {full.genre}</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(full.appleUrl || full.appleId) && (
                <a
                  href={full.appleUrl ?? `https://music.apple.com/br/album/${full.appleId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 text-xs font-bold text-[#020617]"
                >
                  Apple Music <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {full.deezerUrl && (
                <a href={full.deezerUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 text-xs font-bold text-slate-200 hover:bg-slate-800">
                  Deezer <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <ShareButton
                compact
                link={buildDeepLink({ album: full.name, artista: full.artist })}
                data={() => ({
                  kicker: hits.length ? `Top álbuns Apple Music · ${hits.length} ${hits.length === 1 ? 'país' : 'países'}` : albumTypeLabel(full),
                  title: full.name,
                  subtitle: full.artist,
                  artwork: cover || undefined,
                  stats: [
                    ...(hits.length ? [{ label: 'Melhor posição', value: `#${hits[0].rank}`, tone: 'cyan' as const }] : []),
                    ...(charting.length ? [{ label: 'Faixas nos charts', value: String(charting.length), tone: 'green' as const }] : []),
                    ...(tracks.length ? [{ label: 'Faixas', value: String(tracks.length), tone: 'amber' as const }] : []),
                  ],
                  positions: hits.map((h) => ({ label: `Álbuns ${h.label}`, rank: h.rank })),
                  date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                })}
              />
            </div>

            {hits.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
                  <Radar className="h-4 w-4 text-cyan-400" /> Top 100 álbuns da Apple agora
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {hits.map((h) => (
                    <div key={h.country} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5">
                      <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Apple {h.label}</span>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <strong className="text-lg font-black text-white">#{h.rank}</strong>
                        <Movement change={h.change} isNew={h.isNew} compact />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {charting.length > 0 && (
              <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">
                🔥 {charting.length} {charting.length === 1 ? 'faixa desse disco está' : 'faixas desse disco estão'} nos charts de músicas agora.
              </p>
            )}

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
                <ListMusic className="h-4 w-4 text-cyan-400" /> Faixas
                {total > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[0.6875rem] font-normal text-slate-500">
                    <Clock3 className="h-3 w-3" /> {fmtLength(total)}
                  </span>
                )}
              </h3>
              {loading ? (
                <div className="space-y-2" role="status" aria-label="Carregando faixas">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-xl bg-slate-800/50" />
                  ))}
                </div>
              ) : error ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400">{error}</p>
              ) : (
                <ol className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800/60">
                  {tracks.map((t, i) => {
                    const h = trackHits.get(t.key) ?? [];
                    const newDisc = discs > 1 && (i === 0 || (tracks[i - 1].disc ?? 1) !== (t.disc ?? 1));
                    return (
                      <li key={`${t.disc}-${t.number}-${t.key}`}>
                        {newDisc && (
                          <p className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-slate-500">
                            <Disc3 className="h-3 w-3" /> Disco {t.disc ?? 1}
                          </p>
                        )}
                        <div className={cn('flex items-center gap-1 pr-2 transition-colors hover:bg-slate-800/40', h.length && 'bg-emerald-500/[0.04]')}>
                          <button onClick={() => onSong(t)} className="group flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
                            <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-slate-500">{t.number ?? i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white group-hover:text-cyan-300">{t.name}</p>
                              {t.artist !== full.artist && <p className="truncate text-[0.6875rem] text-slate-400">{t.artist}</p>}
                            </div>
                            {h.length > 0 && (
                              <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-emerald-400" title={h.map((x) => `${x.label} #${x.rank}`).join(' · ')}>
                                #{h[0].rank} {h[0].label.split(' ')[1]}
                              </span>
                            )}
                            <span className="w-9 shrink-0 text-right text-[0.6875rem] tabular-nums text-slate-500">{fmtDuration(t.ms)}</span>
                          </button>
                          <PreviewButton src={t.preview} label={t.name} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
