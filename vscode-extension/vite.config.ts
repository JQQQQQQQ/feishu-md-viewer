import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'webview'),
  // VS Code rewrites the entry script and stylesheet to webview resource URIs.
  // Keep all Vite-generated dynamic imports and CSS preloads relative to that
  // script instead of resolving them against the Webview's virtual root.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: resolve(__dirname, 'webview/index.html'),
      output: {
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        // VS Code Webviews use a virtual resource protocol. Mermaid's lazy
        // chunks can fail to fetch through that protocol even when their
        // files exist, so keep the VS Code preview self-contained in one JS
        // resource. The Chrome build retains normal code splitting.
        inlineDynamicImports: true,
      },
    },
  },
});
