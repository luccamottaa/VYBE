import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKworb } from '../lib/sources/kworb.ts';
import { normalizeHistory } from '../api-proxy/lib/streams.js';

const html = `<p>Last updated: 2026/11/01</p><table><thead><tr><th>Pos</th><th>P+</th><th>Artist and Title</th><th>Days</th><th>Pk</th><th>Streams</th><th>Total</th></tr></thead>
<tbody>
<tr><td>1</td><td>+7</td><td><a href="../artist/x.html">Michael Jackson</a> - <a href="../track/2LlQb7Uoj1kKyGhlkBf9aC.html">Thriller</a></td><td>133</td><td>1</td><td>6,606,221</td><td>205,864,115</td></tr>
<tr><td>2</td><td>NEW</td><td><a href="../artist/y.html">Tate McRae</a> - <a href="../track/0123456789abcdefghijkl.html">Housewife (w/ Fulano)</a></td><td>1</td><td>2</td><td>5,000</td><td>5,000</td></tr>
</tbody></table>`;

test('kworb: lê posição, variação, streams, total e colaborações', () => {
  const c = parseKworb(html, 'global');
  assert.equal(c.date, '2026-11-01');
  assert.equal(c.entries.length, 2);
  assert.deepEqual(
    { ...c.entries[0] },
    { rank: 1, previousRank: 8, peakRank: 1, daysOnChart: 133, trackName: 'Thriller', artist: 'Michael Jackson', streams: 6606221, totalStreams: 205864115, spotifyId: '2LlQb7Uoj1kKyGhlkBf9aC', artworkUrl: null, entryStatus: 'MOVED_UP' },
  );
  assert.equal(c.entries[1].entryStatus, 'NEW_ENTRY');
  assert.equal(c.entries[1].trackName, 'Housewife');
  assert.equal(c.entries[1].artist, 'Tate McRae, Fulano');
});

test('kworb: página sem tabela vira erro claro', () => {
  assert.throws(() => parseKworb('<html>bloqueado</html>', 'br'), /sem tabela/);
});

test('streams: normaliza histórico em lista, mapa e pares', () => {
  assert.deepEqual(normalizeHistory([{ date: '2026-11-02', streams: '20' }, { date: '2026-11-01', streams: 10 }]), [
    { date: '2026-11-01', streams: 10 },
    { date: '2026-11-02', streams: 20 },
  ]);
  assert.deepEqual(normalizeHistory({ history: { '2026-11-01': 5 } }), [{ date: '2026-11-01', streams: 5 }]);
  assert.deepEqual(normalizeHistory({ data: [[1761955200, 7]] }), [{ date: '2025-11-01', streams: 7 }]);
});
