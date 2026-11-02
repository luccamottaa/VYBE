// Núcleo do histórico completo de charts do Spotify (kworb).
// Sem dependência de plataforma: só fetch.

export const DEFAULT_MARKETS = ['global', 'br', 'us', 'kr', 'jp', 'gb'];
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

/**
 * query:  { id?, name?, artist?, m? } → { status, body, cache } (cache = pode guardar na CDN)
 * findId: (name, artist) => Promise<string|null> — acha o id do Spotify pelo nome (busca oficial do Spotify)
 */
export async function trackHistory(query, findId) {
  const out = (status, body, cache = true) => ({ status, body, cache: cache && (status === 200 || status === 404) });
  const req = { query };
  const clean = (v) => String(v ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  let id = clean(req.query.id);
  const wanted = req.query.m === 'all' ? 'all' : String(req.query.m || DEFAULT_MARKETS.join(',')).toLowerCase().split(',').slice(0, 80);

  try {
    if (!id && req.query.name && req.query.artist) {
      if (!findId) return out(501, { error: 'Sem busca do Spotify neste servidor: informe o id do Spotify.' }, false);
      id = (await findId(String(req.query.name).slice(0, 200), String(req.query.artist).slice(0, 200))) ?? '';
      if (!id) return out(404, { error: 'Não achei essa música no Spotify.' });
    }
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return out(400, { error: 'Informe id (Spotify) ou name + artist.' });

    const r = await fetch(`https://kworb.net/spotify/track/${id}.html`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return out(404, { spotifyId: id, error: 'Essa música nunca entrou num chart do Spotify.' });
    if (!r.ok) return out(502, { error: `kworb respondeu ${r.status}` });
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
    if (!daily?.dates.length && !weekly?.dates.length) return out(404, { spotifyId: id, error: 'Sem histórico de chart pra essa música.' });
    const all = [...(weekly?.dates ?? []), ...(daily?.dates ?? [])].sort();

    return out(200, {
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
    return out(502, { error: `Falha ao buscar o histórico: ${e?.message ?? e}` });
  }
}
