/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" no build do GitHub Pages: lê JSON estático em vez das rotas /api. */
  readonly VITE_STATIC?: string;
}
