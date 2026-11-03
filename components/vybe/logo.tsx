'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Marca do vybe (V + seta de chart + barras + onda sonora), redesenhada em vetor a partir da logo oficial.
 * `cutout` é a cor dos recortes entre as formas: use a cor do fundo onde a marca aparece.
 */
export function LogoMark({
  className,
  cutout = 'var(--logo-cutout)',
  title = 'vybe',
  animated = false,
}: {
  className?: string;
  cutout?: string;
  title?: string;
  /** Entrada em sequência + pulso na onda e barras de equalizador (CSS em globals.css). */
  animated?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="10 10 760 530" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} className={cn(animated && 'vy-anim', className)}>
      <defs>
      <linearGradient id={`${id}-a`} x1="0" y1="100" x2="0" y2="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#16f4f0"/><stop offset=".75" stopColor="#3d8cf6"/><stop offset="1" stopColor="#7d62f6"/>
      </linearGradient>
      <linearGradient id={`${id}-b`} x1="400" y1="540" x2="760" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#a24af2"/><stop offset=".5" stopColor="#7a63f6"/><stop offset="1" stopColor="#9d5cf5"/>
      </linearGradient>
      <linearGradient id={`${id}-c`} x1="400" y1="520" x2="740" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#3f8ff6"/><stop offset=".55" stopColor="#2cc6f5"/><stop offset="1" stopColor="#1ef1f1"/>
      </linearGradient>
      <linearGradient id={`${id}-d`} x1="0" y1="140" x2="0" y2="250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#3a9df6"/><stop offset="1" stopColor="#8a5cf6"/>
      </linearGradient>
      <linearGradient id={`${id}-e`} x1="0" y1="200" x2="0" y2="460" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#2be8f5"/><stop offset=".6" stopColor="#4a9af5"/><stop offset="1" stopColor="#a656f3"/>
      </linearGradient>
      </defs>
      <path className="vy-rise" fill={`url(#${id}-b)`} d="M398 536 L474 536 L722 172 L760 192 L747 22 L706 152 L560 366 L506 308 L400 500 Z"/>
      <rect className="vy-bar" x="503" y="192" width="37" height="80" fill={`url(#${id}-d)`}/>
      <rect className="vy-bar vy-bar-2" x="568" y="142" width="37" height="110" fill={`url(#${id}-d)`}/>
      <path className="vy-stroke" fill={`url(#${id}-a)`} d="M200 108 L345 108 L452 336 L404 516 Z"/>
      <polyline className="vy-rise" points="404,524 507,318 562,380 710,160" fill="none" style={{ stroke: cutout }} strokeWidth="12" strokeLinejoin="round"/>
      <path className="vy-rise" fill={`url(#${id}-c)`} d="M396 506 L434 338 L497 248 L552 302 L652 130 L600 102 L747 22 L706 152 L560 366 L506 308 Z"/>
      <path className="vy-wave" pathLength={1} d="M30 336 C70 335 100 331 112 306 C124 282 138 280 150 320 C163 366 172 392 186 380 C202 366 206 200 226 202 C246 204 256 460 279 460 C299 460 306 288 323 288 C341 288 346 392 366 390 C383 388 388 360 412 352 L446 348" fill="none" style={{ stroke: cutout }} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="vy-wave" pathLength={1} d="M30 336 C70 335 100 331 112 306 C124 282 138 280 150 320 C163 366 172 392 186 380 C202 366 206 200 226 202 C246 204 256 460 279 460 C299 460 306 288 323 288 C341 288 346 392 366 390 C383 388 388 360 412 352 L446 348" fill="none" stroke={`url(#${id}-e)`} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
      {animated && <path className="vy-pulse" pathLength={1} d="M30 336 C70 335 100 331 112 306 C124 282 138 280 150 320 C163 366 172 392 186 380 C202 366 206 200 226 202 C246 204 256 460 279 460 C299 460 306 288 323 288 C341 288 346 392 366 390 C383 388 388 360 412 352 L446 348" fill="none" stroke="#e8fdff" strokeWidth="14" strokeLinecap="round"/>}
    </svg>
  );
}

/** Slogan oficial. */
export const slogan = 'do play ao topo';

/** Marca + "vybe" em degradê, como na logo. */
export function Logo({ className, tagline = true }: { className?: string; tagline?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark animated className="h-9 w-auto shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.25)]" title="" />
      <span className="flex flex-col leading-none">
        <span className="font-brand bg-gradient-to-r from-[#19f0f2] via-[#3aa0f6] to-[#8b5cf6] bg-clip-text text-[1.625rem] font-semibold tracking-tight text-transparent">vybe</span>
        <span className={cn('hidden transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] sm:grid', tagline ? 'mt-1 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0')}>
          <span className="min-h-0 overflow-hidden whitespace-nowrap text-[0.5625rem] font-medium uppercase tracking-[0.22em] text-slate-400">{slogan}</span>
        </span>
      </span>
    </span>
  );
}
