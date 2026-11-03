// Depois de cada coleta: compara os charts novos com a última foto de cada aparelho e manda o push.
// Idempotente: só processa uma vez cada coleta (meta.json → ran). ?force=1 reprocessa.
import webpush from 'npm:web-push@3.6.7';
import { computeAlerts } from '../_shared/alerts.js';
import { admin, cors, json, SITE, vapidKeys } from '../_shared/util.ts';

const PREF_KINDS: Record<string, string[]> = {
  no1: ['no1', 'artist-no1'],
  top10: ['top10'],
  entry: ['entry', 'artist-entry'],
  milestone: ['milestone'],
  left: ['left'],
};
const DEFAULT_PREFS: Record<string, boolean> = { no1: true, top10: true, entry: true, milestone: true, left: false };
const wants = (prefs: Record<string, boolean>, kind: string) =>
  Object.entries({ ...DEFAULT_PREFS, ...prefs }).some(([k, on]) => on && PREF_KINDS[k]?.includes(kind));

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${SITE}data/${path}`, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  const force = new URL(req.url).searchParams.get('force') === '1';
  const db = admin();

  const meta = await getJson<{ ran: string }>('meta.json');
  if (!meta?.ran) return json(req, { error: 'meta.json indisponível' }, 502);
  const { data: last } = await db.from('app_state').select('value').eq('key', 'last_run').maybeSingle();
  if (!force && last?.value?.ran === meta.ran) return json(req, { skipped: true, ran: meta.ran });

  // charts de agora (mesmos arquivos que o site usa)
  const apple: Record<string, unknown> = {};
  const spotify: Record<string, unknown> = {};
  await Promise.all([
    ...['br', 'us', 'kr', 'jp', 'gb'].map(async (c) => {
      const d = await getJson(`apple/${c}/latest.json`);
      if (d) apple[c] = d;
    }),
    ...['global', 'br', 'us', 'kr', 'jp', 'gb'].map(async (m) => {
      const d = await getJson(`spotify/${m}/latest.json`);
      if (d) spotify[m] = d;
    }),
  ]);
  if (!Object.keys(apple).length && !Object.keys(spotify).length) return json(req, { error: 'charts indisponíveis' }, 502);
  const all = { apple, spotify };

  const { publicKey, privateKey } = await vapidKeys();
  webpush.setVapidDetails(SITE.replace(/\/$/, ''), publicKey, privateKey);

  let processed = 0;
  let sent = 0;
  let removed = 0;
  for (let from = 0; ; from += 500) {
    const { data: subs, error } = await db.from('push_subscriptions').select('endpoint,p256dh,auth,follows,prefs,snapshot').range(from, from + 499);
    if (error) return json(req, { error: error.message }, 500);
    if (!subs?.length) break;
    for (const s of subs) {
      processed++;
      // deno-lint-ignore no-explicit-any
      const { alerts, next } = computeAlerts(all as any, (s.follows ?? []) as any, (s.snapshot ?? {}) as any);
      const mine = alerts.filter((a: { kind: string }) => wants(s.prefs ?? {}, a.kind));
      const target = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      let gone = false;
      const list = mine.slice(0, 3).map((a: { title: string; body: string; id: string; song?: { artwork?: string } }) => ({
        title: a.title,
        body: a.body,
        tag: a.id,
        url: `${SITE}?aba=seguindo`,
      }));
      if (mine.length > 3) list.push({ title: 'vybe', body: `+${mine.length - 3} novidades de quem você segue`, tag: 'vybe-mais', url: `${SITE}?aba=seguindo` });
      for (const payload of list) {
        try {
          await webpush.sendNotification(target, JSON.stringify(payload), { TTL: 12 * 3600, urgency: 'normal' });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            gone = true;
            break;
          }
        }
      }
      if (gone) {
        await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        removed++;
      } else {
        await db
          .from('push_subscriptions')
          .update({ snapshot: next, ...(list.length ? { last_push_at: new Date().toISOString() } : {}) })
          .eq('endpoint', s.endpoint);
      }
    }
    if (subs.length < 500) break;
  }

  await db.from('app_state').upsert({ key: 'last_run', value: { ran: meta.ran, processed, sent, removed }, updated_at: new Date().toISOString() });
  return json(req, { ran: meta.ran, processed, sent, removed });
});
