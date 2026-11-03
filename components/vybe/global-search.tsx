'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Disc3, Library, Loader2, Mic, Music2, Radar, Search, User } from 'lucide-react';
import { listen, voiceSupported } from '@/lib/voice';
import { albumTypeLabel, searchAlbums, type Album } from '@/lib/albums';
import { matchesWords, mergeSongs, searchDeezerSongs, searchSpotifySongs, searchCatalogArtists, searchCatalogSongs, searchDeezerArtists, searchSpotifyArtists, searchIndex, searchIndexArtists, type Artist, type Song } from '@/lib/search';
import type { ViewTrack } from '@/lib/vybe';
import { PreviewButton } from './preview';
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
  onAll,
  onAlbum,
}: {
  query: string;
  onQuery: (q: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  tracks: ViewTrack[];
  onTrack: (t: ViewTrack) => void;
  onSong: (s: Song) => void;
  onArtist: (a: Artist) => void;
  /** Abre a página com todos os resultados. */
  onAll: (q: string) => void;
  onAlbum: (a: Album) => void;
}) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [open, setOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [busy, setBusy] = useState(false);
  const [catalogDown, setCatalogDown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // busca por voz
  const [canVoice, setCanVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const stopVoice = useRef<(() => void) | null>(null);
  useEffect(() => setCanVoice(voiceSupported()), []);
  const toggleVoice = () => {
    if (listening) {
      stopVoice.current?.();
      return;
    }
    setListening(true);
    setOpen(true);
    stopVoice.current = listen(
      (text) => text && onQuery(text),
      () => {
        setListening(false);
        stopVoice.current = null;
        inputRef.current?.focus();
      },
    );
  };
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
      setAlbums([]);
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
        const [sp, ap, dz, ca] = await Promise.allSettled([
          searchSpotifySongs(q, 0, c.signal),
          searchCatalogSongs(q, c.signal, 12),
          searchDeezerSongs(q, 0, c.signal, 12),
          searchCatalogArtists(q, c.signal, 5),
        ]);
        // fotos dos artistas: Spotify e Deezer têm, a Apple não manda
        Promise.allSettled([searchSpotifyArtists(q, c.signal), searchDeezerArtists(q, c.signal, 6)]).then((rs) => {
          if (c.signal.aborted) return;
          const withPic = rs.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
          setArtists((cur) => {
            const pics = new Map(withPic.filter((a) => a.picture).map((a) => [norm(a.name), a] as const));
            const merged = cur.map((a) => {
              const p = pics.get(norm(a.name));
              return p ? { ...a, picture: a.picture ?? p.picture, spotifyId: a.spotifyId ?? p.spotifyId, deezerId: a.deezerId ?? p.deezerId } : a;
            });
            // artista que só o Spotify/Deezer achou entra também (até 5 no total)
            for (const a of withPic) if (merged.length < 5 && !merged.some((m) => norm(m.name) === norm(a.name))) merged.push(a);
            return merged;
          });
        });
        searchAlbums(q, c.signal, 6)
          .then((a) => !c.signal.aborted && setAlbums(a.slice(0, 4)))
          .catch(() => !c.signal.aborted && setAlbums([]));
        if (c.signal.aborted) return;
        if (ap.status === 'rejected' && dz.status === 'rejected' && sp.status === 'rejected') throw ap.reason;
        setCatalogDown(false);
        setSongs(mergeSongs(local, sp.status === 'fulfilled' ? sp.value.songs : [], ap.status === 'fulfilled' ? ap.value : [], dz.status === 'fulfilled' ? dz.value.songs : []).slice(0, 12));
        const cs = ca.status === 'fulfilled' ? ca.value : [];
        const seen = new Set<string>();
        setArtists(
          [...cs, ...localArtists]
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
          if (e.key === 'Enter' && q.length >= 2) pick(() => onAll(q));
        }}
        maxLength={200}
        aria-label="Buscar música ou artista"
        placeholder={listening ? 'Pode falar…' : 'Buscar qualquer música ou artista'}
        className={`w-full rounded-xl border border-slate-800/80 bg-slate-950/60 py-2 pl-10 ${canVoice ? 'pr-16' : 'pr-9'} text-xs text-slate-200 placeholder-slate-500 transition-all focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50`}
      />
      {busy && !listening && <Loader2 className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500 ${canVoice ? 'right-11' : 'right-3'}`} />}
      {canVoice && (
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={listening ? 'Parar de ouvir' : 'Buscar por voz'}
          aria-pressed={listening}
          className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-all ${
            listening ? 'bg-rose-500 text-white shadow-[0_0_0_6px_rgb(244_63_94/0.25)] motion-safe:animate-pulse' : 'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>
      )}

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
                <Row key={a.artistId ?? a.name} onClick={() => pick(() => onArtist(a))} cover={a.picture} title={a.name} sub={a.genre ?? 'Artista'} round />
              ))}
            </Group>
          )}

          {albums.length > 0 && (
            <Group icon={<Library className="h-3.5 w-3.5" />} title="Álbuns">
              {albums.map((a) => (
                <Row key={a.key} onClick={() => pick(() => onAlbum(a))} cover={a.artwork} title={a.name} sub={`${albumTypeLabel(a)} · ${a.artist}${a.releaseDate ? ` · ${a.releaseDate.slice(0, 4)}` : ''}`} />
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
                  preview={s.preview}
                />
              ))
            ) : (
              <p className="px-2 py-3 text-xs text-slate-500">{busy ? 'Procurando no catálogo…' : 'Nenhuma música encontrada.'}</p>
            )}
          </Group>
          {catalogDown && <p className="px-2 pb-1 text-[0.625rem] text-amber-300">Catálogo completo fora do ar agora: mostrando só o que passou pelos charts.</p>}
          <button
            onClick={() => pick(() => onAll(q))}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
          >
            <Search className="h-3.5 w-3.5" /> Ver todos os resultados de “{q}”
          </button>
          <p className="flex items-center gap-1 px-2 pt-2 text-[0.625rem] text-slate-500">
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
      <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function Row({ onClick, cover, title, sub, badge, round, preview }: { onClick: () => void; cover?: string; title: string; sub: string; badge?: string; round?: boolean; preview?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-slate-800/50">
    <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-left">
      <Cover src={cover ?? ''} alt="" eager round={round} className="h-9 w-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{title}</span>
        <span className="block truncate text-[0.6875rem] text-slate-500">{sub}</span>
      </span>
      {badge && <span className="shrink-0 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-cyan-400">{badge}</span>}
    </button>
    <PreviewButton src={preview} label={title} />
    </div>
  );
}
