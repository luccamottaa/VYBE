import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeo, slugify } from '../scripts/pages/seo.ts';
import { readDeepLink } from '../lib/deep-link.ts';

test('slug mantém letras de qualquer idioma', () => {
  assert.equal(slugify('Pós (Ao Vivo) - Felipe'), 'pos-ao-vivo-felipe');
  assert.equal(slugify('체포하겠어'), '체포하겠어');
  assert.equal(slugify('しあわせ'), 'しあわせ');
});

test('gera página por música e artista, sitemap e robots', () => {
  const files = buildSeo(
    { 'housewife|tatemcrae': { n: 'Housewife', a: 'Tate McRae & <Fulano>', img: 'https://x/100x100bb.jpg', sp: 'S'.repeat(22), mk: ['sp:global', 'ap:br'], seen: '2026-11-02' } },
    'https://ex.com/VYBE/',
    '2026-11-02',
  );
  const page = files['musica/housewife-tate-mcrae/index.html'];
  assert.ok(page);
  assert.match(page, /<title>Housewife — Tate McRae &amp; &lt;Fulano&gt; nos charts \| vybe<\/title>/);
  assert.match(page, /600x600bb\.jpg/);
  assert.match(page, /"@type":"MusicRecording"/);
  assert.match(page, /musica=Housewife/);
  assert.ok(files['artista/tate-mcrae/index.html']);
  assert.ok(files['artista/fulano/index.html']);
  assert.equal((files['sitemap.xml'].match(/<url>/g) ?? []).length, 4);
  assert.match(files['robots.txt'], /Sitemap: https:\/\/ex\.com\/VYBE\/sitemap\.xml/);
});

test('deep link aceita só valores válidos', () => {
  assert.deepEqual(readDeepLink('?fonte=spotify&mercado=BR&aba=destaques&musica=Pós'), {
    fonte: 'spotify', pais: undefined, mercado: 'br', aba: 'destaques', buscar: undefined, musica: 'Pós', artista: undefined, spotify: undefined, apple: undefined,
  });
  const bad = readDeepLink('?fonte=tidal&aba=admin&pais=<x>&spotify=../../etc');
  assert.equal(bad.fonte, undefined);
  assert.equal(bad.aba, undefined);
  assert.equal(bad.pais, undefined);
  assert.equal(bad.spotify, undefined);
});
