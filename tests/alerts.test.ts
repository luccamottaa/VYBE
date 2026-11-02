import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAlerts, milestoneLabel } from '../lib/alerts.ts';
import { matchKey } from '../lib/sources/match.ts';
import type { Follow } from '../lib/follow.ts';
import { makeAll } from './fixtures.ts';

const song: Follow = { kind: 'song', key: matchKey('Housewife', 'Tate McRae'), name: 'Housewife', artist: 'Tate McRae', at: 0 };
const artist: Follow = { kind: 'artist', key: 'felipe e rodrigo', name: 'Felipe e Rodrigo', at: 0 };

test('primeira vez só tira a foto base', () => {
  const { alerts, next } = computeAlerts(makeAll(), [song, artist], {});
  assert.equal(alerts.length, 0);
  assert.equal(next['song:' + song.key].ranks['sp:global'], 2);
});

test('#1, top 10 (inclusive estreando), saída e marco de streams', () => {
  const prev = {
    ['song:' + song.key]: { ranks: { 'ap:us': 4, 'ap:br': 30, 'sp:global': 2, 'sp:us': 120 }, total: 90_000_000 },
  };
  const { alerts } = computeAlerts(makeAll(), [song], prev, 1);
  const kinds = alerts.map((a) => `${a.kind}@${a.market}`).sort();
  assert.deepEqual(kinds, ['top10@sp:br', 'left@sp:us', 'milestone@sp:global', 'no1@ap:us', 'top10@ap:br'].sort());
  assert.match(alerts.find((a) => a.kind === 'milestone')!.title, /100 mi/);
});

test('artista: música nova nos charts e #1', () => {
  const k = matchKey('Pós', 'Felipe e Rodrigo');
  const prev = { ['artist:' + artist.key]: { ranks: { [`${k}|ap:br`]: 3 } } };
  const { alerts } = computeAlerts(makeAll(), [artist], prev, 1);
  assert.ok(alerts.some((a) => a.kind === 'artist-no1'));
});

test('rótulo dos marcos', () => {
  assert.equal(milestoneLabel(100e6), '100 mi');
  assert.equal(milestoneLabel(1.5e9), '1,5 bi');
});
