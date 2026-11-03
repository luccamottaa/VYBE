import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, move, normalizeLayout, toggle } from '../lib/home-layout.ts';

test('layout do início: conserta, reordena e esconde', () => {
  assert.deepEqual(normalizeLayout(null), DEFAULT_LAYOUT);
  // seção desconhecida sai, repetida não duplica, faltante entra no fim
  assert.deepEqual(normalizeLayout({ order: ['ranking', 'xyz' as never, 'ranking', 'hero'] }).order, ['ranking', 'hero', 'spotlight', 'artists']);
  // o ranking não pode ser escondido
  assert.deepEqual(normalizeLayout({ hidden: ['ranking', 'artists'] }).hidden, ['artists']);
  const up = move(DEFAULT_LAYOUT, 'ranking', -1);
  assert.deepEqual(up.order, ['hero', 'spotlight', 'ranking', 'artists']);
  assert.deepEqual(move(DEFAULT_LAYOUT, 'hero', -1), DEFAULT_LAYOUT);
  assert.deepEqual(toggle(toggle(DEFAULT_LAYOUT, 'hero'), 'hero').hidden, []);
});
