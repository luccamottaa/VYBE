'use client';

import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

// Um único <audio> pro site todo: tocar uma prévia para a anterior.
let audio: HTMLAudioElement | null = null;
let current: string | null = null;
const listeners = new Set<(src: string | null) => void>();
const emit = () => listeners.forEach((l) => l(current));

function toggle(src: string) {
  audio ??= Object.assign(new Audio(), { volume: 0.8 });
  if (current === src && !audio.paused) {
    audio.pause();
    current = null;
  } else {
    audio.src = src;
    audio.currentTime = 0;
    audio.play().catch(() => {
      current = null;
      emit();
    });
    current = src;
    audio.onended = () => {
      current = null;
      emit();
    };
  }
  emit();
}

/** Botão de prévia de 30 s. Não renderiza nada se não houver prévia. */
export function PreviewButton({ src, label, className, size = 'sm' }: { src?: string; label: string; className?: string; size?: 'sm' | 'lg' }) {
  const [playing, setPlaying] = useState<string | null>(current);
  useEffect(() => {
    listeners.add(setPlaying);
    return () => {
      listeners.delete(setPlaying);
    };
  }, []);
  if (!src) return null;
  const on = playing === src;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(src);
      }}
      aria-label={`${on ? 'Pausar' : 'Ouvir'} prévia de ${label}`}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full transition-colors',
        on ? 'bg-cyan-500 text-[#020617]' : 'bg-slate-800 text-cyan-400 hover:bg-slate-700',
        size === 'lg' ? 'h-10 w-10' : 'h-7 w-7',
        className,
      )}
    >
      {on ? <Pause className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} /> : <Play className={cn(size === 'lg' ? 'h-4 w-4' : 'h-3 w-3', 'translate-x-px')} />}
    </button>
  );
}
