// Artistas e músicas que a pessoa segue. Fica só no aparelho (localStorage), sem login.
import { useSyncExternalStore } from 'react';

export type Follow =
  | { kind: 'song'; key: string; name: string; artist: string; artwork?: string; spotifyId?: string; appleId?: string; at: number }
  | { kind: 'artist'; key: string; name: string; artwork?: string; artistId?: string; at: number };

const KEY = 'vybe:follows';
const EVENT = 'vybe:follows';
let cache: Follow[] | null = null;

function read(): Follow[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = Array.isArray(v) ? v : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: Follow[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* modo privado: fica só na memória */
  }
  window.dispatchEvent(new Event(EVENT));
}

export const artistKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

export const followId = (f: Pick<Follow, 'kind' | 'key'>) => `${f.kind}:${f.key}`;

export function getFollows() {
  return typeof window === 'undefined' ? [] : read();
}

export function isFollowing(kind: Follow['kind'], key: string) {
  return getFollows().some((f) => f.kind === kind && f.key === key);
}

/** Liga/desliga. Devolve true se passou a seguir. */
export function toggleFollow(f: Follow) {
  const list = getFollows();
  const on = list.some((x) => followId(x) === followId(f));
  write(on ? list.filter((x) => followId(x) !== followId(f)) : [{ ...f, at: Date.now() }, ...list]);
  return !on;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
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

const empty: Follow[] = [];
export function useFollows() {
  return useSyncExternalStore(subscribe, read, () => empty);
}
