// Ordem e visibilidade das seções do início. Fica no aparelho.
import { useSyncExternalStore } from 'react';

export type HomeSection = 'hero' | 'spotlight' | 'artists' | 'ranking';
export const SECTION_LABEL: Record<HomeSection, string> = {
  hero: 'O #1 em destaque',
  spotlight: 'Agora no vybe (cards)',
  artists: 'Artistas do momento',
  ranking: 'Top 100',
};
export type Layout = { order: HomeSection[]; hidden: HomeSection[] };
export const DEFAULT_LAYOUT: Layout = { order: ['hero', 'spotlight', 'artists', 'ranking'], hidden: [] };

const KEY = 'vybe:home-layout';
const EVENT = 'vybe:home-layout';
let cache: Layout | null = null;

/** Lê e conserta (seção nova entra no fim; seção que não existe mais sai). Exportada pra teste. */
export function normalizeLayout(raw: Partial<Layout> | null | undefined): Layout {
  const all = DEFAULT_LAYOUT.order;
  const order = (raw?.order ?? []).filter((s, i, a): s is HomeSection => all.includes(s as HomeSection) && a.indexOf(s) === i);
  for (const s of all) if (!order.includes(s)) order.push(s);
  const hidden = (raw?.hidden ?? []).filter((s): s is HomeSection => all.includes(s as HomeSection));
  // o ranking nunca some de vez: é o coração do app
  return { order, hidden: hidden.filter((s) => s !== 'ranking') };
}

export function getLayout(): Layout {
  if (cache) return cache;
  try {
    cache = normalizeLayout(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    cache = DEFAULT_LAYOUT;
  }
  return cache;
}

export function setLayout(next: Layout) {
  cache = normalizeLayout(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ok */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function move(layout: Layout, s: HomeSection, dir: -1 | 1): Layout {
  const order = [...layout.order];
  const i = order.indexOf(s);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return layout;
  [order[i], order[j]] = [order[j], order[i]];
  return { ...layout, order };
}

export function toggle(layout: Layout, s: HomeSection): Layout {
  const hidden = layout.hidden.includes(s) ? layout.hidden.filter((x) => x !== s) : [...layout.hidden, s];
  return { ...layout, hidden };
}

const sub = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const server = () => DEFAULT_LAYOUT;
export const useLayout = () => useSyncExternalStore(sub, getLayout, server);
