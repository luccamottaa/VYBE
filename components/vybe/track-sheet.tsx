'use client';

import { useEffect, useState } from 'react';
import { Activity, ExternalLink } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { artwork, daysSince, fmtCompact, fmtFull, releaseLabel, shortDate, tenure, type ChartView, type CrossHit, type ViewTrack } from '@/lib/vybe';
import { Cover, CrossBadges, Movement } from './ui';

type Point = { date: string; rank: number | null; streams?: number | null };

const periods = [7, 30, 90] as const;

export function TrackSheet({
  track,
  view,
  cross,
  onClose,
}: {
  track: ViewTrack | null;
  view: ChartView | null;
  cross: CrossHit[];
  onClose: () => void;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<number>(30);
  const historyUrl = track && view ? view.historyUrl(track.id) : null;

  useEffect(() => {
    if (!historyUrl) return;
    const c = new AbortController();
    setPoints([]);
    setError('');
    setLoading(true);
    fetch(historyUrl, { signal: c.signal })
      .then(async (r) => {
        const d = (await r.json()) as { points?: Point[]; error?: string };
        if (!r.ok) throw new Error(d.error);
        setPoints(d.points ?? []);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message || 'Não foi possível carregar o histórico');
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [historyUrl]);

  // Recorte relativo ao último registro, não ao relógio do navegador.
  const last = points.length ? Date.parse(points[points.length - 1].date) : 0;
  const history = points.filter((p) => Date.parse(p.date) >= last - period * 86400000);
  const ranks = points.map((p) => p.rank).filter((n): n is number => n !== null);
  const charted = history.filter((p) => p.rank !== null).length;
  const hasStreams = history.some((p) => typeof p.streams === 'number');
  const release = track && view ? releaseLabel(daysSince(track.releaseDate, view.updated)) : null;
  const best = track?.peak ?? (ranks.length ? Math.min(...ranks) : null);
  const spotify = view?.source === 'spotify';

  return (
    <Sheet open={!!track} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-[#090d16] text-slate-100 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-white">Trajetória da música</SheetTitle>
          <SheetDescription className="text-slate-400">{view?.title} · registros do VYBE</SheetDescription>
        </SheetHeader>

        {track && (
          <div className="space-y-5 px-4 pb-8">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800">
              <Cover src={track.artworkUrl100 ? artwork(track.artworkUrl100) : ''} alt={`Capa de ${track.name}`} className="aspect-square w-full rounded-none" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/80 to-transparent p-4 pt-16">
                <h2 className="text-2xl font-extrabold leading-tight text-white">{track.name}</h2>
                <p className="text-sm text-slate-300">{track.artistName}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  {track.genre && <Tag>{track.genre}</Tag>}
                  {release && <Tag>{release}</Tag>}
                  {typeof track.days === 'number' && <Tag>{tenure(track.days, !!view?.chartKey?.includes('weekly'))} no chart</Tag>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Posição atual" value={`#${track.rank}`} />
              <Stat label={track.peak ? 'Pico' : 'Melhor no VYBE'} value={best ? `#${best}` : '—'} />
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500">Variação</span>
                <div className="mt-1.5">
                  <Movement change={view?.hasMovement ? track.change : null} isNew={view?.hasMovement && track.isNew} />
                </div>
              </div>
            </div>

            {typeof track.streams === 'number' && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <span className="block text-[10px] uppercase tracking-wider text-emerald-400/80">Streams nesta parada</span>
                <strong className="text-2xl font-black text-white">{fmtFull(track.streams)}</strong>
              </div>
            )}

            {cross.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold text-slate-300">{spotify ? 'Também na Apple Music' : 'Também no Spotify'}</h3>
                <CrossBadges hits={cross} />
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Evolução no chart</h3>
                <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1">
                  {periods.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                        period === p ? 'bg-cyan-500 font-bold text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p}D
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <p className="py-10 text-center text-sm text-slate-400">Carregando histórico…</p>
              ) : error ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">{error}</p>
              ) : charted < 2 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center">
                  <Activity className="h-8 w-8 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white">A trajetória começa agora</h4>
                  <p className="text-xs text-slate-400">Precisamos de pelo menos dois registros com posição pra desenhar o gráfico.</p>
                </div>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ left: -18, right: hasStreams ? -8 : 8, top: 8 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="rank" reversed domain={[1, 'dataMax']} allowDecimals={false} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                      {hasStreams && (
                        <YAxis yAxisId="streams" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(Number(v))} />
                      )}
                      <Tooltip
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(v, name) => (name === 'Streams' ? [fmtFull(Number(v)), 'Streams'] : [`#${v}`, 'Posição'])}
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '0.75rem', fontSize: 12 }}
                      />
                      <Line yAxisId="rank" name="Posição" dataKey="rank" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, fill: '#06b6d4' }} connectNulls={false} />
                      {hasStreams && (
                        <Line yAxisId="streams" name="Streams" dataKey="streams" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500">Buraco no gráfico = a faixa não estava no chart naquele registro. Não significa zero reproduções.</p>
            </div>

            <a
              href={track.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500"
            >
              Abrir no {spotify ? 'Spotify' : 'Apple Music'} <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-300">{children}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <strong className="mt-1 block text-xl font-black text-white">{value}</strong>
    </div>
  );
}
