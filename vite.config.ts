import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './public/manifest.json';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.tsx'),
        viewer: resolve(__dirname, 'src/viewer/viewer.html'),
        options: resolve(__dirname, 'src/options/options.html'),
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('/node_modules/')) return;

          if (
            /\/node_modules\/(?:unified|remark|rehype|micromark|mdast-util|hast-util|unist-util|vfile)\//.test(normalizedId)
          ) {
            return 'markdown-vendor';
          }

          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(normalizedId)) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
