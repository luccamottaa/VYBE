'use client';

import { useEffect, useRef } from 'react';

/**
 * Fundo animado em "pixel dither": um campo de ruído com domain warping (aurora) amostrado numa grade
 * de quadradinhos, com dithering Bayer 8x8 nas regiões escuras. Roda num fragment shader (WebGL 1).
 *
 * - Pausa fora da tela e com a aba escondida.
 * - prefers-reduced-motion: desenha um quadro só, parado.
 * - Sem WebGL: o canvas fica vazio e o gradiente CSS do container aparece.
 */

export type Palette = [string, string, string, string]; // fundo profundo, base, destaque, brilho

export const palettes: Record<'apple' | 'spotify' | 'all', Palette> = {
  all: ['#0b1f4d', '#2563eb', '#06b6d4', '#10b981'],
  apple: ['#172554', '#2563eb', '#06b6d4', '#a855f7'],
  spotify: ['#064e3b', '#0891b2', '#10b981', '#2dd4bf'],
};

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCell;
uniform float uGap;
uniform vec3 uC0, uC1, uC2, uC3;
uniform vec3 uBg;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Bayer recursivo: limiar ordenado 0..1 por célula.
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 cell = floor(px / uCell);
  vec2 local = px - cell * uCell;

  // Amostra no centro da célula: todos os pixels do quadrado ganham a mesma cor.
  vec2 uv = (cell + 0.5) * uCell / uRes.y;
  float t = uTime * 0.045;

  vec2 q = vec2(fbm(uv * 1.1 + vec2(t, -t * 0.6)), fbm(uv * 1.1 + vec2(5.2 - t * 0.8, 1.3 + t)));
  vec2 r = vec2(fbm(uv * 1.4 + 2.0 * q + vec2(1.7, 9.2) + t * 0.5), fbm(uv * 1.4 + 2.0 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(uv * 1.2 + 1.8 * r);

  // Faixa diagonal suave, lembrando a luz atravessando o banner.
  float diag = smoothstep(-0.25, 0.9, sin((uv.x - uv.y * 0.9) * 1.6 + t * 2.0) * 0.5 + 0.5);
  float lum = clamp((f - 0.2) * 2.6 * mix(0.7, 1.2, diag), 0.0, 1.0);

  vec3 col = mix(uC0, uC1, smoothstep(0.15, 0.55, f));
  col = mix(col, uC2, smoothstep(0.45, 0.85, r.x) * 0.85);
  col = mix(col, uC3, smoothstep(0.55, 0.95, q.y) * 0.55);

  // Dither: célula acesa se o brilho passa do limiar Bayer.
  float on = step(bayer8(cell), lum);
  float flicker = 1.0 - 0.1 * hash(cell + floor(uTime * 1.5));
  float bright = (0.4 + 0.6 * lum) * flicker;

  float inside = step(local.x, uCell - uGap) * step(local.y, uCell - uGap);
  vec3 lit = col * bright;
  vec3 dim = mix(uBg, col, 0.12);
  vec3 c = mix(dim, lit, on);
  gl_FragColor = vec4(mix(uBg, c, inside), 1.0);
}
`;

const hex = (h: string) => {
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function DitherField({ palette, background = '#070a11', cell = 7, className }: { palette: Palette; background?: string; cell?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(palette.map(hex));
  const bg = useRef(hex(background));

  useEffect(() => {
    target.current = palette.map(hex);
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    } catch (e) {
      console.warn('[VYBE] DitherField sem WebGL:', e);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u('uRes'), uTime = u('uTime'), uCell = u('uCell'), uGap = u('uGap');
    const uCols = [u('uC0'), u('uC1'), u('uC2'), u('uC3')];
    gl.uniform3fv(u('uBg'), bg.current);

    const current = target.current.map((c) => [...c]);
    // celular: resolução e quadros menores (o efeito é pixelado, ninguém nota; a bateria e a rolagem agradecem)
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 2);
    const frameMs = touch ? 1000 / 30 : 0;
    let lastFrame = 0;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uCell, Math.round(cell * dpr));
      gl.uniform1f(uGap, Math.max(1, Math.round(dpr)));
    };
    resize();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now() - Math.random() * 60000; // cada visita começa num ponto diferente
    let raf = 0;
    let visible = true;
    let last = 0;

    const draw = (now: number) => {
      // Transição suave de paleta (troca Apple ↔ Spotify).
      const k = last ? Math.min(1, (now - last) / 400) : 1;
      last = now;
      current.forEach((c, i) => {
        for (let j = 0; j < 3; j++) c[j] += (target.current[i][j] - c[j]) * k;
        gl.uniform3fv(uCols[i], c);
      });
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const loop = (now: number) => {
      if (now - lastFrame >= frameMs) {
        lastFrame = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (reduced) draw(performance.now());
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play();
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : play());
    document.addEventListener('visibilitychange', onVis);
    play();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [cell]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
