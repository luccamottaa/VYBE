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
  Sparkles,
  Star,
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
import { GlobalSearch } from '@/components/vybe/global-search';
import { SongSheet } from '@/components/vybe/song-sheet';
import { ArtistSheet } from '@/components/vybe/artist-sheet';
import { SearchResults } from '@/components/vybe/search-results';
import { AlbumSheet } from '@/components/vybe/album-sheet';
import { albumFrom, type Album } from '@/lib/albums';
import { Highlights } from '@/components/vybe/highlights';
import { Following } from '@/components/vybe/following';
import { PwaBar } from '@/components/vybe/pwa';
import { VersionBadge } from '@/components/vybe/changelog';
import { ErrorBoundary, safeMode } from '@/components/vybe/error-boundary';
import { loadAllCharts } from '@/lib/all-charts';
import { runAlertCheck, useAlerts } from '@/lib/alerts-store';
import { readDeepLink, type DeepLink } from '@/lib/deep-link';
import { useFollows } from '@/lib/follow';
import { songFrom, type Artist, type Song } from '@/lib/search';
import { getAppleAlbumChart, getAppleChart, getSpotifyChart, isStatic, spotifyMarkets } from '@/lib/data-source';
import { combineCharts, type SourceRanks } from '@/lib/combined';
import { Cover, CrossBadges, MetricCard, Movement, Panel, PanelTitle } from '@/components/vybe/ui';
import {
  combinedView,
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
  type ChartView,
  type CrossHit,
  type Source,
  type ViewTrack,
} from '@/lib/vybe';

const globalMarket = { flag: '🌍', name: 'Global' };
const genreColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
const tooltipStyle = { backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', borderRadius: '0.75rem', fontSize: 12 };
type View = 'charts' | 'highlights' | 'following' | 'sources';
const tabToParam: Record<View, NonNullable<DeepLink['aba']>> = { charts: 'charts', highlights: 'destaques', following: 'seguindo', sources: 'fontes' };
const paramToTab = Object.fromEntries(Object.entries(tabToParam).map(([k, v]) => [v, k])) as Record<string, View>;
const initialLink = (): DeepLink => (typeof window === 'undefined' ? {} : readDeepLink(location.search));

export default function Page() {
  return (
    <ErrorBoundary full label="página">
      <Dashboard />
    </ErrorBoundary>
  );
}

function Dashboard() {
  const [link] = useState(initialLink);
  // Um ranking só (Apple + Spotify). Mercado: Global ou um dos 5 países. Links antigos com ?pais= ainda funcionam.
  const source: Source = 'all';
  const [market, setMarket] = useState(() => {
    const m = link.mercado ?? link.pais;
    return m && (m === 'global' || markets[m]) ? m : 'global';
  });
  const [tab, setTab] = useState<View>((link.aba && paramToTab[link.aba]) || 'charts');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ChartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ViewTrack | null>(null);
  const [song, setSong] = useState<Song | null>(() =>
    link.musica ? songFrom({ name: link.musica, artist: link.artista ?? '', spotifyId: link.spotify, appleId: link.apple }) : null,
  );
  const [artist, setArtist] = useState<Artist | null>(() => (!link.musica && !link.album && link.artista ? { name: link.artista } : null));
  const [allQuery, setAllQuery] = useState<string | null>(link.buscar ?? null);
  const [kind, setKind] = useState<'songs' | 'albums'>(link.tipo === 'albuns' && isStatic ? 'albums' : 'songs');
  const [album, setAlbum] = useState<Album | null>(() => (link.album ? albumFrom({ name: link.album, artist: link.artista ?? '' }) : null));
  const [compact, setCompact] = useState(false);
  const [safe, setSafe] = useState(false);
  const follows = useFollows();
  const { unread } = useAlerts();
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const place = market === 'global' ? globalMarket : markets[market];
        const countries = market === 'global' ? Object.keys(markets) : [market];
        const settled = <T,>(r: PromiseSettledResult<T>[]) => r.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []));
        if (kind === 'albums') {
          const charts = settled(await Promise.allSettled(countries.map((c) => getAppleAlbumChart(c, signal))));
          if (!charts.length) throw new Error('O Top álbuns não carregou agora.');
          setView(
            combinedView({
              tracks: combineCharts(charts, null),
              title: `Top 100 álbuns · ${place.flag} ${place.name}`,
              updated: charts[0].updated,
              stale: charts.some((c) => c.stale),
              albums: true,
              footnote: `Apple Music${market === 'global' ? ', média dos 5 países' : ''} · ${shortDate(charts[0].updated)}`,
            }),
          );
        } else {
          const spMarket = spotifyMarkets.includes(market) ? market : 'global';
          const [apple, sp] = await Promise.all([
            Promise.allSettled(countries.map((c) => getAppleChart(c, signal))).then(settled),
            getSpotifyChart(spMarket, signal).catch(() => null),
          ]);
          if (!apple.length && !sp) throw new Error('Nem a Apple Music nem o Spotify responderam agora.');
          const missing = [!apple.length && 'Apple Music', !sp && 'Spotify'].filter(Boolean).join(' e ');
          setView(
            combinedView({
              tracks: combineCharts(apple, sp),
              title: `Top 100 vybe · ${place.flag} ${place.name}`,
              updated: sp ? `${sp.date}T00:00:00Z` : apple[0].updated,
              stale: apple.some((c) => c.stale) || !!sp?.stale,
              footnote: missing
                ? `Só com ${missing === 'Spotify' ? 'Apple Music' : 'Spotify'} agora: ${missing} não respondeu.`
                : `Apple Music${market === 'global' ? ' (média dos 5 países)' : ''} + Spotify, somados pela posição · Spotify de ${sp ? shortDate(`${sp.date}T00:00:00Z`) : '—'}`,
            }),
          );
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setView(null);
          setError((e as Error).message || 'Erro ao carregar o ranking');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [market, kind],
  );

  useEffect(() => {
    const c = new AbortController();
    setView(null);
    setSelected(null);
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // Estado da tela na URL (dá pra mandar o link e abre igual). Música/artista abertos não entram: são passageiros.
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== 'charts') p.set('aba', tabToParam[tab]);
    if (market !== 'global') p.set('mercado', market);
    if (kind === 'albums') p.set('tipo', 'albuns');
    const qs = p.toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
  }, [tab, market, kind]);

  // Alertas de quem você segue: compara os charts com a última foto (follow novo só ganha a foto base).
  useEffect(() => {
    if (!follows.length) return;
    loadAllCharts()
      .then((all) => runAlertCheck(all, follows))
      .catch(() => {});
  }, [follows]);

  // Topo vira uma pílula compacta ao rolar; modo seguro desliga a animação pesada.
  useEffect(() => {
    setSafe(safeMode());
    const onScroll = () => setCompact(window.scrollY > 72);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  // linha do ranking: no Top álbuns abre o álbum; senão, a trajetória da música
  const albumsView = !!view?.albums;
  // ranking unificado: a linha abre a página da música (todos os charts, streams e histórico) ou do álbum
  const openTrack = (t: ViewTrack) => {
    const ids = t as ViewTrack & { appleId?: string; spotifyId?: string };
    if (albumsView) setAlbum(albumFrom({ name: t.name, artist: t.artistName, artwork: t.artworkUrl100, appleId: ids.appleId ?? t.id, appleUrl: t.url, releaseDate: t.releaseDate, genre: t.genre }));
    else setSong(songFrom({ name: t.name, artist: t.artistName, artwork: t.artworkUrl100, appleId: ids.appleId, spotifyId: ids.spotifyId, releaseDate: t.releaseDate }));
  };

  const spotify = useMemo(() => (view?.source === 'spotify' ? spotifySummary(view) : null), [view]);
  // Spotify sem login não manda streams: aí os blocos de artistas/lançamentos substituem os de streams.
  const streamMode = !!spotify?.hasStreams;
  const apple = useMemo(() => (view && !streamMode ? summarize(view) : null), [view, streamMode]);
  const recentReleases = useMemo(
    () =>
      [...(view?.tracks ?? [])]
        .filter((t) => t.releaseDate)
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.rank - b.rank)
        .slice(0, 4),
    [view],
  );
  const climbers = useMemo(
    () => (view?.hasMovement ? view.tracks.filter((t) => (t.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)) : []),
    [view],
  );
  const debuts = useMemo(() => (view?.hasMovement ? view.tracks.filter((t) => t.isNew) : []), [view]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return view?.tracks.filter((t) => !q || `${t.name} ${t.artistName}`.toLocaleLowerCase().includes(q)) ?? [];
  }, [view, query]);
  // posições em cada plataforma (Apple: melhor posição entre os países no Global)
  const hitsFor = (t: ViewTrack): CrossHit[] => {
    const src = (t as ViewTrack & { sources?: SourceRanks }).sources;
    if (!src || view?.albums) return [];
    const out: CrossHit[] = [];
    if (src.apple) out.push({ label: market === 'global' && (src.appleCountries ?? 0) > 1 ? ` Apple (${src.appleCountries} países)` : ' Apple', rank: src.apple });
    if (src.spotify) out.push({ label: ' Spotify', rank: src.spotify });
    return out;
  };

  const top = view?.tracks[0];
  const place = market === 'global' ? globalMarket : markets[market];
  const topOnSpotify = !!(top as (ViewTrack & { spotifyId?: string }) | undefined)?.spotifyId;
  const weekly = !!view?.chartKey?.includes('weekly');
  const topRelease = top && view ? releaseLabel(daysSince(top.releaseDate, view.updated)) : null;
  const needsHistory = 'Precisa de 2 dias de registro';

  return (
    <div className="min-h-screen bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] font-sans text-slate-100 selection:bg-cyan-500 selection:text-black sm:px-6 sm:pb-6 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-8">
      {/* faixa sólida atrás do relógio/Dynamic Island: o conteúdo não passa por baixo dela */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-background" />
      <div className="pointer-events-none fixed left-1/4 top-0 hidden h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px] sm:block" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 hidden h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] sm:block" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Navbar */}
        <header
          data-compact={compact || undefined}
          className={`sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 flex flex-col border shadow-2xl transition-[padding,gap,border-radius,background-color,box-shadow] duration-300 lg:flex-row lg:items-center lg:justify-between ${
            compact
              ? 'gap-2 rounded-[1.4rem] border-slate-700/60 bg-slate-900/90 p-2 shadow-black/30 backdrop-blur-md lg:px-3'
              : 'gap-4 rounded-2xl border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-xl'
          }`}
        >
          <div className="flex w-full items-center gap-2 sm:gap-3 lg:w-auto">
            <Link href="/" aria-label="vybe — início" className={`flex items-center gap-2 transition-transform duration-300 ${compact ? 'origin-left scale-[0.86]' : ''}`}>
              <Logo tagline={!compact} />
            </Link>
            <VersionBadge className={compact ? 'hidden sm:block' : ''} />
            <Segmented
              className="ml-auto lg:ml-6"
              value={tab}
              onChange={(t) => {
                setTab(t);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              options={[
                ['charts', 'Charts', Disc3],
                ['highlights', 'Destaques', Sparkles],
                ['following', 'Seguindo', Star, unread],
                ['sources', 'Fontes', Database],
              ]}
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:flex-nowrap lg:w-auto">
            <GlobalSearch
              query={query}
              onQuery={(q) => {
                setQuery(q);
                setTab('charts');
              }}
              inputRef={searchRef}
              tracks={view?.tracks ?? []}
              onTrack={openTrack}
              onSong={setSong}
              onArtist={setArtist}
              onAll={setAllQuery}
              onAlbum={setAlbum}
            />
            <Select
              value={market}
              onValueChange={(v) => {
                if (!v) return;
                setMarket(v);
                setTab('charts');
              }}
            >
              <SelectTrigger aria-label="Mercado do ranking" className={`${compact ? 'max-sm:hidden ' : ''}h-9 w-auto shrink-0 rounded-xl border-slate-700/60 bg-slate-800/60 text-xs text-slate-200`}>
                <SelectValue>{`${place.flag} ${market === 'global' ? 'Global' : market.toUpperCase()}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {['global', ...Object.keys(markets)].map((id) => (
                  <SelectItem key={id} value={id}>
                    {(markets[id] ?? globalMarket).flag} {(markets[id] ?? globalMarket).name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {tab === 'sources' ? (
          <ErrorBoundary label="fontes">
            <Sources />
          </ErrorBoundary>
        ) : tab === 'highlights' ? (
          <ErrorBoundary label="destaques">
            <Highlights onSong={setSong} onArtist={setArtist} />
          </ErrorBoundary>
        ) : tab === 'following' ? (
          <ErrorBoundary label="seguindo">
            <Following onSong={setSong} onArtist={setArtist} />
          </ErrorBoundary>
        ) : error ? (
          <Panel className="flex flex-col items-center gap-3 py-16 text-center">
            <Music2 className="h-10 w-10 text-slate-600" />
            <h2 className="text-lg font-bold text-white">O ranking não carregou</h2>
            <p className="max-w-lg text-sm text-slate-400">{error}</p>
            <button onClick={() => load()} className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-[#020617] hover:bg-cyan-400">
              Tentar novamente
            </button>
          </Panel>
        ) : (
          <>
            {view?.stale && <Notice>A fonte não respondeu. Exibindo o último ranking salvo, de {shortDate(view.updated)}.</Notice>}
            {view && !view.historyAvailable && !view.stale && <Notice>Histórico indisponível agora. O ranking abre normal, mas este registro não foi salvo.</Notice>}

            {isStatic && (
              <div className="flex items-center gap-3">
                <Segmented
                  value={kind}
                  onChange={setKind}
                  options={[
                    ['songs', 'Músicas'],
                    ['albums', 'Álbuns'],
                  ]}
                />
                <span className="text-xs text-slate-500">{kind === 'albums' ? 'Álbuns mais tocados na Apple Music' : 'Apple Music + Spotify num ranking só'}</span>
              </div>
            )}

            {/* Hero: #1 */}
            <section className="theme-dark relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-[#0a1430] to-slate-950 p-6 text-slate-100 shadow-2xl lg:p-8">
              {!safe && <DitherField palette={palettes[source]} className="pointer-events-none absolute inset-0 h-full w-full" />}
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
                    {top && <span className="absolute -bottom-2 -right-2 rounded-lg border-2 border-slate-900 bg-cyan-400 px-1.5 text-xs font-black text-[#020617]">#1</span>}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                        No topo · {place.flag} {place.name}
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
                        {!!top.days && <> • {tenure(top.days, weekly)} no chart</>}
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
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-[#020617] shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500 md:flex-none"
                    >
                      <Play className="h-4 w-4 fill-[#020617]" /> Ouvir no {topOnSpotify ? 'Spotify' : 'Apple Music'}
                    </a>
                    <button
                      onClick={() => openTrack(top)}
                      aria-label={`${albumsView ? 'Abrir o álbum' : 'Ver trajetória de'} ${top.name}`}
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
              {streamMode ? (
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
                    label={`Artistas no Top ${view?.tracks.length || 100}`}
                    value={apple ? apple.artistCount : '—'}
                    icon={<Users className="h-4 w-4" />}
                    tone="blue"
                    badge={apple?.topArtists[0] ? `${apple.topArtists[0].count} ${albumsView ? "álbuns" : "faixas"}` : undefined}
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
                {streamMode ? (
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
                    <PanelTitle icon={<BarChart3 className="h-4 w-4 text-cyan-400" />} title={`Quem domina o Top ${view?.tracks.length || 100}`} hint={`${albumsView ? "Álbuns" : "Faixas"} por artista, contando colaborações para cada nome`} />
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
                            <Tooltip cursor={{ fill: 'rgba(6,182,212,0.06)' }} formatter={(v) => [v, albumsView ? "Álbuns" : "Faixas"]} contentStyle={tooltipStyle} />
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
                        onClick={() => openTrack(t)}
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
                  {spotify?.veterans.length ? (
                    <>
                      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <Hourglass className="h-3.5 w-3.5 text-cyan-400" /> Mais tempo no chart
                      </h4>
                      {spotify?.veterans.length ? (
                        <div className="grid grid-cols-2 gap-2">
                          {spotify.veterans.map((t) => (
                            <button key={t.id} onClick={() => openTrack(t)} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5 text-left hover:border-slate-700">
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
                        {apple?.genres.length ? <Tags className="h-3.5 w-3.5 text-cyan-400" /> : <CalendarClock className="h-3.5 w-3.5 text-cyan-400" />}
                        {apple?.genres.length ? 'Gêneros no chart' : 'Lançadas mais recentemente'}
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
                        recentReleases.length ? (
                          <div className="grid grid-cols-2 gap-2">
                            {recentReleases.map((t) => (
                              <button key={t.id} onClick={() => openTrack(t)} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5 text-left hover:border-slate-700">
                                <span className="block truncate text-[10px] text-slate-400">{t.name}</span>
                                <strong className="text-sm font-black text-white">#{t.rank}</strong>{' '}
                                <span className="text-[10px] text-slate-500">{shortDate(`${t.releaseDate}T00:00:00Z`)}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500">Sem dados de gênero ou lançamento nesta fonte.</p>
                        )
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
                    <Globe2 className="h-4 w-4 text-cyan-400" /> {view?.title ?? 'Top 100 vybe'}
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
                          onClick={() => openTrack(t)}
                          className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/30 sm:gap-4 sm:px-6"
                        >
                          <span className={`w-8 shrink-0 text-center text-sm font-black tabular-nums ${t.rank <= 3 ? 'text-cyan-400' : 'text-slate-500'}`}>
                            {String(t.rank).padStart(2, '0')}
                          </span>
                          <Cover src={t.artworkUrl100} alt="" className="h-10 w-10 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{t.name}</p>
                            <p className="truncate text-xs text-slate-400">{t.artistName}</p>
                            {hits.length > 0 && (
                              <p className="mt-0.5 flex gap-2 text-[10px] font-semibold lg:hidden">
                                {hits.map((h) => (
                                  <span key={h.label} className={h.label.includes('Spotify') ? 'text-emerald-400' : 'text-rose-400'}>
                                    {h.label.includes('Spotify') ? 'Spotify' : 'Apple'} #{h.rank}
                                  </span>
                                ))}
                              </p>
                            )}
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
              <span>Ranking do vybe: cada plataforma dá pontos pela posição e a soma ordena a lista. Posição ≠ streams; os streams são do Spotify.</span>
              <button onClick={() => setTab('sources')} className="inline-flex items-center gap-1 hover:text-cyan-400">
                Ver fontes <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-6 text-xs text-slate-500">
          <span className="flex items-center gap-2"><LogoMark className="h-5 w-auto" title="" /><span className="font-brand text-sm font-semibold text-slate-300">vybe</span></span>
          <span>Ouça a música. Entenda o movimento.</span>
          <span>Feito em Manaus</span>
        </footer>
      </div>

      <TrackSheet
        track={selected}
        view={view}
        cross={selected ? hitsFor(selected) : []}
        onClose={() => setSelected(null)}
        onAllCharts={(t) => {
          setSelected(null);
          setSong(songFrom({ name: t.name, artist: t.artistName, artwork: t.artworkUrl100, spotifyId: t.id }));
        }}
      />
      <SongSheet
        song={song}
        onClose={() => setSong(null)}
        onArtist={(name, artistId) => {
          setSong(null);
          setArtist({ name, artistId });
        }}
        onAlbum={(a) => {
          setSong(null);
          setAlbum(a);
        }}
      />
      <AlbumSheet
        album={album}
        onClose={() => setAlbum(null)}
        onSong={(s) => {
          setAlbum(null);
          setSong(s);
        }}
        onArtist={(name) => {
          setAlbum(null);
          setArtist({ name });
        }}
      />
      <SearchResults
        query={allQuery}
        onClose={() => setAllQuery(null)}
        onSong={(s) => {
          setAllQuery(null);
          setSong(s);
        }}
        onArtist={(a) => {
          setAllQuery(null);
          setArtist(a);
        }}
        onAlbum={(a) => {
          setAllQuery(null);
          setAlbum(a);
        }}
      />
      <ArtistSheet
        artist={artist}
        onClose={() => setArtist(null)}
        onSong={(s) => {
          setArtist(null);
          setSong(s);
        }}
        onAlbum={(a) => {
          setArtist(null);
          setAlbum(a);
        }}
      />
      <PwaBar />
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
  options: readonly (readonly [T, string, React.ComponentType<{ className?: string }>?, number?])[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex shrink-0 items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1 ${className}`}>
      {options.map(([id, label, Icon, badge]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          aria-label={label}
          onClick={() => onChange(id)}
          className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            value === id ? 'bg-cyan-500 font-bold text-[#020617] shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span className={Icon ? 'hidden md:inline lg:hidden xl:inline' : undefined}>{label}</span>
          {!!badge && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white ring-2 ring-slate-950">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
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
