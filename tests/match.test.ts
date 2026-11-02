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
