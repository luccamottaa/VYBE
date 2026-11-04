// Esqueletos do vybe: têm o mesmo formato do conteúdo que vai aparecer (capa, linhas de texto, pílulas),
// então a tela não "pula" quando os dados chegam. Brilho passando por cima (classe .vy-skel, em globals.css).

const bar = (w: string) => <span className="vy-skel block h-3 rounded-full" style={{ width: w }} />;

/** Ranking: cartão do #1 (capa + título + pílulas) e as linhas (número, capa, duas linhas, selo). */
export function RankingSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando ranking" className="space-y-4">
      <div className="flex gap-4 rounded-2xl border border-slate-800/60 p-4">
        <span className="vy-skel h-20 w-20 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2.5 pt-1">
          {bar('40%')}
          {bar('70%')}
          <div className="flex gap-2 pt-1">
            <span className="vy-skel h-5 w-16 rounded-md" />
            <span className="vy-skel h-5 w-20 rounded-md" />
          </div>
        </div>
      </div>
      <ol className="divide-y divide-slate-800/60 border-t border-slate-800/60">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <span className="vy-skel h-3 w-5 shrink-0 rounded" />
            <span className="vy-skel h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              {bar(`${62 - (i % 3) * 8}%`)}
              {bar(`${40 + (i % 4) * 6}%`)}
            </div>
            <span className="vy-skel h-6 w-10 shrink-0 rounded-full" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Destaques da home: cartões em carrossel com a capa cheia e o texto embaixo. */
export function TilesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando destaques" className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative aspect-[3/4] w-[44%] shrink-0 overflow-hidden rounded-3xl sm:w-[19%]">
          <span className="vy-skel absolute inset-0" />
          <div className="absolute inset-x-3 bottom-3 space-y-2">
            <span className="block h-2.5 w-2/3 rounded-full bg-white/10" />
            <span className="block h-4 w-5/6 rounded-full bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lista genérica (faixas de álbum, catálogo, etc.): quadrado + duas linhas por item. */
export function ListSkeleton({ rows = 6, label = 'Carregando' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2">
          <span className="vy-skel h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            {bar(`${70 - (i % 3) * 10}%`)}
            {bar(`${45 + (i % 2) * 15}%`)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Carrossel de cards (discografia, artistas, lançamentos): capa quadrada + título. */
export function CardsSkeleton({ count = 4, label = 'Carregando' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-32 shrink-0 space-y-2">
          <span className="vy-skel block aspect-square w-full rounded-2xl" />
          {bar('85%')}
          {bar('55%')}
        </div>
      ))}
    </div>
  );
}
