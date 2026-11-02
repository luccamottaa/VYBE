// Last.fm: ouvintes e scrobbles por faixa. API oficial e gratuita (precisa de chave: LASTFM_API_KEY).
// https://www.last.fm/api/show/track.getInfo — limite recomendado: até 5 chamadas por segundo.
// Módulo puro, usado pelo coletor do Pages.

export type LastfmStats = { listeners: number; playcount: number; url: string; fetched: number };

const API = 'https://ws.audioscrobbler.com/2.0/';

/** Busca ouvintes/scrobbles de uma faixa. null quando o Last.fm não conhece a faixa. */
export async function fetchLastfmTrack(apiKey: string, artist: string, track: string): Promise<LastfmStats | null> {
  const qs = new URLSearchParams({ method: 'track.getInfo', api_key: apiKey, artist, track, autocorrect: '1', format: 'json' });
  const r = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': 'vybe-charts/1.0' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Last.fm respondeu ${r.status}`);
  const d = (await r.json()) as { error?: number; message?: string; track?: { listeners?: string; playcount?: string; url?: string } };
  if (d.error === 6) return null; // faixa não encontrada
  if (d.error) throw new Error(`Last.fm erro ${d.error}: ${d.message}`);
  const listeners = Number(d.track?.listeners);
  const playcount = Number(d.track?.playcount);
  if (!Number.isFinite(listeners) || !Number.isFinite(playcount)) return null;
  return { listeners, playcount, url: String(d.track?.url ?? ''), fetched: Date.now() };
}
