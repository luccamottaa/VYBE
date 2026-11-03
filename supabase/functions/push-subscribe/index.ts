// POST { subscription, follows, prefs } → guarda/atualiza a inscrição deste aparelho.
// POST { subscription, unsubscribe: true } → apaga. Com Authorization de usuário, liga à conta.
import { admin, cors, json } from '../_shared/util.ts';

type Body = {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  follows?: unknown[];
  prefs?: Record<string, boolean>;
  unsubscribe?: boolean;
};

const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|web\.push\.apple\.com)\//i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Use POST' }, 405);
  let body: Body;
  try {
    const text = await req.text();
    if (text.length > 200_000) return json(req, { error: 'Grande demais' }, 413);
    body = JSON.parse(text);
  } catch {
    return json(req, { error: 'JSON inválido' }, 400);
  }
  const endpoint = body.subscription?.endpoint ?? '';
  if (!PUSH_HOSTS.test(endpoint) || endpoint.length > 1000) return json(req, { error: 'Inscrição inválida' }, 400);
  const db = admin();

  if (body.unsubscribe) {
    await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return json(req, { ok: true, removed: true });
  }

  const p256dh = body.subscription?.keys?.p256dh ?? '';
  const auth = body.subscription?.keys?.auth ?? '';
  if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) return json(req, { error: 'Chaves inválidas' }, 400);
  const follows = Array.isArray(body.follows) ? body.follows.slice(0, 500) : [];
  const prefs = body.prefs && typeof body.prefs === 'object' ? body.prefs : {};

  // conta opcional: se veio o token do usuário, liga a inscrição a ele
  let user_id: string | null = null;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    const { data } = await db.auth.getUser(token);
    user_id = data.user?.id ?? null;
  }

  const row = { endpoint, p256dh, auth, follows, prefs, updated_at: new Date().toISOString(), ...(user_id ? { user_id } : {}) };
  const { error } = await db.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
  if (error) return json(req, { error: error.message }, 500);
  return json(req, { ok: true, linked: !!user_id });
});
