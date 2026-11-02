// Charts mínimos pra testar destaques e alertas sem rede.
import type { All } from '../lib/chart-hits.ts';

type Sp = All['spotify'][string]['entries'][number];
const sp = (rank: number, trackName: string, artist: string, spotifyId: string, extra: Partial<Sp> = {}): Sp => ({
  rank,
  previousRank: rank,
  peakRank: rank,
  daysOnChart: 10,
  trackName,
  artist,
  streams: 1_000_000 - rank * 1000,
  totalStreams: 50_000_000,
  spotifyId,
  artworkUrl: null,
  ...extra,
});
const ap = (rank: number, name: string, artistName: string, id: string, change: number | null = 0, isNew = false) => ({
  id,
  name,
  artistName,
  artworkUrl100: `https://img/${id}/100x100bb.jpg`,
  url: '',
  rank,
  change,
  isNew,
});
const payload = (chart: string, entries: Sp[]) => ({ chart, label: chart, date: '2026-11-01', fetched: 0, source: 'kworb' as const, stale: false, historyAvailable: true, entries });
const chart = (tracks: ReturnType<typeof ap>[]) => ({ tracks, updated: '2026-11-02', date: '2026-11-02', stale: false, days: 2, historyAvailable: true, previousDate: '2026-11-01' });

export function makeAll(): All {
  return {
    apple: {
      br: chart([ap(1, 'Pós', 'Felipe e Rodrigo', 'a1'), ap(2, 'Housewife', 'Tate McRae', 'a2', 3), ap(3, 'Nova', 'Fulano', 'a3', null, true)]),
      us: chart([ap(1, 'Housewife', 'Tate McRae', 'a2', 1), ap(2, 'Thriller', 'Michael Jackson', 'a4')]),
    },
    spotify: {
      global: payload('global', [
        sp(1, 'Thriller', 'Michael Jackson', 'S1'.padEnd(22, 'x'), { previousRank: 8, totalStreams: 2_100_000_000 }),
        sp(2, 'Housewife', 'Tate McRae', 'S2'.padEnd(22, 'x'), { totalStreams: 110_000_000 }),
      ]),
      br: payload('br', [
        sp(1, 'Pós (Ao Vivo)', 'Felipe e Rodrigo', 'S3'.padEnd(22, 'x')),
        sp(2, 'Housewife', 'Tate McRae', 'S2'.padEnd(22, 'x'), { previousRank: null, entryStatus: 'NEW_ENTRY' }),
      ]),
    },
  } as All;
}
