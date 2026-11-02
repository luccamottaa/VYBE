'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Disc3, Loader2, Music2, Radar, Search, User } from 'lucide-react';
import { matchesWords, mergeSongs, searchCatalogArtists, searchCatalogSongs, searchIndex, searchIndexArtists, type Artist, type Song } from '@/lib/search';
import type { ViewTrack } from '@/lib/vybe';
import { Cover } from './ui';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Busca do header. Digitar continua filtrando o ranking aberto e, a partir de 2 letras, abre um painel com:
 * faixas do chart aberto, artistas e músicas (índice do vybe + catálogo inteiro do iTunes).
 */
export function GlobalSearch({
  query,
  onQuery,
  inputRef,
  tracks,
  onTrack,
  onSong,
  onArtist,
}: {
  query: string;
  onQuery: (q: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  tracks: ViewTrack[];
  onTrack: (t: ViewTrack) => void;
  onSong: (s: Song) => void;
  onArtist: (a: Artist) => void;
}) {
  const [open, setOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [busy, setBusy] = useState(false);
  const [catalogDown, setCatalogDown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const q = query.trim();

  // fecha ao clicar fora
  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (q.length < 2) {
      setSongs([]);
      setArtists([]);
      return;
    }
    const c = new AbortController();
    let local: Song[] = [];
    let localArtists: Artist[] = [];
    // índice local: na hora
    Promise.all([searchIndex(q, 8), searchIndexArtists(q, 4)]).then(([s, a]) => {
      if (c.signal.aborted) return;
      local = s;
      localArtists = a;
      setSongs(s);
      setArtists(a);
    });
    // catálogo: depois de uma pausa na digitação
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const [cs, ca] = await Promise.all([searchCatalogSongs(q, c.signal, 15), searchCatalogArtists(q, c.signal, 5)]);
        if (c.signal.aborted) return;
        setCatalogDown(false);
        setSongs(mergeSongs(local, cs).slice(0, 15));
        const seen = new Set<string>();
        setArtists(
          [...ca, ...localArtists]
            .filter((a) => {
              const k = norm(a.name);
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .slice(0, 5),
        );
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setCatalogDown(true);
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }, 320);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q]);

  const inChart = q.length >= 2 ? tracks.filter((t) => matchesWords(`${t.name} ${t.artistName}`, q)).slice(0, 4) : [];
  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={box} className="relative order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1 lg:w-80 lg:flex-none">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          onQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && songs[0]) pick(() => onSong(songs[0]));
        }}
        maxLength={200}
        aria-label="Buscar música ou artista"
        placeholder="Buscar qualquer música ou artista"
        className="w-full rounded-xl border border-slate-800/80 bg-slate-950/60 py-2 pl-10 pr-9 text-xs text-slate-200 placeholder-slate-500 transition-all focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      />
      {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />}

      {open && q.length >= 2 && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto sm:left-auto sm:w-[26rem] rounded-2xl border border-slate-800 bg-popover p-2 shadow-2xl">
          {inChart.length > 0 && (
            <Group icon={<Radar className="h-3.5 w-3.5" />} title="Neste chart">
              {inChart.map((t) => (
                <Row key={t.id} onClick={() => pick(() => onTrack(t))} cover={t.artworkUrl100} title={t.name} sub={t.artistName} badge={`#${t.rank}`} />
              ))}
            </Group>
          )}

          {artists.length > 0 && (
            <Group icon={<User className="h-3.5 w-3.5" />} title="Artistas">
              {artists.map((a) => (
                <Row key={a.artistId ?? a.name} onClick={() => pick(() => onArtist(a))} title={a.name} sub={a.genre ?? 'Artista'} round />
              ))}
            </Group>
          )}

          <Group icon={<Music2 className="h-3.5 w-3.5" />} title="Músicas">
            {songs.length ? (
              songs.map((s) => (
                <Row
                  key={s.key}
                  onClick={() => pick(() => onSong(s))}
                  cover={s.artwork}
                  title={s.name}
                  sub={s.album ? `${s.artist} · ${s.album}` : s.artist}
                  badge={s.markets?.length ? `${s.markets.length} ${s.markets.length === 1 ? 'chart' : 'charts'}` : undefined}
                />
              ))
            ) : (
              <p className="px-2 py-3 text-xs text-slate-500">{busy ? 'Procurando no catálogo…' : 'Nenhuma música encontrada.'}</p>
            )}
          </Group>
          {catalogDown && <p className="px-2 pb-1 text-[10px] text-amber-300">Catálogo completo fora do ar agora: mostrando só o que passou pelos charts.</p>}
          <p className="flex items-center gap-1 px-2 pt-1 text-[10px] text-slate-500">
            <Disc3 className="h-3 w-3" /> Clique numa música pra ver os charts dela em todos os mercados.
          </p>
        </div>
      )}
    </div>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function Row({ onClick, cover, title, sub, badge, round }: { onClick: () => void; cover?: string; title: string; sub: string; badge?: string; round?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-800/50">
      {round ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
          <User className="h-4 w-4 text-cyan-500/70" />
        </span>
      ) : (
        <Cover src={cover ?? ''} alt="" className="h-9 w-9 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{title}</span>
        <span className="block truncate text-[11px] text-slate-500">{sub}</span>
      </span>
      {badge && <span className="shrink-0 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">{badge}</span>}
    </button>
  );
}
