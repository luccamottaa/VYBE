// Endereço da vybe-api (Vercel). /api/health diz se a busca do Spotify já está configurada.
export const VYBE_API = (import.meta.env.VITE_VYBE_API as string | undefined)?.replace(/\/$/, '') ?? 'https://vybe-api-taupe.vercel.app';

export type ApiInfo = { url: string; spotifySearch: boolean; streams: boolean };

let info: Promise<ApiInfo> | null = null;
export function getApi(): Promise<ApiInfo> {
  info ??= fetch(`${VYBE_API}/api/health`)
    .then((r) => (r.ok ? (r.json() as Promise<{ spotify?: boolean; streams?: boolean }>) : {}))
    .then((d: { spotify?: boolean; streams?: boolean }) => ({ url: VYBE_API, spotifySearch: !!d.spotify, streams: !!d.streams }))
    .catch(() => {
      info = null; // tenta de novo na próxima
      return { url: VYBE_API, spotifySearch: false, streams: false };
    });
  return info;
}
