'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, CalendarRange, Crown, Flame, Globe2, Sparkles, TrendingUp, Trophy, Users, Zap } from 'lucide-react';
import { loadAllCharts } from '@/lib/all-charts';
import { getHistoryFile, isStatic } from '@/lib/data-source';
import { buildDeepLink } from '@/lib/deep-link';
import { buildInsights, buildRecap, monthLabel, recapMonths, type ChartHistory, type InsightSong, type Insights, type Names } from '@/lib/insights';
import { getIndex, songFrom, type Artist, type Song } from '@/lib/search';
import { artwork, fmtCompact, markets } from '@/lib/vybe';
import { cn } from '@/lib/utils';
import { FollowButton } from './follow-button';
import { ShareButton } from './share-button';
import { Cover, Panel } from './ui';
import { artistKey } from '@/lib/follow';

const toSong = (s: InsightSong): Song => songFrom({ name: s.name, artist: s.artist, artwork: s.artwork, spotifyId: s.spotifyId, appleId: s.appleId });
const recapCharts = [
  ['global', '🌍 Global'],
  ['br', `${markets.br.flag} Brasil`],
  ['us', `${markets.us.flag} EUA`],
] as const;

/** Aba "Destaques": leitura automática dos charts de hoje + retrospectiva do mês. */
export function Highlights({ onSong, onArtist }: { onSong: (s: Song) => void; onArtist: (a: Artist) => void }) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');
  const [names, setNames] = useState<Names>({});

  useEffect(() => {
    let alive = true;
    loadAllCharts()
      .then((all) => {
        if (!alive) return;
        setData(buildInsights(all));
        // nomes por id do Spotify: charts de agora + índice (músicas que já saíram)
        const n: Names = {};
        for (const p of Object.values(all.spotify))
          for (const e of p.entries) n[e.spotifyId] ??= { name: e.trackName, artist: e.artist, artwork: e.artworkUrl ?? undefined, spotifyId: e.spotifyId };
        setNames((cur) => ({ ...cur, ...n }));
      })
      .catch((e: Error) => alive && setError(e.message || 'Não deu pra carregar os charts'));
    getIndex().then((idx) => {
      if (!alive) return;
      const n: Names = {};
      for (const s of idx) if (s.spotifyId) n[s.spotifyId] = { name: s.name, artist: s.artist, artwork: s.artwork, spotifyId: s.spotifyId, appleId: s.appleId };
      setNames((cur) => ({ ...n, ...cur }));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (error)
    return (
      <Panel className="py-16 text-center">
        <p className="text-sm text-slate-400">{error}</p>
      </Panel>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Destaques</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">O que os charts estão dizendo.</h2>
          <p className="mt-1 text-sm text-slate-400">Lido automaticamente de {data ? data.markets : '…'} charts da Apple Music e do Spotify.</p>
        </div>
      </div>

      {/* #1 de cada chart */}
      <Panel className="p-0 sm:p-0">
        <SectionTitle icon={<Crown className="h-4 w-4 text-amber-300" />} title="Quem manda em cada chart" className="px-5 pt-5 sm:px-6 sm:pt-6" />
        <div className="hscroll snap-x gap-3 pb-5 [--hs-gap:0.75rem] [--hs-pad:1.25rem] sm:pb-6 sm:[--hs-pad:1.5rem]">
          {data
            ? data.numberOnes.map((s) => (
                <button
                  key={s.market}
                  onClick={() => onSong(toSong(s))}
                  className="group relative w-36 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/50 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400/40"
                >
                  <Cover src={s.artwork ? artwork(s.artwork, 300) : ''} alt="" className="aspect-square w-full rounded-none border-0" />
                  <span className="theme-dark absolute left-2 top-2 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">{s.label}</span>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-bold text-white group-hover:text-amber-300">{s.name}</p>
                    <p className="truncate text-[10px] text-slate-400">{s.artist}</p>
                  </div>
                </button>
              ))
            : Array.from({ length: 6 }, (_, i) => <div key={i} className="h-48 w-36 shrink-0 animate-pulse rounded-2xl bg-slate-800/50" />)}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* em todo lugar */}
        <Panel className="lg:col-span-2">
          <SectionTitle icon={<Globe2 className="h-4 w-4 text-cyan-400" />} title="Em todo lugar" hint="Músicas presentes em mais charts ao mesmo tempo" />
          <div className="space-y-2">
            {data?.everywhere.length
              ? data.everywhere.map((s, i) => (
                  <button key={s.key} onClick={() => onSong(toSong(s))} className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-slate-800/40">
                    <span className="w-5 text-center text-xs font-black text-slate-500">{i + 1}</span>
                    <Cover src={s.artwork ?? ''} alt="" className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{s.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${(s.count / (data?.markets || 1)) * 100}%` }} />
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                          {s.count}/{data?.markets} charts
                        </span>
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-xs font-bold text-slate-300 sm:inline">melhor #{s.best}</span>
                  </button>
                ))
              : <Loading rows={5} />}
          </div>
        </Panel>

        {/* artistas */}
        <Panel>
          <SectionTitle icon={<Users className="h-4 w-4 text-purple-400" />} title="Artistas do momento" hint="Mais faixas somando todos os charts" />
          <div className="space-y-2">
            {data?.artists.length
              ? data.artists.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-2">
                    <button onClick={() => onArtist({ name: a.name, picture: a.artwork })} className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-slate-800/40">
                      <div className="relative">
                        <Cover src={a.artwork ?? ''} alt="" className="h-10 w-10 shrink-0 rounded-full" />
                        {i === 0 && <Crown className="absolute -right-1 -top-1.5 h-4 w-4 rotate-12 fill-amber-300 text-amber-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white group-hover:text-purple-300">{a.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {a.entries} entradas · {a.songs} {a.songs === 1 ? 'música' : 'músicas'} · {a.markets} charts
                        </p>
                      </div>
                    </button>
                    <FollowButton compact target={{ kind: 'artist', key: artistKey(a.name), name: a.name, artwork: a.artwork }} />
                  </div>
                ))
              : <Loading rows={5} />}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel>
          <SectionTitle icon={<TrendingUp className="h-4 w-4 text-emerald-400" />} title="Maiores subidas" hint="O maior salto de cada música entre todos os charts" />
          <SongList items={data?.climbers} onSong={onSong} right={(s) => <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-black text-emerald-400">+{s.change}</span>} sub={(s) => `${s.label} · agora #${s.rank}`} empty="Ninguém subiu desde o último registro." />
        </Panel>
        <Panel>
          <SectionTitle icon={<Sparkles className="h-4 w-4 text-cyan-400" />} title="Estreias" hint="Entraram agora, pela melhor posição de entrada" />
          <SongList items={data?.debuts} onSong={onSong} right={(s) => <span className="rounded-lg bg-cyan-500/10 px-2 py-0.5 text-xs font-black text-cyan-400">#{s.rank}</span>} sub={(s) => `estreou no ${s.label}`} empty="Sem estreias nesse registro." />
        </Panel>
      </div>

      {data?.brazil && (
        <Panel>
          <SectionTitle icon={<Zap className="h-4 w-4 text-amber-300" />} title="Brasil × Mundo" hint={`Spotify ${markets.br.flag} Brasil contra o 🌍 Global · ${data.brazil.shared} músicas em comum nos dois top 200`} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">Só o Brasil escuta</h4>
              <SongList items={data.brazil.onlyHere} onSong={onSong} right={(s) => <span className="text-xs font-black text-white">#{s.rank} 🇧🇷</span>} sub={(s) => s.artist} empty="Tudo que bomba aqui também bomba lá fora." />
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400">O mundo escuta, o Brasil não</h4>
              <SongList items={data.brazil.missingHere} onSong={onSong} right={(s) => <span className="text-xs font-black text-white">#{s.rank} 🌍</span>} sub={(s) => s.artist} empty="O Brasil acompanha todo o top 50 global." />
            </div>
          </div>
        </Panel>
      )}

      {!!data?.giants.length && (
        <Panel>
          <SectionTitle icon={<Trophy className="h-4 w-4 text-amber-300" />} title="Gigantes do Global" hint="Maiores totais acumulados no chart global do Spotify" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.giants.map((s, i) => (
              <button key={s.key} onClick={() => onSong(toSong(s))} className="group flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 text-left transition-all hover:border-emerald-500/40 lg:flex-col lg:items-start">
                <Cover src={s.artwork ?? ''} alt="" className="h-12 w-12 shrink-0 lg:h-auto lg:w-full lg:aspect-square" />
                <div className="min-w-0">
                  <p className="text-lg font-black text-emerald-400">{fmtCompact(s.total)}</p>
                  <p className="truncate text-xs font-bold text-white">
                    {i + 1}. {s.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">{s.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Recap names={names} onSong={onSong} />
    </div>
  );
}

function Recap({ names, onSong }: { names: Names; onSong: (s: Song) => void }) {
  const [chart, setChart] = useState<string>('global');
  const [hist, setHist] = useState<ChartHistory | null>(null);
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isStatic) return;
    const c = new AbortController();
    setHist(null);
    setError('');
    getHistoryFile(`spotify/${chart}/history.json`, c.signal)
      .then((h) => {
        setHist(h);
        setMonth((m) => (m && recapMonths(h).includes(m) ? m : (recapMonths(h)[0] ?? '')));
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError('Sem histórico salvo pra esse chart ainda.'));
    return () => c.abort();
  }, [chart]);

  const months = useMemo(() => (hist ? recapMonths(hist) : []), [hist]);
  const recap = useMemo(() => (hist && month ? buildRecap(hist, month) : null), [hist, month]);
  const n = (id: string) => names[id] ?? { name: 'Música', artist: '', spotifyId: id };
  const open = (id: string) => {
    const s = n(id);
    onSong(songFrom({ name: s.name, artist: s.artist, artwork: s.artwork, spotifyId: id }));
  };
  if (!isStatic) return null;
  const chartName = recapCharts.find(([id]) => id === chart)?.[1] ?? chart;
  const lead = recap?.numberOnes[0] ?? recap?.top10[0];

  return (
    <section className="theme-dark relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#0b1430] via-[#0a0f1f] to-[#160b2e] p-5 text-slate-100 shadow-2xl sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-300">
              <CalendarRange className="h-3.5 w-3.5" /> Retrospectiva
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{month ? monthLabel(month) : 'O mês nos charts'}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Spotify {chartName}
              {recap && ` · ${recap.days} ${recap.days === 1 ? 'dia registrado' : 'dias registrados'} · ${recap.distinct} músicas passaram pelo chart`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-700/70 bg-slate-950/60 p-1">
              {recapCharts.map(([id, label]) => (
                <button key={id} onClick={() => setChart(id)} className={cn('rounded-lg px-2.5 py-1 text-xs transition-all', chart === id ? 'bg-purple-500 font-bold text-white' : 'text-slate-400 hover:text-white')}>
                  {label}
                </button>
              ))}
            </div>
            {months.length > 1 && (
              <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês" className="h-8 rounded-xl border border-slate-700/70 bg-slate-950/60 px-2 text-xs text-slate-200">
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            )}
            {recap && lead && (
              <ShareButton
                compact
                link={buildDeepLink({ aba: 'destaques' })}
                data={() => ({
                  kicker: `Retrospectiva · Spotify ${chartName}`,
                  title: monthLabel(month),
                  subtitle: recap.numberOnes[0] ? `${n(recap.numberOnes[0].id).name} dominou o #1` : `${recap.distinct} músicas no chart`,
                  artwork: n(lead.id).artwork,
                  stats: [
                    { label: 'Dias registrados', value: String(recap.days), tone: 'cyan' },
                    { label: 'Músicas no chart', value: String(recap.distinct), tone: 'green' },
                    { label: '#1 diferentes', value: String(recap.numberOnes.length), tone: 'amber' },
                  ],
                  positions: recap.top10.slice(0, 4).map((t) => ({ label: `${n(t.id).name.slice(0, 16)} · ${t.days}d top 10`, rank: Math.min(...(hist?.ranks[t.id] ?? [99]).filter((r): r is number => r != null)) })),
                })}
              />
            )}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-slate-400">{error}</p>
        ) : !recap ? (
          <Loading rows={3} />
        ) : (
          <>
            {recap.days < 7 && (
              <p className="rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-2.5 text-xs text-purple-200">
                O mês ainda tá começando no vybe: a retrospectiva fica mais rica a cada dia de coleta.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <RecapCard icon={<Crown className="h-4 w-4" />} tone="amber" title="Mais dias em #1" rows={recap.numberOnes.map((r) => ({ id: r.id, value: `${r.days}d` }))} n={n} open={open} empty="Sem #1 registrado ainda." />
              <RecapCard icon={<Flame className="h-4 w-4" />} tone="cyan" title="Mais dias no top 10" rows={recap.top10.map((r) => ({ id: r.id, value: `${r.days}d` }))} n={n} open={open} />
              <RecapCard icon={<Zap className="h-4 w-4" />} tone="green" title="Mais streams no mês" rows={recap.streams.map((r) => ({ id: r.id, value: fmtCompact(r.total) }))} n={n} open={open} empty="Sem contagem de streams nesse chart." />
            </div>
            {recap.jump && (
              <button onClick={() => open(recap.jump!.id)} className="group flex w-full items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-left transition-colors hover:border-emerald-400/40">
                <Cover src={n(recap.jump.id).artwork ?? ''} alt="" className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Maior salto do mês</p>
                  <p className="truncate text-base font-extrabold text-white">{n(recap.jump.id).name}</p>
                  <p className="truncate text-xs text-slate-300">
                    {n(recap.jump.id).artist} · de #{recap.jump.from} pra #{recap.jump.to} em {new Date(`${recap.jump.date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <span className="shrink-0 text-2xl font-black text-emerald-300">+{recap.jump.from - recap.jump.to}</span>
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const toneCls = { amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20', cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20', green: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' };

function RecapCard({
  icon,
  tone,
  title,
  rows,
  n,
  open,
  empty = 'Sem dados ainda.',
}: {
  icon: ReactNode;
  tone: keyof typeof toneCls;
  title: string;
  rows: { id: string; value: string }[];
  n: (id: string) => Names[string];
  open: (id: string) => void;
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <h3 className={cn('mb-3 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold', toneCls[tone])}>
        {icon} {title}
      </h3>
      {rows.length ? (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id}>
              <button onClick={() => open(r.id)} className="group flex w-full items-center gap-2.5 text-left">
                <Cover src={n(r.id).artwork ?? ''} alt="" className={cn('shrink-0', i === 0 ? 'h-11 w-11' : 'h-8 w-8')} />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-bold text-white group-hover:text-cyan-300', i === 0 ? 'text-sm' : 'text-xs')}>{n(r.id).name}</p>
                  <p className="truncate text-[10px] text-slate-400">{n(r.id).artist}</p>
                </div>
                <span className={cn('shrink-0 font-black tabular-nums', i === 0 ? 'text-base text-white' : 'text-xs text-slate-300')}>{r.value}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function SongList<T extends InsightSong>({ items, onSong, right, sub, empty }: { items?: T[]; onSong: (s: Song) => void; right: (s: T) => ReactNode; sub: (s: T) => string; empty: string }) {
  if (!items) return <Loading rows={4} />;
  if (!items.length) return <p className="rounded-2xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">{empty}</p>;
  return (
    <div className="space-y-1">
      {items.map((s) => (
        <button key={s.key} onClick={() => onSong(toSong(s))} className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-slate-800/40">
          <Cover src={s.artwork ?? ''} alt="" className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{s.name}</p>
            <p className="truncate text-[11px] text-slate-400">{sub(s)}</p>
          </div>
          {right(s)}
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-cyan-400" />
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ icon, title, hint, className }: { icon: ReactNode; title: string; hint?: string; className?: string }) {
  return (
    <div className={cn('mb-4', className)}>
      <h3 className="flex items-center gap-2 text-base font-bold text-white">
        {icon}
        {title}
      </h3>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Loading({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-800/50" />
      ))}
    </div>
  );
}

