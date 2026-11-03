'use client';

import { Component, type ReactNode } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

const SAFE = 'vybe:safe';

/** Modo seguro: sem animações pesadas. Liga sozinho depois de um erro, ou com ?seguro=1. */
export function safeMode() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(location.search).get('seguro') === '1' || sessionStorage.getItem(SAFE) === '1';
  } catch {
    return false;
  }
}

/** Segura erros de uma parte da tela sem derrubar o vybe inteiro. */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string; full?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    try {
      sessionStorage.setItem(SAFE, '1');
    } catch {
      /* ok */
    }
    console.error('[vybe]', this.props.label ?? 'erro', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.full ? 'flex min-h-screen items-center justify-center bg-background p-6' : ''}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <ShieldAlert className="h-9 w-9 text-rose-400" />
          <h2 className="text-lg font-bold text-white">{this.props.full ? 'O vybe tropeçou' : 'Essa parte não carregou'}</h2>
          <p className="text-sm text-slate-400">Já liguei o modo seguro (sem animações). Tenta de novo; se continuar, recarrega a página.</p>
          <code className="max-w-full truncate rounded-lg bg-slate-900/70 px-2 py-1 text-[0.6875rem] text-slate-500">{this.state.error.message}</code>
          <div className="flex gap-2">
            <button onClick={() => this.setState({ error: null })} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-[#020617] hover:bg-cyan-400">
              <RotateCcw className="h-3.5 w-3.5" /> Tentar de novo
            </button>
            <button onClick={() => location.reload()} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800">
              Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
