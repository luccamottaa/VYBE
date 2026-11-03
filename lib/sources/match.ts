// Identificação da mesma faixa entre fontes (Apple, Spotify, kworb, Last.fm). Módulo puro.

// Nomes de grupo/dupla que têm um separador de colaboração dentro (" x ", "&", ",", "+", "with").
// Sem isso, "TOMORROW X TOGETHER" virava dois artistas ("TOMORROW" e "TOGETHER") e "Hugo & Guilherme" também.
const GROUPS = [
  'TOMORROW X TOGETHER', 'Tyler, The Creator', 'Earth, Wind & Fire', 'Simon & Garfunkel', 'Florence + The Machine',
  'Mumford & Sons', 'Hall & Oates', 'Brooks & Dunn', 'Dan + Shay', 'Big & Rich', 'Crosby, Stills, Nash & Young',
  'Chitãozinho & Xororó', 'Zezé Di Camargo & Luciano', 'Henrique & Juliano', 'Jorge & Mateus', 'Maiara & Maraisa',
  'Matheus & Kauan', 'Zé Neto & Cristiano', 'Bruno & Marrone', 'Israel & Rodolffo', 'Diego & Victor Hugo', 'Hugo & Guilherme',
  'César Menotti & Fabiano', 'Simone & Simaria', 'Marcos & Belutti', 'Munhoz & Mariano', 'Kaique & Felipe', 'Clayton & Romário',
  'Guilherme & Benuto', 'Fernando & Sorocaba', 'Edson & Hudson', 'Rionegro & Solimões', 'João Gustavo & Murilo', 'Thiago & Graciano',
  'Hugo & Tiago', 'Day & Lara', 'Lucas & Felipe', 'Panda & MJ Records', 'Grupo Menos É Mais', 'Sandy & Junior',
  'Kid Abelha & Os Abóboras Selvagens', 'Belo & Gaab', 'Ivete Sangalo & Ludmilla', 'Peter, Paul & Mary', 'Mike + The Mechanics',
  'Hootie & The Blowfish', 'Marina and The Diamonds', 'Florence and the Machine', 'Selena Gomez & The Scene', 'Huey Lewis & The News',
  'Bob Marley & The Wailers', 'Tom Petty and the Heartbreakers', 'Kool & The Gang', 'Sly & The Family Stone', 'Of Monsters and Men',
];
const groupKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const GROUP_RE = new RegExp(
  `(${GROUPS.map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|')})`,
  'gi',
);

/** Separa colaborações ("A & B", "A, B", "A feat. B") pra contar/comparar artistas individuais. Grupos conhecidos ficam inteiros. */
export function splitArtists(name: string) {
  const kept: string[] = [];
  const masked = name.replace(GROUP_RE, (m) => `\u0000${kept.push(m) - 1}\u0000`);
  return masked
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bcom\b|\bwith\b)\s*/i)
    .map((s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]).trim())
    .filter(Boolean);
}

/** O crédito ("A, B & C", "TOMORROW X TOGETHER", "MC A x MC B") inclui esse artista? Compara a frase inteira, não pedaços. */
export function creditIncludes(credit: string, artist: string) {
  const a = groupKey(artist);
  if (!a) return false;
  if (splitArtists(credit).some((x) => groupKey(x) === a)) return true;
  // nome do próprio artista tem separador (grupo/dupla fora da lista): procura a frase inteira no crédito
  return /\s(x|&|e|and|\+)\s|,/i.test(artist) && ` ${groupKey(credit)} `.includes(` ${a} `);
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
