// Coleta programada: grava Apple (todos os países) e Spotify no D1, mesmo com o site fechado.
import { countries, loadChart } from './chart';
import { loadSpotifyChart } from './spotify';

export async function collectAll() {
  const jobs = [
    ...countries.map((c) => ({ name: `apple:${c}`, run: () => loadChart(c) })),
    { name: 'spotify', run: () => loadSpotifyChart() },
  ];
  const results = await Promise.allSettled(jobs.map((j) => j.run()));
  const report = results.map((r, i) => {
    if (r.status === 'rejected') return `${jobs[i].name}: ERRO ${(r.reason as Error)?.message}`;
    return `${jobs[i].name}: ${r.value.stale ? 'fonte fora, mantido o último' : 'ok'}`;
  });
  console.log('[VYBE/collect]', report.join(' | '));
  return report;
}
