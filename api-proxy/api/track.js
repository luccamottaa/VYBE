// vybe-api: histórico completo de uma música nos charts do Spotify, desde a 1ª vez que ela entrou.
//
//   GET /api/track?id=<spotifyId>          (ou ?apple=<id> / ?deezer=<id>: o id do Spotify é achado via Odesli)
//       &m=global,br,us,kr,jp,gb            mercados (padrão); m=all traz todos
//
// Fonte: páginas de faixa do kworb.net (posição e streams diários e semanais por país). Sem chave nenhuma.
// Cache na CDN da Vercel por 12 h, pra não pesar no kworb.

const DEFAULT_MARKETS = ['global', 'br', 'us', 'kr', 'jp', 'gb'];
const UA = 'Mozilla/5.0 (compatible; vybe-charts/1.0; +https://luccamottaa.github.io/VYBE/)';

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
const num = (s) => {
  const n = Number.parseInt(String(s ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** Lê uma tabela do kworb (linhas = datas, colunas = mercados). */
function parseTable(table, wanted) {
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const header = [...(rows.shift() ?? '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => decode(m[1]).toLowerCase());
  const cols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i > 0 && (wanted === 'all' || wanted.includes(h)));
  const out = { dates: [], pos: {}, streams: {}, total: {}, peak: {} };
  for (const { h } of cols) {
    out.pos[h] = [];
    out.streams[h] = [];
  }
  const points = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const label = decode(cells[0] ?? '');
    if (/^total/i.test(label)) {
      for (const { h, i } of cols) out.total[h] = num(cells[i]);
      continue;
    }
    if (/^peak/i.test(label)) {
      for (const { h, i } of cols) {
        const p = num(cells[i]?.match(/class="p"[^>]*>([\s\S]*?)</)?.[1]);
        const s = num(cells[i]?.match(/class="s"[^>]*>([\s\S]*?)</)?.[1]);
        if (p) out.peak[h] = { pos: p, streams: s };
      }
      continue;
    }
    const d = label.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
    if (!d) continue;
    points.push({ date: `${d[1]}-${d[2]}-${d[3]}`, cells });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  for (const { date, cells } of points) {
    out.dates.push(date);
    for (const { h, i } of cols) {
      const c = cells[i] ?? '';
      out.pos[h].push(num(c.match(/class="p"[^>]*>([\s\S]*?)</)?.[1]));
      out.streams[h].push(num(c.match(/class="s"[^>]*>([\s\S]*?)</)?.[1]));
    }
  }
  // tira mercados sem nenhuma posição
  for (const h of Object.keys(out.pos)) {
    if (out.pos[h].every((v) => v === null)) {
      delete out.pos[h];
      delete out.streams[h];
    }
  }
  return out;
}

/** Acha o id do Spotify a partir de Apple Music ou Deezer, via Odesli (song.link). Devolve { id } ou { why }. */
async function resolveSpotifyId(platform, id) {
  const attempts = [
    `platform=${platform === 'apple' ? 'appleMusic' : 'deezer'}&type=song&id=${id}&userCountry=US`,
    `url=${encodeURIComponent(platform === 'apple' ? `https://music.apple.com/us/song/${id}` : `https://www.deezer.com/track/${id}`)}`,
  ];
  let why = '';
  for (const qs of attempts) {
    const r = await fetch(`https://api.song.link/v1-alpha.1/links?${qs}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) {
      why = `Odesli respondeu ${r.status}`;
      continue;
    }
    const d = await r.json();
    const unique = d?.linksByPlatform?.spotify?.entityUniqueId;
    if (typeof unique === 'string') return { id: unique.split('::').pop() };
    why = 'Odesli não conhece essa música no Spotify';
  }
  return { why };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // cache = false: resposta que não deve ficar guardada (falha de terceiros)
  const send = (status, body, cache = true) => {
    res.setHeader('Cache-Control', cache && (status === 200 || status === 404) ? 'public, max-age=600, s-maxage=43200, stale-while-revalidate=86400' : 'no-store');
    res.status(status).end(JSON.stringify(body));
  };

  const clean = (v) => String(v ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  let id = clean(req.query.id);
  const wanted = req.query.m === 'all' ? 'all' : String(req.query.m || DEFAULT_MARKETS.join(',')).toLowerCase().split(',').slice(0, 80);

  try {
    if (!id && (req.query.apple || req.query.deezer)) {
      const found = await resolveSpotifyId(req.query.apple ? 'apple' : 'deezer', clean(req.query.apple || req.query.deezer));
      if (!found.id) return send(found.why?.includes('respondeu') ? 502 : 404, { error: 'Não deu pra achar essa música no Spotify.', why: found.why }, false);
      id = found.id;
    }
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return send(400, { error: 'Informe id (Spotify), apple ou deezer.' });

    const r = await fetch(`https://kworb.net/spotify/track/${id}.html`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return send(404, { spotifyId: id, error: 'Essa música nunca entrou num chart do Spotify.' });
    if (!r.ok) return send(502, { error: `kworb respondeu ${r.status}` });
    const html = await r.text();

    const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s*-\s*Spotify Chart History\s*$/i, '');
    const [artist, ...rest] = title.split(' - ');
    const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => parseTable(m[0], wanted));
    // O kworb põe a semanal primeiro e a diária depois. Confere pelo intervalo entre datas:
    // a diária tem datas a 1 dia de distância, a semanal nunca.
    const minGap = (t) =>
      t.dates.slice(1).reduce((m, d, i) => Math.min(m, (Date.parse(d) - Date.parse(t.dates[i])) / 86400000), Infinity);
    let [weekly, daily] = tables.length > 1 ? tables : [null, tables[0]];
    if (weekly && daily && minGap(weekly) === 1 && minGap(daily) !== 1) [weekly, daily] = [daily, weekly];
    if (!daily?.dates.length && !weekly?.dates.length) return send(404, { spotifyId: id, error: 'Sem histórico de chart pra essa música.' });
    const all = [...(weekly?.dates ?? []), ...(daily?.dates ?? [])].sort();

    return send(200, {
      spotifyId: id,
      name: rest.join(' - ') || null,
      artist: artist || null,
      source: `https://kworb.net/spotify/track/${id}.html`,
      firstDate: all[0],
      lastDate: all[all.length - 1],
      daily,
      weekly,
    });
  } catch (e) {
    return send(502, { error: `Falha ao buscar o histórico: ${e?.message ?? e}` });
  }
}
