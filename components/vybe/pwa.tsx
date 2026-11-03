'use client';

import { useEffect, useState } from 'react';
import { Download, RefreshCw, Share, SquarePlus, X } from 'lucide-react';
import { isStatic } from '@/lib/data-source';
import { LogoMark } from './logo';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DISMISS = 'vybe:install-dismissed';
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const dismissedRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS) ?? 0) < 14 * 86400000;
  } catch {
    return false;
  }
};

/** Barra de instalar o app (Android/desktop: prompt nativo; iPhone: instruções) + aviso de versão nova. */
export function PwaBar() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);

  // registra o service worker (só no build do Pages)
  useEffect(() => {
    if (!isStatic || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const base = import.meta.env.BASE_URL ?? '/';
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((reg) => {
        const watch = (w: ServiceWorker | null) =>
          w?.addEventListener('statechange', () => w.state === 'installed' && navigator.serviceWorker.controller && setUpdate(w));
        if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => watch(reg.installing));
        // confere atualização quando volta pro app
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
      })
      .catch(() => {});
    // só recarrega quando a versão antiga estava no comando (atualização). Na primeira instalação a
    // página já veio atualizada da rede: recarregar só atrapalharia (e cortaria a abertura animada).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      location.reload();
    });
  }, []);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const t = setTimeout(() => {
      if (isIOS()) setIos(true);
      setShow(true);
    }, 12000);
    const onInstalled = () => setShow(false);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS, String(Date.now()));
    } catch {
      /* ok */
    }
  };

  if (update)
    return (
      <Bar>
        <RefreshCw className="h-5 w-5 shrink-0 text-cyan-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Versão nova do vybe</p>
          <p className="text-xs text-slate-400">Atualiza pra pegar as novidades.</p>
        </div>
        <button onClick={() => update.postMessage('skip-waiting')} className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-[#020617] hover:bg-cyan-400">
          Atualizar
        </button>
      </Bar>
    );

  if (!show || (!install && !ios)) return null;

  return (
    <Bar>
      <LogoMark className="h-9 w-auto shrink-0" title="" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Instale o vybe</p>
        {ios ? (
          <p className="text-xs text-slate-400">
            Toque em <Share className="inline h-3.5 w-3.5 -translate-y-px text-cyan-400" /> e depois em <SquarePlus className="inline h-3.5 w-3.5 -translate-y-px text-cyan-400" /> “Adicionar à Tela de Início”.
          </p>
        ) : (
          <p className="text-xs text-slate-400">Abre em tela cheia, funciona offline e avisa de quem você segue.</p>
        )}
      </div>
      {install && (
        <button
          onClick={async () => {
            await install.prompt();
            await install.userChoice.catch(() => null);
            setInstall(null);
            setShow(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-bold text-[#020617]"
        >
          <Download className="h-3.5 w-3.5" /> Instalar
        </button>
      )}
      <button onClick={dismiss} aria-label="Agora não" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
        <X className="h-4 w-4" />
      </button>
    </Bar>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:pb-[calc(env(safe-area-inset-bottom)+0.75rem)] motion-safe:animate-[vy-up_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
      <div role="status" className="glass-float flex w-full max-w-lg items-center gap-3 rounded-3xl p-3">
        {children}
      </div>
    </div>
  );
}
