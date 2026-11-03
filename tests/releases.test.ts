import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickReleases, releaseWhen } from '../lib/releases.ts';

const al = (key: string, releaseDate?: string) => ({ key, name: key, artist: 'X', releaseDate });

test('lançamentos: separa em breve e recentes, sem repetir e dentro da janela', () => {
  const r = pickReleases(
    [
      { artist: 'TXT', albums: [al('a', '2026-11-01'), al('b', '2026-11-20'), al('c', '2026-09-01'), al('d')] },
      { artist: 'ENHYPEN', albums: [al('a', '2026-11-01'), al('e', '2026-11-03'), al('f', '2026-11-05')] },
    ],
    '2026-11-03',
  );
  assert.deepEqual(r.recent.map((x) => x.key), ['e', 'a']); // hoje, há 2 dias; "c" passou da janela
  assert.deepEqual(r.upcoming.map((x) => x.key), ['f', 'b']); // daqui 2 dias, daqui 17
  assert.equal(r.recent[1].followed, 'TXT');
  assert.equal(releaseWhen(0), 'saiu hoje');
  assert.equal(releaseWhen(-2), 'sai em 2 dias');
});
