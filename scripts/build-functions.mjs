// Empacota a lógica de alertas do app (lib/alerts.ts + dependências puras) num ESM só, pras Edge Functions
// do Supabase (Deno) usarem exatamente o mesmo cálculo do aparelho.
//   node scripts/build-functions.mjs
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    lib: { entry: here('../lib/alerts.ts'), formats: ['es'], fileName: () => 'alerts.js' },
    outDir: here('../supabase/functions/_shared'),
    emptyOutDir: false,
    minify: false,
    target: 'es2022',
  },
});
console.log('supabase/functions/_shared/alerts.js pronto');
