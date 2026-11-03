'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { artistPhoto } from '@/lib/artist-photos';
import type { Artist } from '@/lib/search';
import { artwork, daysSince, fmtCompact, fmtFull, splitArtists, type ChartView, type ViewTrack } from '@/lib/vybe';
import { cn } from '@/lib/utils';
import { Cover } from './ui';

type Tile = { id: string; emoji: string; label: string; stat: string; sub: string; track: ViewTrack; ring: string; glow: string };

const relDays = (d: number) => (d === 0 ? 'saiu hoje' : d === 1 ? 'saiu ontem' : `saiu há ${d} dias`);

/** Cards de destaque com a capa ocupando tudo: maior alta, estreia, mais ouvida, lançamento, veterana. */
export function SpotlightTiles({ view, onOpen }: { view: ChartView | null; onOpen: (t: ViewTrack) => void }) {
  const tiles = useMemo<Tile[]>(() => {
    if (!view?.tracks.length) return [];
    const t = view.tracks;
    const used = new Set<string>([t[0].id]); // o #1 já está no destaque grande
    const pick = (list: ViewTrack[]) => list.find((x) => !used.has(x.id) && (used.add(x.id), true));
    const out: Tile[] = [];
    const climber = view.hasMovement ? pick([...t].filter((x) => (x.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))) : undefined;
    if (climber) out.push({ id: 'up', emoji: '🔥', label: 'Maior alta', stat: `+${climber.change}`, sub: `agora #${climber.rank}`, track: climber, ring: 'ring-emerald-400/60', glow: 'from-emerald-500/40' });
    const debut = view.hasMovement ? pick(t.filter((x) => x.isNew)) : undefined;
    if (debut) out.push({ id: 'new', emoji: '✨', label: 'Estreia', stat: `#${debut.rank}`, sub: 'entrou agora', track: debut, ring: 'ring-cyan-400/60', glow: 'from-cyan-500/40' });
    const loud = pick([...t].filter((x) => typeof x.streams === 'number').sort((a, b) => (b.streams ?? 0) - (a.streams ?? 0)));
    if (loud) out.push({ id: 'loud', emoji: '🎧', label: 'Mais ouvida hoje', stat: fmtCompact(loud.streams ?? 0), sub: 'streams no Spotify', track: loud, ring: 'ring-fuchsia-400/60', glow: 'from-fuchsia-500/40' });
    const fresh = pick(
      [...t]
        .filter((x) => x.releaseDate && (daysSince(x.releaseDate, view.updated) ?? 99) <= 30)
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')),
    );
    if (fresh) out.push({ id: 'fresh', emoji: '💿', label: 'Lançamento fresco', stat: `#${fresh.rank}`, sub: relDays(daysSince(fresh.releaseDate, view.updated) ?? 0), track: fresh, ring: 'ring-amber-300/60', glow: 'from-amber-400/40' });
    const vet = pick([...t].filter((x) => (x.days ?? 0) > 0).sort((a, b) => (b.days ?? 0) - (a.days ?? 0)));
    if (vet) out.push({ id: 'vet', emoji: '⏳', label: 'Veterana do chart', stat: `${fmtFull(vet.days ?? 0)}`, sub: 'dias no chart', track: vet, ring: 'ring-violet-400/60', glow: 'from-violet-500/40' });
    return out;
  }, [view]);

  if (!view) return <TileSkeleton />;
  if (!tiles.length) return null;
  return (
    <section aria-label="Destaques de agora">
      <SectionHead title="Agora no vybe" hint="O que tá mexendo no ranking" />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {tiles.map((x, i) => (
          <button
            key={x.id}
            onClick={() => onOpen(x.track)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              'theme-dark group relative aspect-[3/4] w-[44%] shrink-0 snap-start overflow-hidden rounded-3xl text-left shadow-xl shadow-black/20 ring-1 transition-transform duration-300 active:scale-[0.97] motion-safe:animate-[vy-up_0.5s_cubic-bezier(0.2,0.8,0.2,1)_backwards] sm:w-auto sm:hover:-translate-y-1',
              x.ring,
            )}
          >
            <Cover eager src={x.track.artworkUrl100 ? artwork(x.track.artworkUrl100, 400) : ''} alt="" className="absolute inset-0 h-full w-full rounded-none border-0 transition-transform duration-500 group-hover:scale-105" />
            <div className={cn('absolute inset-0 bg-gradient-to-t via-black/45 to-transparent', x.glow)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
              <span aria-hidden>{x.emoji}</span> {x.label}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="text-3xl font-black leading-none tracking-tight text-white drop-shadow">{x.stat}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">{x.sub}</p>
              <p className="mt-2 truncate text-sm font-bold text-white">{x.track.name}</p>
              <p className="truncate text-[11px] text-white/70">{x.track.artistName}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Artistas do momento em bolinhas com anel colorido, tipo stories. */
export function ArtistBubbles({ view, onArtist }: { view: ChartView | null; onArtist: (a: Artist) => void }) {
  const top = useMemo(() => {
    if (!view?.tracks.length) return [];
    const map = new Map<string, { name: string; count: number; best: number; artwork?: string }>();
    for (const t of view.tracks)
      for (const name of splitArtists(t.artistName)) {
        const k = name.toLowerCase();
        const r = map.get(k) ?? { name, count: 0, best: t.rank, artwork: t.artworkUrl100 };
        r.count++;
        if (t.rank < r.best) {
          r.best = t.rank;
          r.artwork = t.artworkUrl100 || r.artwork;
        }
        map.set(k, r);
      }
    return [...map.values()].sort((a, b) => b.count - a.count || a.best - b.best).slice(0, 12);
  }, [view]);

  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    top.forEach((a) =>
      artistPhoto(a.name).then((url) => {
        if (alive && url) setPhotos((p) => (p[a.name] === url ? p : { ...p, [a.name]: url }));
      }),
    );
    return () => {
      alive = false;
    };
  }, [top]);

  if (!top.length) return null;
  return (
    <section aria-label="Artistas do momento">
      <SectionHead title="Artistas do momento" hint="Quem tem mais músicas no ranking" />
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {top.map((a, i) => (
          <button key={a.name} onClick={() => onArtist({ name: a.name, picture: photos[a.name] })} className="group flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className="relative rounded-full bg-[conic-gradient(from_200deg,#22d3ee,#3b82f6,#a855f7,#ec4899,#22d3ee)] p-[2.5px] transition-transform group-active:scale-90">
              <span className="block rounded-full bg-background p-[2px]">
                <Cover eager round src={photos[a.name] ?? (a.artwork ? artwork(a.artwork, 160) : '')} alt="" className="h-16 w-16" />
              </span>
              <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-background bg-cyan-500 px-1.5 text-[10px] font-black text-[#020617]">{a.count}</span>
              {i === 0 && <span className="absolute -left-1 -top-2 text-base" aria-hidden>👑</span>}
            </span>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-200 group-hover:text-cyan-300">{a.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2 px-1">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight text-white">{title}</h3>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      {action ?? <ChevronRight className="h-4 w-4 text-slate-600 sm:hidden" aria-hidden />}
    </div>
  );
}

function TileSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" role="status" aria-label="Carregando destaques">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="aspect-[3/4] w-[44%] shrink-0 animate-pulse rounded-3xl bg-slate-800/50 sm:w-[19%]" />
      ))}
    </div>
  );
}
