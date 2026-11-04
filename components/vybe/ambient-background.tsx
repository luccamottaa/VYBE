'use client';

import { useEffect, useRef } from 'react';

// Fundo vivo do vybe: manchas de cor que flutuam devagar, tiradas da capa da música em destaque
// (o #1 do ranking ou a música/álbum aberto). Leve de propósito: desenha num canvas de 48 px que o
// navegador estica (o desfoque sai de graça), ~20 quadros por segundo e para quando a aba some.

type RGB = [number, number, number];

const BRAND: RGB[] = [
  [6, 182, 212],
  [59, 130, 246],
  [139, 92, 246],
  [16, 185, 129],
];

const SIZE = 48;

const toHsl = ([r, g, b]: RGB) => {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l] as const;
};

const fromHsl = (h: number, s: number, l: number): RGB => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

/** 4 cores marcantes da capa: agrupa por matiz e prefere as mais saturadas. Exportada pra teste. */
export function paletteFromPixels(data: Uint8ClampedArray): RGB[] | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; s: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
    const [h, s, l] = toHsl(rgb);
    if (l < 0.08 || l > 0.94) continue; // preto e branco puros não dão clima
    const k = Math.round(h / 24) % 15;
    const b = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0, s: 0 };
    b.n++;
    b.r += rgb[0];
    b.g += rgb[1];
    b.b += rgb[2];
    b.s += s;
    buckets.set(k, b);
  }
  const ranked = [...buckets.values()]
    .map((b) => ({ rgb: [b.r / b.n, b.g / b.n, b.b / b.n] as RGB, score: b.n * (0.35 + b.s / b.n) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  // capa monocromática: varia o tom da cor principal pra ainda ter movimento
  const out = ranked.slice(0, 4).map((x) => x.rgb);
  while (out.length < 4) {
    const [h, s, l] = toHsl(out[0]);
    out.push(fromHsl((h + 28 * out.length) % 360, Math.max(s, 0.45), Math.min(0.65, Math.max(0.35, l))));
  }
  return out;
}

const hex2 = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Paleta de 4 cores (fundo, base, destaque, brilho) tirada da capa, pro fundo pontilhado. */
export async function coverDitherPalette(src: string | undefined, dark: boolean): Promise<[string, string, string, string] | null> {
  if (!src) return null;
  const p = await loadPalette(src.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, '/60x60bb.$1'));
  if (!p) return null;
  const [h, s] = toHsl(p[0]);
  const deep = dark ? fromHsl(h, Math.min(1, s), 0.09) : fromHsl(h, Math.min(0.6, s * 0.6), 0.95);
  return [hex2(deep), ...p.map((c) => hex2(tune(c, dark)))] as [string, string, string, string];
}

/** Ajusta pro tema: no claro, tons pastel; no escuro, cores fundas e vivas. */
function tune(c: RGB, dark: boolean): RGB {
  const [h, s, l] = toHsl(c);
  return dark ? fromHsl(h, Math.min(1, Math.max(0.5, s * 1.15)), Math.min(0.5, Math.max(0.3, l))) : fromHsl(h, Math.min(0.9, Math.max(0.45, s)), Math.min(0.82, Math.max(0.68, l + 0.2)));
}

export function loadPalette(src: string): Promise<RGB[] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const t = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(t);
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 24, 24);
        resolve(paletteFromPixels(ctx.getImageData(0, 0, 24, 24).data));
      } catch {
        resolve(null); // capa sem CORS: fica com as cores atuais
      }
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

export function AmbientBackground({ src, still = false }: { src?: string; still?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef<RGB[]>(BRAND);

  // troca de capa → nova paleta (a transição acontece no loop de desenho)
  useEffect(() => {
    let alive = true;
    if (!src) {
      target.current = BRAND;
      return;
    }
    const url = src.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, '/60x60bb.$1');
    loadPalette(url).then((p) => alive && p && (target.current = p));
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const darkQ = window.matchMedia('(prefers-color-scheme: dark)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || still;
    const current = BRAND.map((c) => [...c] as RGB);
    // cada mancha tem órbita própria; t inicial aleatório pra cada visita ser diferente
    const blobs = [
      { ax: 0.32, ay: 0.26, fx: 0.07, fy: 0.05, ph: 0, r: 0.62 },
      { ax: 0.3, ay: 0.32, fx: 0.05, fy: 0.08, ph: 2.1, r: 0.55 },
      { ax: 0.36, ay: 0.24, fx: 0.06, fy: 0.045, ph: 4.2, r: 0.5 },
      { ax: 0.24, ay: 0.34, fx: 0.085, fy: 0.06, ph: 5.3, r: 0.45 },
    ];
    const t0 = performance.now() - Math.random() * 120000;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      const dark = darkQ.matches;
      const k = last ? Math.min(1, (now - last) / 1600) : 1; // ~1,6 s de transição entre capas
      last = now;
      const t = (now - t0) / 1000;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = dark ? '#070a11' : '#f4f7fb';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      blobs.forEach((b, i) => {
        const goal = tune(target.current[i % target.current.length], dark);
        for (let j = 0; j < 3; j++) current[i][j] += (goal[j] - current[i][j]) * k;
        const x = SIZE * (0.5 + b.ax * Math.sin(t * b.fx + b.ph));
        const y = SIZE * (0.5 + b.ay * Math.cos(t * b.fy + b.ph * 1.3));
        const r = SIZE * b.r * (1 + 0.08 * Math.sin(t * 0.11 + b.ph));
        const [cr, cg, cb] = current[i].map(Math.round);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = dark ? 0.42 : 0.72;
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SIZE, SIZE);
      });
    };

    let lastFrame = 0;
    const loop = (now: number) => {
      if (now - lastFrame > 50) {
        lastFrame = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      if (reduced) {
        // sem animação: só acompanha a troca de capa, quadro a quadro durante a transição
        const settle = (now: number) => {
          draw(now);
          if (now - t0 < 0 || current.some((c, i) => c.some((v, j) => Math.abs(v - tune(target.current[i % target.current.length], darkQ.matches)[j]) > 1))) raf = requestAnimationFrame(settle);
        };
        raf = requestAnimationFrame(settle);
      } else raf = requestAnimationFrame(loop);
    };
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : play());
    document.addEventListener('visibilitychange', onVis);
    darkQ.addEventListener('change', play);
    // no modo parado, repinta quando a capa muda
    const poll = reduced ? window.setInterval(play, 2000) : 0;
    play();
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      darkQ.removeEventListener('change', play);
    };
  }, [still]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={{ imageRendering: 'auto' }}
    />
  );
}
