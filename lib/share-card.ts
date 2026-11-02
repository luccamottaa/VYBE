// Card 1080x1350 (formato de post/story) pra compartilhar uma música ou artista nas redes. Tudo no canvas, sem servidor.

export type CardData = {
  kicker: string; // "Spotify 🌍 · Top 200"
  title: string;
  subtitle: string;
  artwork?: string;
  round?: boolean; // foto de artista em círculo
  stats: { label: string; value: string; tone?: 'green' | 'cyan' | 'amber' }[];
  positions: { label: string; rank: number }[];
  date?: string;
};

const W = 1080;
const H = 1350;
const tones = { green: '#34d399', cyan: '#22d3ee', amber: '#fbbf24' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function loadImage(src: string, cors = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    const t = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Quebra em até `lines` linhas; a última ganha reticências se sobrar texto. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= max) cur = next;
    else {
      if (cur) out.push(cur);
      cur = words[i];
      if (out.length === lines - 1) {
        out.push(fit(ctx, words.slice(i).join(' '), max));
        return out;
      }
    }
  }
  if (cur) out.push(fit(ctx, cur, max));
  return out.slice(0, lines);
}

async function draw(d: CardData, withCover: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const base = import.meta.env.BASE_URL ?? '/';
  const [cover, logo] = await Promise.all([withCover && d.artwork ? loadImage(d.artwork) : null, loadImage(`${base}favicon.svg`, false)]);

  // fundo: escuro + capa desfocada + brilhos da marca
  ctx.fillStyle = '#070a11';
  ctx.fillRect(0, 0, W, H);
  if (cover) {
    ctx.save();
    ctx.filter = 'blur(70px) saturate(1.4)';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(cover, -200, -200, W + 400, W + 400);
    ctx.restore();
  }
  const glow = (x: number, y: number, r: number, c: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(7,10,17,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(140, 120, 520, 'rgba(6,182,212,0.28)');
  glow(980, 1220, 620, 'rgba(139,92,246,0.25)');
  const fade = ctx.createLinearGradient(0, 520, 0, H);
  fade.addColorStop(0, 'rgba(7,10,17,0)');
  fade.addColorStop(0.45, 'rgba(7,10,17,0.86)');
  fade.addColorStop(1, 'rgba(7,10,17,0.97)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  // pontilhado discreto (eco do dither do site)
  ctx.fillStyle = 'rgba(148,163,184,0.07)';
  for (let y = 24; y < H; y += 28) for (let x = 24 + ((y / 28) % 2) * 14; x < W; x += 28) ctx.fillRect(x, y, 2, 2);

  // capa
  const S = 520;
  const cx = (W - S) / 2;
  const cy = 96;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  if (d.round) {
    ctx.beginPath();
    ctx.arc(W / 2, cy + S / 2, S / 2, 0, Math.PI * 2);
  } else roundRect(ctx, cx, cy, S, S, 36);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.restore();
  ctx.save();
  if (d.round) {
    ctx.beginPath();
    ctx.arc(W / 2, cy + S / 2, S / 2, 0, Math.PI * 2);
  } else roundRect(ctx, cx, cy, S, S, 36);
  ctx.clip();
  if (cover) ctx.drawImage(cover, cx, cy, S, S);
  else {
    const g = ctx.createLinearGradient(cx, cy, cx + S, cy + S);
    g.addColorStop(0, '#06b6d4');
    g.addColorStop(1, '#7c3aed');
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, S, S);
    if (logo) ctx.drawImage(logo, cx + S * 0.2, cy + S * 0.2, S * 0.6, S * 0.6);
  }
  ctx.restore();

  // textos
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // altura do bloco de texto pra centralizar entre a capa e o rodapé
  ctx.font = `800 64px ${FONT}`;
  const nTitle = wrap(ctx, d.title, W - 140, 2).length;
  ctx.font = `700 26px ${FONT}`;
  const chipRows = (() => {
    let rows = d.positions.length ? 1 : 0;
    let w = 0;
    for (const p of d.positions.slice(0, 6)) {
      const cw = ctx.measureText(`${p.label}  #${p.rank}`).width + 44;
      if (w + cw > W - 120 && w > 0) {
        rows++;
        w = 0;
      }
      w += cw + 14;
    }
    return Math.min(rows, 2);
  })();
  const blockH = 26 + 46 + nTitle * 70 + 44 + (d.stats.length ? 146 : 0) + chipRows * 68;
  const room = H - 120 - (cy + S);
  let y = cy + S + Math.max(56, (room - blockH) / 2) + 26;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(fit(ctx, d.kicker.toUpperCase(), W - 160), W / 2, y);
  y += 72;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  const titleLines = wrap(ctx, d.title, W - 140, 2);
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 70;
  }
  ctx.font = `500 36px ${FONT}`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(fit(ctx, d.subtitle, W - 160), W / 2, y - 8);
  y += 52;

  // números
  const stats = d.stats.slice(0, 3);
  if (stats.length) {
    const gap = 20;
    const bw = (W - 120 - gap * (stats.length - 1)) / stats.length;
    stats.forEach((s, i) => {
      const x = 60 + i * (bw + gap);
      roundRect(ctx, x, y, bw, 118, 24);
      ctx.fillStyle = 'rgba(15,23,42,0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `800 44px ${FONT}`;
      ctx.fillStyle = tones[s.tone ?? 'cyan'];
      ctx.fillText(fit(ctx, s.value, bw - 28), x + bw / 2, y + 60);
      ctx.font = `600 20px ${FONT}`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(fit(ctx, s.label.toUpperCase(), bw - 28), x + bw / 2, y + 94);
    });
    y += 146;
  }

  // posições
  const pos = d.positions.slice(0, 6);
  if (pos.length) {
    ctx.font = `700 26px ${FONT}`;
    const chips = pos.map((p) => `${p.label}  #${p.rank}`);
    const widths = chips.map((c) => ctx.measureText(c).width + 44);
    const rows: number[][] = [[]];
    let rowW = 0;
    widths.forEach((w, i) => {
      if (rowW + w > W - 120 && rows[rows.length - 1].length) {
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push(i);
      rowW += w + 14;
    });
    for (const row of rows.slice(0, 2)) {
      const total = row.reduce((s, i) => s + widths[i], 0) + 14 * (row.length - 1);
      let x = (W - total) / 2;
      for (const i of row) {
        roundRect(ctx, x, y, widths[i], 54, 27);
        ctx.fillStyle = pos[i].rank === 1 ? 'rgba(251,191,36,0.16)' : 'rgba(6,182,212,0.12)';
        ctx.fill();
        ctx.strokeStyle = pos[i].rank === 1 ? 'rgba(251,191,36,0.45)' : 'rgba(34,211,238,0.35)';
        ctx.stroke();
        ctx.fillStyle = pos[i].rank === 1 ? '#fcd34d' : '#a5f3fc';
        ctx.textAlign = 'left';
        ctx.fillText(chips[i], x + 22, y + 37);
        x += widths[i] + 14;
      }
      y += 68;
    }
    ctx.textAlign = 'center';
  }

  // rodapé com a marca
  const fy = H - 70;
  ctx.fillStyle = 'rgba(148,163,184,0.18)';
  ctx.fillRect(60, fy - 50, W - 120, 2);
  if (logo) ctx.drawImage(logo, 60, fy - 30, 52, 52);
  ctx.textAlign = 'left';
  ctx.font = `800 40px ${FONT}`;
  const g = ctx.createLinearGradient(124, 0, 240, 0);
  g.addColorStop(0, '#22d3ee');
  g.addColorStop(1, '#60a5fa');
  ctx.fillStyle = g;
  ctx.fillText('vybe', 124, fy + 10);
  ctx.textAlign = 'right';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(d.date ? `do play ao topo · ${d.date}` : 'do play ao topo', W - 60, fy + 6);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/png');
    } catch (e) {
      reject(e); // canvas "sujo" (capa sem CORS)
    }
  });
}

/** Gera o PNG. Se a capa não permitir uso no canvas, refaz sem ela. */
export async function renderCard(d: CardData): Promise<Blob> {
  try {
    return await draw(d, true);
  } catch {
    return draw(d, false);
  }
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'vybe';
