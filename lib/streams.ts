// Streams totais e por dia de qualquer música no Spotify (MyStreamCount), via vybe-api.
import { getApi } from './api-base';

export type StreamsData = { spotifyId: string; total: number | null; history: { date: string; streams: number }[] };
export type StreamsResult = { ok: true; data: StreamsData; stale?: number } | { ok: false; off?: boolean; quota?: boolean; error: string };

// Cache no aparelho: cada consulta gasta a cota do plano do MyStreamCount. Dentro de 6 h nem pergunta de novo;
// se a API falhar (cota estourada, fora do ar), mostra o último valor conhecido, avisando a idade.
const FRESH_MS = 6 * 3600_000;
const LS = 'vybe:streams:';
const readSaved = (qs: string): { at: number; data: StreamsData } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(LS + qs) ?? 'null');
    return v && typeof v.at === 'number' && v.data ? v : null;
  } catch {
    return null;
  }
};
const save = (qs: string, data: StreamsData) => {
  try {
    localStorage.setItem(LS + qs, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* sem espaço: segue sem guardar */
  }
};

const cache = new Map<string, Promise<StreamsResult>>();

export function getStreams(ids: { spotifyId?: string; name?: string; artist?: string }): Promise<StreamsResult> | null {
  const qs = ids.spotifyId ? `id=${ids.spotifyId}` : ids.name && ids.artist ? `name=${encodeURIComponent(ids.name)}&artist=${encodeURIComponent(ids.artist)}` : null;
  if (!qs) return null;
  if (!cache.has(qs)) {
    const p = (async (): Promise<StreamsResult> => {
      const saved = readSaved(qs);
      if (saved && Date.now() - saved.at < FRESH_MS) return { ok: true, data: saved.data };
      const api = await getApi();
      if (!api.streams) return { ok: false, off: true, error: 'Contagem de streams ainda não configurada.' };
      const fallback = (error: string, quota = false): StreamsResult => (saved ? { ok: true, data: saved.data, stale: saved.at } : { ok: false, quota, error });
      try {
        const r = await fetch(`${api.url}/api/streams?${qs}`);
        const d = (await r.json()) as StreamsData & { error?: string; quota?: boolean };
        if (r.ok) {
          save(qs, d);
          return { ok: true, data: d };
        }
        return r.status === 429 || d.quota ? fallback('O contador de streams bateu o limite por agora e volta em breve.', true) : fallback(d.error ?? `Erro ${r.status}`);
      } catch {
        return fallback('Contagem de streams indisponível agora.');
      }
    })();
    // falha passageira tenta de novo na próxima abertura; cota estourada ou valor guardado ficam até recarregar
    p.then((r) => !r.ok && !r.quota && cache.delete(qs));
    cache.set(qs, p);
  }
  return cache.get(qs)!;
}
