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

// Tira só os acentos latinos (NFD + marcas 0300–036F) e recompõe: hangul, kana e kanji ficam intactos.
// (Antes tudo que não fosse a-z/0-9 sumia, e toda música com título em coreano/japonês virava a mesma chave.)
const strip = (s: string) =>
  cleanTitle(s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, '');

/** Chave "música|primeiro artista" pra achar a mesma faixa em charts diferentes. */
export const matchKey = (name: string, artist: string) => `${strip(name)}|${strip(splitArtists(artist)[0] ?? artist)}`;
