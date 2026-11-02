import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-3xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md sm:p-6', className)}>
      {children}
    </div>
  );
}

export function PanelTitle({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          {icon}
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

type Tone = 'emerald' | 'cyan' | 'blue' | 'purple' | 'orange';
const tones: Record<Tone, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function MetricCard({
  label,
  value,
  icon,
  tone,
  badge,
  note,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone: Tone;
  badge?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md transition-all hover:border-cyan-500/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <div className={cn('rounded-lg border p-2', tones[tone])}>{icon}</div>
      </div>
      <div className="truncate text-2xl font-black tracking-tight text-white transition-colors group-hover:text-cyan-400">
        {value}
      </div>
      <div className="mt-2 flex min-h-[22px] items-center gap-2">
        {badge && <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', tones[tone])}>{badge}</span>}
        {note && <span className="truncate text-[11px] text-slate-400">{note}</span>}
      </div>
    </div>
  );
}

/** Variação de posição: subiu, caiu, estável, nova entrada ou sem comparação. */
export function Movement({ change, isNew, compact }: { change: number | null; isNew?: boolean; compact?: boolean }) {
  const base = 'inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums';
  if (isNew)
    return (
      <span className={cn(base, 'bg-cyan-500/10 text-cyan-300')}>
        <Sparkles className="h-3 w-3" />
        {!compact && 'NOVA'}
      </span>
    );
  if (change === null) return <span className={cn(base, 'text-slate-500')}>—</span>;
  if (change > 0)
    return (
      <span className={cn(base, 'bg-emerald-500/10 text-emerald-400')}>
        <ArrowUpRight className="h-3.5 w-3.5" />
        {change}
      </span>
    );
  if (change < 0)
    return (
      <span className={cn(base, 'bg-rose-500/10 text-rose-400')}>
        <ArrowDownRight className="h-3.5 w-3.5" />
        {Math.abs(change)}
      </span>
    );
  return <span className={cn(base, 'bg-slate-800 text-slate-400')}>=</span>;
}
