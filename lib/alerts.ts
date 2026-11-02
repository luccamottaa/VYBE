// Alertas de quem você segue: compara os charts de agora com a última foto guardada.
// Módulo puro (testado em tests/alerts.test.ts); o armazenamento fica em lib/alerts-store.ts.
import { artistHits, findHits, type All } from './chart-hits.ts';
import { marketLabel, marketName } from './sources/markets.ts';
import type { Follow } from './follow';

export type AlertKind = 'no1' | 'top10' | 'entry' | 'left' | 'milestone' | 'artist-entry' | 'artist-no1';

export type Alert = {
  id: string;
  at: number;
  kind: AlertKind;
  title: string;
  body: string;
  follow: string; // id do follow
  song?: { key: string; name: string; artist: string; artwork?: string; spotifyId?: string; appleId?: string };
  artist?: string;
  market?: string;
};

/** Foto dos charts de cada follow: posição por mercado (músicas) ou "música|mercado" (artistas). */
export type Snapshot = Record<string, { ranks: Record<string, number>; total?: number | null }>;

export const MILESTONES = [10e6, 50e6, 100e6, 250e6, 500e6, 750e6, 1e9, 1.5e9, 2e9, 2.5e9, 3e9, 4e9, 5e9];

export const milestoneLabel = (n: number) => (n >= 1e9 ? `${String(n / 1e9).replace('.', ',')} bi` : `${n / 1e6} mi`);

const fid = (f: Follow) => `${f.kind}:${f.key}`;

export function snapshotOf(all: All, f: Follow): Snapshot[string] {
  if (f.kind === 'song') {
    const hits = findHits(all, { key: f.key, appleId: f.appleId, spotifyId: f.spotifyId });
    return {
      ranks: Object.fromEntries(hits.map((h) => [h.market, h.rank])),
      total: all.spotify.global?.entries.find((e) => hits.some((h) => h.market === 'sp:global' && h.id === e.spotifyId))?.totalStreams ?? null,
    };
  }
  const ranks: Record<string, number> = {};
  for (const s of artistHits(all, f.name)) for (const h of s.hits) ranks[`${s.key}|${h.market}`] = h.rank;
  return { ranks };
}

/**
 * Compara a foto anterior com os charts de agora.
 * Follow sem foto anterior só ganha a foto base (não dispara nada no primeiro dia).
 */
export function computeAlerts(all: All, follows: Follow[], prev: Snapshot, now = Date.now()): { alerts: Alert[]; next: Snapshot } {
  const next: Snapshot = {};
  const alerts: Alert[] = [];
  for (const f of follows) {
    const id = fid(f);
    const cur = snapshotOf(all, f);
    next[id] = cur;
    const old = prev[id];
    if (!old) continue;
    const push = (a: Omit<Alert, 'id' | 'at' | 'follow'>) => alerts.push({ ...a, id: `${id}|${a.kind}|${a.market ?? ''}|${now}`, at: now, follow: id });

    if (f.kind === 'song') {
      const song = { key: f.key, name: f.name, artist: f.artist, artwork: f.artwork, spotifyId: f.spotifyId, appleId: f.appleId };
      for (const [m, rank] of Object.entries(cur.ranks)) {
        const before = old.ranks[m];
        if (rank === 1 && before !== 1)
          push({ kind: 'no1', title: `${f.name} chegou ao #1`, body: `${f.artist} no topo do ${marketName(m)}${before ? ` (antes #${before})` : ''}.`, song, market: m });
        else if (rank <= 10 && (before === undefined || before > 10))
          push({ kind: 'top10', title: `${f.name} entrou no top 10`, body: `#${rank} no ${marketName(m)}${before ? `, subiu de #${before}` : ''}.`, song, market: m });
        else if (before === undefined)
          push({ kind: 'entry', title: `${f.name} entrou num chart novo`, body: `Estreou em #${rank} no ${marketName(m)}.`, song, market: m });
      }
      for (const [m, before] of Object.entries(old.ranks))
        if (cur.ranks[m] === undefined) push({ kind: 'left', title: `${f.name} saiu do ${marketLabel(m)}`, body: `Estava em #${before} no ${marketName(m)}.`, song, market: m });
      if (cur.total && old.total) {
        const passed = MILESTONES.filter((n) => old.total! < n && cur.total! >= n).pop();
        if (passed)
          push({ kind: 'milestone', title: `${f.name} passou de ${milestoneLabel(passed)} de streams`, body: `${f.artist} · total contado no Spotify Global.`, song, market: 'sp:global' });
      }
    } else {
      const split = (k: string) => [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)] as const;
      const seenSongs = new Set(Object.keys(old.ranks).map((k) => split(k)[0]));
      const names = new Map(artistHits(all, f.name).map((s) => [s.key, s]));
      const done = new Set<string>();
      for (const [k, rank] of Object.entries(cur.ranks)) {
        const [songKey, m] = split(k);
        const s = names.get(songKey);
        if (!s) continue;
        const song = { key: s.key, name: s.name, artist: s.artist, artwork: s.artwork, spotifyId: s.spotifyId, appleId: s.appleId };
        if (rank === 1 && old.ranks[k] !== 1)
          push({ kind: 'artist-no1', title: `${f.name} no #1`, body: `${s.name} chegou ao topo do ${marketName(m)}.`, song, artist: f.name, market: m });
        else if (!seenSongs.has(songKey) && !done.has(songKey)) {
          done.add(songKey);
          push({ kind: 'artist-entry', title: `Música nova de ${f.name} nos charts`, body: `${s.name} estreou em #${rank} no ${marketName(m)}.`, song, artist: f.name, market: m });
        }
      }
    }
  }
  return { alerts, next };
}
