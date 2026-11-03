// Onde os alertas moram no aparelho: feed, foto dos charts e "lido até". Também dispara a notificação do sistema.
import { useSyncExternalStore } from 'react';
import { computeAlerts, type Alert, type Snapshot } from './alerts';
import type { All } from './chart-hits';
import type { Follow } from './follow';
import { wants } from './alert-prefs';

const FEED = 'vybe:alerts';
const SNAP = 'vybe:alerts-snapshot';
const READ = 'vybe:alerts-read';
const EVENT = 'vybe:alerts';
const MAX = 60;

const load = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem espaço/privado */
  }
};

type State = { feed: Alert[]; readAt: number };
let state: State | null = null;
const empty: State = { feed: [], readAt: 0 };

function get(): State {
  state ??= { feed: load<Alert[]>(FEED, []), readAt: load<number>(READ, 0) };
  return state;
}
function set(next: State) {
  state = next;
  save(FEED, next.feed);
  save(READ, next.readAt);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === FEED || e.key === READ) {
      state = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useAlerts() {
  const s = useSyncExternalStore(subscribe, get, () => empty);
  return {
    feed: s.feed,
    unread: s.feed.filter((a) => a.at > s.readAt).length,
    readAt: s.readAt,
    markRead: () => set({ ...get(), readAt: Date.now() }),
    clear: () => set({ feed: [], readAt: Date.now() }),
  };
}

/** Roda a comparação, guarda a foto nova e avisa (no app e, se permitido, no sistema). */
export function runAlertCheck(all: All, follows: Follow[]) {
  if (!Object.keys(all.apple).length && !Object.keys(all.spotify).length) return [];
  const prev = load<Snapshot>(SNAP, {});
  const { alerts: everything, next } = computeAlerts(all, follows, prev);
  save(SNAP, next);
  const alerts = everything.filter((a) => wants(a.kind)); // só o que a pessoa escolheu receber
  if (alerts.length) {
    set({ ...get(), feed: [...alerts, ...get().feed].slice(0, MAX) });
    notify(alerts);
  }
  return alerts;
}

/* ---------- Notificações do sistema ---------- */

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
export const notificationsOn = () => notificationsSupported() && Notification.permission === 'granted' && load<boolean>('vybe:notify', true);

export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported' as const;
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  save('vybe:notify', p === 'granted');
  return p;
}
export const disableNotifications = () => save('vybe:notify', false);

async function notify(alerts: Alert[]) {
  if (!notificationsOn()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const base = import.meta.env.BASE_URL ?? '/';
    const list = alerts.slice(0, 3);
    for (const a of list)
      await reg.showNotification(a.title, {
        body: a.body,
        icon: `${base}icon-192.png`,
        badge: `${base}icon-maskable-192.png`,
        tag: a.id,
        data: { url: `${base}?aba=seguindo` },
      });
    if (alerts.length > list.length)
      await reg.showNotification('vybe', { body: `+${alerts.length - list.length} novidades de quem você segue`, icon: `${base}icon-192.png`, tag: 'vybe-mais', data: { url: `${base}?aba=seguindo` } });
  } catch {
    /* sem SW ativo: fica só no feed */
  }
}

export const NOTIFY_TEST: Alert = {
  id: 'teste',
  at: 0,
  kind: 'no1',
  title: 'Notificações ligadas ✅',
  body: 'Quando alguém que você segue subir no chart, o vybe avisa aqui.',
  follow: 'teste',
};
export const testNotification = () => notify([{ ...NOTIFY_TEST, id: `teste-${Date.now()}` }]);
