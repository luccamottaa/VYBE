// Avatar do perfil: um dos 12 do vybe (public/avatars) ou a foto do Google. Com conta, fica no perfil
// (user_metadata, igual em todo aparelho); sem conta, só neste aparelho.
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const AVATARS = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}`);
export const avatarUrl = (id: string) => `${import.meta.env.BASE_URL ?? '/'}avatars/${id}.webp`;

const KEY = 'vybe:avatar';

export function currentAvatar(session: Session | null): string | null {
  const meta = session?.user.user_metadata as { vybe_avatar?: string; avatar_url?: string; picture?: string } | undefined;
  if (meta?.vybe_avatar && AVATARS.includes(meta.vybe_avatar)) return avatarUrl(meta.vybe_avatar);
  try {
    const local = localStorage.getItem(KEY);
    if (local && AVATARS.includes(local)) return avatarUrl(local);
  } catch {
    /* ok */
  }
  return meta?.avatar_url ?? meta?.picture ?? null;
}

export async function chooseAvatar(id: string, session: Session | null) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ok */
  }
  if (session) await supabase.auth.updateUser({ data: { vybe_avatar: id } });
  window.dispatchEvent(new Event('vybe:avatar'));
}
