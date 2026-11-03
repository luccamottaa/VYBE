// Resumo do dia de quem você segue: onde cada um está nos charts agora.
// Módulo puro (testado em tests/daily.test.ts); o servidor (push-send) usa o mesmo cálculo.
import type { All } from './chart-hits.ts';
import { snapshotOf } from './alerts.ts';
import { marketName } from './sources/markets.ts';
import type { Follow } from './follow';

export type Summary = { title: string; body: string; count: number };

/** Melhor posição de um follow (e em qual mercado) nos charts de agora, ou null se estiver fora de todos. */
function best(all: All, f: Follow) {
  const { ranks } = snapshotOf(all, f);
  let top: { rank: number; market: string } | null = null;
  let charts = 0;
  const songs = new Set<string>();
  for (const [k, rank] of Object.entries(ranks)) {
    charts++;
    const market = f.kind === 'artist' ? k.slice(k.lastIndexOf('|') + 1) : k;
    if (f.kind === 'artist') songs.add(k.slice(0, k.lastIndexOf('|')));
    if (!top || rank < top.rank) top = { rank, market };
  }
  return top ? { ...top, charts, songs: songs.size } : null;
}

/** Texto do push diário. Null quando ninguém que a pessoa segue está em chart nenhum (aí não manda nada). */
export function dailySummary(all: All, follows: Follow[]): Summary | null {
  const rows = follows
    .map((f) => ({ f, b: best(all, f) }))
    .filter((r): r is { f: Follow; b: NonNullable<ReturnType<typeof best>> } => !!r.b)
    .sort((a, b) => a.b.rank - b.b.rank || a.f.name.localeCompare(b.f.name));
  if (!rows.length) return null;
  const line = ({ f, b }: (typeof rows)[number]) => {
    const where = `#${b.rank} ${marketName(b.market)}`;
    return f.kind === 'artist' && b.songs > 1 ? `${f.name}: ${b.songs} músicas, melhor ${where}` : `${f.name} ${where}`;
  };
  const shown = rows.slice(0, 3).map(line);
  const more = rows.length - shown.length;
  return {
    title: rows.length === 1 ? 'Seu resumo do dia 🎧' : `${rows.length} dos seus estão nos charts hoje 🎧`,
    body: shown.join(' · ') + (more > 0 ? ` · +${more}` : ''),
    count: rows.length,
  };
}

/** Data (AAAA-MM-DD) e hora em Brasília: o resumo sai de manhã no horário do Brasil, não do servidor. */
export function brasiliaNow(now = Date.now()) {
  const d = new Date(now - 3 * 3600_000); // Brasília é UTC-3 o ano todo (sem horário de verão desde 2019)
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}
