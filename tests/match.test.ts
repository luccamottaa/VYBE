import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, matchKey, splitArtists } from '../lib/sources/match.ts';
import { marketLabel, marketName } from '../lib/sources/markets.ts';

test('splitArtists separa colaborações', () => {
  assert.deepEqual(splitArtists('Anitta & J Balvin feat. Fulano'), ['Anitta', 'J Balvin', 'Fulano']);
  assert.deepEqual(splitArtists('MC A, MC B'), ['MC A', 'MC B']);
});

test('matchKey ignora acento, (feat.), [Ao Vivo] e colaboradores', () => {
  assert.equal(matchKey('Pós (Ao Vivo)', 'Felipe e Rodrigo'), matchKey('Pós', 'Felipe e Rodrigo'));
  assert.equal(matchKey('Coração - Remastered', 'Zé & Ana'), matchKey('Coracao', 'Ze'));
  assert.equal(cleanTitle('Song (feat. X) - Live'), 'Song');
});

test('rótulos de mercado', () => {
  assert.equal(marketLabel('sp:global'), 'Spotify 🌍');
  assert.equal(marketName('ap:br'), 'Apple Music Brasil');
});

test('matchKey não junta músicas diferentes com título em coreano/japonês', () => {
  assert.notEqual(matchKey('체포하겠어', '아일릿'), matchKey('행복하지 말아요', 'M.C the MAX'));
  assert.notEqual(matchKey('夜に駆ける', 'YOASOBI'), matchKey('マリーゴールド', 'あいみょん'));
  assert.equal(matchKey('체포하겠어', '아일릿'), matchKey('체포하겠어 (feat. X)', '아일릿'));
});

test('grupos com separador no nome ficam inteiros e o crédito acha o artista', async () => {
  const { creditIncludes } = await import('../lib/sources/match.ts');
  assert.deepEqual(splitArtists('TOMORROW X TOGETHER'), ['TOMORROW X TOGETHER']);
  assert.deepEqual(splitArtists('Hugo & Guilherme, Ana Castela'), ['Hugo & Guilherme', 'Ana Castela']);
  assert.deepEqual(splitArtists('MC A x MC B'), ['MC A', 'MC B']);
  assert.ok(creditIncludes('TOMORROW X TOGETHER', 'TOMORROW X TOGETHER'));
  assert.ok(creditIncludes('TOMORROW X TOGETHER & Jonas Brothers', 'tomorrow x together'));
  assert.ok(creditIncludes('Henrique & Juliano', 'Henrique & Juliano'));
  assert.ok(creditIncludes('Anitta, Ludmilla', 'Ludmilla'));
  assert.ok(!creditIncludes('TOMORROW X TOGETHER', 'TOMORROW'));
  assert.ok(!creditIncludes('Olivia Dean', 'Olivia Rodrigo'));
});
