'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { releases, VERSION } from '@/lib/changelog';
import { cn } from '@/lib/utils';

const SEEN = 'vybe:seen-version';

/** Selo da versão no topo; abre as novidades. Pisca até a pessoa ver a versão nova. */
export function VersionBadge({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    try {
      setFresh(localStorage.getItem(SEEN) !== VERSION);
    } catch {
      /* ok */
    }
  }, []);
  const onOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      setFresh(false);
      try {
        localStorage.setItem(SEEN, VERSION);
      } catch {
        /* ok */
      }
    }
  };
  return (
    <>
      <button
        onClick={() => onOpen(true)}
        aria-label={`Novidades da versão ${VERSION}`}
        className={cn('relative self-start rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[0.625rem] font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20', className)}
      >
        v{VERSION}
        {fresh && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={onOpen}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-cyan-400" /> Novidades
            </DialogTitle>
            <DialogDescription className="text-slate-400">O que mudou no vybe.</DialogDescription>
          </DialogHeader>
          <ol className="relative space-y-6 border-l border-slate-800 pl-5">
            {releases.map((r, i) => (
              <li key={r.version} className="relative">
                <span className={cn('absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-popover', i === 0 ? 'bg-cyan-400' : 'bg-slate-600')} />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[0.625rem] font-black', i === 0 ? 'bg-cyan-500 text-[#020617]' : 'bg-slate-800 text-slate-300')}>v{r.version}</span>
                  <h3 className="text-sm font-bold text-white">{r.title}</h3>
                  <span className="text-[0.6875rem] text-slate-500">{new Date(`${r.date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {r.items.map((it) => (
                    <li key={it} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                      {it}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
