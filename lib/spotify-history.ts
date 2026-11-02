// Histórico completo de uma música nos charts do Spotify (desde a 1ª entrada), via vybe-api (Vercel → kworb).

import { getApi } from './api-base';

export type ChartTable = {
  dates: string[];
  pos: Record<string, (number | null)[]>;
  streams: Record<string, (number | null)[]>;
  total: Record<string, number | null>;
  peak: Record<string, { pos: number; streams: number | null }>;
};

export type AllTime = {
  spotifyId: string;
  name: string | null;
  artist: string | null;
  source: string;
  firstDate: string;
  lastDate: string;
  daily: ChartTable | null;
  weekly: ChartTable | null;
};

export type AllTimeResult = { ok: true; data: AllTime } | { ok: false; notFound: boolean; error: string };

const cache = new Map<string, Promise<AllTimeResult>>();

/** Busca pelo id do Spotify; sem ele, por nome + artista (a API acha o id pela busca oficial do Spotify). */
export function getAllTime(ids: { spotifyId?: string; name?: string; artist?: string }): Promise<AllTimeResult> | null {
  const qs = ids.spotifyId
    ? `id=${ids.spotifyId}`
    : ids.name && ids.artist
      ? `name=${encodeURIComponent(ids.name)}&artist=${encodeURIComponent(ids.artist)}`
      : null;
  if (!qs) return null;
  if (!cache.has(qs)) {
    const p = (async (): Promise<AllTimeResult> => {
      try {
        const api = await getApi();
        if (!ids.spotifyId && !api.spotifySearch) return { ok: false, notFound: true, error: 'Não deu pra identificar essa música no Spotify.' };
        const r = await fetch(`${api.url}/api/track?${qs}&m=global,br,us,kr,jp,gb`);
        const d = (await r.json()) as AllTime & { error?: string };
        if (r.ok) return { ok: true, data: d };
        return { ok: false, notFound: r.status === 404, error: d.error ?? `Erro ${r.status}` };
      } catch {
        return { ok: false, notFound: false, error: 'Histórico do Spotify indisponível agora.' };
      }
    })();
    p.then((res) => !res.ok && !res.notFound && cache.delete(qs));
    cache.set(qs, p);
  }
  return cache.get(qs)!;
}
