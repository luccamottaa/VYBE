// Com a conta conectada, seguidos, preferências de alerta e o layout do início ficam iguais em todos os aparelhos.
import { getPrefs, setPref, type PrefKey } from './alert-prefs';
import { followId, getFollows, replaceFollows, setRemote, type Follow } from './follow';
import { getLayout, setLayout } from './home-layout';
import { syncPush } from './push';
import { supabase } from './supabase';

let started = false;
let syncing = false;

async function pullAndMerge(userId: string) {
  syncing = true;
  try {
    // seguidos: união do que está no aparelho com o que está na conta
    const { data: rows } = await supabase.from('follows').select('kind,key,data');
    const server = new Map((rows ?? []).map((r) => [`${r.kind}:${r.key}`, r.data as Follow]));
    const local = getFollows();
    const onlyLocal = local.filter((f) => !server.has(followId(f)));
    if (onlyLocal.length)
      await supabase.from('follows').upsert(onlyLocal.map((f) => ({ user_id: userId, kind: f.kind, key: f.key, data: f })), { onConflict: 'user_id,kind,key' });
    const merged = [...local, ...[...server.values()].filter((f) => !local.some((l) => followId(l) === followId(f)))].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    replaceFollows(merged);

    // preferências e layout: a conta manda; conta nova recebe o que está no aparelho
    const { data: s } = await supabase.from('user_settings').select('alert_prefs,home_layout').maybeSingle();
    if (s) {
      for (const [k, v] of Object.entries(s.alert_prefs ?? {})) setPref(k as PrefKey, !!v);
      if (s.home_layout) setLayout(s.home_layout);
    } else {
      await supabase.from('user_settings').insert({ user_id: userId, alert_prefs: getPrefs(), home_layout: getLayout() });
    }
  } finally {
    syncing = false;
  }
}

let settingsTimer = 0;
function pushSettings(userId: string) {
  if (syncing) return;
  clearTimeout(settingsTimer);
  settingsTimer = window.setTimeout(() => {
    supabase.from('user_settings').upsert({ user_id: userId, alert_prefs: getPrefs(), home_layout: getLayout(), updated_at: new Date().toISOString() }).then(() => {});
  }, 800);
}

/** Liga a sincronização (uma vez por página). Chamado pelo app ao abrir. */
export function startSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  let userId: string | null = null;
  const onPrefs = () => userId && pushSettings(userId);
  window.addEventListener('vybe:alert-prefs', onPrefs);
  window.addEventListener('vybe:home-layout', onPrefs);
  // qualquer mudança nos seguidos/preferências também atualiza a inscrição de push deste aparelho
  window.addEventListener('vybe:follows', () => syncPush());
  window.addEventListener('vybe:alert-prefs', () => syncPush());

  supabase.auth.onAuthStateChange((event, session) => {
    const id = session?.user.id ?? null;
    if (id && id !== userId) {
      userId = id;
      setRemote((f, on) => {
        if (on) supabase.from('follows').upsert({ user_id: id, kind: f.kind, key: f.key, data: f }, { onConflict: 'user_id,kind,key' }).then(() => {});
        else supabase.from('follows').delete().match({ user_id: id, kind: f.kind, key: f.key }).then(() => {});
      });
      pullAndMerge(id).then(() => syncPush());
    } else if (!id && userId) {
      userId = null;
      setRemote(null);
    }
    void event;
  });
}
