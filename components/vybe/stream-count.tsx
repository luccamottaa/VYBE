'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { findInIndex } from '@/lib/search';
import { getStreams, type StreamsResult } from '@/lib/streams';
import { fmtCompact, fmtFull } from '@/lib/vybe';

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const axisDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/** Streams totais da música no Spotify (qualquer música com mais de 1.000 plays) e a evolução por dia. */
export function StreamCount({ spotifyId, name, artist, songKey }: { spotifyId?: string; name?: string; artist?: string; songKey?: string }) {
  const [res, setRes] = useState<StreamsResult | null>(null);
  const [mode, setMode] = useState<'total' | 'daily'>('daily');

  useEffect(() => {
    let alive = true;
    setRes(null);
    (async () => {
      const fromIndex = !spotifyId && songKey ? (await findInIndex(songKey))?.spotifyId : undefined;
      const p = getStreams({ spotifyId: spotifyId ?? fromIndex, name, artist });
      const r = p ? await p : ({ ok: false, error: 'Não deu pra identificar essa música no Spotify.' } as StreamsResult);
      if (alive) setRes(r);
    })();
    return () => {
      alive = false;
    };
  }, [spotifyId, name, artist, songKey]);

  // streams ganhos por dia = diferença entre totais de dias seguidos
  const series = useMemo(() => {
    if (!res?.ok) return [];
    const h = res.data.history;
    return h.map((p, i) => {
      const prev = h[i - 1];
      const gap = prev ? (Date.parse(p.date) - Date.parse(prev.date)) / 86400000 : 0;
      return { date: p.date, total: p.streams, daily: prev && gap > 0 ? Math.max(0, Math.round((p.streams - prev.streams) / gap)) : null };
    });
  }, [res]);

  if (res && !res.ok && res.off) return null; // ainda não configurado: some sem barulho

  const last = series.at(-1);
  const lastDaily = [...series].reverse().find((p) => p.daily !== null)?.daily ?? null;

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white">
        <TrendingUp className="h-4 w-4 text-emerald-400" /> Streams no Spotify
      </h3>
      {!res ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando streams…
        </p>
      ) : !res.ok ? (
        <p className="rounded-xl border border-slate-800 p-3 text-xs text-slate-400">{res.error}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <span className="block text-[10px] uppercase tracking-wider text-emerald-400/80">Total</span>
              <strong className="block text-xl font-black text-white">{res.data.total !== null ? fmtFull(res.data.total) : '—'}</strong>
              {last && <span className="text-[10px] text-slate-500">em {longDate(last.date)}</span>}
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Último dia</span>
              <strong className="block text-xl font-black text-white">{lastDaily !== null ? `+${fmtCompact(lastDaily)}` : '—'}</strong>
              <span className="text-[10px] text-slate-500">streams ganhos</span>
            </div>
          </div>

          {series.length >= 2 && (
            <>
              <div className="flex w-fit rounded-xl border border-slate-800 bg-slate-950/80 p-1">
                {(
                  [
                    ['daily', 'Por dia'],
                    ['total', 'Acumulado'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-all ${mode === m ? 'bg-emerald-500 font-bold text-[#020617]' : 'text-slate-400 hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ left: -6, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="streamsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#94a3b833" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={axisDate} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => fmtCompact(Number(v))} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={48} domain={mode === 'total' ? ['dataMin', 'dataMax'] : [0, 'auto']} />
                    <Tooltip
                      labelFormatter={(v) => longDate(String(v))}
                      formatter={(v) => [fmtFull(Number(v)), mode === 'daily' ? 'Streams no dia' : 'Total acumulado']}
                      contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', borderRadius: '0.75rem', fontSize: 12 }}
                    />
                    <Area dataKey={mode} type="monotone" stroke="#10b981" strokeWidth={2} fill="url(#streamsFill)" connectNulls isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          <p className="text-[10px] text-slate-500">Contagem pública do Spotify, via MyStreamCount. Aparece pra músicas com mais de 1.000 plays.</p>
        </div>
      )}
    </section>
  );
}
