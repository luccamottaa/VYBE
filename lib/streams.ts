// Streams totais e por dia de qualquer música no Spotify (MyStreamCount), via vybe-api.
import { getApi } from './api-base';

export type StreamsData = { spotifyId: string; total: number | null; history: { date: string; streams: number }[] };
export type StreamsResult = { ok: true; data: StreamsData } | { ok: false; off?: boolean; error: string };

const cache = new Map<string, Promise<StreamsResult>>();

export function getStreams(ids: { spotifyId?: string; name?: string; artist?: string }): Promise<StreamsResult> | null {
  const qs = ids.spotifyId ? `id=${ids.spotifyId}` : ids.name && ids.artist ? `name=${encodeURIComponent(ids.name)}&artist=${encodeURIComponent(ids.artist)}` : null;
  if (!qs) return null;
  if (!cache.has(qs)) {
    const p = (async (): Promise<StreamsResult> => {
      const api = await getApi();
      if (!api.streams) return { ok: false, off: true, error: 'Contagem de streams ainda não configurada.' };
      try {
        const r = await fetch(`${api.url}/api/streams?${qs}`);
        const d = (await r.json()) as StreamsData & { error?: string };
        return r.ok ? { ok: true, data: d } : { ok: false, error: d.error ?? `Erro ${r.status}` };
      } catch {
        return { ok: false, error: 'Contagem de streams indisponível agora.' };
      }
    })();
    p.then((r) => !r.ok && cache.delete(qs));
    cache.set(qs, p);
  }
  return cache.get(qs)!;
}
