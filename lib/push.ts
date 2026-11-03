// Push com o app fechado (Web Push). O aparelho se inscreve e manda quem segue + o que quer receber;
// o servidor (Edge Function push-send) compara os charts depois de cada coleta e envia.
// No iPhone só funciona com o vybe instalado na tela de início (iOS 16.4+).
import { getPrefs } from './alert-prefs';
import { getFollows } from './follow';
import { fnUrl, supabase, VAPID_PUBLIC_KEY } from './supabase';

const FLAG = 'vybe:push';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIOS = () => typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
/** iPhone fora do app instalado: o Safari não deixa receber push. */
export const needsInstallForPush = () => isIOS() && !isStandalone();

export const pushOn = () => {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function send(sub: PushSubscription, unsubscribe = false) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(fnUrl(unsubscribe ? 'push-subscribe' : 'push-subscribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(unsubscribe ? { subscription: sub.toJSON(), unsubscribe: true } : { subscription: sub.toJSON(), follows: getFollows(), prefs: getPrefs() }),
  });
  if (!r.ok) throw new Error(`Servidor de push respondeu ${r.status}`);
}

/** Pede permissão, inscreve e registra no servidor. Devolve 'granted' | 'denied' | 'default' | 'unsupported' | 'install'. */
export async function enablePush() {
  if (!pushSupported()) return 'unsupported' as const;
  if (needsInstallForPush()) return 'install' as const;
  const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') return perm;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await send(sub);
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    /* ok */
  }
  return 'granted' as const;
}

export async function disablePush() {
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* ok */
  }
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await send(sub, true).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

let timer = 0;
/** Mantém o servidor com os seguidos/preferências atuais deste aparelho (com atraso pra juntar mudanças). */
export function syncPush() {
  if (!pushOn() || !pushSupported()) return;
  clearTimeout(timer);
  timer = window.setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await send(sub);
    } catch {
      /* tenta de novo na próxima mudança */
    }
  }, 1500);
}
