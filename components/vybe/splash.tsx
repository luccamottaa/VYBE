'use client';

import { useEffect, useState } from 'react';
import { safeMode } from './error-boundary';
import { LogoMark } from './logo';

const KEY = 'vybe:splash';
const SHOW_MS = 1600; // tempo na tela antes de começar a sumir
const OUT_MS = 500; // duração do sumir

/** Só na primeira abertura de cada sessão, sem atrapalhar link direto, robô de teste, modo seguro ou "reduzir movimento". */
function shouldShow() {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.webdriver) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (safeMode()) return false;
    if (/[?&](musica|album|artista|buscar|aba|seguro)=/.test(location.search)) return false;
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/** Abertura do app: a logo se monta, o nome aparece e a tela dissolve no ranking. Um toque pula. */
export function Splash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'off'>(() => (shouldShow() ? 'in' : 'off'));

  useEffect(() => {
    if (phase !== 'in') return;
    const a = setTimeout(() => setPhase('out'), SHOW_MS);
    return () => clearTimeout(a);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'out') return;
    const b = setTimeout(() => setPhase('off'), OUT_MS);
    return () => clearTimeout(b);
  }, [phase]);

  if (phase === 'off') return null;
  return (
    <div
      data-splash={phase}
      aria-hidden
      onPointerDown={() => setPhase((p) => (p === 'in' ? 'out' : p))}
      className={`theme-dark vy-splash fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#070a11] ${phase === 'out' ? 'vy-splash-out' : ''}`}
    >
      <div className="vy-splash-glow pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] rounded-full" />
      <div className="vy-splash-logo relative">
        <LogoMark animated cutout="#070a11" title="" className="h-28 w-auto drop-shadow-[0_0_28px_rgba(34,211,238,0.35)]" />
      </div>
      <p className="vy-splash-word font-brand relative mt-5 bg-gradient-to-r from-[#19f0f2] via-[#3aa0f6] to-[#8b5cf6] bg-clip-text text-5xl font-semibold tracking-tight text-transparent">vybe</p>
      <p className="vy-splash-tag relative mt-2 text-[0.6875rem] font-medium uppercase tracking-[0.3em] text-slate-400">Do play ao topo</p>
    </div>
  );
}
