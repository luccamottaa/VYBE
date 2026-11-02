// Endereço da vybe-api. O deploy do Worker grava data/api.json; sem ele, usa a Vercel (só histórico, sem busca do Spotify).
import { isStatic } from './data-source';

export const VERCEL_API = 'https://vybe-api-taupe.vercel.app';
const base = import.meta.env.BASE_URL ?? '/';

export type ApiInfo = { url: string; spotifySearch: boolean };

let info: Promise<ApiInfo> | null = null;
export function getApi(): Promise<ApiInfo> {
  info ??= (async () => {
    const fromEnv = import.meta.env.VITE_VYBE_API as string | undefined;
    if (fromEnv) return { url: fromEnv, spotifySearch: true };
    if (isStatic) {
      try {
        const r = await fetch(`${base}data/api.json`, { cache: 'no-cache' });
        if (r.ok) {
          const d = (await r.json()) as { api?: string };
          if (d.api) return { url: d.api.replace(/\/$/, ''), spotifySearch: true };
        }
      } catch {
        /* sem Worker ainda */
      }
    }
    return { url: VERCEL_API, spotifySearch: false };
  })();
  return info;
}
