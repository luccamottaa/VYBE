import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brasiliaNow, dailySummary } from '../lib/daily.ts';
import { matchKey } from '../lib/sources/match.ts';
import type { Follow } from '../lib/follow.ts';
import { makeAll } from './fixtures.ts';

const song: Follow = { kind: 'song', key: matchKey('Housewife', 'Tate McRae'), name: 'Housewife', artist: 'Tate McRae', at: 0 };
const nobody: Follow = { kind: 'song', key: matchKey('Música que não existe', 'Ninguém'), name: 'Música que não existe', artist: 'Ninguém', at: 0 };

test('resumo mostra a melhor posição de quem está nos charts', () => {
  const s = dailySummary(makeAll(), [song]);
  assert.ok(s);
  assert.match(s!.body, /Housewife #\d+/);
  assert.equal(s!.count, 1);
});

test('sem nada em chart não manda resumo', () => {
  assert.equal(dailySummary(makeAll(), [nobody]), null);
  assert.equal(dailySummary(makeAll(), []), null);
});

test('ignora quem está fora e conta só os que estão nos charts', () => {
  const s = dailySummary(makeAll(), [nobody, song]);
  assert.equal(s!.count, 1);
  assert.doesNotMatch(s!.body, /Ninguém/);
});

test('Brasília é UTC-3: 11h UTC é 8h no Brasil e a data vira só às 3h UTC', () => {
  assert.deepEqual(brasiliaNow(Date.UTC(2026, 10, 3, 11, 0)), { date: '2026-11-03', hour: 8 });
  assert.deepEqual(brasiliaNow(Date.UTC(2026, 10, 4, 2, 30)), { date: '2026-11-03', hour: 23 });
  assert.deepEqual(brasiliaNow(Date.UTC(2026, 10, 4, 3, 0)), { date: '2026-11-04', hour: 0 });
});
