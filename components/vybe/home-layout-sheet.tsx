'use client';

import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_LAYOUT, move, SECTION_LABEL, setLayout, toggle, useLayout } from '@/lib/home-layout';

/** Botão ⚙ + painel pra esconder e reordenar as seções do início. */
export function HomeLayoutButton() {
  const [open, setOpen] = useState(false);
  const layout = useLayout();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Personalizar o início"
        className="glass ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-200 transition-transform active:scale-95"
      >
        <SlidersHorizontal className="h-4 w-4 text-cyan-400" /> <span className="hidden sm:inline">Personalizar</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl border-slate-800 bg-popover text-slate-100">
          <SheetHeader>
            <SheetTitle className="text-white">Seu início</SheetTitle>
            <SheetDescription className="text-slate-400">Esconda ou mude a ordem das seções. Fica salvo neste aparelho.</SheetDescription>
          </SheetHeader>
          <ol className="space-y-2 px-4">
            {layout.order.map((s, i) => {
              const on = !layout.hidden.includes(s);
              return (
                <li key={s} className={`glass flex items-center gap-2 rounded-2xl p-2 pl-3 transition-opacity ${on ? '' : 'opacity-60'}`}>
                  <span className="w-5 text-center text-xs font-black text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{SECTION_LABEL[s]}</span>
                  <button onClick={() => setLayout(move(layout, s, -1))} disabled={i === 0} aria-label={`Subir ${SECTION_LABEL[s]}`} className="rounded-full p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-25">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => setLayout(move(layout, s, 1))} disabled={i === layout.order.length - 1} aria-label={`Descer ${SECTION_LABEL[s]}`} className="rounded-full p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-25">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <Switch checked={on} disabled={s === 'ranking'} onCheckedChange={() => setLayout(toggle(layout, s))} aria-label={`Mostrar ${SECTION_LABEL[s]}`} />
                </li>
              );
            })}
          </ol>
          <div className="flex justify-between px-4 pb-6 pt-2">
            <button onClick={() => setLayout(DEFAULT_LAYOUT)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-300">
              <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
            </button>
            <button onClick={() => setOpen(false)} className="rounded-full bg-cyan-500 px-5 py-2 text-xs font-bold text-[#020617]">
              Pronto
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
