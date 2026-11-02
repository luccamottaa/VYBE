'use client';

import { Star } from 'lucide-react';
import { toggleFollow, useFollows, type Follow } from '@/lib/follow';
import { cn } from '@/lib/utils';

type Target = Omit<Extract<Follow, { kind: 'song' }>, 'at'> | Omit<Extract<Follow, { kind: 'artist' }>, 'at'>;

/** Estrela de seguir. Quem você segue aparece na aba "Seguindo" e gera alertas. */
export function FollowButton({ target, className, compact }: { target: Target; className?: string; compact?: boolean }) {
  const follows = useFollows();
  const on = follows.some((f) => f.kind === target.kind && f.key === target.key);
  const label = on ? 'Seguindo' : 'Seguir';
  return (
    <button
      type="button"
      onClick={() => toggleFollow({ ...target, at: Date.now() } as Follow)}
      aria-pressed={on}
      aria-label={`${on ? 'Deixar de seguir' : 'Seguir'} ${target.name}`}
      title={on ? 'Você recebe alertas sobre isso' : 'Seguir pra receber alertas'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95',
        compact ? 'h-9 w-9' : 'h-9 px-3',
        on
          ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
          : 'border-slate-700/70 bg-slate-800/60 text-slate-300 hover:border-amber-400/40 hover:text-amber-300',
        className,
      )}
    >
      <Star className={cn('h-4 w-4 transition-transform', on && 'scale-110 fill-current')} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
