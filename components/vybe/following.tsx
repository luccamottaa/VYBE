'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, BellRing, Crown, Star, Trash2, TrendingDown, TrendingUp, Sparkles, Trophy, LogOut } from 'lucide-react';
import { artistHits, findHits, loadAllCharts, type All } from '@/lib/all-charts';
import type { Alert, AlertKind } from '@/lib/alerts';
import { disableNotifications, enableNotifications, notificationsOn, notificationsSupported, testNotification, useAlerts } from '@/lib/alerts-store';
import { artistKey, useFollows, type Follow } from '@/lib/follow';
import { buildInsights } from '@/lib/insights';
import { songFrom, type Artist, type Song } from '@/lib/search';
import { artwork } from '@/lib/vybe';
import { cn } from '@/lib/utils';
import { FollowButton } from './follow-button';
import { FollowedReleases } from './releases';
import type { Album } from '@/lib/albums';
import { Switch } from '@/components/ui/switch';
import { PREFS, setPref, usePrefs } from '@/lib/alert-prefs';
import { Cover, Panel } from './ui';
import { AccountCard } from './account';
import { disablePush, enablePush, pushOn, pushSupported } from '@/lib/push';

const kindStyle: Record<AlertKind, { icon: typeof Bell; cls: string }> = {
  no1: { icon: Crown, cls: 'text-amber-300 bg-amber-400/10 border-amber-400/25' },
  'artist-no1': { icon: Crown, cls: 'text-amber-300 bg-amber-400/10 border-amber-400/25' },
  top10: { icon: TrendingUp, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  entry: { icon: Sparkles, cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25' },
  'artist-entry': { icon: Sparkles, cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25' },
  milestone: { icon: Trophy, cls: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  left: { icon: LogOut, cls: 'text-slate-400 bg-slate-800/60 border-slate-700' },
};

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Aba "Seguindo": quem você segue, onde está agora e o feed de alertas. */
export function Following({ onSong, onArtist, onAlbum }: { onSong: (s: Song) => void; onArtist: (a: Artist) => void; onAlbum: (a: Album) => void }) {
  const follows = useFollows();
  const { feed, unread, readAt, markRead, clear } = useAlerts();
  const [all, setAll] = useState<All | null>(null);
  const [notif, setNotif] = useState(false);

  useEffect(() => {
    loadAllCharts().then(setAll).catch(() => {});
    setNotif(notificationsOn() || pushOn());
  }, []);
  // marca como lido ao sair da aba (mantém o destaque enquanto a pessoa olha)
  const [seenAt] = useState(readAt);
  useEffect(() => () => markRead(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const songs = follows.filter((f): f is Extract<Follow, { kind: 'song' }> => f.kind === 'song');
  const artists = follows.filter((f): f is Extract<Follow, { kind: 'artist' }> => f.kind === 'artist');
  const suggestions = useMemo(() => (all ? buildInsights(all).artists.filter((a) => !artists.some((f) => f.key === artistKey(a.name))).slice(0, 4) : []), [all, artists]);

  const [hint, setHint] = useState('');
  const toggleNotif = async () => {
    setHint('');
    if (notif) {
      disableNotifications();
      await disablePush();
      setNotif(false);
      return;
    }
    if (pushSupported()) {
      const r = await enablePush().catch(() => 'error' as const);
      if (r === 'install') {
        setHint('No iPhone, os avisos com o app fechado só funcionam com o vybe instalado na tela de início (Compartilhar → Adicionar à Tela de Início).');
      } else if (r === 'granted') {
        await enableNotifications();
        setNotif(true);
        setHint('Pronto: você recebe os avisos mesmo com o vybe fechado, logo depois de cada atualização dos charts.');
        return;
      } else if (r === 'error') setHint('Não deu pra falar com o servidor de avisos agora. Ficou ligado só com o app aberto.');
    }
    const p = await enableNotifications();
    const on = p === 'granted';
    setNotif(on);
    if (on) testNotification();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Seguindo</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Seus artistas e músicas.</h2>
          <p className="mt-1 text-sm text-slate-400">Toque na ⭐ de qualquer música ou artista. O vybe avisa quando entrar no top 10, chegar ao #1 ou bater marca de streams.</p>
        </div>
        {notificationsSupported() && (
          <button
            onClick={toggleNotif}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition-all',
              notif ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-cyan-500/40',
            )}
          >
            {notif ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {notif ? 'Notificações ligadas' : 'Ativar notificações'}
          </button>
        )}
      </div>
      {hint && <p className="glass rounded-2xl px-4 py-3 text-xs text-slate-200">{hint}</p>}

      <AccountCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* feed */}
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <Bell className="h-4 w-4 text-cyan-400" /> Novidades
              {unread > 0 && <span className="rounded-full bg-cyan-500 px-1.5 text-[10px] font-black text-[#020617]">{unread}</span>}
            </h3>
            {feed.length > 0 && (
              <button onClick={clear} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-400">
                <Trash2 className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
          {feed.length ? (
            <ol className="space-y-2">
              {feed.map((a) => (
                <AlertRow key={a.id} a={a} fresh={a.at > seenAt} onOpen={() => a.song && onSong(songFrom(a.song))} />
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center">
              <Bell className="mx-auto h-7 w-7 text-slate-600" />
              <p className="mt-2 text-sm font-bold text-white">Nada novo por enquanto</p>
              <p className="mt-1 text-xs text-slate-400">
                {follows.length ? 'Os alertas aparecem aqui quando os charts mudarem (a coleta roda 3x por dia).' : 'Siga alguém pra começar a receber alertas.'}
              </p>
            </div>
          )}
          <AlertPrefs />
          {notif && (
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              As notificações chegam quando o vybe é aberto e os charts mudaram. Aviso com o app fechado precisa de um servidor de push (fica pra próxima).
            </p>
          )}
        </Panel>

        <div className="space-y-6 lg:col-span-3">
          <FollowedReleases artists={artists} onAlbum={onAlbum} />

          {/* músicas */}
          <Panel>
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" /> Músicas <span className="text-xs font-medium text-slate-500">{songs.length}</span>
            </h3>
            {songs.length ? (
              <div className="space-y-2">
                {songs.map((f) => {
                  const hits = all ? findHits(all, f) : [];
                  return (
                    <div key={f.key} className="flex items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-2 pr-2.5">
                      <button onClick={() => onSong(songFrom(f))} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Cover eager src={f.artwork ? artwork(f.artwork, 160) : ''} alt="" className="h-12 w-12 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300">{f.name}</p>
                          <p className="truncate text-[11px] text-slate-400">{f.artist}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {!all ? (
                              <span className="h-4 w-24 animate-pulse rounded bg-slate-800" />
                            ) : hits.length ? (
                              hits.slice(0, 4).map((h) => (
                                <span key={h.market} className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', h.rank === 1 ? 'bg-amber-400/15 text-amber-300' : h.rank <= 10 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-300')}>
                                  {h.label} #{h.rank}
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                <TrendingDown className="h-3 w-3" /> fora dos charts agora
                              </span>
                            )}
                            {hits.length > 4 && <span className="text-[10px] text-slate-500">+{hits.length - 4}</span>}
                          </div>
                        </div>
                      </button>
                      <FollowButton compact target={f} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-400">Abra uma música e toque em ⭐ Seguir.</p>
            )}
          </Panel>

          {/* artistas */}
          <Panel>
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
              <Star className="h-4 w-4 fill-purple-400 text-purple-400" /> Artistas <span className="text-xs font-medium text-slate-500">{artists.length}</span>
            </h3>
            {artists.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {artists.map((f) => {
                  const hs = all ? artistHits(all, f.name) : [];
                  return (
                    <div key={f.key} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => onArtist({ name: f.name, artistId: f.artistId, picture: f.artwork })} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
                          <Cover eager src={f.artwork ? artwork(f.artwork, 160) : ''} alt="" className="h-12 w-12 shrink-0 rounded-full" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white group-hover:text-purple-300">{f.name}</p>
                            <p className="text-[11px] text-slate-400">{all ? (hs.length ? `${hs.length} ${hs.length === 1 ? 'música' : 'músicas'} nos charts` : 'fora dos charts agora') : '…'}</p>
                          </div>
                        </button>
                        <FollowButton compact target={f} />
                      </div>
                      {hs.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-slate-800/60 pt-2">
                          {hs.slice(0, 3).map((s) => (
                            <button key={s.key} onClick={() => onSong(songFrom({ name: s.name, artist: s.artist, artwork: s.artwork, spotifyId: s.spotifyId, appleId: s.appleId }))} className="flex w-full items-center justify-between gap-2 text-left text-xs hover:text-cyan-300">
                              <span className="truncate text-slate-300">{s.name}</span>
                              <span className="shrink-0 font-bold text-white">
                                #{s.hits[0].rank} <span className="font-normal text-slate-500">{s.hits[0].label}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-400">Nenhum artista ainda. Que tal um desses?</p>
            )}
            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Em alta agora</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((a) => (
                    <div key={a.name} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/50 py-1 pl-1 pr-1">
                      <Cover eager src={a.artwork ?? ''} alt="" className="h-7 w-7 rounded-full" />
                      <span className="max-w-32 truncate text-xs font-semibold text-slate-200">{a.name}</span>
                      <FollowButton compact className="h-7 w-7 rounded-full" target={{ kind: 'artist', key: artistKey(a.name), name: a.name, artwork: a.artwork }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ a, fresh, onOpen }: { a: Alert; fresh: boolean; onOpen: () => void }) {
  const k = kindStyle[a.kind];
  return (
    <li>
      <button onClick={onOpen} className={cn('flex w-full items-start gap-3 rounded-2xl border p-2.5 text-left transition-colors hover:bg-slate-800/40', fresh ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-slate-800/60')}>
        <div className="relative shrink-0">
          <Cover eager src={a.song?.artwork ? artwork(a.song.artwork, 160) : ''} alt="" className="h-11 w-11" />
          <span className={cn('absolute -bottom-1.5 -right-1.5 rounded-lg border p-1', k.cls)}>
            <k.icon className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-snug text-white">{a.title}</p>
          <p className="text-[11px] leading-snug text-slate-400">{a.body}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{ago(a.at)}</p>
        </div>
        {fresh && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />}
      </button>
    </li>
  );
}

function AlertPrefs() {
  const prefs = usePrefs();
  return (
    <div className="mt-5 border-t border-slate-800/60 pt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">O que te avisar</p>
      <ul className="space-y-1">
        {PREFS.map((p) => (
          <li key={p.key}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-800/40">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{p.label}</span>
                <span className="block text-[11px] text-slate-400">{p.hint}</span>
              </span>
              <Switch checked={prefs[p.key]} onCheckedChange={(v) => setPref(p.key, !!v)} aria-label={p.label} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
