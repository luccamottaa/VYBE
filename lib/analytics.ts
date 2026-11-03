// Estatísticas anônimas do vybe (PostHog). Regras:
//  - só depois do "pode contar" da pessoa; sem resposta ou "agora não" = nada sai do aparelho
//  - "Não rastrear" / Global Privacy Control: não coleta e nem pergunta
//  - sem cookies, sem IP, sem conta, sem nome de música/artista/busca; id aleatório novo a cada visita
//  - fila só na memória (até 50 pendentes, 100 por visita), sem tentar de novo em loop
import { useSyncExternalStore } from 'react';
import { releases } from './changelog';
import { blocked, buildBatch, cleanProps, isEvent, POSTHOG_HOST, type Env, type Queued } from './analytics-core';

// Token público de envio do projeto (feito pra ficar no navegador; só deixa gravar eventos).
const API_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? 'phc_yxT3ZC8brv4uP5EngDqbsvr4uMi8NacXJTZXGcTiX3bk';
const KEY = 'vybe:analytics';
const EVENT = 'vybe:analytics';
const MAX_QUEUE = 50;
const MAX_VISIT = 100;

export type Consent = 'yes' | 'no' | null;

const env = (): Env => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null };
  return { doNotTrack: n.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack ?? null, gpc: n.globalPrivacyControl, webdriver: n.webdriver };
};
export const analyticsBlocked = () => typeof window === 'undefined' || blocked(env());

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'yes' || v === 'no' ? v : null;
  } catch {
    return null;
  }
}

let queue: Queued[] = [];
let sent = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let visitId: string | undefined;
const id = () => (visitId ??= crypto.randomUUID());

function flush() {
  timer = undefined;
  if (!queue.length || getConsent() !== 'yes' || analyticsBlocked()) {
    queue = [];
    return;
  }
  const batch = queue;
  queue = [];
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const body = buildBatch(API_KEY, id(), batch, { app: 'vybe', version: releases[0].version, display: standalone ? 'app' : 'site' });
  fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

/** Registra um evento. Sem consentimento, não faz nada. */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !isEvent(event) || analyticsBlocked() || getConsent() !== 'yes') return;
  if (sent >= MAX_VISIT || queue.length >= MAX_QUEUE) return;
  sent++;
  queue.push({ event, props: cleanProps(props), at: Date.now() });
  timer ??= setTimeout(flush, 2000);
}

export function setConsent(c: Exclude<Consent, null>) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
  if (c === 'no') {
    queue = [];
    sent = 0;
  }
  window.dispatchEvent(new Event(EVENT));
  if (c === 'yes') track('app_open');
}

if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && queue.length) flush();
  });

const sub = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};
export const useConsent = () => useSyncExternalStore(sub, getConsent, () => null as Consent);
