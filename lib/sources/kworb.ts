// kworb.net: charts diários do Spotify com streams, por país e global.
//
// Não existe API: o kworb publica tabelas HTML (ele mesmo coleta do Spotify). Lemos a tabela pelo
// nome das colunas do cabeçalho, não pela posição, pra aguentar mudanças pequenas de layout.
// Se não der pra entender a página, o erro traz um diagnóstico do HTML recebido.
// Módulo puro: sem Cloudflare e sem alias, usado pelo coletor do Pages e pelo Worker.

import type { SpotifyEntry } from './spotify.ts';

export const kworbMarkets: Record<string, string> = {
  global: 'Global',
  br: 'Brasil',
  us: 'Estados Unidos',
  kr: 'Coreia do Sul',
  jp: 'Japão',
  gb: 'Reino Unido',
};

export const kworbUrl = (market: string) => `https://kworb.net/spotify/country/${market}_daily.html`;

const UA = 'Mozilla/5.0 (compatible; vybe-charts/1.0; +https://luccamottaa.github.io/VYBE/)';

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

const num = (s: string | undefined) => {
  const n = Number.parseInt(String(s ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

export type KworbEntry = SpotifyEntry & { totalStreams?: number | null };

export type KworbChart = {
  market: string;
  date: string;
  entries: KworbEntry[];
};

/** Lê a tabela de um chart diário do kworb. Exportada pra teste. */
export function parseKworb(html: string, market: string): KworbChart {
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error(`kworb ${market}: página sem tabela (${decode(html).slice(0, 160)})`);

  const headers = [...(table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? table).matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
    decode(m[1]).toLowerCase(),
  );
  const col = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const iPos = col('pos', '#', 'rank');
  const iChange = col('p+', '+/-', 'change');
  const iDays = col('days');
  const iPeak = col('pk', 'peak');
  const iStreams = col('streams');
  const iTotal = col('total');

  const rows = [...(table.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0] ?? table).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const entries: KworbEntry[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (!cells.length) continue;
    const trackCell = cells.find((c) => /\/track\/[A-Za-z0-9]{22}/.test(c));
    const id = trackCell?.match(/\/track\/([A-Za-z0-9]{22})/)?.[1];
    if (!trackCell || !id) continue;

    // "Artista - Título" (colaborações às vezes vêm como "(w/ Fulano)" no título)
    const text = decode(trackCell);
    const titleLink = trackCell.match(/<a[^>]*\/track\/[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const trackName = titleLink ? decode(titleLink) : text.split(' - ').slice(1).join(' - ') || text;
    let artist = text.endsWith(trackName) ? text.slice(0, text.length - trackName.length).replace(/\s*-\s*$/, '') : text.split(' - ')[0];
    const feat = trackName.match(/\(w\/\s*([^)]+)\)/i)?.[1];
    if (feat) artist = `${artist}, ${feat}`;

    const rank = num(cells[iPos >= 0 ? iPos : 0]) ?? entries.length + 1;
    const change = iChange >= 0 ? decode(cells[iChange]).toUpperCase() : '';
    const delta = /^[+-]?\d+$/.test(change) ? Number(change) : change === '=' ? 0 : null;
    const entryStatus = change.startsWith('NEW') ? 'NEW_ENTRY' : change.startsWith('RE') ? 'RE_ENTRY' : delta === null ? undefined : delta > 0 ? 'MOVED_UP' : delta < 0 ? 'MOVED_DOWN' : 'NO_CHANGE';

    entries.push({
      rank,
      previousRank: delta === null ? null : rank + delta,
      peakRank: iPeak >= 0 ? num(cells[iPeak]) : null,
      daysOnChart: iDays >= 0 ? num(cells[iDays]) : null,
      trackName: trackName.replace(/\s*\(w\/[^)]+\)/i, '').trim(),
      artist,
      streams: iStreams >= 0 ? num(cells[iStreams]) : null,
      totalStreams: iTotal >= 0 ? num(cells[iTotal]) : null,
      spotifyId: id,
      artworkUrl: null,
      entryStatus,
    });
  }

  if (!entries.length) {
    const sample = decode(rows[0] ?? '').slice(0, 160);
    throw new Error(`kworb ${market}: tabela sem faixas (colunas: ${headers.join('|') || 'nenhuma'}; 1ª linha: ${sample || 'vazia'})`);
  }

  // "Last updated: 2026/11/01" no topo da página; se não achar, assume ontem (UTC).
  const m = html.match(/updated[^0-9]{0,60}(20\d{2})[/-](\d{2})[/-](\d{2})/i) ?? html.match(/(20\d{2})[/-](\d{2})[/-](\d{2})/);
  const date = m ? `${m[1]}-${m[2]}-${m[3]}` : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return { market, date, entries };
}

export async function fetchKworbChart(market: string, attempts = 1): Promise<KworbChart> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fetch(kworbUrl(market), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`kworb ${market} respondeu ${r.status}`);
      return parseKworb(await r.text(), market);
    } catch (e) {
      lastError = e;
      if (i < attempts) await new Promise((res) => setTimeout(res, 3000 * i));
    }
  }
  throw lastError;
}
