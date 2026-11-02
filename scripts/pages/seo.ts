// Páginas estáticas pra buscadores e pré-visualização de links: uma por música e uma por artista,
// mais sitemap.xml e robots.txt. Cada página tem título, descrição, Open Graph e JSON-LD próprios,
// mostra o resumo dos charts e leva pro vybe com a música/artista aberto.
//   node scripts/pages/seo.ts dist-pages   (depois de copiar os dados pra dist-pages/data)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { splitArtists } from '../../lib/sources/match.ts';
import { marketName } from '../../lib/sources/markets.ts';

export type IndexRow = { n: string; a: string; img?: string; ap?: string; sp?: string; mk: string[]; seen: string };

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const big = (img?: string) => img?.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, '/600x600bb.$1');

function page(o: { site: string; path: string; title: string; description: string; image: string; jsonld: object; h1: string; sub: string; items: string[]; go: string }) {
  const url = `${o.site}${o.path}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" type="image/svg+xml" href="${o.site}favicon.svg">
<meta name="theme-color" content="#070a11">
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="vybe">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(o.image)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070a11;color:#e2e8f0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:520px;padding:32px 20px;text-align:center}
img{width:180px;height:180px;border-radius:24px;object-fit:cover;box-shadow:0 20px 50px #0008}
h1{margin:20px 0 4px;font-size:28px;color:#fff}p{margin:0;color:#94a3b8}
ul{list-style:none;padding:0;margin:18px 0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
li{border:1px solid #22d3ee55;background:#06b6d41a;color:#a5f3fc;border-radius:999px;padding:4px 12px;font-size:13px}
a{display:inline-block;margin-top:8px;padding:12px 20px;border-radius:14px;background:linear-gradient(90deg,#06b6d4,#2563eb);color:#020617;font-weight:700;text-decoration:none}
</style>
</head>
<body>
<main>
<img src="${esc(o.image)}" alt="">
<h1>${esc(o.h1)}</h1>
<p>${esc(o.sub)}</p>
<ul>${o.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
<a href="${esc(o.go)}">Ver no vybe</a>
</main>
<script>location.replace(${JSON.stringify(o.go)})</script>
</body>
</html>
`;
}

/** Gera { caminho: conteúdo } com as páginas, o sitemap e o robots. */
export function buildSeo(index: Record<string, IndexRow>, site: string, today = new Date().toISOString().slice(0, 10)) {
  const files: Record<string, string> = {};
  const urls: { loc: string; lastmod: string }[] = [{ loc: site, lastmod: today }];
  const usedSongs = new Set<string>();
  const artists = new Map<string, { name: string; songs: IndexRow[] }>();

  const rows = Object.values(index).sort((a, b) => b.seen.localeCompare(a.seen) || b.mk.length - a.mk.length);
  for (const r of rows) {
    const first = splitArtists(r.a)[0] ?? r.a;
    let slug = slugify(`${r.n}-${first}`);
    if (!slug) continue;
    if (usedSongs.has(slug)) slug = `${slug}-${r.sp ?? r.ap ?? usedSongs.size}`.toLowerCase();
    usedSongs.add(slug);
    const where = r.mk.map(marketName);
    const go = `${site}?${new URLSearchParams({ musica: r.n, artista: r.a, ...(r.sp ? { spotify: r.sp } : r.ap ? { apple: r.ap } : {}) })}`;
    const path = `musica/${encodeURIComponent(slug)}/`;
    files[`${decodeURIComponent(path)}index.html`] = page({
      site,
      path,
      title: `${r.n} — ${r.a} nos charts | vybe`,
      description: `${r.n}, de ${r.a}: posições no ${where.slice(0, 3).join(', ')}${where.length > 3 ? ` e mais ${where.length - 3}` : ''}, streams e histórico no vybe.`,
      image: big(r.img) ?? `${site}og.png`,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'MusicRecording',
        name: r.n,
        byArtist: splitArtists(r.a).map((name) => ({ '@type': 'MusicGroup', name })),
        image: big(r.img),
        url: `${site}${path}`,
        ...(r.sp ? { sameAs: [`https://open.spotify.com/track/${r.sp}`] } : {}),
      },
      h1: r.n,
      sub: r.a,
      items: where,
      go,
    });
    urls.push({ loc: `${site}${path}`, lastmod: r.seen });
    for (const name of splitArtists(r.a)) {
      const k = slugify(name);
      if (!k) continue;
      const a = artists.get(k) ?? artists.set(k, { name, songs: [] }).get(k)!;
      a.songs.push(r);
    }
  }

  for (const [slug, a] of artists) {
    const path = `artista/${encodeURIComponent(slug)}/`;
    const img = a.songs.find((s) => s.img)?.img;
    const lastmod = a.songs.map((s) => s.seen).sort().pop() ?? today;
    files[`${decodeURIComponent(path)}index.html`] = page({
      site,
      path,
      title: `${a.name} nos charts do Apple Music e do Spotify | vybe`,
      description: `${a.name}: ${a.songs.length} ${a.songs.length === 1 ? 'música' : 'músicas'} nos charts acompanhados pelo vybe, com posições, streams e histórico.`,
      image: big(img) ?? `${site}og.png`,
      jsonld: { '@context': 'https://schema.org', '@type': 'MusicGroup', name: a.name, url: `${site}${path}`, track: a.songs.slice(0, 20).map((s) => ({ '@type': 'MusicRecording', name: s.n })) },
      h1: a.name,
      sub: `${a.songs.length} ${a.songs.length === 1 ? 'música' : 'músicas'} nos charts`,
      items: a.songs.slice(0, 8).map((s) => s.n),
      go: `${site}?${new URLSearchParams({ artista: a.name })}`,
    });
    urls.push({ loc: `${site}${path}`, lastmod });
  }

  files['sitemap.xml'] =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  files['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`;
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? 'dist-pages';
  const site = process.env.SITE_URL ?? 'https://luccamottaa.github.io/VYBE/';
  const src = join(out, 'data/tracks.json');
  const index: Record<string, IndexRow> = existsSync(src) ? JSON.parse(readFileSync(src, 'utf8')) : {};
  const files = buildSeo(index, site.endsWith('/') ? site : `${site}/`);
  for (const [path, body] of Object.entries(files)) {
    const full = join(out, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  const songs = Object.keys(files).filter((f) => f.startsWith('musica/')).length;
  const artists = Object.keys(files).filter((f) => f.startsWith('artista/')).length;
  console.log(`SEO: ${songs} músicas, ${artists} artistas, sitemap com ${songs + artists + 1} endereços.`);
}
