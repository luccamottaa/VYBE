'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Headphones, LineChart as LineIcon, Radar, User } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { findHits, loadAllCharts, marketLabel, songHistory, type ChartHit } from '@/lib/all-charts';
import { getLastfm, type LastfmRow, type Point } from '@/lib/data-source';
import { findInIndex, searchCatalogSongs, type Song } from '@/lib/search';
import { artwork, fmtCompact, fmtFull, shortDate } from '@/lib/vybe';
import { buildDeepLink } from '@/lib/deep-link';
import { FollowButton } from './follow-button';
import { PreviewButton } from './preview';
import { albumFrom, type Album } from '@/lib/albums';
import { ShareButton } from './share-button';
import { SpotifyAllTime } from './spotify-all-time';
import { StreamCount } from './stream-count';
import { Cover, Movement } from './ui';

// Apple em azuis/violetas, Spotify em verdes/cianos.
const colors: Record<string, string> = {
  'ap:br': '#3b82f6', 'ap:us': '#8b5cf6', 'ap:kr': '#ec4899', 'ap:jp': '#f59e0b', 'ap:gb': '#6366f1',
  'sp:global': '#10b981', 'sp:br': '#22c55e', 'sp:us': '#14b8a6', 'sp:kr': '#06b6d4', 'sp:jp': '#84cc16', 'sp:gb': '#2dd4bf',
};

export function SongSheet({
  song,
  onClose,
  onArtist,
  onAlbum,
}: {
  song: Song | null;
  onClose: () => void;
  onArtist: (name: string, artistId?: string) => void;
  onAlbum?: (a: Album) => void;
}) {
  const [full, setFull] = useState<Song | null>(null);
  const [hits, setHits] = useState<ChartHit[]>([]);
  const [series, setSeries] = useState<[string, Point[]][]>([]);
  const [loading, setLoading] = useState(false);
  const [lastfm, setLastfm] = useState<Record<string, LastfmRow>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [chartTotal, setChartTotal] = useState<number | null>(null); // total do kworb, plano B do contador

  useEffect(() => {
    getLastfm().then(setLastfm);
  }, []);

  useEffect(() => {
    if (!song) return;
    let alive = true;
    setFull(song);
    setHits([]);
    setChartTotal(null);
    setSeries([]);
    setTotal(null);
    setLoading(true);
    (async () => {
      // completa com o índice (ids das duas fontes e mercados por onde já passou)
      const idx = await findInIndex(song.key);
      const s: Song = idx ? { ...idx, ...song, appleId: song.appleId ?? idx.appleId, spotifyId: song.spotifyId ?? idx.spotifyId, artwork: song.artwork ?? idx.artwork, markets: idx.markets } : song;
      if (!s.preview) {
        try {
          const found = await searchCatalogSongs(`${s.name} ${s.artist.split(/,|&/)[0]}`, undefined, 5);
          const same = found.find((x) => x.key === s.key);
          if (same) Object.assign(s, { preview: same.preview, appleUrl: s.appleUrl ?? same.appleUrl, album: s.album ?? same.album, albumId: s.albumId ?? same.albumId, releaseDate: s.releaseDate ?? same.releaseDate, artistId: s.artistId ?? same.artistId, artwork: s.artwork ?? same.artwork });
        } catch {
          /* sem prévia, tudo bem */
        }
      }
      const all = await loadAllCharts();
      const h = findHits(all, s);
      if (!alive) return;
      setFull({ ...s, artwork: s.artwork ?? h.find((x) => x.artwork)?.artwork });
      setHits(h);
      setChartTotal(all.spotify.global?.entries.find((e) => h.some((x) => x.market === 'sp:global' && x.id === e.spotifyId))?.totalStreams ?? null);
      const hist = await songHistory(all, s, h);
      if (alive) setSeries(hist);
    })()
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [song]);

  // datas de todas as séries numa linha do tempo só
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string | null>>();
    for (const [m, pts] of series) for (const p of pts) (byDate.get(p.date) ?? byDate.set(p.date, { date: p.date }).get(p.date)!)[m] = p.rank;
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [series]);
  const best = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [m, pts] of series) {
      const r = pts.map((p) => p.rank).filter((x): x is number => x !== null);
      if (r.length) out[m] = Math.min(...r);
    }
    return out;
  }, [series]);
  const past = (full?.markets ?? []).filter((m) => !hits.some((h) => h.market === m));
  const lf = full ? lastfm[full.key] : undefined;
  const spotifyId = full?.spotifyId ?? hits.find((h) => h.market.startsWith('sp:'))?.id;
  const appleUrl = full?.appleUrl ?? ((full?.appleId ?? hits.find((h) => h.market.startsWith('ap:'))?.id) ? `https://music.apple.com/br/song/${full?.appleId ?? hits.find((h) => h.market.startsWith('ap:'))?.id}` : undefined);

  return (
    <Sheet open={!!song} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">Charts da música</SheetTitle>
          <SheetDescription className="text-slate-400">Apple Music e Spotify em todos os mercados que o vybe acompanha</SheetDescription>
        </SheetHeader>

        {full && (
          <div className="space-y-5 px-4 pb-8">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Cover eager src={full.artwork ? artwork(full.artwork, 300) : ''} alt={`Capa de ${full.name}`} className="vy-pop h-24 w-24 rounded-2xl" />
                <PreviewButton src={full.preview} label={full.name} size="lg" className="absolute -bottom-2 -right-2 shadow-lg" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold leading-tight text-white">{full.name}</h2>
                <button onClick={() => onArtist(full.artist.split(/,|&| feat/i)[0].trim(), full.artistId)} className="mt-0.5 inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300">
                  <User className="h-3.5 w-3.5" /> {full.artist}
                </button>
                {(full.album || full.releaseDate) && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {full.album && onAlbum ? (
                      <button
                        onClick={() => onAlbum(albumFrom({ name: full.album!, artist: full.artist, artwork: full.artwork, appleId: full.albumId }))}
                        className="font-semibold text-slate-300 underline decoration-slate-600 underline-offset-2 hover:text-cyan-300"
                      >
                        💿 {full.album}
                      </button>
                    ) : (
                      full.album
                    )}
                    {full.album && full.releaseDate && ' · '}
                    {full.releaseDate && shortDate(`${full.releaseDate}T00:00:00Z`)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <FollowButton
                className="flex-1"
                target={{ kind: 'song', key: full.key, name: full.name, artist: full.artist, artwork: full.artwork, spotifyId, appleId: full.appleId ?? hits.find((h) => h.market.startsWith('ap:'))?.id }}
              />
              <ShareButton
                className="flex-1"
                link={buildDeepLink({ musica: full.name, artista: full.artist, spotify: spotifyId })}
                data={() => ({
                  kicker: hits.length ? `No vybe · em ${hits.length} ${hits.length === 1 ? 'chart' : 'charts'} agora` : 'No vybe',
                  title: full.name,
                  subtitle: full.artist,
                  artwork: full.artwork ? artwork(full.artwork, 600) : undefined,
                  stats: [
                    ...(hits.length ? [{ label: 'Melhor posição agora', value: `#${hits[0].rank}`, tone: 'cyan' as const }] : []),
                    ...(total ? [{ label: 'Streams no Spotify', value: fmtCompact(total), tone: 'green' as const }] : []),
                    ...(lf && !('missing' in lf) ? [{ label: 'Ouvintes Last.fm', value: fmtCompact(lf.listeners), tone: 'amber' as const }] : []),
                  ],
                  positions: hits.map((h) => ({ label: h.label, rank: h.rank })),
                  date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                })}
              />
            </div>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
                <Radar className="h-4 w-4 text-cyan-400" /> Agora nos charts
              </h3>
              {loading && !hits.length ? (
                <p className="text-xs text-slate-400">Procurando em todos os charts…</p>
              ) : hits.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {hits.map((h) => (
                    <div key={h.market} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5">
                      <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">{h.label}</span>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <strong className="text-lg font-black text-white">#{h.rank}</strong>
                        <Movement change={h.change} isNew={h.isNew} compact />
                      </div>
                      {typeof h.streams === 'number' && <span className="text-[0.625rem] text-emerald-400">{fmtCompact(h.streams)} streams</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400">
                  Essa música não tá em nenhum chart que o vybe acompanha agora.
                </p>
              )}
              {past.length > 0 && (
                <p className="mt-2 text-[0.6875rem] text-slate-500">
                  Já passou por: {past.map((m) => `${marketLabel(m)}${best[m] ? ` (melhor #${best[m]})` : ''}`).join(', ')}
                </p>
              )}
            </section>

            {!loading && <StreamCount spotifyId={spotifyId} name={full.name} artist={full.artist} songKey={full.key} fallbackTotal={chartTotal} onTotal={setTotal} />}

            {!loading && (
              <SpotifyAllTime
                spotifyId={spotifyId}
                name={full.name}
                artist={full.artist}
                songKey={full.key}
              />
            )}

            {lf && !('missing' in lf) && (
              <a href={lf.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 transition-colors hover:border-rose-500/40">
                <span className="mb-1 flex items-center gap-1.5 text-[0.625rem] uppercase tracking-wider text-rose-400/90">
                  <Headphones className="h-3 w-3" /> Last.fm · todos os tempos
                </span>
                <span className="text-lg font-black text-white">{fmtCompact(lf.listeners)}</span> <span className="text-xs text-slate-400">ouvintes</span>
                <span className="ml-4 text-lg font-black text-white">{fmtCompact(lf.playcount)}</span> <span className="text-xs text-slate-400">scrobbles</span>
              </a>
            )}

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
                <LineIcon className="h-4 w-4 text-cyan-400" /> Trajetória em cada chart
              </h3>
              {data.length >= 2 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#94a3b833" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v) => shortDate(String(v))} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis reversed domain={[1, 'dataMax']} allowDecimals={false} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(v, name) => [`#${v}`, marketLabel(String(name))]}
                        contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', borderRadius: '0.75rem', fontSize: 12 }}
                      />
                      <Legend formatter={(v) => <span className="text-[0.625rem] text-slate-400">{marketLabel(String(v))}</span>} iconSize={8} />
                      {series.map(([m]) => (
                        <Line key={m} dataKey={m} stroke={colors[m] ?? '#94a3b8'} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} strokeDasharray={m.startsWith('sp:') ? undefined : '5 3'} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400">{loading ? 'Carregando histórico…' : 'Ainda não há registros suficientes pra desenhar a trajetória.'}</p>
              )}
              <p className="mt-1 text-[0.625rem] text-slate-500">Linha cheia = Spotify · tracejada = Apple Music. Buraco = fora do chart naquele dia.</p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              {appleUrl && <ListenLink href={appleUrl}>Apple Music</ListenLink>}
              {spotifyId && <ListenLink href={`https://open.spotify.com/track/${spotifyId}`}>Spotify</ListenLink>}
              {full.deezerUrl && <ListenLink href={full.deezerUrl}>Deezer</ListenLink>}
            </div>
            {hits.some((h) => typeof h.streams === 'number') && (
              <p className="text-[0.625rem] text-slate-500">Streams do Spotify via kworb.net · maior número do dia: {fmtFull(Math.max(...hits.map((h) => h.streams ?? 0)))}</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ListenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2.5 text-xs font-bold text-[#020617] hover:from-cyan-400 hover:to-blue-500">
      Ouvir no {children} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
