// Coletor do GitHub Pages: roda na GitHub Action (Node 22+, TypeScript nativo).
//
//   node scripts/pages/collect.ts <pasta-de-dados>
//
// Busca Apple Music (5 países), Spotify (Global + 5 países, via kworb, com streams) e Last.fm, e atualiza:
//   apple/<país>/latest.json        ranking atual no mesmo formato de /api/chart
//   apple/<país>/history.json       { dates: [...], ranks: { id: [posição|null por data] } }
//   spotify/<mercado>/latest.json   mesmo formato de /api/spotify (mercado: global, br, us, kr, jp, gb)
//   spotify/<chart>/history.json    { dates, ranks, streams } (chart = mercado, ou o alias oficial no fallback)
//   spotify/artwork.json            capas por id do Spotify (cache entre rodadas)
//   lastfm.json                     ouvintes/scrobbles por faixa (só com LASTFM_API_KEY)
//   tracks.json                     índice de busca: toda faixa vista em algum chart nos últimos 120 dias
//   meta.json                       quando rodou e o que deu certo
//
// Se uma fonte falhar, o último dado salvo continua lá, marcado como `stale`.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { countries, fetchAppleChart } from '../../lib/sources/apple.ts';
import { fetchKworbChart, kworbMarkets, kworbUrl } from '../../lib/sources/kworb.ts';
import { fetchLastfmTrack, type LastfmStats } from '../../lib/sources/lastfm.ts';
import { cleanTitle, matchKey, splitArtists } from '../../lib/sources/match.ts';
import { fetchSpotifyChart, fillArtwork, type SpotifyEntry } from '../../lib/sources/spotify.ts';

const KEEP_DAYS = 120;

/** Índice de busca: chave matchKey → faixa, ids nas fontes e mercados onde apareceu. */
type IndexRow = { n: string; a: string; img?: string; ap?: string; sp?: string; mk: string[]; seen: string };
const index: Record<string, IndexRow> = {};
function remember(t: { name: string; artist: string; img?: string | null; appleId?: string; spotifyId?: string }, market: string, date: string) {
  const k = matchKey(t.name, t.artist);
  const row = (index[k] ??= { n: t.name, a: t.artist, mk: [], seen: date });
  if (t.img && !row.img) row.img = t.img;
  if (t.appleId) row.ap ??= t.appleId;
  if (t.spotifyId) row.sp ??= t.spotifyId;
  if (!row.mk.includes(market)) row.mk.push(market);
  if (date > row.seen) row.seen = date;
}
const root = process.argv[2] ?? 'data-store';

type History = { dates: string[]; ranks: Record<string, (number | null)[]>; streams?: Record<string, (number | null)[]> };

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(root, path), 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, data: unknown) {
  const full = join(root, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(data));
}

/** Grava (ou substitui) a coluna de `date` no histórico e devolve as posições da data anterior. */
function upsert(h: History, date: string, rows: { id: string; rank: number; streams?: number | null }[], withStreams: boolean) {
  let idx = h.dates.indexOf(date);
  if (idx < 0) {
    h.dates.push(date);
    // mantém as datas ordenadas mesmo se uma coleta atrasada chegar fora de ordem
    const order = h.dates.map((d, i) => [d, i] as const).sort((a, b) => a[0].localeCompare(b[0]));
    const remap = (arr: (number | null)[]) => order.map(([, i]) => arr[i] ?? null);
    h.dates = order.map(([d]) => d);
    for (const id of Object.keys(h.ranks)) h.ranks[id] = remap(h.ranks[id]);
    if (h.streams) for (const id of Object.keys(h.streams)) h.streams[id] = remap(h.streams[id]);
    idx = h.dates.indexOf(date);
  }
  const n = h.dates.length;
  const prevIdx = idx - 1;
  const previous = new Map<string, number>();
  if (prevIdx >= 0) for (const [id, arr] of Object.entries(h.ranks)) if (arr[prevIdx] != null) previous.set(id, arr[prevIdx]!);

  // limpa a coluna (re-coleta no mesmo dia) e preenche
  for (const arr of Object.values(h.ranks)) arr[idx] = null;
  if (h.streams) for (const arr of Object.values(h.streams)) arr[idx] = null;
  if (withStreams) h.streams ??= {};
  for (const r of rows) {
    (h.ranks[r.id] ??= Array(n).fill(null))[idx] = r.rank;
    if (withStreams) (h.streams![r.id] ??= Array(n).fill(null))[idx] = r.streams ?? null;
  }
  for (const arr of Object.values(h.ranks)) while (arr.length < n) arr.push(null);
  if (h.streams) for (const arr of Object.values(h.streams)) while (arr.length < n) arr.push(null);

  // retenção
  const drop = Math.max(0, h.dates.length - KEEP_DAYS);
  if (drop) {
    h.dates = h.dates.slice(drop);
    for (const k of Object.keys(h.ranks)) {
      h.ranks[k] = h.ranks[k].slice(drop);
      if (h.ranks[k].every((v) => v === null)) delete h.ranks[k];
    }
    if (h.streams) {
      for (const k of Object.keys(h.streams)) {
        if (h.ranks[k]) h.streams[k] = h.streams[k].slice(drop);
        else delete h.streams[k];
      }
    }
  }
  const at = h.dates.indexOf(date);
  const prevDate = at > 0 ? h.dates[at - 1] : null;
  return { previous, prevDate };
}

async function collectApple(country: string) {
  const latestPath = `apple/${country}/latest.json`;
  try {
    const { date, updated, tracks } = await fetchAppleChart(country, 4); // a Apple às vezes trava com os servidores do GitHub: até 4 tentativas
    const history = (await readJson<History>(`apple/${country}/history.json`)) ?? { dates: [], ranks: {} };
    const { previous, prevDate } = upsert(history, date, tracks, false);
    await writeJson(`apple/${country}/history.json`, history);
    await writeJson(latestPath, {
      country,
      date,
      updated,
      fetched: Date.now(),
      stale: false,
      historyAvailable: true,
      days: history.dates.length,
      previousDate: prevDate,
      tracks: tracks.map((t) => ({
        ...t,
        change: previous.has(t.id) ? previous.get(t.id)! - t.rank : null,
        isNew: !!prevDate && !previous.has(t.id),
      })),
    });
    for (const t of tracks.slice(0, 50)) collected.push({ name: t.name, artist: t.artistName });
    for (const t of tracks) remember({ name: t.name, artist: t.artistName, img: t.artworkUrl100, appleId: t.id }, `ap:${country}`, date);
    return `apple:${country} ok (${date})`;
  } catch (e) {
    const old = await readJson<Record<string, unknown>>(latestPath);
    if (old) await writeJson(latestPath, { ...old, stale: true });
    return `apple:${country} ERRO ${(e as Error).message}${old ? ' (mantido o último)' : ''}`;
  }
}

type Artwork = Record<string, string>;
const artwork: Artwork = (await readJson<Artwork>('spotify/artwork.json')) ?? {};
const collected: { name: string; artist: string }[] = []; // faixas do topo, pro Last.fm

async function withArtwork(entries: SpotifyEntry[]) {
  await fillArtwork(entries, Object.entries(artwork).map(([spotifyId, artworkUrl]) => ({ spotifyId, artworkUrl }) as SpotifyEntry), 50);
  for (const e of entries) if (e.artworkUrl) artwork[e.spotifyId] = e.artworkUrl;
}

async function saveSpotify(market: string, chart: string, payload: Record<string, unknown> & { date: string; entries: SpotifyEntry[] }) {
  const path = `spotify/${chart}/history.json`;
  const history = (await readJson<History>(path)) ?? { dates: [], ranks: {}, streams: {} };
  upsert(history, payload.date, payload.entries.map((e) => ({ id: e.spotifyId, rank: e.rank, streams: e.streams })), true);
  await writeJson(path, history);
  const latest = { ...payload, chart, fetched: Date.now(), stale: false, historyAvailable: true };
  await writeJson(`spotify/${market}/latest.json`, latest);
  if (market === 'global') await writeJson('spotify/latest.json', latest); // compatibilidade com a versão anterior
  for (const e of payload.entries.slice(0, 50)) collected.push({ name: e.trackName, artist: e.artist });
  for (const e of payload.entries) remember({ name: e.trackName, artist: e.artist, img: e.artworkUrl, spotifyId: e.spotifyId }, `sp:${market}`, payload.date);
}

async function collectSpotify(market: string) {
  const name = kworbMarkets[market];
  try {
    const k = await fetchKworbChart(market, 3);
    await withArtwork(k.entries);
    await saveSpotify(market, market, { label: `Top ${k.entries.length} ${name} · Diário`, date: k.date, source: 'kworb', sourceUrl: kworbUrl(market), entries: k.entries });
    return `spotify:${market} ok (${k.date}, ${k.entries.length} faixas, via kworb)`;
  } catch (kworbError) {
    const why = (kworbError as Error).message;
    // Reserva só pro Global: o JSON público oficial (Top 50 semanal, sem streams).
    if (market === 'global') {
      const fetched = await fetchSpotifyChart();
      if ('result' in fetched) {
        const r = fetched.result;
        await withArtwork(r.entries);
        await saveSpotify(market, r.chart, { ...r });
        return `spotify:global ok via oficial (${r.chart} ${r.date}) — kworb falhou: ${why}`;
      }
    }
    const old = await readJson<Record<string, unknown>>(`spotify/${market}/latest.json`);
    if (old) await writeJson(`spotify/${market}/latest.json`, { ...old, stale: true });
    return `spotify:${market} ERRO ${why}${old ? ' (mantido o último)' : ''}`;
  }
}

/** Ouvintes e scrobbles do Last.fm pras faixas do topo (até 250 por rodada, ~4 por segundo). */
async function collectLastfm() {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return 'lastfm: pulado (sem LASTFM_API_KEY)';
  type Row = LastfmStats | { missing: true; fetched: number };
  const db = (await readJson<Record<string, Row>>('lastfm.json')) ?? {};
  const fresh = Date.now() - 48 * 3600_000;
  const queue = [...new Map(collected.map((t) => [matchKey(t.name, t.artist), t])).entries()]
    .filter(([k]) => !db[k] || db[k].fetched < fresh)
    .sort(([a], [b]) => (db[a]?.fetched ?? 0) - (db[b]?.fetched ?? 0))
    .slice(0, 250);
  let ok = 0;
  let missing = 0;
  let failed = 0;
  for (const [k, t] of queue) {
    try {
      const stats = await fetchLastfmTrack(key, splitArtists(t.artist)[0] ?? t.artist, cleanTitle(t.name));
      db[k] = stats ?? { missing: true, fetched: Date.now() };
      if (stats) ok++;
      else missing++;
    } catch (e) {
      failed++;
      if (/erro (10|26|29)\b/.test((e as Error).message)) break; // chave inválida/suspensa ou limite: para por aqui
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  // limpa o que ninguém atualiza há 30 dias
  for (const [k, v] of Object.entries(db)) if (v.fetched < Date.now() - 30 * 86400_000) delete db[k];
  await writeJson('lastfm.json', db);
  return `lastfm ok (${ok} atualizadas, ${missing} não encontradas, ${failed} falhas, ${Object.keys(db).length} no total)`;
}

// Um país por vez: em paralelo a Apple às vezes segura uma das respostas até estourar o tempo.
const report: string[] = [];
for (const c of countries) report.push(await collectApple(c));
for (const m of Object.keys(kworbMarkets)) report.push(await collectSpotify(m));
await writeJson('spotify/artwork.json', artwork);

// Junta o índice novo ao antigo e descarta o que não aparece em chart há mais de 120 dias.
{
  const old = (await readJson<Record<string, IndexRow>>('tracks.json')) ?? {};
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
  for (const [k, row] of Object.entries(index)) {
    const prev = old[k];
    if (prev) {
      row.mk = [...new Set([...prev.mk, ...row.mk])];
      row.img ??= prev.img;
      row.ap ??= prev.ap;
      row.sp ??= prev.sp;
    }
    old[k] = row;
  }
  for (const [k, row] of Object.entries(old)) if (row.seen < cutoff) delete old[k];
  await writeJson('tracks.json', old);
  report.push(`índice: ${Object.keys(old).length} faixas`);
}
report.push(await collectLastfm());
await writeJson('meta.json', { ran: new Date().toISOString(), report });
for (const line of report) console.log(line.includes('ERRO') ? `::warning::${line}` : line);
