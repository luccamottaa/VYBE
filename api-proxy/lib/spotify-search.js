// Busca oficial do Spotify (Web API) com o fluxo Client Credentials: a chave fica só no servidor.
// Sem dependência de plataforma (só fetch). Desde fev/2026, apps em Development Mode:
//   - precisam de dono com Premium;
//   - a busca devolve no máximo 10 itens por página (paginar com offset).

let token = null; // { value, expires } — reaproveitado enquanto a instância viver

async function getToken(clientId, clientSecret) {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw Object.assign(new Error(`Spotify recusou a chave do app (${r.status} ${d.error ?? ''})`.trim()), { status: 502 });
  token = { value: d.access_token, expires: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return token.value;
}

const img = (images, size = 300) => {
  if (!Array.isArray(images) || !images.length) return null;
  return [...images].sort((a, b) => Math.abs((a.width ?? 0) - size) - Math.abs((b.width ?? 0) - size))[0]?.url ?? null;
};

const toTrack = (t) => ({
  spotifyId: t.id,
  name: t.name,
  artist: (t.artists ?? []).map((a) => a.name).join(', '),
  artists: (t.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
  album: t.album?.name ?? null,
  artwork: img(t.album?.images),
  releaseDate: t.album?.release_date ?? null,
  preview: t.preview_url ?? null,
  url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
  explicit: !!t.explicit,
});

const toArtist = (a) => ({
  spotifyId: a.id,
  name: a.name,
  picture: img(a.images, 160),
  genres: Array.isArray(a.genres) ? a.genres.slice(0, 3) : [],
  followers: a.followers?.total ?? null,
  url: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}`,
});

/**
 * query: { q, type = 'track' | 'artist', offset = 0, market = 'BR' }
 * env:   { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET }
 * → { status, body, cache }
 */
export async function spotifySearch(query, env) {
  const out = (status, body, cache = status === 200) => ({ status, body, cache });
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return out(503, { error: 'Busca do Spotify não configurada (faltam SPOTIFY_CLIENT_ID/SECRET).' });
  const q = String(query.q ?? '').trim().slice(0, 200);
  if (q.length < 2) return out(400, { error: 'Busca muito curta.' });
  const type = query.type === 'artist' ? 'artist' : 'track';
  const offset = Math.max(0, Math.min(990, Number.parseInt(query.offset ?? '0', 10) || 0));
  const market = /^[A-Z]{2}$/.test(String(query.market ?? '')) ? query.market : 'BR';

  try {
    const call = async () => {
      const t = await getToken(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);
      const qs = new URLSearchParams({ q, type, limit: '10', offset: String(offset), market });
      return fetch(`https://api.spotify.com/v1/search?${qs}`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(10000) });
    };
    let r = await call();
    if (r.status === 401) {
      token = null; // token vencido/revogado: tenta de novo uma vez
      r = await call();
    }
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) return out(429, { error: 'Limite da API do Spotify atingido, tenta de novo daqui a pouco.', retryAfter: r.headers.get('retry-after') }, false);
    if (!r.ok) return out(502, { error: `Spotify respondeu ${r.status}`, detail: d?.error?.message ?? d?.error ?? null }, false);
    const page = type === 'artist' ? d.artists : d.tracks;
    const items = (page?.items ?? []).filter(Boolean).map(type === 'artist' ? toArtist : toTrack);
    const total = page?.total ?? items.length;
    const next = page?.next && offset + 10 < Math.min(total, 1000) ? offset + 10 : null;
    return out(200, { type, q, offset, total, next, items });
  } catch (e) {
    return out(e.status ?? 502, { error: e.message ?? 'Falha na busca do Spotify' }, false);
  }
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

/** Acha o id do Spotify de uma música pelo nome + artista (melhor resultado da busca oficial). */
export async function findSpotifyId(name, artist, env) {
  const first = String(artist).split(/,|&| feat\.? | ft\.? | x /i)[0].trim();
  const tries = [`track:"${name}" artist:"${first}"`, `${name} ${first}`];
  for (const q of tries) {
    const { status, body } = await spotifySearch({ q, type: 'track', market: 'US' }, env);
    if (status !== 200) continue;
    const n = norm(name);
    const a = norm(first);
    const hit =
      body.items.find((t) => norm(t.name) === n && t.artists.some((x) => norm(x.name) === a)) ??
      body.items.find((t) => norm(t.name) === n);
    if (hit) return hit.spotifyId;
  }
  return null;
}
