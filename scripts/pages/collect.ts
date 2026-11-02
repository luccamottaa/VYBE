// Coletor do GitHub Pages: roda na GitHub Action (Node 22+, TypeScript nativo).
//
//   node scripts/pages/collect.ts <pasta-de-dados>
//
// Busca Apple Music (5 países) e Spotify Charts e atualiza, dentro da pasta:
//   apple/<país>/latest.json      ranking atual no mesmo formato de /api/chart
//   apple/<país>/history.json     { dates: [...], ranks: { id: [posição|null por data] } }
//   spotify/latest.json           mesmo formato de /api/spotify
//   spotify/<chart>/history.json  { dates, ranks, streams }
//   meta.json                     quando rodou e o que deu certo
//
// Se uma fonte falhar, o último dado salvo continua lá, marcado como `stale`.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { countries, fetchAppleChart } from '../../lib/sources/apple.ts';
import { fetchSpotifyChart, fillArtwork } from '../../lib/sources/spotify.ts';

const KEEP_DAYS = 120;
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
    const { date, updated, tracks } = await fetchAppleChart(country);
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
    return `apple:${country} ok (${date})`;
  } catch (e) {
    const old = await readJson<Record<string, unknown>>(latestPath);
    if (old) await writeJson(latestPath, { ...old, stale: true });
    return `apple:${country} ERRO ${(e as Error).message}${old ? ' (mantido o último)' : ''}`;
  }
}

async function collectSpotify() {
  const fetched = await fetchSpotifyChart();
  const old = await readJson<{ entries?: { spotifyId: string; artworkUrl: string | null }[] } & Record<string, unknown>>('spotify/latest.json');
  if ('errors' in fetched) {
    if (old) await writeJson('spotify/latest.json', { ...old, stale: true });
    return `spotify ERRO ${fetched.errors.join('; ')}${old ? ' (mantido o último)' : ''}`;
  }
  const result = fetched.result;
  // Sem limite apertado de subrequest aqui: dá pra buscar mais capas por rodada.
  await fillArtwork(result.entries, (old?.entries ?? []) as Parameters<typeof fillArtwork>[1], 80);
  const path = `spotify/${result.chart}/history.json`;
  const history = (await readJson<History>(path)) ?? { dates: [], ranks: {}, streams: {} };
  upsert(history, result.date, result.entries.map((e) => ({ id: e.spotifyId, rank: e.rank, streams: e.streams })), true);
  await writeJson(path, history);
  await writeJson('spotify/latest.json', { ...result, fetched: Date.now(), stale: false, historyAvailable: true });
  return `spotify ok (${result.chart} ${result.date}, via ${result.source})`;
}

const report = [...(await Promise.all(countries.map(collectApple))), await collectSpotify()];
await writeJson('meta.json', { ran: new Date().toISOString(), report });
for (const line of report) console.log(line.includes('ERRO') ? `::warning::${line}` : line);
