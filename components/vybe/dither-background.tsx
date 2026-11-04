'use client';

import { useEffect, useState } from 'react';
import { AmbientBackground, coverDitherPalette } from './ambient-background';
import { DitherField, type Palette } from './dither-field';

// Fundo de tela cheia no estilo pontilhado (dither), com as cores da capa em destaque. É o visual
// da noite: no dia o fundo suave de sempre continua (o pontilhado sobre branco fica sujo).
// Resolução reduzida: os quadradinhos já são grossos, então ninguém percebe, e a bateria agradece.
const NIGHT: Palette = ['#0a0612', '#6d28d9', '#c026d3', '#f472b6'];

export function DitherBackground({ src }: { src?: string }) {
  const [dark, setDark] = useState(true);
  const [pal, setPal] = useState<Palette | null>(null);

  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!dark) return;
    let alive = true;
    coverDitherPalette(src, true).then((p) => alive && setPal(p ?? NIGHT));
    return () => {
      alive = false;
    };
  }, [src, dark]);

  if (!dark) return <AmbientBackground src={src} />;
  return (
    <DitherField
      palette={pal ?? NIGHT}
      background="#0a0612"
      cell={7}
      quality={0.5}
      gain={1.8}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
