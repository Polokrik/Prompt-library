import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH permet de fixer le chemin du dépôt sur GitHub Pages (ex. "/prompt-library/").
// Par défaut le chemin relatif "./" fonctionne partout, y compris sous un sous-dossier.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/**/*.test.{ts,mts,tsx}'], environment: 'node' },
});
