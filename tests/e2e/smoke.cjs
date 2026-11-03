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

// Quando algo vaza pro lado, diz QUEM (sem isso o CI só dizia "vaza 24px" e eu tinha que adivinhar).
async function offenders(root) {
  return root.evaluate((el) => {
    const rootRight = el === document.documentElement ? innerWidth : el.getBoundingClientRect().right;
    const clipped = (n) => {
      for (let a = n.parentElement; a && a !== el; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.contain.includes('paint')) return true;
      }
      return false;
    };
    const out = [];
    for (const n of el.querySelectorAll('*')) {
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.right > rootRight + 1 && !clipped(n)) out.push({ tag: n.tagName.toLowerCase(), cls: String(n.getAttribute('class') ?? '').slice(0, 70), txt: (n.textContent ?? '').trim().slice(0, 24), right: Math.round(r.right), w: Math.round(r.width) });
    }
    return out.sort((a, b) => b.right - a.right).slice(0, 6);
  });
}

// [nome, largura, altura, celular?, tamanho do texto em px (padrão = 16)]
const sizes = [
  ['iPhone SE', 320, 568, true],
  ['iPhone 14', 390, 844, true],
  ['iPhone Pro Max', 430, 932, true],
  ['celular deitado', 844, 390, true],
  ['iPhone com texto grande', 390, 844, true, 21.6],
  ['iPhone com texto pequeno', 390, 844, true, 13.6],
  ['tablet', 768, 1024, true],
  ['notebook', 1366, 768, false],
  ['monitor grande', 2560, 1440, false],
];

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
        await step('cards que deslizam não encostam na borda', async () => {
          const gap = await page.evaluate(async () => {
            const c = document.querySelector('section[aria-label="Destaques de agora"] .hscroll');
            if (!c || getComputedStyle(c).display !== 'flex') return null; // desktop: grade, sem rolagem
            c.scrollLeft = 0;
            await new Promise((r) => setTimeout(r, 300));
            const first = c.firstElementChild.getBoundingClientRect().left;
            c.scrollLeft = 1e6;
            await new Promise((r) => setTimeout(r, 300));
            const last = innerWidth - c.lastElementChild.getBoundingClientRect().right;
            c.scrollLeft = 0;
            return { first, last };
          });
          if (gap && (gap.first < 8 || gap.last < 8)) throw new Error(`card colado na borda: ${JSON.stringify(gap)}`);
        });
        await step('ranking começa no top 10 e expande', async () => {
          const rows = page.locator('#ranking ol > li');
          if ((await rows.count()) !== 10) throw new Error(`esperava 10 linhas, veio ${await rows.count()}`);
          await page.getByRole('button', { name: /^Ver o top \d+ completo/ }).click();
          await page.waitForFunction(() => document.querySelectorAll('#ranking ol > li').length > 10);
          await page.getByRole('button', { name: 'Mostrar só o top 10' }).click();
          await page.waitForFunction(() => document.querySelectorAll('#ranking ol > li').length === 10);
          // volta pro topo (no celular, com o topo compacto, o seletor de país fica escondido)
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await page.waitForFunction(() => !document.querySelector('header[data-compact]'));
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
        await step('privacidade e termos publicados e linkados', async () => {
          for (const path of ['privacidade/', 'termos/']) {
            const r = await page.evaluate(async (u) => {
              const res = await fetch(u);
              return { status: res.status, html: await res.text() };
            }, `${base}${path}`);
            if (r.status !== 200 || !/<h1>/.test(r.html)) throw new Error(`${path} → ${r.status}`);
          }
          await page.goto(base, { waitUntil: 'networkidle' });
          await page.getByRole('link', { name: 'Privacidade' }).click();
          await page.getByRole('heading', { name: 'Política de Privacidade' }).waitFor();
          await shot('privacidade');
          await page.getByRole('link', { name: 'Termos de Uso' }).click();
          await page.getByRole('heading', { name: 'Termos de Uso' }).waitFor();
        });
        await step('manifest e service worker publicados', async () => {
          const m = await page.evaluate(async (b) => (await fetch(`${b}manifest.webmanifest`)).json(), base);
          if (m.short_name !== 'vybe' || !m.icons?.length) throw new Error('manifest inválido');
          const sw = await page.evaluate(async (b) => (await fetch(`${b}sw.js`)).status, base);
          if (sw !== 200) throw new Error(`sw.js ${sw}`);
        });
        await step('link direto numa PRIMEIRA visita abre a música (contexto novo, sem home antes)', async () => {
          // quem recebe um link compartilhado nunca abriu o vybe antes: o service worker se instala na hora
          // e a página não pode recarregar sozinha perdendo o link
          const c6 = await browser.newContext(opts);
          await c6.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
          try {
            const p6 = await c6.newPage();
            await p6.goto(`${base}?musica=Housewife&artista=Tate%20McRae`, { waitUntil: 'networkidle' });
            await p6.getByText('Charts da música').waitFor({ timeout: 15000 });
            await p6.waitForTimeout(2500); // dá tempo de um reload indevido acontecer
            if (!(await p6.getByText('Charts da música').count())) throw new Error('o painel da música sumiu depois da primeira visita (a página recarregou?)');
          } finally {
            await c6.close();
          }
        });
        await step('abertura animada aparece uma vez por sessão e some sozinha', async () => {
          // o Playwright se anuncia como robô (navigator.webdriver) e a abertura pula robôs: aqui fingimos ser gente
          const c2 = await browser.newContext(opts);
          await c2.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
          await c2.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
          const p2 = await c2.newPage();
          try {
            await p2.goto(base, { waitUntil: 'commit' });
            await p2.waitForSelector('[data-splash]', { timeout: 8000 });
            await p2.waitForSelector('[data-splash]', { state: 'detached', timeout: 8000 });
            await p2.getByText('Top 100 vybe', { exact: false }).first().waitFor({ timeout: 15000 });
            await p2.reload({ waitUntil: 'domcontentloaded' });
            await p2.getByText('Top 100 vybe', { exact: false }).first().waitFor({ timeout: 15000 });
            if (await p2.locator('[data-splash]').count()) throw new Error('a abertura voltou na mesma sessão');
          } finally {
            await c2.close();
          }
        });
        await step('streams: cota do plano estourada não deixa o painel vazio', async () => {
          // simulamos a vybe-api dentro da página (o route do Playwright no WebKit não intercepta tudo); o modo vive no sessionStorage
          const c5 = await browser.newContext(opts);
          await c5.addInitScript(() => {
            const orig = window.fetch.bind(window);
            const reply = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
            window.fetch = (u, o) => {
              const url = String(u instanceof Request ? u.url : u);
              if (url.includes('vybe-api-taupe.vercel.app/api/health')) return reply(200, { spotify: true, streams: true });
              if (url.includes('vybe-api-taupe.vercel.app/api/track'))
                return reply(200, { spotifyId: 'T'.padEnd(22, 'x'), name: 'Ghostbusters', artist: 'Ray Parker Jr.', source: 'https://kworb.net/spotify/track/x.html', firstDate: '2026-10-01', lastDate: '2026-11-02', daily: { dates: ['2026-11-02'], pos: { global: [50] }, streams: { global: [1] }, total: { global: 987654321 }, peak: {} }, weekly: null });
              if (url.includes('vybe-api-taupe.vercel.app/api/streams')) {
                if (sessionStorage.getItem('pw:modo') === 'ok')
                  return reply(200, { spotifyId: 'S2'.padEnd(22, 'x'), total: 111111111, history: [{ date: '2026-11-01', streams: 111000000 }, { date: '2026-11-02', streams: 111111111 }] });
                return reply(429, { error: 'Limite do plano', quota: true });
              }
              return orig(u, o);
            };
          });
          await c5.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
          const url = `${base}?musica=Housewife&artista=Tate%20McRae`;
          try {
            const p5 = await c5.newPage();
            const modo = (m) => p5.evaluate((v) => sessionStorage.setItem('pw:modo', v), m);
            await p5.goto(base, { waitUntil: 'networkidle' }); // deixa o service worker se instalar antes dos links diretos
            await p5.waitForTimeout(1500);
            // 1) cota estourada e nunca consultou: cai no total do chart global (kworb)
            await modo('quota');
            await p5.goto(url, { waitUntil: 'networkidle' });
            await p5.getByText('Do chart global do Spotify (kworb.net)').waitFor({ timeout: 20000 });
            await p5.locator('section', { hasText: 'Do chart global do Spotify (kworb.net)' }).getByText(/\d{1,3}(\.\d{3}){2,}/).first().waitFor();
            // 2) funcionou uma vez; depois a cota acaba: mostra o último valor guardado, avisando
            await modo('ok');
            await p5.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('vybe:streams:')).forEach((k) => localStorage.removeItem(k)));
            await p5.goto(url, { waitUntil: 'networkidle' });
            await p5.getByText('111.111.111').first().waitFor({ timeout: 20000 });
            await p5.evaluate(() =>
              Object.keys(localStorage).filter((k) => k.startsWith('vybe:streams:')).forEach((k) => {
                const v = JSON.parse(localStorage.getItem(k));
                v.at -= 10 * 3600_000; // velho o bastante pra tentar de novo
                localStorage.setItem(k, JSON.stringify(v));
              }),
            );
            await modo('quota');
            await p5.goto(url, { waitUntil: 'networkidle' });
            await p5.getByText('111.111.111').first().waitFor({ timeout: 20000 });
            await p5.getByText(/guardado de .*o contador está no limite/).waitFor({ timeout: 5000 });
            // 3) cota estourada e a música NÃO está no chart global de agora: usa o total da página dela no kworb
            await modo('quota');
            await p5.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('vybe:streams:')).forEach((k) => localStorage.removeItem(k)));
            await p5.goto(`${base}?musica=Ghostbusters&artista=Ray%20Parker%20Jr.`, { waitUntil: 'networkidle' });
            await p5.getByText('987.654.321').first().waitFor({ timeout: 20000 });
            await p5.getByText(/soma os dias em que a música esteve no chart/).waitFor({ timeout: 5000 });
          } finally {
            await c5.close();
          }
        });
        await step('estatísticas: só com consentimento, e nada sai antes disso', async () => {
          // fingimos ser gente (o teste normal é robô e nunca vê o aviso). As requisições externas viram contagem.
          const c3 = await browser.newContext(opts);
          await c3.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            // grava dentro da página o que o app manda pro PostHog (o route do Playwright no WebKit pode não ver fetch com keepalive)
            window.__ph = [];
            const orig = window.fetch.bind(window);
            window.fetch = (u, o) => {
              if (String(u instanceof Request ? u.url : u).includes('posthog.com')) window.__ph.push(String(o?.body ?? ''));
              return orig(u, o);
            };
          });
          await c3.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
          try {
            const p3 = await c3.newPage();
            const errs3 = [];
            const sentNow = () => p3.evaluate(() => window.__ph ?? []);
            p3.on('pageerror', (e) => errs3.push(e.message));
            p3.on('console', (m) => m.type() === 'error' && !/access control|Load failed|Failed to load resource/i.test(m.text()) && errs3.push(`console: ${m.text()}`));
            await p3.goto(base, { waitUntil: 'networkidle' });
            await p3.waitForSelector('[data-consent]', { timeout: 15000 }); // aparece depois da abertura
            if ((await sentNow()).length) throw new Error('mandou evento antes de a pessoa responder');
            await p3.getByRole('button', { name: 'Agora não' }).click();
            await p3.waitForSelector('[data-consent]', { state: 'detached' });
            await p3.getByRole('tab', { name: 'Destaques' }).click();
            await p3.waitForTimeout(2600);
            if ((await sentNow()).length) throw new Error('mandou evento depois de "agora não"');
            if ((await p3.evaluate(() => localStorage.getItem('vybe:analytics'))) !== 'no') throw new Error('não guardou a escolha');
            // ligar pelo rodapé: passa a medir, sem conteúdo
            await p3.getByRole('button', { name: /Estatísticas: desligadas/ }).click();
            await p3.getByRole('tab', { name: 'Seguindo' }).click();
            // o envio sai em até 2 s depois do evento; o WebKit do CI é lento, então espera até 10 s
            for (let i = 0; i < 40 && !(await sentNow()).length; i++) await p3.waitForTimeout(250);
            if (!(await sentNow()).length) throw new Error(`aceitou e nada foi enviado${errs3.length ? ` (erros da página: ${errs3.join(' | ')})` : ''}`);
            const sent = (await sentNow()).join('');
            if (/Tate|Housewife|Olivia/i.test(sent)) throw new Error('nome de música ou artista vazou nos eventos');
            if (!/"\$ip":null/.test(sent) || !/\$geoip_disable":true/.test(sent)) throw new Error('faltam as travas de IP/GeoIP');
            // "Não rastrear" nem pergunta
            const c4 = await browser.newContext({ ...opts });
            await c4.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => false });
              Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
            });
            await c4.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
            const p4 = await c4.newPage();
            await p4.goto(base, { waitUntil: 'networkidle' });
            await p4.waitForTimeout(6000);
            if (await p4.locator('[data-consent]').count()) throw new Error('perguntou mesmo com "Não rastrear" ligado');
            await c4.close();
          } finally {
            await c3.close();
          }
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
    // matriz de telas: do iPhone SE ao monitor grande, com o texto do sistema pequeno e grande
    console.log(`${name} · matriz de telas`);
    for (const [label, width, height, mobile, scale] of sizes) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile && name !== 'webkit',
        hasTouch: mobile && name !== 'webkit',
        colorScheme: 'dark',
      });
      await ctx.route((url) => !url.href.startsWith(new URL(base).origin), (r) => r.abort());
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await step(`${label} (${width}×${height}${scale ? `, texto ${scale}px` : ''})`, async () => {
          await page.goto(base, { waitUntil: 'networkidle' });
          if (scale) await page.evaluate((px) => (document.documentElement.style.fontSize = `${px}px`), scale);
          await page.getByText('Top 100 vybe', { exact: false }).first().waitFor({ timeout: 15000 });
          await page.waitForTimeout(400);
          const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          if (over > 1) throw new Error(`a página vaza ${over}px pro lado: ${JSON.stringify(await offenders(page.locator('html')))}`);
          const tabs = page.locator('nav[aria-label="Seções"]');
          if (width < 1024 && !(await tabs.isVisible())) throw new Error('barra de abas sumiu no celular/tablet');
          if (width >= 1024 && (await tabs.isVisible())) throw new Error('barra de abas flutuante apareceu no desktop');
          await page.screenshot({ path: `${out}/matriz-${name}-${label.replace(/\s+/g, '-')}${scale ? `-${scale}` : ''}.png` });

          // painel do artista: cabe na tela e o X de fechar fica à vista
          await page.goto(`${base}?artista=Tate%20McRae`, { waitUntil: 'networkidle' });
          if (scale) await page.evaluate((px) => (document.documentElement.style.fontSize = `${px}px`), scale);
          const dialog = page.getByRole('dialog');
          await dialog.waitFor({ timeout: 15000 });
          await page.waitForTimeout(700);
          const sheet = await dialog.evaluate((el) => ({ over: el.scrollWidth - el.clientWidth, w: el.getBoundingClientRect().width, vw: innerWidth }));
          if (sheet.over > 1) throw new Error(`o painel do artista vaza ${sheet.over}px: ${JSON.stringify(await offenders(dialog))}`);
          if (sheet.w > sheet.vw + 1) throw new Error('o painel do artista é mais largo que a tela');
          const broken = await dialog.evaluate((el) => [...el.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none' && i.getBoundingClientRect().width > 0).length);
          if (broken) throw new Error(`${broken} imagem(ns) quebrada(s) à mostra no painel do artista`);
          const close = await dialog.getByRole('button', { name: 'Fechar' }).boundingBox();
          if (!close || close.y < 0 || close.x < 0 || close.x + close.width > width + 1 || close.y + close.height > height) throw new Error('o X de fechar saiu da tela');
          await page.screenshot({ path: `${out}/matriz-${name}-${label.replace(/\s+/g, '-')}${scale ? `-${scale}` : ''}-artista.png` });
        });
        // a matriz bloqueia a rede externa de propósito; o WebKit relata cada requisição bloqueada como erro de JS
        const reais = errors.filter((m) => !/due to access control checks|Load failed/i.test(m));
        if (reais.length) throw new Error(`erros de JS: ${reais.join(' | ')}`);
      } catch (e) {
        failed++;
        console.log(`  ${e.message}`);
      }
      await ctx.close();
    }
    await browser.close();
  }
  console.log(failed ? `\n${failed} cenário(s) falharam.` : '\nTudo certo.');
  process.exit(failed ? 1 : 0);
})();
