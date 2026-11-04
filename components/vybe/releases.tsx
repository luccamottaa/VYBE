'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { albumsByArtist, albumTypeLabel, type Album } from '@/lib/albums';
import type { Follow } from '@/lib/follow';
import { pickReleases, releaseWhen, type Release } from '@/lib/releases';
import { artwork } from '@/lib/vybe';
import { cn } from '@/lib/utils';
import { Cover, Panel } from './ui';

const CACHE = 'vybe:releases';
const TTL = 6 * 3600000;

/** Lançamentos dos artistas seguidos (discografia da Apple + Deezer, cache de 6 h no aparelho). */
export function FollowedReleases({ artists, onAlbum }: { artists: Extract<Follow, { kind: 'artist' }>[]; onAlbum: (a: Album) => void }) {
  const [data, setData] = useState<{ upcoming: Release[]; recent: Release[] } | null>(null);
  const keys = artists.map((a) => a.key).join('|');

  useEffect(() => {
    if (!artists.length) return;
    const c = new AbortController();
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      let cache: Record<string, { at: number; albums: Album[] }> = {};
      try {
        cache = JSON.parse(localStorage.getItem(CACHE) ?? '{}');
      } catch {
        /* ok */
      }
      const list = await Promise.all(
        artists.slice(0, 12).map(async (f) => {
          const hit = cache[f.key];
          if (hit && Date.now() - hit.at < TTL) return { artist: f.name, albums: hit.albums };
          const albums = await albumsByArtist({ name: f.name, artistId: f.artistId }, c.signal).catch(() => [] as Album[]);
          // guarda só o que interessa (últimos ~40 dias e futuros) pra não encher o armazenamento
          const keep = albums.filter((a) => a.releaseDate && a.releaseDate >= new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10));
          cache[f.key] = { at: Date.now(), albums: keep };
          return { artist: f.name, albums: keep };
        }),
      );
      if (c.signal.aborted) return;
      try {
        localStorage.setItem(CACHE, JSON.stringify(cache));
      } catch {
        /* ok */
      }
      setData(pickReleases(list, today));
    })();
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  if (!artists.length) return null;
  const items = data ? [...data.upcoming, ...data.recent] : [];
  return (
    <Panel>
      <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-white">
        <CalendarClock className="h-4 w-4 text-amber-300" /> Lançamentos
      </h3>
      <p className="mb-4 text-xs text-slate-400">De quem você segue: o que saiu no último mês e o que já tem data nas lojas.</p>
      {!data ? (
        <div className="hscroll -mx-5 gap-3 [--hs-gap:0.75rem] [--hs-pad:1.25rem] sm:-mx-6 sm:[--hs-pad:1.5rem]">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="w-32 shrink-0"><span className="vy-skel block aspect-square w-full rounded-2xl" /></div>
          ))}
        </div>
      ) : items.length ? (
        <div className="hscroll -mx-5 snap-x gap-3 pb-1 [--hs-gap:0.75rem] [--hs-pad:1.25rem] sm:-mx-6 sm:[--hs-pad:1.5rem]">
          {items.map((r) => (
            <button key={r.key} onClick={() => onAlbum(r)} className="vy-press group w-32 shrink-0 snap-start text-left">
              <div className="relative">
                <Cover eager src={r.artwork ? artwork(r.artwork, 300) : ''} alt="" className="aspect-square w-full rounded-2xl" />
                <span
                  className={cn(
                    'theme-dark absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[0.625rem] font-bold backdrop-blur-md',
                    r.days < 0 ? 'bg-amber-400/90 text-[#1c1300]' : r.days <= 7 ? 'bg-emerald-400/90 text-[#022c1c]' : 'bg-black/55 text-white',
                  )}
                >
                  {r.days < 0 ? 'Em breve' : r.days <= 7 ? 'Novo' : albumTypeLabel(r)}
                </span>
              </div>
              <p className="mt-1.5 truncate text-xs font-bold text-white group-hover:text-cyan-300">{r.name}</p>
              <p className="truncate text-[0.625rem] text-slate-400">{r.followed}</p>
              <p className={cn('text-[0.625rem] font-semibold', r.days < 0 ? 'text-amber-300' : 'text-emerald-400')}>{releaseWhen(r.days)}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400">Nenhum lançamento recente ou anunciado de quem você segue.</p>
      )}
    </Panel>
  );
}
