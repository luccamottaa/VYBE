// O que a pessoa quer receber de alerta. Fica no aparelho.
import { useSyncExternalStore } from 'react';
import type { AlertKind } from './alerts';

export type PrefKey = 'no1' | 'top10' | 'entry' | 'milestone' | 'left' | 'daily';
export const PREFS: { key: PrefKey; label: string; hint: string; kinds: AlertKind[] }[] = [
  { key: 'no1', label: 'Chegou ao #1', hint: 'Música ou artista que você segue no topo de um chart', kinds: ['no1', 'artist-no1'] },
  { key: 'top10', label: 'Entrou no top 10', hint: 'Subiu pro top 10 em algum chart', kinds: ['top10'] },
  { key: 'entry', label: 'Estreias', hint: 'Entrou num chart novo ou música nova de artista seguido', kinds: ['entry', 'artist-entry'] },
  { key: 'milestone', label: 'Marcos de streams', hint: '100 mi, 500 mi, 1 bi… no Spotify', kinds: ['milestone'] },
  { key: 'left', label: 'Saiu de um chart', hint: 'Avisa quando cai pra fora', kinds: ['left'] },
  // não é um alerta de mudança: é um push de manhã (9h de Brasília) com onde quem você segue está agora
  { key: 'daily', label: 'Resumo do dia', hint: 'Uma notificação por manhã com onde quem você segue está. Precisa das notificações ligadas', kinds: [] },
];
const DEFAULTS: Record<PrefKey, boolean> = { no1: true, top10: true, entry: true, milestone: true, left: false, daily: false };

const KEY = 'vybe:alert-prefs';
const EVENT = 'vybe:alert-prefs';
let cache: Record<PrefKey, boolean> | null = null;

export function getPrefs(): Record<PrefKey, boolean> {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<PrefKey, boolean>>) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setPref(key: PrefKey, on: boolean) {
  cache = { ...getPrefs(), [key]: on };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ok */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Esse tipo de alerta está ligado? */
export const wants = (kind: AlertKind) => PREFS.some((p) => getPrefs()[p.key] && p.kinds.includes(kind));

const sub = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const server = () => DEFAULTS;
export const usePrefs = () => useSyncExternalStore(sub, getPrefs, server);
