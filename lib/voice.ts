// Busca por voz (Web Speech API). No Safari do iPhone é webkitSpeechRecognition; o áudio vai pro
// reconhecimento do próprio sistema/navegador, não pro vybe.
type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const Ctor = () =>
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition);

export const voiceSupported = () => !!Ctor();

/** Escuta uma frase. onText recebe o parcial enquanto fala e o final no fim. Devolve uma função pra parar. */
export function listen(onText: (text: string, final: boolean) => void, onEnd: (error?: string) => void) {
  const C = Ctor();
  if (!C) {
    onEnd('unsupported');
    return () => {};
  }
  const r = new C();
  r.lang = 'pt-BR';
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.continuous = false;
  let error: string | undefined;
  r.onresult = (e) => {
    const res = Array.from(e.results);
    const text = res.map((x) => x[0]?.transcript ?? '').join(' ').trim();
    onText(text, res.every((x) => x.isFinal));
  };
  r.onerror = (e) => (error = e.error);
  r.onend = () => onEnd(error);
  try {
    r.start();
  } catch {
    onEnd('start');
  }
  return () => r.stop();
}
