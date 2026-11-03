'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { analyticsBlocked, setConsent, useConsent } from '@/lib/analytics';

/** Pergunta uma vez, depois da abertura, se pode contar como o vybe é usado. Sem resposta = nada é enviado. */
export function ConsentBanner() {
  const consent = useConsent();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4500); // espera a abertura animada e a primeira tela
    return () => clearTimeout(t);
  }, []);
  if (!ready || consent !== null || analyticsBlocked()) return null;
  const base = import.meta.env.BASE_URL ?? '/';
  return (
    <aside
      role="dialog"
      aria-label="Estatísticas anônimas"
      data-consent
      className="vy-pop glass-float fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 mx-auto max-w-md rounded-3xl p-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:mx-0"
    >
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <BarChart3 className="h-4 w-4 text-cyan-300" /> Posso contar como você usa o vybe?
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
        Só medidas anônimas, tipo quais telas abrem. Sem IP, sem nome, sem conta, e nada de música ou busca. Muda quando quiser, lá no rodapé.{' '}
        <a href={`${base}privacidade/`} className="font-semibold text-cyan-300 underline-offset-2 hover:underline">
          Saiba mais
        </a>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setConsent('no')} className="vy-press rounded-full border border-slate-600/70 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60">
          Agora não
        </button>
        <button onClick={() => setConsent('yes')} className="vy-press rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-[#020617]">
          Pode contar
        </button>
      </div>
    </aside>
  );
}

/** Rodapé: ver e mudar a escolha. Some quando o navegador já pede pra não ser rastreado. */
export function StatsToggle() {
  const consent = useConsent();
  if (analyticsBlocked()) return null;
  const on = consent === 'yes';
  return (
    <button onClick={() => setConsent(on ? 'no' : 'yes')} aria-pressed={on} className="hover:text-cyan-400">
      Estatísticas: {on ? 'ligadas' : 'desligadas'}
    </button>
  );
}
