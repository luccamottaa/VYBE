import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocked, bucket, buildBatch, cleanProps, EVENTS, isEvent } from '../lib/analytics-core.ts';

test('Não rastrear, Global Privacy Control e robô bloqueiam; navegador comum não', () => {
  assert.equal(blocked({ doNotTrack: '1' }), true);
  assert.equal(blocked({ doNotTrack: 'yes' }), true);
  assert.equal(blocked({ gpc: true }), true);
  assert.equal(blocked({ webdriver: true }), true);
  assert.equal(blocked({ doNotTrack: '0', gpc: false, webdriver: false }), false);
  assert.equal(blocked({}), false);
});

test('só os eventos da lista passam', () => {
  for (const e of EVENTS) assert.equal(isEvent(e), true);
  assert.equal(isEvent('search_text'), false);
  assert.equal(isEvent(''), false);
});

test('propriedades: só valores simples e curtos', () => {
  const p = cleanProps({ a: 'x'.repeat(100), b: 3, c: true, d: { nome: 'Tate' }, e: ['x'], f: null, g: undefined, h: Infinity });
  assert.deepEqual(Object.keys(p).sort(), ['a', 'b', 'c']);
  assert.equal((p.a as string).length, 40);
});

test('busca vira faixa de tamanho, nunca o texto', () => {
  assert.deepEqual([0, 2, 7, 30].map(bucket), ['0', '1-3', '4-10', '11+']);
});

test('lote do PostHog: sem IP, sem GeoIP, sem perfil, e com o app e a visita', () => {
  const b = buildBatch('phc_x', 'visita-1', [{ event: 'tab_view', props: { tab: 'charts' }, at: Date.UTC(2026, 10, 3) }], { app: 'vybe', version: '2.4' });
  assert.equal(b.api_key, 'phc_x');
  const ev = b.batch[0];
  assert.equal(ev.event, 'tab_view');
  assert.equal(ev.timestamp, '2026-11-03T00:00:00.000Z');
  assert.deepEqual(ev.properties, { app: 'vybe', version: '2.4', tab: 'charts', distinct_id: 'visita-1', $process_person_profile: false, $ip: null, $geoip_disable: true });
});
