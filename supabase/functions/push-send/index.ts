// Depois de cada coleta: compara os charts novos com a última foto de cada aparelho e manda o push.
// E, uma vez por dia de manhã (9h de Brasília), o resumo do dia pra quem ligou.
//
// Feito pra aguentar muita gente:
//  - trava (push_claim): só uma execução por vez; se uma morrer, a trava vence sozinha em 3 min
//  - lotes de 100 inscrições, 10 envios em paralelo, ordenados pelo endpoint
//  - cursor em app_state: se o tempo acabar (90 s), a próxima chamada continua de onde parou
//  - idempotente: cada coleta (meta.json → ran) e cada dia só são processados uma vez
// É chamado pelo deploy do site e por um cron a cada 10 minutos (supabase/migrations/*_push_cron.sql).
import webpush from 'npm:web-push@3.6.7';
import { brasiliaNow, computeAlerts, dailySummary } from '../_shared/alerts.js';
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

const BATCH = 100; // inscrições lidas por vez
const PARALLEL = 10; // aparelhos atendidos ao mesmo tempo
const BUDGET_MS = 90_000; // depois disso não começa lote novo
const LEASE_S = 180; // validade da trava
const DAILY_HOUR = 9; // hora de Brasília em que sai o resumo do dia

type Sub = { endpoint: string; p256dh: string; auth: string; follows: unknown[] | null; prefs: Record<string, boolean> | null; snapshot: unknown };
type Stats = { processed: number; sent: number; removed: number };
type Cursor = { run: string; after: string | null; done: boolean } & Stats;
type Payload = { title: string; body: string; tag: string; url: string };

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${SITE}data/${path}`, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Manda os payloads pra um aparelho. Devolve `gone` se a inscrição morreu (404/410) e quantos foram. */
async function deliver(s: Sub, list: Payload[]) {
  const target = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
  let sent = 0;
  for (const payload of list) {
    try {
      await webpush.sendNotification(target, JSON.stringify(payload), { TTL: 12 * 3600, urgency: 'normal', timeout: 12_000 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) return { gone: true, sent };
    }
  }
  return { gone: false, sent };
}

/**
 * Percorre as inscrições em lotes, retomando do cursor guardado. `run` identifica a rodada
 * (a coleta, ou o dia): outra rodada recomeça do zero; a mesma, já concluída, não repete.
 */
async function runJob(db: ReturnType<typeof admin>, name: string, run: string, deadline: number, handle: (s: Sub) => Promise<{ sent: number; gone: boolean }>) {
  const key = `cursor:${name}`;
  const { data } = await db.from('app_state').select('value').eq('key', key).maybeSingle();
  let cur: Cursor = data?.value?.run === run ? data.value : { run, after: null, done: false, processed: 0, sent: 0, removed: 0 };
  if (cur.done) return { ...cur, skipped: true };

  while (Date.now() < deadline) {
    let q = db.from('push_subscriptions').select('endpoint,p256dh,auth,follows,prefs,snapshot').order('endpoint').limit(BATCH);
    if (cur.after) q = q.gt('endpoint', cur.after);
    const { data: subs, error } = await q;
    if (error) throw new Error(error.message);
    if (!subs?.length) {
      cur = { ...cur, done: true };
      break;
    }
    for (let i = 0; i < subs.length; i += PARALLEL) {
      const results = await Promise.all(
        (subs.slice(i, i + PARALLEL) as Sub[]).map(async (s) => {
          try {
            return await handle(s);
          } catch {
            return { sent: 0, gone: false }; // um aparelho com problema não derruba o lote
          }
        }),
      );
      for (const r of results) {
        cur.processed++;
        cur.sent += r.sent;
        if (r.gone) cur.removed++;
      }
    }
    cur.after = subs[subs.length - 1].endpoint;
    if (subs.length < BATCH) cur.done = true;
    await db.from('app_state').upsert({ key, value: cur, updated_at: new Date().toISOString() });
    if (cur.done) break;
  }
  if (cur.done) await db.from('app_state').upsert({ key, value: cur, updated_at: new Date().toISOString() });
  return cur;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  const force = new URL(req.url).searchParams.get('force') === '1';
  const db = admin();
  const deadline = Date.now() + BUDGET_MS;

  const meta = await getJson<{ ran: string }>('meta.json');
  if (!meta?.ran) return json(req, { error: 'meta.json indisponível' }, 502);

  const { date, hour } = brasiliaNow();
  const alertsRun = force ? `${meta.ran}#force${Date.now()}` : meta.ran;
  const [{ data: ac }, { data: dc }] = await Promise.all([
    db.from('app_state').select('value').eq('key', 'cursor:alerts').maybeSingle(),
    db.from('app_state').select('value').eq('key', 'cursor:daily').maybeSingle(),
  ]);
  const alertsDone = !force && ac?.value?.run === meta.ran && ac.value.done;
  const dailyDue = hour >= DAILY_HOUR && hour < 22 && !(dc?.value?.run === date && dc.value.done);
  if (alertsDone && !dailyDue) return json(req, { skipped: true, ran: meta.ran });

  // só uma execução por vez
  const { data: claimed } = await db.rpc('push_claim', { secs: LEASE_S });
  if (!claimed) return json(req, { busy: true });

  try {
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
    const url = `${SITE}?aba=seguindo`;
    const out: Record<string, unknown> = { ran: meta.ran };

    if (!alertsDone) {
      const r = await runJob(db, 'alerts', alertsRun, deadline, async (s) => {
        // deno-lint-ignore no-explicit-any
        const { alerts, next } = computeAlerts(all as any, (s.follows ?? []) as any, (s.snapshot ?? {}) as any);
        const mine = alerts.filter((a: { kind: string }) => wants(s.prefs ?? {}, a.kind));
        const list: Payload[] = mine.slice(0, 3).map((a: { title: string; body: string; id: string }) => ({ title: a.title, body: a.body, tag: a.id, url }));
        if (mine.length > 3) list.push({ title: 'vybe', body: `+${mine.length - 3} novidades de quem você segue`, tag: 'vybe-mais', url });
        const res = await deliver(s, list);
        if (res.gone) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        else await db.from('push_subscriptions').update({ snapshot: next, ...(list.length ? { last_push_at: new Date().toISOString() } : {}) }).eq('endpoint', s.endpoint);
        return res;
      });
      out.alerts = r;
      if (r.done) await db.from('app_state').upsert({ key: 'last_run', value: { ran: meta.ran, processed: r.processed, sent: r.sent, removed: r.removed }, updated_at: new Date().toISOString() });
    }

    // resumo do dia: só pra quem ligou (prefs.daily), no máximo uma vez por dia
    if (dailyDue && Date.now() < deadline) {
      out.daily = await runJob(db, 'daily', date, deadline, async (s) => {
        if (!s.prefs?.daily) return { sent: 0, gone: false };
        // deno-lint-ignore no-explicit-any
        const sum = dailySummary(all as any, (s.follows ?? []) as any);
        if (!sum) return { sent: 0, gone: false };
        const res = await deliver(s, [{ title: sum.title, body: sum.body, tag: `vybe-dia-${date}`, url }]);
        if (res.gone) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        return res;
      });
    }
    return json(req, out);
  } finally {
    await db.from('app_state').delete().eq('key', 'push_lock');
  }
});
