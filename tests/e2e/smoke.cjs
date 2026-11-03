// Smoke test visual do vybe: abre o build estático com dados fixos (tests/fixtures/data) em navegadores reais.
//   node tests/e2e/smoke.cjs http://127.0.0.1:4173/VYBE/ chromium webkit
// Sai com código 1 se algo quebrar; salva screenshots em test-results/.
const { mkdirSync } = require('node:fs');
const pw = require('playwright');

const [base = 'http://127.0.0.1:4173/VYBE/', ...names] = process.argv.slice(2);
const browsers = names.length ? names : ['chromium'];
const out = 'test-results';
mkdirSync(out, { recursive: true });

const views = {
  desktop: { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
  mobile: { viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

async function step(label, fn) {
  const t = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${label} (${Date.now() - t} ms)`);
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.message.split('\n')[0]}`);
    throw e;
  }
}

(async () => {
  let failed = 0;
  for (const name of browsers) {
    const browser = await pw[name].launch();
    for (const [vname, opts] of Object.entries(views)) {
      if (name === 'webkit' && vname === 'mobile') opts.isMobile = false; // WebKit no Linux não emula isMobile
      console.log(`${name} · ${vname}`);
      const ctx = await browser.newContext(opts);
      // fontes externas (Apple, Spotify, kworb, Deezer, Vercel) ficam fora: o teste usa só os dados do build
      await ctx.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (s) => page.screenshot({ path: `${out}/${name}-${vname}-${s}.png` });
      try {
        await step('ranking unificado (Apple + Spotify) carrega', async () => {
          await page.goto(base, { waitUntil: 'networkidle' });
          await page.getByText('Top 100 vybe', { exact: false }).first().waitFor({ timeout: 15000 });
          await page.locator('ol > li').nth(9).waitFor({ timeout: 15000 });
          await shot('home');
        });
        await step('trocar pro Brasil e abrir uma música do ranking', async () => {
          await page.getByRole('combobox', { name: 'Mercado do ranking' }).click();
          await page.getByRole('option', { name: /Brasil/ }).click();
          await page.getByText('Top 100 vybe · 🇧🇷 Brasil').waitFor({ timeout: 15000 });
          await page.locator('ol > li button').first().click();
          await page.getByText('Charts da música').waitFor();
          await page.getByRole('button', { name: 'Fechar' }).click();
          await page.getByText('Charts da música').waitFor({ state: 'hidden' });
        });
        await step('Top álbuns abre e o painel do álbum carrega', async () => {
          await page.goto(`${base}?tipo=albuns`, { waitUntil: 'networkidle' });
          await page.getByText('Top 100 Álbuns', { exact: false }).first().waitFor({ timeout: 15000 });
          await page.locator('ol > li button').first().click();
          await page.getByRole('heading', { name: 'Faixas' }).waitFor();
          await shot('album');
          await page.keyboard.press('Escape');
          await page.goto(base, { waitUntil: 'networkidle' });
        });
        await step('aba Destaques', async () => {
          await page.getByRole('tab', { name: 'Destaques' }).click();
          await page.getByText('Quem manda em cada chart').waitFor();
          await page.getByText('Em todo lugar').waitFor();
          await shot('destaques');
        });
        await step('link direto abre a música e dá pra seguir', async () => {
          await page.goto(`${base}?musica=Housewife&artista=Tate%20McRae`, { waitUntil: 'networkidle' });
          await page.getByText('Charts da música').waitFor();
          await page.getByRole('button', { name: /^Seguir Housewife/ }).click();
          await page.getByRole('button', { name: /^Deixar de seguir Housewife/ }).waitFor();
          await shot('musica');
        });
        await step('card de compartilhar é gerado', async () => {
          await page.getByRole('button', { name: 'Compartilhar' }).click();
          await page.locator('img[alt^="Card de"]').waitFor({ timeout: 15000 });
          await shot('card');
          await page.keyboard.press('Escape');
        });
        await step('aba Seguindo lista a música', async () => {
          await page.goto(`${base}?aba=seguindo`, { waitUntil: 'networkidle' });
          await page.getByText('Seus artistas e músicas.').waitFor();
          await page.getByText('Housewife').first().waitFor();
          await shot('seguindo');
        });
        await step('manifest e service worker publicados', async () => {
          const m = await page.evaluate(async (b) => (await fetch(`${b}manifest.webmanifest`)).json(), base);
          if (m.short_name !== 'vybe' || !m.icons?.length) throw new Error('manifest inválido');
          const sw = await page.evaluate(async (b) => (await fetch(`${b}sw.js`)).status, base);
          if (sw !== 200) throw new Error(`sw.js ${sw}`);
        });
        if (errors.length) throw new Error(`erros de JS: ${errors.join(' | ')}`);
      } catch (e) {
        failed++;
        await shot('falha').catch(() => {});
        if (!String(e.message).startsWith('erros')) console.log(`  erros de JS: ${errors.join(' | ') || 'nenhum'}`);
        else console.log(`  ${e.message}`);
      }
      await ctx.close();
    }
    await browser.close();
  }
  console.log(failed ? `\n${failed} cenário(s) falharam.` : '\nTudo certo.');
  process.exit(failed ? 1 : 0);
})();
