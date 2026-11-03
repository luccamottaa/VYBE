import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineCharts } from '../lib/combined.ts';
import { makeAll } from './fixtures.ts';

test('ranking unificado: quem está bem nas duas plataformas fica no topo', () => {
  const all = makeAll();
  const br = combineCharts([all.apple.br], all.spotify.br);
  assert.equal(br[0].name, 'Pós'); // #1 na Apple BR e #1 no Spotify BR
  assert.deepEqual(br[0].sources.apple, 1);
  assert.equal(br[0].sources.spotify, 1);
  assert.ok(br[0].appleId && br[0].spotifyId);
  assert.equal(br.length, 3);
  assert.deepEqual(br.map((t) => t.rank), [1, 2, 3]);
});

test('Global junta o Spotify Global com a média dos países da Apple', () => {
  const all = makeAll();
  const gl = combineCharts(Object.values(all.apple), all.spotify.global);
  const names = gl.map((t) => t.name);
  assert.ok(names.includes('Thriller') && names.includes('Housewife'));
  const hw = gl.find((t) => t.name === 'Housewife')!;
  assert.equal(hw.sources.appleCountries, 2);
  assert.equal(hw.streams, all.spotify.global.entries[1].streams);
});

test('variação compara com o ranking unificado anterior', () => {
  const all = makeAll();
  const gl = combineCharts([], all.spotify.global);
  // Housewife estava em #2 e segue #2; Thriller veio de fora do chart (posição anterior além do tamanho)
  const hw = gl.find((t) => t.name === 'Housewife')!;
  assert.equal(typeof hw.change, 'number');
  assert.equal(gl.find((t) => t.name === 'Thriller')!.isNew, true);
});
