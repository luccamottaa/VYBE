'use client';

import { useEffect, useState } from 'react';
import { Activity, ExternalLink } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { artwork, daysSince, markets, releaseLabel, shortDate, type HistoryPoint, type Track } from '@/lib/vybe';
import { Movement } from './ui';

const periods = [
  { id: 7, label: '7D' },
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
] as const;

export function TrackSheet({
  track,
  country,
  feedUpdated,
  onClose,
}: {
  track: Track | null;
  country: string;
  feedUpdated: string | undefined;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<number>(30);

  useEffect(() => {
    if (!track) return;
    const c = new AbortController();
    setPoints([]);
    setError('');
    setLoading(true);
    fetch(`/api/history?country=${country}&id=${track.id}`, { signal: c.signal })
      .then(async (r) => {
        const d = (await r.json()) as { points?: HistoryPoint[]; error?: string };
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
  }, [track, country]);

  // Recorte relativo ao último registro, não ao relógio do navegador.
  const last = points.length ? Date.parse(points[points.length - 1].date) : 0;
  const history = points.filter((p) => Date.parse(p.date) >= last - period * 86400000);
  const ranks = points.map((p) => p.rank).filter((n): n is number => n !== null);
  const charted = history.filter((p) => p.rank !== null).length;
  const release = track && feedUpdated ? releaseLabel(daysSince(track.releaseDate, feedUpdated)) : null;

  return (
    <Sheet open={!!track} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-[#090d16] text-slate-100 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-white">Trajetória da música</SheetTitle>
          <SheetDescription className="text-slate-400">
            Apple Music · {markets[country]?.flag} {markets[country]?.name} · registros do VYBE
          </SheetDescription>
        </SheetHeader>

        {track && (
          <div className="space-y-5 px-4 pb-8">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800">
              <img src={artwork(track.artworkUrl100)} alt={`Capa de ${track.name}`} className="aspect-square w-full bg-slate-900 object-cover text-[0px]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/80 to-transparent p-4 pt-16">
                <h2 className="text-2xl font-extrabold leading-tight text-white">{track.name}</h2>
                <p className="text-sm text-slate-300">{track.artistName}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  {track.genre && <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-300">{track.genre}</span>}
                  {release && <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-300">{release}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Posição atual" value={`#${track.rank}`} />
              <Stat label="Melhor no VYBE" value={ranks.length ? `#${Math.min(...ranks)}` : '—'} />
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500">Variação</span>
                <div className="mt-1.5">
                  <Movement change={track.change} isNew={track.isNew} />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Evolução no chart</h3>
                <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1">
                  {periods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                        period === p.id ? 'bg-cyan-500 font-bold text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.label}
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
                  <p className="text-xs text-slate-400">Precisamos de pelo menos dois dias com posição registrada para desenhar o gráfico.</p>
                </div>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ left: -18, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis reversed domain={[1, 100]} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(v) => [`#${v}`, 'Posição']}
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '0.75rem', fontSize: 12 }}
                      />
                      <Line dataKey="rank" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, fill: '#06b6d4' }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Buraco no gráfico = a faixa não estava no Top 100 naquele registro. Não significa zero reproduções.
              </p>
            </div>

            <a
              href={track.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500"
            >
              Abrir no Apple Music <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <strong className="mt-1 block text-xl font-black text-white">{value}</strong>
    </div>
  );
}
