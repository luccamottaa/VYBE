'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronDown,
  Database,
  Disc3,
  ExternalLink,
  Globe2,
  Music2,
  Play,
  RefreshCw,
  Sparkles,
  Star,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrackSheet } from '@/components/vybe/track-sheet';
import { Sources } from '@/components/vybe/sources';
import { DitherField, palettes } from '@/components/vybe/dither-field';
import { Logo, LogoMark } from '@/components/vybe/logo';
import { ConsentBanner, StatsToggle } from '@/components/vybe/consent';
import { RankingSkeleton } from '@/components/vybe/skeletons';
import { track } from '@/lib/analytics';
import { bucket } from '@/lib/analytics-core';
import { GlobalSearch } from '@/components/vybe/global-search';
import { SongSheet } from '@/components/vybe/song-sheet';
import { ArtistSheet } from '@/components/vybe/artist-sheet';
import { SearchResults } from '@/components/vybe/search-results';
import { AlbumSheet } from '@/components/vybe/album-sheet';
import { albumFrom, type Album } from '@/lib/albums';
import { Highlights } from '@/components/vybe/highlights';
import { Following } from '@/components/vybe/following';
import { PwaBar } from '@/components/vybe/pwa';
import { HomeLayoutButton } from '@/components/vybe/home-layout-sheet';
import { useLayout, type HomeSection } from '@/lib/home-layout';
import { TabBar } from '@/components/vybe/tab-bar';
import { startSync } from '@/lib/sync';
import { AmbientBackground } from '@/components/vybe/ambient-background';
import { Splash } from '@/components/vybe/splash';
import { ArtistBubbles, SpotlightTiles } from '@/components/vybe/home';
import { VersionBadge } from '@/components/vybe/changelog';
import { ErrorBoundary, safeMode } from '@/components/vybe/error-boundary';
import { loadAllCharts } from '@/lib/all-charts';
import { runAlertCheck, useAlerts } from '@/lib/alerts-store';
import { readDeepLink, type DeepLink } from '@/lib/deep-link';
import { useFollows } from '@/lib/follow';
import { songFrom, type Artist, type Song } from '@/lib/search';
import { getAppleAlbumChart, getAppleChart, getSpotifyChart, isStatic, spotifyMarkets } from '@/lib/data-source';
import { combineCharts, type SourceRanks } from '@/lib/combined';
import { Cover, CrossBadges, Movement, Panel } from '@/components/vybe/ui';
import {
  combinedView,
  artwork,
  daysSince,
  fmtCompact,
  fmtFull,
  markets,
  releaseLabel,
  shortDate,
  tenure,
  type ChartView,
  type CrossHit,
  type Source,
  type ViewTrack,
} from '@/lib/vybe';

const globalMarket = { flag: '🌍', name: 'Global' };
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
  const headerRef = useRef<HTMLElement>(null);
  const [headerGap, setHeaderGap] = useState(0);
  // guarda a altura do topo aberto; quando encolhe, a diferença vira margem embaixo: o conteúdo não dá tranco
  const fullHeader = useRef(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (!compact) fullHeader.current = h;
      setHeaderGap(compact ? Math.max(0, fullHeader.current - h) : 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);
  const [safe, setSafe] = useState(false);
  const follows = useFollows();
  const { unread } = useAlerts();
  const searchRef = useRef<HTMLInputElement>(null);

  // estatísticas anônimas (só com o consentimento): telas e aberturas, sem nome de música, artista ou busca
  useEffect(() => track('app_open'), []);
  useEffect(() => track('tab_view', { tab }), [tab]);
  const firstMarket = useRef(true);
  useEffect(() => {
    if (firstMarket.current) firstMarket.current = false;
    else track('market_change', { market });
  }, [market]);
  useEffect(() => {
    if (song) track('open_song');
  }, [!!song]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (artist) track('open_artist');
  }, [!!artist]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (album) track('open_album');
  }, [!!album]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // volta do login com Google: o código fica na URL até o Supabase trocar pela sessão (ele mesmo limpa)
    if (/[?&]code=/.test(location.search)) return;
    const p = new URLSearchParams();
    if (tab !== 'charts') p.set('aba', tabToParam[tab]);
    if (market !== 'global') p.set('mercado', market);
    if (kind === 'albums') p.set('tipo', 'albuns');
    const qs = p.toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
  }, [tab, market, kind]);

  // conta: sincroniza seguidos/preferências quando a pessoa entra (só no build do Pages)
  useEffect(() => {
    if (isStatic) startSync();
  }, []);

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
    // histerese: encolhe depois de 140 px e só volta perto do topo (senão o encolher muda a página e ela fica pulando)
    const onScroll = () => setCompact((c) => (c ? window.scrollY > 24 : window.scrollY > 140));
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

  // ranking começa com 10; "ver completo" abre o resto (buscando, mostra tudo que bater)
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [market, kind]);
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

  // início personalizável: ordem via CSS order (sem remontar nada) e seções escondidas
  const layout = useLayout();
  const sec = (k: HomeSection) => ({ order: layout.order.indexOf(k) + 1 });
  const secCls = (k: HomeSection) => (layout.hidden.includes(k) ? 'hidden' : '');
  const top = view?.tracks[0];
  const place = market === 'global' ? globalMarket : markets[market];
  const topOnSpotify = !!(top as (ViewTrack & { spotifyId?: string }) | undefined)?.spotifyId;
  const weekly = !!view?.chartKey?.includes('weekly');
  const topRelease = top && view ? releaseLabel(daysSince(top.releaseDate, view.updated)) : null;

  return (
    <div className="min-h-screen bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] font-sans text-slate-100 selection:bg-cyan-500 selection:text-black sm:px-6 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-8">
      <Splash />
      {/* faixa sólida atrás do relógio/Dynamic Island: o conteúdo não passa por baixo dela */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-background" />
      {/* fundo vivo com as cores da capa em destaque (música/álbum aberto ou o #1) */}
      <AmbientBackground src={song?.artwork ?? album?.artwork ?? top?.artworkUrl100} still={safe} />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Navbar */}
        <header
          ref={headerRef}
          style={headerGap ? { marginBottom: `calc(1.5rem + ${headerGap}px)` } : undefined}
          data-compact={compact || undefined}
          className={`sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 flex flex-col transition-[padding,gap,border-radius] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:flex-row lg:items-center lg:justify-between ${
            compact
              ? 'glass-float gap-2 rounded-[1.6rem] p-2 lg:px-3'
              : 'glass-float gap-4 rounded-[1.75rem] p-4'
          }`}
        >
          <div className="flex w-full items-center gap-2 sm:gap-3 lg:w-auto">
            <Link href="/" aria-label="vybe — início" className={`flex origin-left items-center gap-2 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${compact ? 'scale-[0.86]' : ''}`}>
              <Logo tagline={!compact} />
            </Link>
            <VersionBadge className={`transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${compact ? 'max-sm:pointer-events-none max-sm:scale-75 max-sm:opacity-0' : ''}`} />
            <div className="ml-auto hidden lg:ml-6 lg:block">
            <Segmented
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
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:flex-nowrap lg:w-auto">
            <GlobalSearch
              query={query}
              onQuery={(q) => {
                if (q && !query) track('search', { len: bucket(q.length) }); // só que buscou; o texto nunca sai
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
            {/* no celular o seletor recolhe deslizando (altura + opacidade) em vez de sumir de uma vez */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                compact ? 'max-sm:-mb-3 max-sm:grid-rows-[0fr] max-sm:opacity-0 max-sm:pointer-events-none' : 'grid-rows-[1fr]'
              }`}
            >
            <div className="min-h-0 overflow-hidden">
            <Select
              value={market}
              onValueChange={(v) => {
                if (!v) return;
                setMarket(v);
                setTab('charts');
              }}
            >
              <SelectTrigger aria-label="Mercado do ranking" tabIndex={compact ? -1 : undefined} className={`h-9 w-auto shrink-0 rounded-xl border-slate-700/60 bg-slate-800/60 text-xs text-slate-200`}>
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
            </div>
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
            <Following onSong={setSong} onArtist={setArtist} onAlbum={setAlbum} />
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
          <div className="flex flex-col gap-6">
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
                <HomeLayoutButton />
              </div>
            )}

            <div style={sec('hero')} className={secCls('hero')}>
            {/* Hero: #1 */}
            <section className="theme-dark relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-[#0a1430] to-slate-950 p-6 text-slate-100 shadow-2xl lg:p-8">
              {!safe && <DitherField palette={palettes[source]} gain={2.6} className="pointer-events-none absolute inset-0 h-full w-full" />}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070a11]/85 via-[#070a11]/35 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070a11]/60 to-transparent md:hidden" />
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="flex w-full min-w-0 items-center gap-5 md:w-auto">
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-xl shadow-cyan-900/30 sm:h-28 sm:w-28">
                      {top ? (
                        <Cover src={top.artworkUrl100 ? artwork(top.artworkUrl100, 300) : ''} alt={`Capa de ${top.name}`} className="h-full w-full rounded-[14px] border-0" />
                      ) : (
                        <div className="vy-skel flex h-full w-full items-center justify-center rounded-[14px]">
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
                      {top ? top.name : loading ? <span aria-label="Carregando" className="vy-skel block h-7 w-44 rounded-full sm:h-9 sm:w-64" /> : 'Ranking indisponível'}
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
            </div>

            {/* Destaques visuais e artistas do momento */}
            <div style={sec('spotlight')} className={secCls('spotlight')}>
              <SpotlightTiles view={view} onOpen={openTrack} />
            </div>
            {!albumsView && (
              <div style={sec('artists')} className={secCls('artists')}>
                <ArtistBubbles view={view} onArtist={setArtist} />
              </div>
            )}

            <div style={sec('ranking')} className={`${secCls('ranking')} space-y-6`}>
            {/* Ranking completo */}
            <Panel id="ranking" className="p-0 sm:p-0">
              <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
                <div className="min-w-0">
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
                  <RankingSkeleton rows={8} />
                </div>
              ) : filtered.length ? (
                <>
                <ol className="divide-y divide-slate-800/60 border-t border-slate-800/60">
                  {(expanded || query.trim() ? filtered : filtered.slice(0, 10)).map((t) => {
                    const hits = hitsFor(t);
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => openTrack(t)}
                          className="vy-press group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/30 sm:gap-4 sm:px-6"
                        >
                          <span className={`w-8 shrink-0 text-center text-sm font-black tabular-nums ${t.rank <= 3 ? 'text-cyan-400' : 'text-slate-500'}`}>
                            {String(t.rank).padStart(2, '0')}
                          </span>
                          <Cover src={t.artworkUrl100} alt="" className="h-10 w-10 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{t.name}</p>
                            <p className="truncate text-xs text-slate-400">{t.artistName}</p>
                            {hits.length > 0 && (
                              <p className="mt-0.5 flex gap-2 text-[0.625rem] font-semibold lg:hidden">
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
                          {t.genre && <span className="hidden shrink-0 rounded-md bg-slate-800/80 px-2 py-0.5 text-[0.625rem] text-slate-400 md:inline">{t.genre}</span>}
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
                {!query.trim() && filtered.length > 10 && (
                  <button
                    onClick={() => {
                      if (expanded) document.getElementById('ranking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setExpanded((e) => !e);
                    }}
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-800/60 py-4 text-sm font-bold text-cyan-400 transition-colors hover:bg-slate-800/30 hover:text-cyan-300"
                  >
                    {expanded ? 'Mostrar só o top 10' : `Ver o top ${filtered.length} completo`}
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
                </>
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

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[0.6875rem] text-slate-500">
              <span>Ranking do vybe: cada plataforma dá pontos pela posição e a soma ordena a lista. Posição ≠ streams; os streams são do Spotify.</span>
              <button onClick={() => setTab('sources')} className="inline-flex items-center gap-1 hover:text-cyan-400">
                Ver fontes <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            </div>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-6 text-xs text-slate-500">
          <span className="flex items-center gap-2"><LogoMark className="h-5 w-auto" title="" /><span className="font-brand text-sm font-semibold text-slate-300">vybe</span></span>
          <span>Ouça a música. Entenda o movimento.</span>
          <span className="flex items-center gap-3">
            <a href={`${import.meta.env.BASE_URL ?? '/'}privacidade/`} className="hover:text-cyan-400">
              Privacidade
            </a>
            <a href={`${import.meta.env.BASE_URL ?? '/'}termos/`} className="hover:text-cyan-400">
              Termos
            </a>
            <StatsToggle />
            <span>Feito em Manaus</span>
          </span>
        </footer>
      </div>

      <ConsentBanner />

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
      <TabBar
        value={tab}
        onChange={(t) => {
          setTab(t);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        tabs={[
          ['charts', 'Charts', Disc3],
          ['highlights', 'Destaques', Sparkles],
          ['following', 'Seguindo', Star, unread],
          ['sources', 'Fontes', Database],
        ]}
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
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.5625rem] font-black text-white ring-2 ring-slate-950">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[0.625rem] text-slate-300">{children}</span>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">{children}</p>;
}

