// De onde vêm os dados: rotas /api (Cloudflare) ou JSON estático (GitHub Pages, VITE_STATIC=1).
import type { Chart, HistoryPoint, SpotifyPayload } from './vybe';

export const isStatic = import.meta.env.VITE_STATIC === '1';
const base = import.meta.env.BASE_URL ?? '/';

export type Point = HistoryPoint & { streams?: number | null };
type StaticHistory = { dates: string[]; ranks: Record<string, (number | null)[]>; streams?: Record<string, (number | null)[]> };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal, cache: isStatic ? 'no-cache' : 'default' });
  let d: T & { error?: string };
  try {
    d = (await r.json()) as T & { error?: string };
  } catch {
    throw new Error(r.ok ? 'Resposta inválida' : `Dados indisponíveis (${r.status})`);
  }
  if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
  return d;
}

export const getAppleChart = (country: string, signal?: AbortSignal) =>
  getJson<Chart & { days: number }>(isStatic ? `${base}data/apple/${country}/latest.json` : `/api/chart?country=${country}`, signal);

/** Mercados do Spotify: no Pages, Global + 5 países (kworb); no Cloudflare, só o Global. */
export const spotifyMarkets = isStatic ? ['global', 'br', 'us', 'kr', 'jp', 'gb'] : ['global'];

export async function getSpotifyChart(market = 'global', signal?: AbortSignal): Promise<SpotifyPayload> {
  if (!isStatic) return getJson<SpotifyPayload>('/api/spotify', signal);
  try {
    return await getJson<SpotifyPayload>(`${base}data/spotify/${market}/latest.json`, signal);
  } catch (e) {
    // dados gravados antes da separação por mercado
    if (market === 'global' && (e as Error).name !== 'AbortError') return getJson<SpotifyPayload>(`${base}data/spotify/latest.json`, signal);
    throw e;
  }
}

export type LastfmRow = { listeners: number; playcount: number; url: string; fetched: number } | { missing: true; fetched: number };
let lastfm: Promise<Record<string, LastfmRow>> | null = null;
/** Ouvintes/scrobbles do Last.fm por matchKey (só no Pages; no Cloudflare devolve vazio). */
export function getLastfm(): Promise<Record<string, LastfmRow>> {
  if (!isStatic) return Promise.resolve({});
  lastfm ??= getJson<Record<string, LastfmRow>>(`${base}data/lastfm.json`).catch(() => {
    lastfm = null;
    return {};
  });
  return lastfm;
}

// No Pages o histórico inteiro de um chart vem num arquivo só; guarda em memória entre aberturas.
const historyCache = new Map<string, Promise<StaticHistory>>();
function staticHistory(path: string, signal?: AbortSignal) {
  if (!historyCache.has(path)) {
    const p = getJson<StaticHistory>(`${base}data/${path}`, signal);
    p.catch(() => historyCache.delete(path));
    historyCache.set(path, p);
  }
  return historyCache.get(path)!;
}

function pick(h: StaticHistory, id: string): Point[] {
  const ranks = h.ranks[id] ?? [];
  const streams = h.streams?.[id];
  return h.dates.map((date, i) => ({ date, rank: ranks[i] ?? null, ...(h.streams ? { streams: streams?.[i] ?? null } : {}) }));
}

export async function getAppleHistory(country: string, id: string, signal?: AbortSignal): Promise<Point[]> {
  if (isStatic) return pick(await staticHistory(`apple/${country}/history.json`, signal), id);
  return (await getJson<{ points: Point[] }>(`/api/history?country=${country}&id=${id}`, signal)).points;
}

export async function getSpotifyHistory(chart: string, id: string, signal?: AbortSignal): Promise<Point[]> {
  if (isStatic) return pick(await staticHistory(`spotify/${chart}/history.json`, signal), id);
  return (await getJson<{ points: Point[] }>(`/api/spotify/history?chart=${chart}&id=${id}`, signal)).points;
}

/** Arquivo de histórico inteiro de um chart (só no Pages): base da retrospectiva do mês. */
export function getHistoryFile(path: string, signal?: AbortSignal): Promise<StaticHistory> {
  if (!isStatic) return Promise.reject(new Error('Retrospectiva disponível só na versão do GitHub Pages'));
  return staticHistory(path, signal);
}
