'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Database,
  Disc3,
  ExternalLink,
  Flame,
  Globe2,
  Hourglass,
  Music2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrackSheet } from '@/components/vybe/track-sheet';
import { Sources } from '@/components/vybe/sources';
import { DitherField, palettes } from '@/components/vybe/dither-field';
import { Logo, LogoMark } from '@/components/vybe/logo';
import { Cover, CrossBadges, MetricCard, Movement, Panel, PanelTitle } from '@/components/vybe/ui';
import {
  appleView,
  artwork,
  daysSince,
  fmtCompact,
  fmtFull,
  markets,
  matchKey,
  releaseLabel,
  shortDate,
  spotifySummary,
  spotifyView,
  summarize,
  tenure,
  type Chart,
  type ChartView,
  type CrossHit,
  type Source,
  type SpotifyPayload,
  type ViewTrack,
} from '@/lib/vybe';

const genreColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
const tooltipStyle = { backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '0.75rem', fontSize: 12 };
type View = 'charts' | 'sources';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(d.error || 'Erro ao carregar');
  return d;
}

export default function Page() {
  const [source, setSource] = useState<Source>('apple');
  const [country, setCountry] = useState('br');
  const [tab, setTab] = useState<View>('charts');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ChartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ViewTrack | null>(null);
  const [cross, setCross] = useState<Map<string, CrossHit[]>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const next =
          source === 'spotify'
            ? spotifyView(await getJson<SpotifyPayload>('/api/spotify', signal))
            : appleView(await getJson<Chart>(`/api/chart?country=${country}`, signal), country);
        setView(next);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setView(null);
          setError((e as Error).message || 'Erro ao carregar o ranking');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [source, country],
  );

  useEffect(() => {
    const c = new AbortController();
    setView(null);
    setSelected(null);
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // Cruzamento: no Apple mostra a posição no Spotify; no Spotify mostra a posição nos 5 países da Apple.
  useEffect(() => {
    const c = new AbortController();
    setCross(new Map());
    const add = (map: Map<string, CrossHit[]>, key: string, hit: CrossHit) => map.set(key, [...(map.get(key) ?? []), hit]);
    (async () => {
      const map = new Map<string, CrossHit[]>();
      if (source === 'apple') {
        const sp = spotifyView(await getJson<SpotifyPayload>('/api/spotify', c.signal));
        for (const t of sp.tracks) add(map, matchKey(t.name, t.artistName), { label: 'Spotify', rank: t.rank });
      } else {
        const ids = Object.keys(markets);
        const results = await Promise.allSettled(ids.map((m) => getJson<Chart>(`/api/chart?country=${m}`, c.signal)));
        results.forEach((r, i) => {
          if (r.status !== 'fulfilled') return;
          for (const t of r.value.tracks) add(map, matchKey(t.name, t.artistName), { label: markets[ids[i]].flag, rank: t.rank });
        });
      }
      if (!c.signal.aborted) setCross(map);
    })().catch(() => {});
    return () => c.abort();
  }, [source]);

  // Ctrl/Cmd+K foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setTab('charts');
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const apple = useMemo(() => (view?.source === 'apple' ? summarize(view) : null), [view]);
  const spotify = useMemo(() => (view?.source === 'spotify' ? spotifySummary(view) : null), [view]);
  const climbers = useMemo(
    () => (view?.hasMovement ? view.tracks.filter((t) => (t.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)) : []),
    [view],
  );
  const debuts = useMemo(() => (view?.hasMovement ? view.tracks.filter((t) => t.isNew) : []), [view]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return view?.tracks.filter((t) => !q || `${t.name} ${t.artistName}`.toLocaleLowerCase().includes(q)) ?? [];
  }, [view, query]);
  const hitsFor = (t: ViewTrack) => cross.get(matchKey(t.name, t.artistName)) ?? [];

  const top = view?.tracks[0];
  const market = markets[country];
  const isSpotify = source === 'spotify';
  const weekly = !!view?.chartKey?.includes('weekly');
  const topRelease = top && view ? releaseLabel(daysSince(top.releaseDate, view.updated)) : null;
  const needsHistory = 'Precisa de 2 dias de registro';

  return (
    <div className="min-h-screen bg-[#070a11] p-4 font-sans text-slate-100 selection:bg-cyan-500 selection:text-black sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed left-1/4 top-0 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Navbar */}
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 shadow-2xl backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-3 lg:w-auto">
            <Link href="/" aria-label="vybe — início" className="flex items-center gap-2">
              <Logo />
              <span className="self-start rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">BETA</span>
            </Link>
            <Segmented
              className="ml-auto lg:ml-6"
              value={tab}
              onChange={setTab}
              options={[
                ['charts', 'Charts', Disc3],
                ['sources', 'Fontes', Database],
              ]}
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:flex-nowrap lg:w-auto">
            <Segmented
              value={source}
              onChange={(s) => {
                setSource(s);
                setTab('charts');
              }}
              options={[
                ['apple', 'Apple Music'],
                ['spotify', 'Spotify'],
              ]}
            />
            <div className="relative order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1 lg:w-72 lg:flex-none">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setTab('charts');
                }}
                maxLength={200}
                aria-label="Buscar no ranking"
                placeholder="Buscar música ou artista"
                className="w-full rounded-xl border border-slate-800/80 bg-slate-950/60 py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 transition-all focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
            {isSpotify ? (
              <span className="flex h-9 shrink-0 items-center rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 text-xs text-slate-300" title="O Spotify Charts público só tem o Global">
                🌍 Global
              </span>
            ) : (
              <Select value={country} onValueChange={(v) => v && setCountry(v)}>
                <SelectTrigger aria-label="País do ranking" className="h-9 w-auto shrink-0 rounded-xl border-slate-700/60 bg-slate-800/60 text-xs text-slate-200">
                  <SelectValue>{`${market.flag} ${country.toUpperCase()}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(markets).map(([id, m]) => (
                    <SelectItem key={id} value={id}>
                      {m.flag} {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {tab === 'sources' ? (
          <Sources />
        ) : error ? (
          <Panel className="flex flex-col items-center gap-3 py-16 text-center">
            <Music2 className="h-10 w-10 text-slate-600" />
            <h2 className="text-lg font-bold text-white">{isSpotify ? 'O Spotify Charts não respondeu' : 'O ranking não carregou'}</h2>
            <p className="max-w-lg text-sm text-slate-400">{error}</p>
            <button onClick={() => load()} className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">
              Tentar novamente
            </button>
          </Panel>
        ) : (
          <>
            {view?.stale && <Notice>A fonte não respondeu. Exibindo o último ranking salvo, de {shortDate(view.updated)}.</Notice>}
            {view && !view.historyAvailable && !view.stale && <Notice>Histórico indisponível agora. O ranking abre normal, mas este registro não foi salvo.</Notice>}

            {/* Hero: #1 */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-[#0a1430] to-slate-950 p-6 shadow-2xl lg:p-8">
              <DitherField palette={palettes[source]} className="pointer-events-none absolute inset-0 h-full w-full" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070a11]/85 via-[#070a11]/35 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070a11]/60 to-transparent md:hidden" />
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="flex min-w-0 items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-xl shadow-cyan-900/30 sm:h-28 sm:w-28">
                      {top ? (
                        <Cover src={top.artworkUrl100 ? artwork(top.artworkUrl100, 300) : ''} alt={`Capa de ${top.name}`} className="h-full w-full rounded-[14px] border-0" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-900">
                          <Disc3 className="h-10 w-10 text-cyan-400 motion-safe:animate-[spin_8s_linear_infinite]" />
                        </div>
                      )}
                    </div>
                    {top && <span className="absolute -bottom-2 -right-2 rounded-lg border-2 border-slate-900 bg-cyan-400 px-1.5 text-xs font-black text-slate-950">#1</span>}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                        No topo · {isSpotify ? '🌍 Spotify Global' : `${market.flag} ${market.name}`}
                      </span>
                      {top?.genre && <Chip>{top.genre}</Chip>}
                      {top && hitsFor(top).length > 0 && <CrossBadges hits={hitsFor(top)} max={3} />}
                    </div>
                    <h2 className="truncate text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                      {top ? top.name : loading ? 'Consultando o ranking…' : 'Ranking indisponível'}
                    </h2>
                    {top && (
                      <p className="text-xs text-slate-400">
                        <span className="font-medium text-slate-200">{top.artistName}</span>
                        {typeof top.streams === 'number' && <> • {fmtFull(top.streams)} streams</>}
                        {typeof top.days === 'number' && <> • {tenure(top.days, weekly)} no chart</>}
                        {topRelease && <> • {topRelease}</>}
                      </p>
                    )}
                  </div>
                </div>

                {top && (
                  <div className="flex w-full items-center justify-end gap-3 md:w-auto">
                    <a
                      href={top.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500 md:flex-none"
                    >
                      <Play className="h-4 w-4 fill-slate-950" /> Ouvir no {isSpotify ? 'Spotify' : 'Apple Music'}
                    </a>
                    <button
                      onClick={() => setSelected(top)}
                      aria-label={`Ver trajetória de ${top.name}`}
                      className="rounded-xl border border-slate-700/80 bg-slate-800/80 p-3 text-slate-300 transition-all hover:bg-slate-700/80"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Métricas */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {isSpotify ? (
                <>
                  <MetricCard
                    label="Streams no chart"
                    value={spotify?.hasStreams ? fmtCompact(spotify.totalStreams) : '—'}
                    icon={<BarChart3 className="h-4 w-4" />}
                    tone="emerald"
                    badge={view ? `Top ${view.tracks.length}` : undefined}
                    note={spotify?.hasStreams ? 'somados nesta parada' : 'Sem contagem nesta fonte'}
                  />
                  <MetricCard
                    label="#1 em streams"
                    value={spotify?.topStreams[0] ? fmtCompact(spotify.topStreams[0].streams) : '—'}
                    icon={<Flame className="h-4 w-4" />}
                    tone="orange"
                    note={spotify?.topStreams[0]?.name}
                  />
                </>
              ) : (
                <>
                  <MetricCard
                    label="Artistas no Top 100"
                    value={apple ? apple.artistCount : '—'}
                    icon={<Users className="h-4 w-4" />}
                    tone="blue"
                    badge={apple?.topArtists[0] ? `${apple.topArtists[0].count} faixas` : undefined}
                    note={apple?.topArtists[0] ? `${apple.topArtists[0].artist} lidera` : undefined}
                  />
                  <MetricCard
                    label="Lançamentos da semana"
                    value={apple ? apple.recent.length : '—'}
                    icon={<CalendarClock className="h-4 w-4" />}
                    tone="purple"
                    badge={apple ? 'até 7 dias' : undefined}
                    note={apple?.recent[0] ? `melhor: #${apple.recent[0].rank} ${apple.recent[0].name}` : undefined}
                  />
                </>
              )}
              <MetricCard
                label="Maior alta"
                value={climbers[0]?.name ?? '—'}
                icon={<TrendingUp className="h-4 w-4" />}
                tone="emerald"
                badge={climbers[0] ? `+${climbers[0].change}` : undefined}
                note={climbers[0] ? `agora #${climbers[0].rank}` : view?.hasMovement ? 'Ninguém subiu' : needsHistory}
              />
              <MetricCard
                label="Estreias"
                value={view?.hasMovement ? debuts.length : '—'}
                icon={<Sparkles className="h-4 w-4" />}
                tone="cyan"
                badge={view?.hasMovement ? 'novas no chart' : undefined}
                note={view?.compareLabel ?? needsHistory}
              />
            </section>

            {/* Grid principal */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Panel className="lg:col-span-2">
                {isSpotify ? (
                  <>
                    <PanelTitle icon={<BarChart3 className="h-4 w-4 text-emerald-400" />} title="Top 10 em streams" hint="Reproduções contadas pelo Spotify nesta parada" />
                    <div className="h-72 w-full">
                      {spotify?.topStreams.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={spotify.topStreams.map((t) => ({ name: t.name.length > 22 ? `${t.name.slice(0, 21)}…` : t.name, streams: t.streams }))} layout="vertical" margin={{ left: 0, right: 16 }}>
                            <defs>
                              <linearGradient id="barGreen" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#0891b2" />
                                <stop offset="100%" stopColor="#10b981" />
                              </linearGradient>
                            </defs>
                            <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(Number(v))} />
                            <YAxis type="category" dataKey="name" width={150} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(16,185,129,0.06)' }} formatter={(v) => [fmtFull(Number(v)), 'Streams']} contentStyle={tooltipStyle} />
                            <Bar dataKey="streams" fill="url(#barGreen)" radius={[0, 6, 6, 0]} barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : loading ? (
                        <Skeleton />
                      ) : (
                        <Empty>Esta parada veio sem contagem de streams.</Empty>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <PanelTitle icon={<BarChart3 className="h-4 w-4 text-cyan-400" />} title="Quem domina o Top 100" hint="Faixas por artista, contando colaborações para cada nome" />
                    <div className="h-72 w-full">
                      {apple?.topArtists.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={apple.topArtists} layout="vertical" margin={{ left: 0, right: 16 }}>
                            <defs>
                              <linearGradient id="barGlow" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#06b6d4" />
                              </linearGradient>
                            </defs>
                            <XAxis type="number" allowDecimals={false} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="artist" width={130} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(6,182,212,0.06)' }} formatter={(v) => [v, 'Faixas']} contentStyle={tooltipStyle} />
                            <Bar dataKey="count" fill="url(#barGlow)" radius={[0, 6, 6, 0]} barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Skeleton />
                      )}
                    </div>
                  </>
                )}
              </Panel>

              <Panel className="flex flex-col justify-between">
                <div>
                  <PanelTitle icon={<Flame className="h-4 w-4 text-orange-400" />} title={climbers.length ? 'Subindo rápido' : 'Top 5 agora'}>
                    <span className="text-xs font-medium text-slate-500">{climbers.length ? view?.compareLabel : 'Top hits'}</span>
                  </PanelTitle>
                  <div className="space-y-3">
                    {(climbers.length ? climbers : view?.tracks ?? []).slice(0, 5).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className="group flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-3 text-left transition-all hover:border-slate-700/80"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-7 text-center text-xs font-bold text-slate-500">#{t.rank}</span>
                          <Cover src={t.artworkUrl100} alt="" className="h-9 w-9 shrink-0 group-hover:border-cyan-500/40" />
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-white group-hover:text-cyan-300">{t.name}</h4>
                            <p className="truncate text-[10px] text-slate-400">{t.artistName}</p>
                          </div>
                        </div>
                        <Movement change={view?.hasMovement ? t.change : null} isNew={view?.hasMovement && t.isNew} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-800/60 pt-4">
                  {isSpotify ? (
                    <>
                      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <Hourglass className="h-3.5 w-3.5 text-cyan-400" /> Mais tempo no chart
                      </h4>
                      {spotify?.veterans.length ? (
                        <div className="grid grid-cols-2 gap-2">
                          {spotify.veterans.map((t) => (
                            <button key={t.id} onClick={() => setSelected(t)} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5 text-left hover:border-slate-700">
                              <span className="block truncate text-[10px] text-slate-400">{t.name}</span>
                              <strong className="text-sm font-black text-white">{t.days}</strong> <span className="text-[10px] text-slate-500">{tenure(t.days ?? 0, weekly).split(' ')[1]}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">Sem dado de permanência nesta parada.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <Tags className="h-3.5 w-3.5 text-cyan-400" /> Gêneros no chart
                      </h4>
                      {apple?.genres.length ? (
                        <div className="grid grid-cols-2 gap-2">
                          {apple.genres.slice(0, 4).map((g, i) => {
                            const pct = Math.round((g.count / view!.tracks.length) * 100);
                            return (
                              <div key={g.genre} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5">
                                <div className="mb-1 flex items-center justify-between gap-1 text-[10px] text-slate-400">
                                  <span className="truncate">{g.genre}</span>
                                  <span className="font-bold text-white">{pct}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: genreColors[i % genreColors.length] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">Gêneros aparecem na próxima atualização do feed.</p>
                      )}
                    </>
                  )}
                </div>
              </Panel>
            </section>

            {/* Ranking completo */}
            <Panel className="p-0 sm:p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-white">
                    <Globe2 className="h-4 w-4 text-cyan-400" /> {view?.title ?? (isSpotify ? 'Spotify Charts' : 'Apple Music')}
                  </h3>
                  <p className="text-xs text-slate-400">{view?.footnote ?? 'Carregando ranking…'}</p>
                </div>
                <button
                  onClick={() => load()}
                  disabled={loading}
                  aria-label="Atualizar ranking"
                  className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5 text-slate-300 transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading && !view ? (
                <div className="px-6 pb-6">
                  <Skeleton rows={8} />
                </div>
              ) : filtered.length ? (
                <ol className="divide-y divide-slate-800/60 border-t border-slate-800/60">
                  {filtered.map((t) => {
                    const hits = hitsFor(t);
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => setSelected(t)}
                          className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/30 sm:gap-4 sm:px-6"
                        >
                          <span className={`w-8 shrink-0 text-center text-sm font-black tabular-nums ${t.rank <= 3 ? 'text-cyan-400' : 'text-slate-500'}`}>
                            {String(t.rank).padStart(2, '0')}
                          </span>
                          <Cover src={t.artworkUrl100} alt="" className="h-10 w-10 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{t.name}</p>
                            <p className="truncate text-xs text-slate-400">{t.artistName}</p>
                          </div>
                          {hits.length > 0 && (
                            <span className="hidden shrink-0 lg:inline-flex">
                              <CrossBadges hits={hits} max={3} />
                            </span>
                          )}
                          {t.genre && <span className="hidden shrink-0 rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 md:inline">{t.genre}</span>}
                          {typeof t.streams === 'number' && (
                            <span className="hidden w-24 shrink-0 text-right text-xs tabular-nums text-slate-300 sm:inline" title={`${fmtFull(t.streams)} streams`}>
                              {fmtCompact(t.streams)}
                            </span>
                          )}
                          <span className="w-16 shrink-0 text-right">
                            <Movement change={view?.hasMovement ? t.change : null} isNew={view?.hasMovement && t.isNew} compact />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="flex flex-col items-center gap-2 border-t border-slate-800/60 p-10 text-center">
                  <h4 className="font-bold text-white">Nenhuma música encontrada</h4>
                  <p className="text-xs text-slate-400">A busca cobre todas as faixas deste chart.</p>
                  <button onClick={() => setQuery('')} className="mt-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                    Limpar busca
                  </button>
                </div>
              )}
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
              <span>{isSpotify ? 'Dados do Spotify Charts, fonte não oficial e sem API pública.' : 'Posições conforme a ordem do feed oficial da Apple. Posição ≠ streams.'}</span>
              {view && (
                <a href={view.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-cyan-400">
                  Consultar fonte <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-6 text-xs text-slate-500">
          <span className="flex items-center gap-2"><LogoMark className="h-5 w-auto" cutout="#070a11" title="" /><span className="font-brand text-sm font-semibold text-slate-300">vybe</span></span>
          <span>Ouça a música. Entenda o movimento.</span>
          <span>Feito em Manaus</span>
        </footer>
      </div>

      <TrackSheet track={selected} view={view} cross={selected ? hitsFor(selected) : []} onClose={() => setSelected(null)} />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string, React.ComponentType<{ className?: string }>?])[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex shrink-0 items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1 ${className}`}>
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          aria-label={label}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            value === id ? 'bg-cyan-500 font-bold text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span className={Icon ? 'hidden sm:inline' : undefined}>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{children}</span>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{children}</div>;
}

function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-6 animate-pulse rounded-lg bg-slate-800/60" style={{ width: `${90 - i * 7}%` }} />
      ))}
    </div>
  );
}
