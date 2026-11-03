// Regras puras das estatísticas anônimas do vybe (testadas em tests/analytics.test.ts).
// Nada aqui toca o navegador: quem guarda o consentimento e envia é lib/analytics.ts.

export const POSTHOG_HOST = 'https://us.i.posthog.com';

/** Os únicos eventos que existem. Nome de música, artista e texto de busca NUNCA entram. */
export const EVENTS = ['app_open', 'tab_view', 'market_change', 'search', 'open_song', 'open_artist', 'open_album', 'follow', 'share_open', 'push_toggle', 'signin_click', 'error'] as const;
export type EventName = (typeof EVENTS)[number];
export type Props = Record<string, string | number | boolean>;
export type Queued = { event: EventName; props: Props; at: number };

export type Env = { doNotTrack?: string | null; gpc?: boolean; webdriver?: boolean };

/** "Não rastrear", Global Privacy Control ou robô de teste: nunca coleta e nem pergunta. */
export const blocked = (e: Env) => e.doNotTrack === '1' || e.doNotTrack === 'yes' || !!e.gpc || !!e.webdriver;

export const isEvent = (s: string): s is EventName => (EVENTS as readonly string[]).includes(s);

/** Só valores simples e curtos; objetos, listas e nulos caem fora. */
export function cleanProps(p: Record<string, unknown> = {}): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(p).slice(0, 8)) {
    if (typeof v === 'string') out[k.slice(0, 24)] = v.slice(0, 40);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k.slice(0, 24)] = v;
    else if (typeof v === 'boolean') out[k.slice(0, 24)] = v;
  }
  return out;
}

/** Tamanho de um texto em faixas, pra saber que a pessoa buscou sem saber o quê. */
export const bucket = (n: number) => (n <= 0 ? '0' : n <= 3 ? '1-3' : n <= 10 ? '4-10' : '11+');

/** Corpo do POST /batch/ do PostHog: sem IP, sem GeoIP, sem perfil de pessoa, id aleatório da visita. */
export function buildBatch(apiKey: string, distinctId: string, events: Queued[], base: Props) {
  return {
    api_key: apiKey,
    batch: events.map((e) => ({
      event: e.event,
      timestamp: new Date(e.at).toISOString(),
      properties: {
        ...base,
        ...e.props,
        distinct_id: distinctId,
        $process_person_profile: false,
        $ip: null,
        $geoip_disable: true,
      },
    })),
  };
}
