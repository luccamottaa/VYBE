'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, History, Loader2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { findInIndex } from '@/lib/search';
import { getAllTime, type AllTimeResult } from '@/lib/spotify-history';
import { fmtCompact, fmtFull, markets } from '@/lib/vybe';

const label = (m: string) => (m === 'global' ? '🌍 Global' : `${markets[m]?.flag ?? ''} ${m.toUpperCase()}`);
const colors: Record<string, string> = { global: '#10b981', br: '#22c55e', us: '#3b82f6', kr: '#ec4899', jp: '#f59e0b', gb: '#8b5cf6' };
const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const axisDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** Histórico completo da música nos charts do Spotify, desde a primeira vez que entrou. */
export function SpotifyAllTime({
  spotifyId,
  appleId,
  deezerId,
  songKey,
}: {
  spotifyId?: string;
  appleId?: string;
  deezerId?: string;
  /** matchKey da música: sem id do Spotify, procura primeiro no índice do vybe */
  songKey?: string;
}) {
  const [res, setRes] = useState<AllTimeResult | null>(null);
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
  const [market, setMarket] = useState('global');

  useEffect(() => {
    let alive = true;
    setRes(null);
    (async () => {
      const fromIndex = !spotifyId && songKey ? (await findInIndex(songKey))?.spotifyId : undefined;
      return getAllTime({ spotifyId: spotifyId ?? fromIndex, appleId, deezerId });
    })().then((p) => {
      if (!alive) return;
      if (!p) {
        setRes({ ok: false, notFound: true, error: 'Não deu pra identificar essa música no Spotify.' });
        return;
      }
      return p;
    }).then((r) => {
      if (!r) return;
      if (!alive) return;
      setRes(r);
      // começa no que tiver mais história
      if (r.ok) {
        const d = r.data.daily?.dates.length ?? 0;
        const w = r.data.weekly?.dates.length ?? 0;
        const m = w > d * 2 ? 'weekly' : 'daily';
        setMode(m);
        const t = r.data[m];
        setMarket(t?.pos.global ? 'global' : (Object.keys(t?.pos ?? {})[0] ?? 'global'));
      }
    });
    return () => {
      alive = false;
    };
  }, [spotifyId, appleId, deezerId, songKey]);

  const table = res?.ok ? res.data[mode] : null;
  const marketsHere = table ? Object.keys(table.pos) : [];
  const data = useMemo(
    () => (table && table.pos[market] ? table.dates.map((date, i) => ({ date, pos: table.pos[market][i], streams: table.streams[market]?.[i] ?? null })) : []),
    [table, market],
  );
  const charted = data.filter((d) => d.pos !== null);
  const peak = table?.peak[market];
  const total = table?.total[market];

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
        <History className="h-4 w-4 text-emerald-400" /> Histórico completo no Spotify
      </h3>

      {!res ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando todas as datas desde a primeira entrada…
        </p>
      ) : !res.ok ? (
        <p className={`rounded-xl border p-3 text-xs ${res.notFound ? 'border-slate-800 text-slate-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
          {res.notFound && /nunca|sem hist/i.test(res.error) ? 'Essa música nunca entrou num chart do Spotify.' : res.error}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            No chart desde <strong className="text-slate-200">{longDate(res.data.firstDate)}</strong>
            {res.data.lastDate && ` · último registro em ${longDate(res.data.lastDate)}`}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-800 bg-slate-950/80 p-1">
              {(['daily', 'weekly'] as const).map((m) => (
                <button
                  key={m}
                  disabled={!res.data[m]?.dates.length}
                  onClick={() => {
                    setMode(m);
                    const t = res.data[m];
                    if (t && !t.pos[market]) setMarket(Object.keys(t.pos)[0] ?? 'global');
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-all disabled:opacity-40 ${mode === m ? 'bg-emerald-500 font-bold text-[#020617]' : 'text-slate-400 hover:text-white'}`}
                >
                  {m === 'daily' ? 'Diário' : 'Semanal'}
                </button>
              ))}
            </div>
            {marketsHere.map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${market === m ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-slate-800 text-slate-400 hover:text-white'}`}
              >
                {label(m)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat title="Pico" value={peak ? `#${peak.pos}` : '—'} sub={peak?.streams ? `${fmtCompact(peak.streams)} streams` : undefined} />
            <Stat title={mode === 'daily' ? 'Dias no chart' : 'Semanas no chart'} value={String(charted.length)} />
            <Stat title="Streams em chart" value={total ? fmtCompact(total) : '—'} sub={total ? fmtFull(total) : undefined} />
          </div>

          {charted.length >= 1 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ left: -14, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#94a3b833" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={axisDate} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis reversed domain={[1, 200]} allowDecimals={false} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(v) => longDate(String(v))}
                    formatter={(v, _n, item) => [`#${v}${item?.payload?.streams ? ` · ${fmtFull(item.payload.streams)} streams` : ''}`, label(market)]}
                    contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', borderRadius: '0.75rem', fontSize: 12 }}
                  />
                  <Line dataKey="pos" stroke={colors[market] ?? '#10b981'} strokeWidth={2} dot={{ r: charted.length > 120 ? 0 : 2 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Sem posições nesse mercado.</p>
          )}

          <a href={res.data.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400">
            Dados do Spotify via kworb.net <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </section>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-2.5">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500">{title}</span>
      <strong className="block text-lg font-black text-white">{value}</strong>
      {sub && <span className="block truncate text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}
