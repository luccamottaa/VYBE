import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, buildRecap, recapMonths } from '../lib/insights.ts';
import { findHits } from '../lib/chart-hits.ts';
import { matchKey } from '../lib/sources/match.ts';
import { makeAll } from './fixtures.ts';

test('findHits acha a mesma música em Apple e Spotify', () => {
  const hits = findHits(makeAll(), { key: matchKey('Housewife', 'Tate McRae') });
  assert.deepEqual(hits.map((h) => h.market).sort(), ['ap:br', 'ap:us', 'sp:br', 'sp:global']);
  assert.equal(hits[0].rank, 1);
});

test('destaques: em todo lugar, #1 por chart, subidas, estreias, Brasil × Mundo e gigantes', () => {
  const i = buildInsights(makeAll());
  assert.equal(i.markets, 4);
  assert.equal(i.everywhere[0].name, 'Housewife');
  assert.equal(i.everywhere[0].count, 4);
  assert.equal(i.numberOnes.length, 4);
  assert.equal(i.climbers[0].name, 'Thriller'); // 8 → 1 no global
  assert.equal(i.climbers[0].change, 7);
  assert.deepEqual(i.debuts.map((d) => d.name).sort(), ['Housewife', 'Nova']);
  assert.match(i.brazil?.onlyHere[0].name ?? '', /^Pós/);
  assert.equal(i.brazil?.missingHere[0].name, 'Thriller');
  assert.equal(i.giants[0].total, 2_100_000_000);
  assert.equal(i.artists[0].name, 'Tate McRae');
});

test('retrospectiva conta dias no #1, top 10, streams e maior salto', () => {
  const h = {
    dates: ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'],
    ranks: { a: [1, 1, 2, 1], b: [2, 2, 1, 2], c: [null, 50, 9, 30] },
    streams: { a: [10, 20, 30, 40], b: [1, 1, 1, 1], c: [null, 5, 5, 5] },
  };
  assert.deepEqual(recapMonths(h), ['2026-11', '2026-10']);
  const r = buildRecap(h, '2026-11')!;
  assert.equal(r.days, 3);
  assert.deepEqual(r.numberOnes, [{ id: 'a', days: 2 }, { id: 'b', days: 1 }]);
  assert.equal(r.streams[0].id, 'a');
  assert.equal(r.streams[0].total, 90);
  assert.deepEqual(r.jump, { id: 'c', from: 50, to: 9, date: '2026-11-02' });
  assert.equal(r.distinct, 3);
  assert.equal(buildRecap(h, '2025-01'), null);
});
