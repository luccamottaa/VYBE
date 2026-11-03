'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { findInIndex } from '@/lib/search';
import { getAllTime } from '@/lib/spotify-history';
import { getStreams, type StreamsResult } from '@/lib/streams';
import { fmtCompact, fmtFull } from '@/lib/vybe';

const ZOOMS: [number, string][] = [
  [14, '14d'],
  [30, '1m'],
  [90, '3m'],
  [180, '6m'],
  [0, 'Tudo'],
];

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const axisDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/** Streams totais da música no Spotify (qualquer música com mais de 1.000 plays) e a evolução por dia. */
export function StreamCount({
  spotifyId,
  name,
  artist,
  songKey,
  fallbackTotal,
  onTotal,
}: {
  spotifyId?: string;
  name?: string;
  artist?: string;
  songKey?: string;
  /** total do chart do Spotify (kworb), usado quando o contador não responde (ex.: cota do plano acabou) */
  fallbackTotal?: number | null;
  /** avisa o total quando chega (usado no card de compartilhar) */
  onTotal?: (n: number | null) => void;
}) {
  const [res, setRes] = useState<StreamsResult | null>(null);
  const [zoom, setZoom] = useState<number>(30);
  // plano B 2: total da página da música no kworb (cobre quem já esteve no chart global, mesmo que não esteja mais)
  const [kworbTotal, setKworbTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setRes(null);
    setKworbTotal(null);
    (async () => {
      const fromIndex = !spotifyId && songKey ? (await findInIndex(songKey))?.spotifyId : undefined;
      const p = getStreams({ spotifyId: spotifyId ?? fromIndex, name, artist });
      const r = p ? await p : ({ ok: false, error: 'Não deu pra identificar essa música no Spotify.' } as StreamsResult);
      if (!alive) return;
      setRes(r);
      onTotal?.(r.ok ? r.data.total : (fallbackTotal ?? null));
      // contador fora do ar e a música não está no chart global de agora: tenta a página dela no kworb (sem cota)
      if (!r.ok && !r.off && typeof fallbackTotal !== 'number') {
        const k = getAllTime({ spotifyId: spotifyId ?? fromIndex, name, artist });
        const all = k ? await k : null;
        if (!alive || !all?.ok) return;
        const t = all.data.daily?.total.global ?? all.data.weekly?.total.global ?? null;
        if (typeof t === 'number' && t > 0) {
          setKworbTotal(t);
          onTotal?.(t);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const zoomed = last ? series.filter((p) => zoom === 0 || Date.parse(p.date) >= Date.parse(last.date) - (zoom - 1) * 86400000) : [];
  const bars = zoomed.filter((p) => p.daily !== null);

  return (
    <section className="space-y-3">
      {!res ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando streams no Spotify…
        </div>
      ) : !res.ok && typeof (typeof fallbackTotal === 'number' ? fallbackTotal : kworbTotal) === 'number' ? (
        // o contador não respondeu: mostra o total que o kworb publica (chart global de agora, ou a página da música)
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-5 py-4 shadow-lg">
          <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Total de streams</span>
          <strong className="mt-1 block text-4xl font-black tabular-nums tracking-tight text-emerald-400 sm:text-[2.6rem]">
            {fmtFull((typeof fallbackTotal === 'number' ? fallbackTotal : kworbTotal) as number)}
          </strong>
          <span className="mt-1 block text-[0.6875rem] text-slate-400">
            Do chart global do Spotify (kworb.net): soma os dias em que a música esteve no chart, então pode ficar abaixo do total real.{' '}
            {res.quota ? 'O número exato e o histórico por dia voltam quando o contador voltar.' : 'O histórico por dia está indisponível agora.'}
          </span>
        </div>
      ) : !res.ok ? (
        <p className="rounded-2xl border border-slate-800 p-4 text-xs text-slate-400">{res.error}</p>
      ) : (
        <>
          {/* Total, no estilo do MyStreamCount */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-5 py-4 shadow-lg">
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Total de streams</span>
            <strong className="mt-1 block text-4xl font-black tabular-nums tracking-tight text-emerald-400 sm:text-[2.6rem]">
              {res.data.total !== null ? fmtFull(res.data.total) : '—'}
            </strong>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.6875rem] text-slate-400">
              {lastDaily !== null && <span className="font-semibold text-emerald-300">+{fmtFull(lastDaily)} no último dia</span>}
              {last && <span>atualizado em {longDate(last.date)}</span>}
              <span>Spotify</span>
              {res.stale && <span className="text-amber-300">guardado de {longDate(new Date(res.stale).toISOString().slice(0, 10))} (o contador está no limite agora)</span>}
            </span>
          </div>

          {/* Histórico em barras por dia */}
          {series.length >= 2 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-white">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> Histórico de streams
              </h3>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[0.6875rem] text-slate-500">
                  <span className="mr-1">Zoom</span>
                  {ZOOMS.map(([d, label]) => (
                    <button
                      key={label}
                      onClick={() => setZoom(d)}
                      className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${zoom === d ? 'bg-emerald-500 text-[#020617]' : 'text-slate-400 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {zoomed.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[0.6875rem] text-slate-500">
                    De <span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-slate-300">{longDate(zoomed[0].date)}</span>
                    Até <span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-slate-300">{longDate(zoomed[zoomed.length - 1].date)}</span>
                  </div>
                )}
              </div>
              <div className="h-52">
                {bars.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bars} margin={{ left: -6, right: 4, top: 8 }}>
                      <CartesianGrid stroke="#94a3b822" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={axisDate} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis tickFormatter={(v) => fmtCompact(Number(v))} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={44} />
                      <Tooltip
                        cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                        labelFormatter={(v) => longDate(String(v))}
                        formatter={(v) => [fmtFull(Number(v)), 'Streams no dia']}
                        contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', borderRadius: '0.75rem', fontSize: 12 }}
                      />
                      <Bar dataKey="daily" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-xs text-slate-500">Sem dados nesse período.</p>
                )}
              </div>
            </div>
          )}
          <p className="text-[0.625rem] text-slate-500">Contagem pública do Spotify, via MyStreamCount. Aparece pra músicas com mais de 1.000 plays.</p>
        </>
      )}
    </section>
  );
}
