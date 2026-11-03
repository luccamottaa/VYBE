'use client';

import { useEffect, useState } from 'react';
import { Check, Cloud, LogOut, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AVATARS, avatarUrl, chooseAvatar, currentAvatar } from '@/lib/avatar';
import { deleteAccount, signInWithGoogle, signOut, useSession } from '@/lib/supabase';
import { cn } from '@/lib/utils';

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Avatar atual (redondo com anel), atualiza quando troca. */
export function useAvatar() {
  const { session } = useSession();
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener('vybe:avatar', on);
    return () => window.removeEventListener('vybe:avatar', on);
  }, []);
  return { session, url: currentAvatar(session) };
}

export function AvatarPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { session, url } = useAvatar();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Escolha seu avatar</DialogTitle>
          <DialogDescription className="text-slate-400">{session ? 'Fica salvo na sua conta.' : 'Fica salvo neste aparelho.'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {AVATARS.map((id) => {
            const on = url === avatarUrl(id);
            return (
              <button
                key={id}
                onClick={async () => {
                  await chooseAvatar(id, session);
                  onOpenChange(false);
                }}
                aria-label={`Avatar ${Number(id)}`}
                aria-pressed={on}
                className={cn('vy-press relative rounded-full p-[3px] transition-all', on ? 'bg-[conic-gradient(from_200deg,#22d3ee,#3b82f6,#a855f7,#ec4899,#22d3ee)]' : 'bg-slate-800 hover:bg-slate-700')}
              >
                <img src={avatarUrl(id)} alt="" loading="lazy" className="aspect-square w-full rounded-full bg-slate-900" />
                {on && (
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-cyan-400 p-0.5 text-[#020617] ring-2 ring-popover">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de excluir a conta: apaga tudo no servidor e sai. */
function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-slate-800 bg-popover text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Excluir sua conta?</DialogTitle>
          <DialogDescription className="text-slate-400">
            Isso apaga na hora quem você segue, seus alertas, o layout do início, o avatar e os avisos com o app fechado. Não dá pra desfazer. O vybe continua funcionando sem conta, só que sem a sincronização.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button disabled={busy} onClick={() => onOpenChange(false)} className="rounded-full border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800">
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await deleteAccount();
                onOpenChange(false);
              } catch (e) {
                setError((e as Error).message || 'Não deu pra apagar agora.');
                setBusy(false);
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" /> {busy ? 'Apagando…' : 'Excluir tudo'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cartão da conta na aba Seguindo. */
export function AccountCard() {
  const { session, url } = useAvatar();
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const user = session?.user;
  const name = (user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined) ?? user?.email?.split('@')[0];

  return (
    <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-4 sm:p-5">
      <button onClick={() => setPicker(true)} aria-label="Trocar avatar" className="vy-press group relative shrink-0 rounded-full bg-[conic-gradient(from_200deg,#22d3ee,#3b82f6,#a855f7,#ec4899,#22d3ee)] p-[3px]">
        {url ? (
          <img src={url} alt="" className="h-16 w-16 rounded-full bg-slate-900 object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-2xl">🎧</span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-slate-900 p-1 text-cyan-300 ring-2 ring-slate-950">
          <Pencil className="h-3 w-3" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        {user ? (
          <>
            <p className="truncate text-base font-extrabold text-white">{name}</p>
            <p className="flex items-center gap-1 truncate text-xs text-emerald-400">
              <Cloud className="h-3.5 w-3.5" /> Seguidos e alertas sincronizados
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-extrabold text-white">Entre na sua conta</p>
            <p className="text-xs text-slate-400">Quem você segue em todos os aparelhos e alertas com o app fechado.</p>
          </>
        )}
        {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
      </div>
      {user ? (
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
          <button onClick={() => setConfirmDelete(true)} className="text-[0.6875rem] font-medium text-slate-500 underline-offset-2 hover:text-rose-300 hover:underline">
            Excluir minha conta
          </button>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await signInWithGoogle();
            } catch (e) {
              setError((e as Error).message || 'Não deu pra entrar agora.');
              setBusy(false);
            }
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ffffff] px-4 py-2.5 text-sm font-bold text-[#1f2937] shadow-lg transition-transform active:scale-95 disabled:opacity-60 sm:w-auto"
        >
          <GoogleG /> Entrar com Google
        </button>
      )}
      <AvatarPicker open={picker} onOpenChange={setPicker} />
      <DeleteAccountDialog open={confirmDelete} onOpenChange={setConfirmDelete} />
    </div>
  );
}
