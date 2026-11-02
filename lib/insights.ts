// Destaques automáticos a partir dos charts carregados + retrospectiva do mês a partir do histórico.
// Módulo puro (sem rede e sem navegador): testado em tests/insights.test.ts.
import { matchKey, splitArtists } from './sources/match.ts';
import { marketLabel } from './sources/markets.ts';
import type { All } from './chart-hits';

export type InsightSong = {
  key: string;
  name: string;
  artist: string;
  artwork?: string;
  spotifyId?: string;
  appleId?: string;
};

type Row = InsightSong & { market: string; rank: number; change: number | null; isNew: boolean; streams?: number | null; total?: number | null };

/** Todas as linhas de todos os charts, num formato só. */
export function allRows(all: All): Row[] {
  const rows: Row[] = [];
  for (const [cc, chart] of Object.entries(all.apple))
    for (const t of chart.tracks)
      rows.push({
        key: matchKey(t.name, t.artistName),
        name: t.name,
        artist: t.artistName,
        artwork: t.artworkUrl100,
        appleId: t.id,
        market: `ap:${cc}`,
        rank: t.rank,
        change: chart.previousDate ? t.change : null,
        isNew: !!chart.previousDate && !!t.isNew,
      });
  for (const [m, chart] of Object.entries(all.spotify))
    for (const e of chart.entries)
      rows.push({
        key: matchKey(e.trackName, e.artist),
        name: e.trackName,
        artist: e.artist,
        artwork: e.artworkUrl ?? undefined,
        spotifyId: e.spotifyId,
        market: `sp:${m}`,
        rank: e.rank,
        change: e.previousRank === null ? null : e.previousRank - e.rank,
        isNew: e.entryStatus ? e.entryStatus === 'NEW_ENTRY' : e.previousRank === null && (e.daysOnChart ?? 1) <= 1,
        streams: e.streams,
        total: e.totalStreams ?? null,
      });
  return rows;
}

function songOf(rows: Row[]): InsightSong {
  const r = rows[0];
  return {
    key: r.key,
    name: r.name,
    artist: r.artist,
    artwork: rows.find((x) => x.artwork)?.artwork,
    spotifyId: rows.find((x) => x.spotifyId)?.spotifyId,
    appleId: rows.find((x) => x.appleId)?.appleId,
  };
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

export type Insights = {
  markets: number;
  /** músicas em mais charts ao mesmo tempo */
  everywhere: (InsightSong & { count: number; best: number; markets: string[] })[];
  /** artistas com mais faixas somando todos os charts */
  artists: { name: string; entries: number; songs: number; markets: number; artwork?: string }[];
  /** quem está em #1 em cada chart */
  numberOnes: (InsightSong & { market: string; label: string })[];
  /** maiores subidas (uma por música, a maior entre os charts) */
  climbers: (InsightSong & { change: number; rank: number; label: string })[];
  /** estreias, pela melhor posição de entrada */
  debuts: (InsightSong & { rank: number; label: string })[];
  /** Spotify Brasil × Global */
  brazil: {
    onlyHere: (InsightSong & { rank: number })[];
    missingHere: (InsightSong & { rank: number })[];
    shared: number;
  } | null;
  /** maiores totais acumulados no Spotify Global */
  giants: (InsightSong & { total: number; rank: number })[];
};

export function buildInsights(all: All): Insights {
  const rows = allRows(all);
  const bySong = new Map<string, Row[]>();
  for (const r of rows) (bySong.get(r.key) ?? bySong.set(r.key, []).get(r.key)!).push(r);
  const markets = new Set(rows.map((r) => r.market)).size;

  const everywhere = [...bySong.values()]
    .map((rs) => {
      const ms = [...new Set(rs.map((r) => r.market))];
      return { ...songOf(rs), count: ms.length, best: Math.min(...rs.map((r) => r.rank)), markets: ms.sort() };
    })
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count || a.best - b.best)
    .slice(0, 8);

  const artistMap = new Map<string, { name: string; entries: number; songs: Set<string>; markets: Set<string>; artwork?: string }>();
  for (const r of rows)
    for (const a of splitArtists(r.artist)) {
      const k = norm(a);
      const row = artistMap.get(k) ?? artistMap.set(k, { name: a, entries: 0, songs: new Set(), markets: new Set() }).get(k)!;
      row.entries++;
      row.songs.add(r.key);
      row.markets.add(r.market);
      row.artwork ??= r.artwork;
    }
  const artists = [...artistMap.values()]
    .map((a) => ({ name: a.name, entries: a.entries, songs: a.songs.size, markets: a.markets.size, artwork: a.artwork }))
    .sort((a, b) => b.entries - a.entries || b.markets - a.markets || a.name.localeCompare(b.name))
    .slice(0, 6);

  const numberOnes = rows
    .filter((r) => r.rank === 1)
    .sort((a, b) => a.market.localeCompare(b.market))
    .map((r) => ({ ...songOf(bySong.get(r.key)!), market: r.market, label: marketLabel(r.market) }));

  const bestBy = <T extends Row>(list: T[], score: (r: T) => number) => {
    const out = new Map<string, T>();
    for (const r of list) {
      const cur = out.get(r.key);
      if (!cur || score(r) > score(cur)) out.set(r.key, r);
    }
    return [...out.values()].sort((a, b) => score(b) - score(a));
  };

  const climbers = bestBy(
    rows.filter((r) => (r.change ?? 0) > 0),
    (r) => r.change ?? 0,
  )
    .slice(0, 6)
    .map((r) => ({ ...songOf(bySong.get(r.key)!), change: r.change ?? 0, rank: r.rank, label: marketLabel(r.market) }));

  const debuts = bestBy(
    rows.filter((r) => r.isNew),
    (r) => -r.rank,
  )
    .slice(0, 6)
    .map((r) => ({ ...songOf(bySong.get(r.key)!), rank: r.rank, label: marketLabel(r.market) }));

  let brazil: Insights['brazil'] = null;
  const br = all.spotify.br?.entries;
  const gl = all.spotify.global?.entries;
  if (br?.length && gl?.length) {
    const glKeys = new Set(gl.map((e) => matchKey(e.trackName, e.artist)));
    const brKeys = new Set(br.map((e) => matchKey(e.trackName, e.artist)));
    const pick = (e: (typeof br)[number]) => ({ ...songOf(bySong.get(matchKey(e.trackName, e.artist))!), rank: e.rank });
    brazil = {
      onlyHere: br.filter((e) => e.rank <= 50 && !glKeys.has(matchKey(e.trackName, e.artist))).slice(0, 5).map(pick),
      missingHere: gl.filter((e) => e.rank <= 50 && !brKeys.has(matchKey(e.trackName, e.artist))).slice(0, 5).map(pick),
      shared: [...brKeys].filter((k) => glKeys.has(k)).length,
    };
  }

  const giants = (gl ?? [])
    .filter((e) => typeof e.totalStreams === 'number')
    .sort((a, b) => (b.totalStreams ?? 0) - (a.totalStreams ?? 0))
    .slice(0, 5)
    .map((e) => ({ ...songOf(bySong.get(matchKey(e.trackName, e.artist))!), total: e.totalStreams ?? 0, rank: e.rank }));

  return { markets, everywhere, artists, numberOnes, climbers, debuts, brazil, giants };
}

/* ---------- Retrospectiva ---------- */

export type ChartHistory = { dates: string[]; ranks: Record<string, (number | null)[]>; streams?: Record<string, (number | null)[]> };
export type Names = Record<string, Omit<InsightSong, 'key'> & { key?: string }>;

export type Recap = {
  month: string; // "2026-11"
  days: number;
  first: string;
  last: string;
  numberOnes: { id: string; days: number }[];
  top10: { id: string; days: number }[];
  streams: { id: string; total: number }[];
  /** maior salto de um dia pro outro no mês */
  jump: { id: string; from: number; to: number; date: string } | null;
  distinct: number; // músicas diferentes que passaram pelo chart no mês
};

/** Meses (AAAA-MM) presentes no histórico, do mais novo pro mais velho. */
export const recapMonths = (h: ChartHistory) => [...new Set(h.dates.map((d) => d.slice(0, 7)))].sort().reverse();

export function buildRecap(h: ChartHistory, month: string): Recap | null {
  const idx = h.dates.map((d, i) => [d, i] as const).filter(([d]) => d.startsWith(month));
  if (!idx.length) return null;
  const one = new Map<string, number>();
  const ten = new Map<string, number>();
  const sum = new Map<string, number>();
  const seen = new Set<string>();
  let jump: Recap['jump'] = null;
  for (const [id, ranks] of Object.entries(h.ranks)) {
    let prev: number | null = null;
    for (const [date, i] of idx) {
      const r = ranks[i];
      if (r != null) {
        seen.add(id);
        if (r === 1) one.set(id, (one.get(id) ?? 0) + 1);
        if (r <= 10) ten.set(id, (ten.get(id) ?? 0) + 1);
        if (prev != null && prev - r > (jump ? jump.from - jump.to : 0)) jump = { id, from: prev, to: r, date };
      }
      prev = r ?? null;
      const s = h.streams?.[id]?.[i];
      if (typeof s === 'number') sum.set(id, (sum.get(id) ?? 0) + s);
    }
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n);
  return {
    month,
    days: idx.length,
    first: idx[0][0],
    last: idx[idx.length - 1][0],
    numberOnes: top(one, 5).map(([id, days]) => ({ id, days })),
    top10: top(ten, 5).map(([id, days]) => ({ id, days })),
    streams: top(sum, 5).map(([id, total]) => ({ id, total })),
    jump,
    distinct: seen.size,
  };
}

export const monthLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  const t = new Date(Date.UTC(y, mm - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
