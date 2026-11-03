// Utilidades comuns das Edge Functions do vybe.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

export const SITE = Deno.env.get('VYBE_SITE') ?? 'https://luccamottaa.github.io/VYBE/';

const ORIGINS = ['https://luccamottaa.github.io', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://127.0.0.1:4179'];
export function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });

/** Cliente com service role: ignora RLS. Só dentro das funções. */
export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Chaves VAPID: geradas uma vez e guardadas em app_state (a privada nunca sai do servidor). */
export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const db = admin();
  const { data } = await db.from('app_state').select('value').eq('key', 'vapid').maybeSingle();
  if (data?.value?.publicKey) return data.value;
  const webpush = (await import('npm:web-push@3.6.7')).default;
  const keys = webpush.generateVAPIDKeys();
  // insert-or-ignore: se duas chamadas correrem juntas, vale a primeira
  await db.from('app_state').upsert({ key: 'vapid', value: keys }, { onConflict: 'key', ignoreDuplicates: true });
  const { data: again } = await db.from('app_state').select('value').eq('key', 'vapid').single();
  return again!.value;
}
