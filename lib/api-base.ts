// Endereço da vybe-api (Vercel). /api/health diz se a busca do Spotify já está configurada.
export const VYBE_API = (import.meta.env.VITE_VYBE_API as string | undefined)?.replace(/\/$/, '') ?? 'https://vybe-api-taupe.vercel.app';

export type ApiInfo = { url: string; spotifySearch: boolean };

let info: Promise<ApiInfo> | null = null;
export function getApi(): Promise<ApiInfo> {
  info ??= fetch(`${VYBE_API}/api/health`)
    .then((r) => (r.ok ? (r.json() as Promise<{ spotify?: boolean }>) : {}))
    .then((d: { spotify?: boolean }) => ({ url: VYBE_API, spotifySearch: !!d.spotify }))
    .catch(() => {
      info = null; // tenta de novo na próxima
      return { url: VYBE_API, spotifySearch: false };
    });
  return info;
}
