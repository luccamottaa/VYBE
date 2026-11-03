// POST (com o token do usuário) → apaga a conta e tudo que ela guarda.
// follows, user_settings e push_subscriptions têm ON DELETE CASCADE ligado a auth.users,
// então remover o usuário limpa todos os dados dele de uma vez.
import { admin, cors, json } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Use POST' }, 405);
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(req, { error: 'Entre na conta primeiro' }, 401);
  const db = admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json(req, { error: 'Sessão inválida' }, 401);
  const id = data.user.id;

  // por garantia, apaga explicitamente antes (o cascade cobre o resto)
  await db.from('push_subscriptions').delete().eq('user_id', id);
  await db.from('follows').delete().eq('user_id', id);
  await db.from('user_settings').delete().eq('user_id', id);
  const { error: delError } = await db.auth.admin.deleteUser(id);
  if (delError) return json(req, { error: 'Não deu pra apagar agora. Tenta de novo.' }, 500);
  return json(req, { ok: true });
});
