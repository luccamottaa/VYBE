// Build estático do vybe para o GitHub Pages:
//   VITE_STATIC=1 pnpm exec vite build -c vite.pages.config.ts
// Saída em dist-pages/. Os dados (JSON) são copiados para dist-pages/data pela GitHub Action.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('./pages'),
  // Repositório luccamottaa/VYBE → https://luccamottaa.github.io/VYBE/
  base: process.env.PAGES_BASE ?? '/VYBE/',
  publicDir: here('./public'),
  envDir: here('.'),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss({ base: here('.') })] } },
  resolve: {
    alias: [
      { find: 'next/link', replacement: here('./pages/shims/link.tsx') },
      { find: /^@\//, replacement: here('./') + '/' },
    ],
  },
  build: { outDir: here('./dist-pages'), emptyOutDir: true },
});
