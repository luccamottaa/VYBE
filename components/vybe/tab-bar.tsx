'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';

type Tab<T extends string> = readonly [T, string, ComponentType<{ className?: string }>, number?];

/** Barra de abas de vidro flutuando embaixo (celular/tablet). A "gota" desliza até a aba ativa e a barra
 *  encolhe (só ícones) quando você rola pra baixo, como no iOS 26. */
export function TabBar<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: readonly Tab<T>[] }) {
  const [mini, setMini] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 12) return;
      setMini(y > last && y > 160);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const i = Math.max(0, tabs.findIndex(([id]) => id === value));

  return (
    <nav
      aria-label="Seções"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] lg:hidden"
    >
      <div
        role="tablist"
        className={cn(
          'glass-float pointer-events-auto relative grid rounded-full p-1.5 transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          mini ? 'w-[min(15rem,80vw)]' : 'w-[min(26rem,100%)]',
        )}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {/* gota de vidro da aba ativa */}
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-1.5 rounded-full bg-gradient-to-b from-cyan-400/90 to-cyan-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_6px_16px_-4px_rgb(6_182_212/0.6)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: `calc((100% - 0.75rem) / ${tabs.length})`, transform: `translateX(${i * 100}%)` }}
        />
        {tabs.map(([id, label, Icon, badge]) => {
          const on = id === value;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              aria-label={label}
              onClick={() => {
                onChange(id);
                if (navigator.vibrate) navigator.vibrate(8);
              }}
              className={cn(
                'relative z-10 flex flex-col items-center justify-center rounded-full py-1.5 transition-[height,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95',
                mini ? 'h-10' : 'h-12',
                on ? 'text-[#020617]' : 'text-slate-300 hover:text-white',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]', mini && 'scale-110')} />
              <span className={cn('grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]', mini ? 'mt-0 grid-rows-[0fr] opacity-0' : 'mt-0.5 grid-rows-[1fr] opacity-100')}>
                <span className="min-h-0 overflow-hidden text-[0.625rem] font-semibold leading-none">{label}</span>
              </span>
              {!!badge && (
                <span className="absolute right-[18%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.5625rem] font-black text-white ring-2 ring-slate-950">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
