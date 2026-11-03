// Lançamentos de quem você segue: o que saiu nos últimos dias e o que vem por aí (pré-estreia nas lojas).
// Módulo puro (testado em tests/releases.test.ts).
import type { Album } from './albums';

export type Release = Album & { followed: string; days: number }; // days < 0 = falta; >= 0 = saiu há

const DAY = 86400000;

/** Junta os álbuns dos artistas seguidos e separa em "em breve" e "saiu agora" (até `window` dias). */
export function pickReleases(byArtist: { artist: string; albums: Album[] }[], today: string, window = 30) {
  const t = Date.parse(`${today}T00:00:00Z`);
  const seen = new Set<string>();
  const all: Release[] = [];
  for (const { artist, albums } of byArtist)
    for (const a of albums) {
      if (!a.releaseDate || seen.has(a.key)) continue;
      const days = Math.round((t - Date.parse(`${a.releaseDate.slice(0, 10)}T00:00:00Z`)) / DAY);
      if (!Number.isFinite(days) || days > window || days < -365) continue;
      seen.add(a.key);
      all.push({ ...a, followed: artist, days });
    }
  return {
    upcoming: all.filter((r) => r.days < 0).sort((a, b) => b.days - a.days), // mais perto primeiro
    recent: all.filter((r) => r.days >= 0).sort((a, b) => a.days - b.days),
  };
}

export const releaseWhen = (days: number) => {
  if (days === 0) return 'saiu hoje';
  if (days === 1) return 'saiu ontem';
  if (days > 1) return `saiu há ${days} dias`;
  if (days === -1) return 'sai amanhã';
  return `sai em ${-days} dias`;
};
