import { CheckCircle2, Clock3, ExternalLink, Info, Plug } from 'lucide-react';
import { Panel } from './ui';

const sources = [
  {
    name: 'Apple Music',
    status: 'connected' as const,
    desc: 'Top 100 de Brasil, EUA, Coreia do Sul, Japão e Reino Unido, pelo feed oficial da Apple.',
    link: 'https://rss.marketingtools.apple.com/',
  },
  {
    name: 'Spotify via kworb',
    status: 'connected' as const,
    desc: 'Top 200 diário do Global, Brasil, EUA, Coreia do Sul, Japão e Reino Unido, com streams do dia, total, pico e dias no chart. O kworb não é oficial; se o Global falhar, o vybe usa o Top 50 semanal público do Spotify (sem streams).',
    link: 'https://kworb.net/spotify/',
  },
  {
    name: 'Spotify Web API',
    status: 'connected' as const,
    desc: 'Busca oficial do Spotify (músicas e artistas) e identificação de faixas pra montar o histórico completo de charts desde a primeira entrada, via kworb.',
    link: 'https://developer.spotify.com/documentation/web-api',
  },
  {
    name: 'Last.fm',
    status: 'connected' as const,
    desc: 'Ouvintes e scrobbles de todos os tempos das faixas do topo, pela API oficial e gratuita. Aparece no painel de cada música.',
    link: 'https://www.last.fm/api',
  },
  {
    name: 'MyStreamCount',
    status: 'connected' as const,
    desc: 'Total de streams de qualquer música no Spotify (com mais de 1.000 plays), pela API no RapidAPI. Aparece no painel de cada música.',
    link: 'https://www.mystreamcount.com/',
  },
  {
    name: 'Billboard · YouTube · Circle',
    status: 'pending' as const,
    desc: 'Hot 100, Global 200, YouTube Charts e Circle Chart ainda não estão conectados.',
    link: 'https://charts.youtube.com/',
  },
];

const badge = {
  connected: { label: 'Conectado', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  next: { label: 'Próxima', cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Plug },
  pending: { label: 'Não conectado', cls: 'bg-slate-800 text-slate-400 border-slate-700', icon: Clock3 },
};

export function Sources() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Dados & cobertura</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Cada número tem uma fonte.</h2>
        <p className="mt-1 text-sm text-slate-400">O que já está ligado no VYBE e o que vem depois.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sources.map((s) => {
          const b = badge[s.status];
          return (
            <Panel key={s.name} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{s.name}</h3>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold ${b.cls}`}>
                  <b.icon className="h-3 w-3" /> {b.label}
                </span>
              </div>
              <p className="flex-1 text-sm text-slate-400">{s.desc}</p>
              <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                Site da fonte <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
          <Info className="h-4 w-4 text-cyan-400" /> Como o histórico funciona
        </h3>
        <div className="space-y-2 text-sm text-slate-400">
          <p>
            O VYBE guarda um registro por data do feed e país quando o ranking é consultado. Variações comparam o registro atual ao anterior
            disponível; lacunas não são preenchidas com estimativa. O histórico não é retroativo. A coleta roda sozinha três vezes por dia.
          </p>
          <p>
            Posição na Apple não é contagem de streams: o feed da Apple não informa reproduções. Os streams exibidos vêm do Spotify, via kworb. O melhor resultado observado no VYBE também não é o
            pico oficial da faixa.
          </p>
        </div>
      </Panel>
    </div>
  );
}
