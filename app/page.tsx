'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Database,
  Disc3,
  ExternalLink,
  Flame,
  Globe2,
  Music2,
  Play,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrackSheet } from '@/components/vybe/track-sheet';
import { Sources } from '@/components/vybe/sources';
import { MetricCard, Movement, Panel, PanelTitle } from '@/components/vybe/ui';
import { artwork, daysSince, markets, releaseLabel, shortDate, summarize, type Chart, type Track } from '@/lib/vybe';

const genreColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
type View = 'charts' | 'sources';

export default function Page() {
  const [country, setCountry] = useState('br');
  const [view, setView] = useState<View>('charts');
  const [query, setQuery] = useState('');
  const [chart, setChart] = useState<Chart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Track | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch('/api/chart?country=' + country, { signal });
        const d = (await r.json()) as Chart & { error?: string };
        if (!r.ok) throw new Error(d.error);
        setChart(d);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setChart(null);
          setError((e as Error).message || 'Erro ao carregar o ranking');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [country],
  );

  useEffect(() => {
    const c = new AbortController();
    setChart(null);
    setSelected(null);
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // Ctrl/Cmd+K foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView('charts');
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stats = useMemo(() => (chart ? summarize(chart) : null), [chart]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return chart?.tracks.filter((t) => !q || `${t.name} ${t.artistName}`.toLocaleLowerCase().includes(q)) ?? [];
  }, [chart, query]);

  const top = chart?.tracks[0];
  const market = markets[country];
  const hasHistory = !!chart?.previousDate;

  return (
    <div className="min-h-screen bg-[#070a11] p-4 font-sans text-slate-100 selection:bg-cyan-500 selection:text-black sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed left-1/4 top-0 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Navbar */}
        <header className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 shadow-2xl backdrop-blur-xl md:flex-row">
          <div className="flex w-full items-center gap-3 md:w-auto">
            <Link href="/" aria-label="VYBE início" className="rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 p-2.5 shadow-lg shadow-cyan-500/20">
              <Radio className="h-5 w-5 text-white motion-safe:animate-pulse" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-xl font-black tracking-wider text-transparent">VYBE</h1>
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">BETA</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Music & Chart Intelligence</p>
            </div>
            <nav className="ml-auto flex items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1 md:ml-6">
              {(
                [
                  ['charts', 'Charts', Disc3],
                  ['sources', 'Fontes', Database],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    view === id ? 'bg-cyan-500 font-bold text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex w-full items-center gap-3 md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setView('charts');
                }}
                maxLength={200}
                aria-label="Buscar no ranking"
                placeholder="Buscar música ou artista"
                className="w-full rounded-xl border border-slate-800/80 bg-slate-950/60 py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 transition-all focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
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
          </div>
        </header>

        {view === 'sources' ? (
          <Sources />
        ) : error ? (
          <Panel className="flex flex-col items-center gap-3 py-16 text-center">
            <Music2 className="h-10 w-10 text-slate-600" />
            <h2 className="text-lg font-bold text-white">O ranking não carregou</h2>
            <p className="text-sm text-slate-400">{error}</p>
            <button onClick={() => load()} className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">
              Tentar novamente
            </button>
          </Panel>
        ) : (
          <>
            {/* Avisos de estado dos dados */}
            {chart?.stale && (
              <Notice>A fonte não respondeu. Exibindo o último ranking disponível, de {shortDate(chart.updated)}.</Notice>
            )}
            {chart && !chart.historyAvailable && !chart.stale && (
              <Notice>Histórico indisponível agora. O ranking abre normal, mas este registro não foi salvo.</Notice>
            )}

            {/* Hero: #1 do país */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-slate-950/80 p-6 shadow-2xl backdrop-blur-md lg:p-8">
              {top && (
                <img
                  src={artwork(top.artworkUrl100, 600)}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -right-20 top-1/2 h-[140%] -translate-y-1/2 opacity-15 blur-2xl"
                />
              )}
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="flex min-w-0 items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-xl shadow-cyan-900/30 sm:h-28 sm:w-28">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-slate-900">
                        {top ? (
                          <img src={artwork(top.artworkUrl100, 300)} alt={`Capa de ${top.name}`} className="h-full w-full object-cover text-[0px]" />
                        ) : (
                          <Disc3 className="h-10 w-10 text-cyan-400 motion-safe:animate-[spin_8s_linear_infinite]" />
                        )}
                      </div>
                    </div>
                    {top && (
                      <span className="absolute -bottom-2 -right-2 rounded-lg border-2 border-slate-900 bg-cyan-400 px-1.5 text-xs font-black text-slate-950">#1</span>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                        No topo · {market.flag} {market.name}
                      </span>
                      {top?.genre && (
                        <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{top.genre}</span>
                      )}
                    </div>
                    <h2 className="truncate text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                      {top ? top.name : loading ? 'Consultando o ranking…' : 'Ranking indisponível'}
                    </h2>
                    {top && (
                      <p className="text-xs text-slate-400">
                        <span className="font-medium text-slate-200">{top.artistName}</span>
                        {releaseLabel(daysSince(top.releaseDate, chart!.updated)) && <> • {releaseLabel(daysSince(top.releaseDate, chart!.updated))}</>}
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
                      <Play className="h-4 w-4 fill-slate-950" /> Ouvir no Apple Music
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
              <MetricCard
                label="Artistas no Top 100"
                value={stats ? stats.artistCount : '—'}
                icon={<Users className="h-4 w-4" />}
                tone="blue"
                badge={stats?.topArtists[0] ? `${stats.topArtists[0].count} faixas` : undefined}
                note={stats?.topArtists[0] ? `${stats.topArtists[0].artist} lidera` : undefined}
              />
              <MetricCard
                label="Maior alta"
                value={stats?.climbers[0] ? stats.climbers[0].name : '—'}
                icon={<TrendingUp className="h-4 w-4" />}
                tone="emerald"
                badge={stats?.climbers[0] ? `+${stats.climbers[0].change}` : undefined}
                note={stats?.climbers[0] ? `agora #${stats.climbers[0].rank}` : hasHistory ? 'Ninguém subiu' : 'Precisa de 2 dias de registro'}
              />
              <MetricCard
                label="Estreias"
                value={hasHistory ? stats?.debuts.length ?? '—' : '—'}
                icon={<Sparkles className="h-4 w-4" />}
                tone="cyan"
                badge={hasHistory ? 'novas no chart' : undefined}
                note={hasHistory ? `vs ${shortDate(chart!.previousDate!)}` : 'Precisa de 2 dias de registro'}
              />
              <MetricCard
                label="Lançamentos da semana"
                value={stats ? stats.recent.length : '—'}
                icon={<CalendarClock className="h-4 w-4" />}
                tone="purple"
                badge={stats ? 'até 7 dias' : undefined}
                note={stats?.recent[0] ? `melhor: #${stats.recent[0].rank} ${stats.recent[0].name}` : undefined}
              />
            </section>

            {/* Grid principal */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Panel className="lg:col-span-2">
                <PanelTitle
                  icon={<BarChart3 className="h-4 w-4 text-cyan-400" />}
                  title="Quem domina o Top 100"
                  hint="Faixas por artista, contando colaborações para cada nome"
                />
                <div className="h-72 w-full">
                  {stats?.topArtists.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.topArtists} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <defs>
                          <linearGradient id="barGlow" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                        </defs>
                        <XAxis type="number" allowDecimals={false} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="artist" width={130} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: 'rgba(6,182,212,0.06)' }}
                          formatter={(v) => [v, 'Faixas']}
                          contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '0.75rem', fontSize: 12 }}
                        />
                        <Bar dataKey="count" fill="url(#barGlow)" radius={[0, 6, 6, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Skeleton />
                  )}
                </div>
              </Panel>

              <Panel className="flex flex-col justify-between">
                <div>
                  <PanelTitle icon={<Flame className="h-4 w-4 text-orange-400" />} title={stats?.climbers.length ? 'Subindo rápido' : 'Top 5 agora'}>
                    <span className="text-xs font-medium text-slate-500">{stats?.climbers.length ? `vs ${shortDate(chart!.previousDate!)}` : 'Top hits'}</span>
                  </PanelTitle>
                  <div className="space-y-3">
                    {(stats?.climbers.length ? stats.climbers : chart?.tracks ?? []).slice(0, 5).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className="group flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-3 text-left transition-all hover:border-slate-700/80"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-6 text-center text-xs font-bold text-slate-500">#{t.rank}</span>
                          <img src={t.artworkUrl100} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg border border-slate-800 group-hover:border-cyan-500/40" />
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-white group-hover:text-cyan-300">{t.name}</h4>
                            <p className="truncate text-[10px] text-slate-400">{t.artistName}</p>
                          </div>
                        </div>
                        <Movement change={t.change} isNew={t.isNew} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-800/60 pt-4">
                  <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Tags className="h-3.5 w-3.5 text-cyan-400" /> Gêneros no chart
                  </h4>
                  {stats?.genres.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {stats.genres.slice(0, 4).map((g, i) => {
                        const pct = Math.round((g.count / chart!.tracks.length) * 100);
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
                </div>
              </Panel>
            </section>

            {/* Ranking completo */}
            <Panel className="p-0 sm:p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-white">
                    <Globe2 className="h-4 w-4 text-cyan-400" /> Top 100 Apple Music · {market.flag} {market.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {chart
                      ? `Feed de ${shortDate(chart.updated)} · ${chart.days} ${chart.days === 1 ? 'dia registrado' : 'dias registrados'}`
                      : 'Ranking das músicas mais tocadas'}
                    {chart && !hasHistory && ' · variações aparecem a partir do 2º dia'}
                  </p>
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

              {loading && !chart ? (
                <div className="px-6 pb-6">
                  <Skeleton rows={8} />
                </div>
              ) : filtered.length ? (
                <ol className="divide-y divide-slate-800/60 border-t border-slate-800/60">
                  {filtered.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelected(t)}
                        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/30 sm:gap-4 sm:px-6"
                      >
                        <span className={`w-8 shrink-0 text-center text-sm font-black tabular-nums ${t.rank <= 3 ? 'text-cyan-400' : 'text-slate-500'}`}>
                          {String(t.rank).padStart(2, '0')}
                        </span>
                        <img src={t.artworkUrl100} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-slate-800" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{t.name}</p>
                          <p className="truncate text-xs text-slate-400">{t.artistName}</p>
                        </div>
                        {t.genre && <span className="hidden shrink-0 rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 md:inline">{t.genre}</span>}
                        <span className="w-16 shrink-0 text-right">
                          <Movement change={t.change} isNew={t.isNew} compact />
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex flex-col items-center gap-2 border-t border-slate-800/60 p-10 text-center">
                  <h4 className="font-bold text-white">Nenhuma música encontrada</h4>
                  <p className="text-xs text-slate-400">A busca cobre as 100 faixas deste país.</p>
                  <button onClick={() => setQuery('')} className="mt-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                    Limpar busca
                  </button>
                </div>
              )}
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
              <span>Posições conforme a ordem do feed oficial da Apple. Posição ≠ streams.</span>
              <a
                href={`https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/songs.json`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-cyan-400"
              >
                Consultar fonte <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-6 text-xs text-slate-500">
          <span className="font-black tracking-wider text-slate-300">VYBE.</span>
          <span>Ouça a música. Entenda o movimento.</span>
          <span>Feito em Manaus</span>
        </footer>
      </div>

      <TrackSheet track={selected} country={country} feedUpdated={chart?.updated} onClose={() => setSelected(null)} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">{children}</p>;
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
