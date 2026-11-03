// Conta (login com Google) e push com o app fechado, no projeto "vybe" do Supabase.
// A chave abaixo é a publicável: feita pra ficar no site. O que protege os dados são as regras (RLS) do banco.
import { createClient, type Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://gpwlltfgkaaiqofytuzs.supabase.co';
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_TxW4LFJRdYbvReIVKI2QLA_G3r1Xnp0';
export const VAPID_PUBLIC_KEY = 'BHRG7Fvvnw-Cc1JT3mbsfrkhDgwZ-RtxLulGbwSykMT2oGOX2wm535ocxRO8FoDAepeuN8FCfA2Bj5N5opLbydY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'vybe:auth' },
});

export const fnUrl = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

/** Sessão atual (null = sem conta). Atualiza sozinho ao entrar/sair. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { session, ready };
}

export async function signInWithGoogle() {
  const base = import.meta.env.BASE_URL ?? '/';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${base}?aba=seguindo` },
  });
  if (error) throw error;
}

export const signOut = () => supabase.auth.signOut();

/** Apaga a conta (e todos os dados dela) no servidor e desconecta este aparelho. */
export async function deleteAccount() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Entre na conta primeiro.');
  const res = await fetch(fnUrl('account-delete'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY } });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error || 'Não deu pra apagar agora.');
  try {
    localStorage.removeItem('vybe:push');
    localStorage.removeItem('vybe:avatar');
  } catch {
    /* ok */
  }
  await supabase.auth.signOut({ scope: 'local' });
}
