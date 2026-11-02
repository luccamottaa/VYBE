// Streams totais de qualquer música no Spotify, via MyStreamCount ("Spotify Stream Count" no RapidAPI).
//   - atual:     total de streams que o Spotify mostra hoje (resposta: { streams: "159502124" })
//   - histórico: um ponto por dia com o total daquele dia
// Env: RAPIDAPI_KEY (obrigatória). Opcionais: MSC_CURRENT_PATH e MSC_HISTORY_PATH ({id} vira o trackId).
// Sem os caminhos configurados, descobre sozinho testando formatos comuns (o RapidAPI responde 404
// "endpoint does not exist" pros errados) e guarda o que funcionou enquanto a função estiver viva.

export const MSC_HOST = 'spotify-stream-count.p.rapidapi.com';

const CURRENT_CANDIDATES = [
  '/v1/spotify/tracks/{id}/streams/current',
  '/v1/spotify/tracks/{id}/streams',
  '/v1/tracks/{id}/streams/current',
  '/v1/tracks/{id}/streams',
  '/tracks/{id}/streams/current',
  '/tracks/{id}/streams',
  '/tracks/{id}/current',
  '/tracks/{id}',
  '/track/{id}',
  '/streams/{id}',
  '/current/{id}',
  '/stream-count/{id}',
  '/{id}',
];
// Doc do RapidAPI: o histórico recebe trackId como query param.
const HISTORY_CANDIDATES = [
  '/v1/spotify/tracks/streams/historical?trackId={id}',
  '/v1/spotify/tracks/historical?trackId={id}',
  '/v1/spotify/streams/historical?trackId={id}',
  '/v1/spotify/tracks/streams/history?trackId={id}',
  '/v1/spotify/historical?trackId={id}',
  '/v1/spotify/tracks/{id}/streams/historical',
  '/v1/spotify/tracks/{id}/streams/history',
  '/v1/tracks/{id}/streams/historical',
  '/tracks/{id}/streams/historical',
  '/tracks/{id}/streams/history',
  '/historical?trackId={id}',
  '/history?trackId={id}',
  '/streams/historical?trackId={id}',
  '/streams/history?trackId={id}',
  '/tracks/historical?trackId={id}',
  '/tracks/history?trackId={id}',
  '/?trackId={id}',
];

let found = { current: null, history: null };

async function call(path, id, key) {
  const r = await fetch(`https://${MSC_HOST}${path.replace('{id}', encodeURIComponent(id))}`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': MSC_HOST },
    signal: AbortSignal.timeout(12000),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* não-JSON */
  }
  // endpoint inexistente no RapidAPI: 404 com "does not exist"
  const missing = r.status === 404 && /does not exist|not exist|no route|not found/i.test(text) && !(json && 'streams' in json);
  return { status: r.status, json, text: text.slice(0, 300), missing };
}

/** Usa o caminho configurado/descoberto; senão testa os candidatos. Devolve { res, path, tried }. */
async function resolve(kind, id, env) {
  const configured = kind === 'current' ? env.MSC_CURRENT_PATH : env.MSC_HISTORY_PATH;
  const list = configured ? [configured] : found[kind] ? [found[kind]] : kind === 'current' ? CURRENT_CANDIDATES : HISTORY_CANDIDATES;
  const tried = [];
  for (const path of list) {
    const res = await call(path, id, env.RAPIDAPI_KEY);
    tried.push({ path, status: res.status, sample: res.missing ? 'endpoint inexistente' : res.text.slice(0, 120) });
    if (res.status === 401 || res.status === 403) return { res, path, tried }; // chave/assinatura: não adianta seguir
    const usable = kind === 'history' ? res.status === 200 : !res.missing;
    if (usable) {
      if (!configured) found[kind] = path;
      return { res, path, tried };
    }
    if (res.status === 429) return { res, path, tried };
  }
  return { res: null, path: null, tried };
}

const toNum = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};
const toDate = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000).toISOString().slice(0, 10);
  const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = Date.parse(String(v));
  return Number.isFinite(d) ? new Date(d).toISOString().slice(0, 10) : null;
};

/** Aceita lista de pontos ({date, streams} com nomes variados) ou mapa data → valor. */
export function normalizeHistory(json) {
  const arr = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.history) ? json.history : Array.isArray(json?.streams) ? json.streams : null;
  let points = [];
  if (arr) {
    for (const p of arr) {
      if (Array.isArray(p)) {
        const date = toDate(p[0]);
        const streams = toNum(p[1]);
        if (date && streams !== null) points.push({ date, streams });
        continue;
      }
      if (!p || typeof p !== 'object') continue;
      const dk = Object.keys(p).find((k) => /date|day|time|timestamp/i.test(k));
      const sk = Object.keys(p).find((k) => /stream|count|plays|value|total/i.test(k));
      const date = toDate(dk ? p[dk] : null);
      const streams = toNum(sk ? p[sk] : null);
      if (date && streams !== null) points.push({ date, streams });
    }
  } else if (json && typeof json === 'object') {
    const map = json.history && typeof json.history === 'object' ? json.history : json;
    for (const [k, v] of Object.entries(map)) {
      const date = toDate(k);
      const streams = toNum(v);
      if (date && streams !== null) points.push({ date, streams });
    }
  }
  const byDate = new Map(points.map((p) => [p.date, p.streams]));
  points = [...byDate.entries()].map(([date, streams]) => ({ date, streams })).sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * query: { id?, name?, artist?, history? ('0' pula o histórico) }
 * findId: (name, artist) => Promise<string|null>
 * → { status, body, cache }
 */
export async function trackStreams(query, env, findId) {
  const out = (status, body, cache = status === 200) => ({ status, body, cache });
  if (!env.RAPIDAPI_KEY) return out(503, { error: 'Streams não configurados (falta RAPIDAPI_KEY na Vercel).' }, false);
  let id = String(query.id ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!id && query.name && query.artist && findId) id = (await findId(String(query.name).slice(0, 200), String(query.artist).slice(0, 200))) ?? '';
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return out(id ? 400 : 404, { error: id ? 'id do Spotify inválido.' : 'Não achei essa música no Spotify.' });

  const [cur, hist] = await Promise.all([resolve('current', id, env), query.history === '0' ? null : resolve('history', id, env)]);
  if (cur.res && (cur.res.status === 401 || cur.res.status === 403))
    return out(502, { error: 'O RapidAPI recusou a chave (confira a RAPIDAPI_KEY e a assinatura do plano).', detail: cur.res.text }, false);
  if (cur.res?.status === 429) return out(429, { error: 'Limite do plano do MyStreamCount atingido, tenta mais tarde.' }, false);

  const total = toNum(cur.res?.json?.streams ?? cur.res?.json?.streamCount ?? cur.res?.json?.count);
  const history = hist?.res && hist.res.status === 200 ? normalizeHistory(hist.res.json) : [];
  if (total === null && !history.length) {
    const status = cur.res?.status === 404 ? 404 : 502;
    return out(status, { spotifyId: id, error: status === 404 ? 'Sem contagem de streams pra essa música (precisa de mais de 1.000 plays).' : 'MyStreamCount não respondeu como esperado.', tried: { current: cur.tried, history: hist?.tried } }, false);
  }
  return out(200, {
    spotifyId: id,
    total: total ?? history.at(-1)?.streams ?? null,
    history,
    source: 'MyStreamCount',
    paths: { current: cur.path, history: hist?.path ?? null },
    // diagnóstico enquanto o formato do histórico não estiver confirmado
    ...(history.length ? {} : { historyDebug: hist ? { tried: hist.tried, sample: hist.res?.text ?? null } : null }),
  });
}
