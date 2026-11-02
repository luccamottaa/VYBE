// Identificação da mesma faixa entre fontes (Apple, Spotify, kworb, Last.fm). Módulo puro.

/** Separa colaborações ("A & B", "A, B", "A feat. B") pra contar/comparar artistas individuais. */
export function splitArtists(name: string) {
  return name
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bcom\b|\bwith\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Título sem "(feat. X)", "[Ao Vivo]" e " - Remastered". */
export const cleanTitle = (s: string) =>
  s
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();

const strip = (s: string) =>
  cleanTitle(s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()).replace(/[^a-z0-9]+/g, '');

/** Chave "música|primeiro artista" pra achar a mesma faixa em charts diferentes. */
export const matchKey = (name: string, artist: string) => `${strip(name)}|${strip(splitArtists(artist)[0] ?? artist)}`;
