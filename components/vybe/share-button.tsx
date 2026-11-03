'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Link2, Loader2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { renderCard, slug, type CardData } from '@/lib/share-card';
import { cn } from '@/lib/utils';

/** Botão que gera o card do vybe (PNG 1080x1350) e abre o compartilhar do aparelho. */
export function ShareButton({ data, link, className, compact }: { data: () => CardData; link: string; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState<CardData | null>(null);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const start = async () => {
    const d = data();
    setCard(d);
    setOpen(true);
    setBusy(true);
    setBlob(null);
    try {
      const b = await renderCard(d);
      setBlob(b);
      setUrl(URL.createObjectURL(b));
    } finally {
      setBusy(false);
    }
  };

  const file = blob && card ? new File([blob], `vybe-${slug(card.title)}.png`, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });

  const share = async () => {
    if (!file || !card) return;
    try {
      await navigator.share({ files: [file], title: `${card.title} · vybe`, text: `${card.title} — ${card.subtitle} no vybe\n${link}` });
    } catch {
      /* cancelado */
    }
  };
  const download = () => {
    if (!url || !file) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem clipboard */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label="Compartilhar"
        title="Gerar card pra postar"
        className={cn(
          'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-800/60 text-xs font-bold text-slate-300 transition-all hover:border-cyan-500/40 hover:text-cyan-300 active:scale-95',
          compact ? 'w-9' : 'px-3',
          className,
        )}
      >
        <Share2 className="h-4 w-4" />
        {!compact && <span>Compartilhar</span>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-slate-800 bg-popover text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Compartilhar</DialogTitle>
            <DialogDescription className="text-slate-400">Card pronto pro story, feed ou grupo.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            {url ? (
              <img src={url} alt={`Card de ${card?.title}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">{busy ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Não deu pra gerar a imagem.'}</div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={share} disabled={!canShareFile} className="flex flex-col items-center gap-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-2.5 text-[0.6875rem] font-bold text-[#020617] transition-opacity disabled:opacity-40">
              <Share2 className="h-4 w-4" /> Enviar
            </button>
            <button onClick={download} disabled={!url} className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/70 px-2 py-2.5 text-[0.6875rem] font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40">
              <Download className="h-4 w-4" /> Baixar
            </button>
            <button onClick={copy} className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/70 px-2 py-2.5 text-[0.6875rem] font-bold text-slate-200 hover:bg-slate-800">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />} {copied ? 'Copiado' : 'Link'}
            </button>
          </div>
          {!canShareFile && url && <p className="text-center text-[0.6875rem] text-slate-500">Esse navegador não envia imagem direto: baixa e posta 😉</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
