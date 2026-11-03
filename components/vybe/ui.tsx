'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Music2, Sparkles, User } from 'lucide-react';
import type { CrossHit } from '@/lib/vybe';
import { cn } from '@/lib/utils';

export function Panel({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={cn('glass rounded-3xl p-5 sm:p-6', className)}>
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
    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-all sm:bg-slate-900/40 sm:backdrop-blur-md hover:border-cyan-500/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <div className={cn('rounded-lg border p-2', tones[tone])}>{icon}</div>
      </div>
      <div className="truncate text-2xl font-black tracking-tight text-white transition-colors group-hover:text-cyan-400">
        {value}
      </div>
      <div className="mt-2 flex min-h-[22px] items-center gap-2">
        {badge && <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', tones[tone])}>{badge}</span>}
        {note && <span className="truncate text-[0.6875rem] text-slate-400">{note}</span>}
      </div>
    </div>
  );
}

/** Variação de posição: subiu, caiu, estável, nova entrada ou sem comparação. */
export function Movement({ change, isNew, compact }: { change: number | null; isNew?: boolean; compact?: boolean }) {
  const base = 'inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums';
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

/** Capa com fallback: tenta a imagem, depois a reserva; se nada carregar, mostra um ícone no lugar do alt quebrado. */
export function Cover({ src, alt, className, eager, fallback, round }: { src: string; alt: string; className?: string; eager?: boolean; fallback?: string; round?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = [src, fallback].find((u) => u && !failed.includes(u));
  if (!url)
    return (
      <div role="img" aria-label={alt} className={cn('flex items-center justify-center border border-slate-800 bg-slate-900', round ? 'rounded-full' : 'rounded-lg', className)}>
        {round ? <User className="h-1/2 max-h-6 w-1/2 max-w-6 text-cyan-500/70" /> : <Music2 className="h-1/3 max-h-10 w-1/3 max-w-10 text-cyan-500/60" />}
      </div>
    );
  return (
    <img
      src={url}
      alt={alt}
      // lazy dentro de listas que rolam (dropdown, painéis) às vezes nunca carrega no Safari
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed((f) => [...f, url])}
      className={cn('border border-slate-800 bg-slate-900 object-cover', round ? 'rounded-full' : 'rounded-lg', className)}
    />
  );
}

/** Selos de posição da mesma faixa em outros charts: "🇧🇷 #3". */
export function CrossBadges({ hits, max }: { hits: CrossHit[]; max?: number }) {
  const shown = max ? hits.slice(0, max) : hits;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((h) => (
        <span key={h.label} className="rounded-md border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-slate-300">
          {h.label} #{h.rank}
        </span>
      ))}
      {max && hits.length > max && <span className="text-[0.625rem] text-slate-500">+{hits.length - max}</span>}
    </span>
  );
}
