// Tipos e helpers do lado do cliente. Não importar lib/chart.ts aqui (depende do runtime Cloudflare).

export const markets: Record<string, { name: string; flag: string }> = {
  br: { name: 'Brasil', flag: '🇧🇷' },
  us: { name: 'Estados Unidos', flag: '🇺🇸' },
  kr: { name: 'Coreia do Sul', flag: '🇰🇷' },
  jp: { name: 'Japão', flag: '🇯🇵' },
  gb: { name: 'Reino Unido', flag: '🇬🇧' },
};

export type Track = {
  id: string;
  name: string;
  artistName: string;
  artworkUrl100: string;
  url: string;
  rank: number;
  change: number | null;
  isNew?: boolean;
  releaseDate?: string;
  genre?: string;
  artistUrl?: string;
};

export type Chart = {
  tracks: Track[];
  updated: string;
  date: string;
  stale: boolean;
  days: number;
  historyAvailable: boolean;
  previousDate: string | null;
};

export type HistoryPoint = { date: string; rank: number | null };

/** Troca a miniatura 100x100 do feed por uma versão maior. */
export const artwork = (url: string, size = 600) =>
  url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${size}x${size}bb.$1`);

export const shortDate = (v: string) =>
  new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/** Dias desde o lançamento, comparado à data do feed (não ao relógio do usuário). */
export function daysSince(release: string | undefined, reference: string) {
  if (!release) return null;
  const diff = Math.floor((Date.parse(reference) - Date.parse(release)) / 86400000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

export function releaseLabel(days: number | null) {
  if (days === null) return null;
  if (days === 0) return 'Lançada hoje';
  if (days === 1) return 'Lançada ontem';
  if (days < 30) return `Lançada há ${days} dias`;
  if (days < 365) return `Lançada há ${Math.round(days / 30)} ${Math.round(days / 30) === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(days / 365);
  return `Lançada há ${y} ${y === 1 ? 'ano' : 'anos'}`;
}

/** Separa colaborações ("A & B", "A, B", "A feat. B") pra contar artistas individuais. */
export function splitArtists(name: string) {
  return name
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bcom\b|\bwith\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function summarize(chart: Chart) {
  const { tracks } = chart;
  const artistCount = new Map<string, number>();
  const genreCount = new Map<string, number>();
  for (const t of tracks) {
    for (const a of splitArtists(t.artistName)) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
    if (t.genre) genreCount.set(t.genre, (genreCount.get(t.genre) ?? 0) + 1);
  }
  const topArtists = [...artistCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([artist, count]) => ({ artist, count }));
  const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count }));
  const recent = tracks.filter((t) => {
    const d = daysSince(t.releaseDate, chart.updated);
    return d !== null && d <= 7;
  });
  const climbers = tracks.filter((t) => (t.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  const debuts = tracks.filter((t) => t.isNew);
  return { artistCount: artistCount.size, topArtists, genres, recent, climbers, debuts };
}
