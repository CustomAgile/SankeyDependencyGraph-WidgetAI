/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

/**
 * Vite configuration for Sankey Dependency Graph.
 *
 * Dev server: npm run dev
 *   - Proxies /slm/* to Rally (requires auth.json in project root)
 *   - Defaults to mock data unless ?live=true
 *
 * Production build: npm run build
 *   - Outputs IIFE bundle to dist/app.js
 *   - React loaded from CDN (not bundled)
 *
 * Mock build: npm run build:mock
 *   - Same as production but __USE_MOCK__ is hardcoded to true
 */

import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'fs';

function cssInlinePlugin() {
  return {
    name: 'css-inline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const cssChunks = [];
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.css')) {
          cssChunks.push(chunk.source);
          delete bundle[fileName];
        }
      }
      if (cssChunks.length === 0) return;
      const css = cssChunks.join('\n').replace(/`/g, '\\`').replace(/\\/g, '\\\\');
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = `(function(){var s=document.createElement('style');s.textContent=\`${css}\`;document.head.appendChild(s)})();\n` + chunk.code;
        }
      }
    },
  };
}

const rallyConfig = JSON.parse(readFileSync('./rally.config.json', 'utf-8'));
const appVersion = (rallyConfig.version || '0.0.0') + '-' + (rallyConfig.build || 0);

/**
 * Load Rally credentials for the dev-server proxy.
 *
 * Source order (first non-empty value wins per field):
 *   1. ./auth.json:  { "server": "https://rally1.rallydev.com", "apiKey": "..." }
 *   2. Env vars:     RALLY_SERVER, RALLY_API_KEY
 */
function getAuth() {
  let server = '';
  let apiKey = '';
  try {
    if (existsSync('./auth.json')) {
      const j = JSON.parse(readFileSync('./auth.json', 'utf-8'));
      server = j.server ?? '';
      apiKey = j.apiKey ?? '';
    }
  } catch { /* ignore */ }
  if (!server) server = process.env.RALLY_SERVER ?? '';
  if (!apiKey) apiKey = process.env.RALLY_API_KEY ?? '';
  return { server, apiKey };
}

const auth = getAuth();
const bundleReact = !!rallyConfig.bundleReact;

export default defineConfig({
  plugins: [cssInlinePlugin()],

  optimizeDeps: {
    include: ['react', 'react-dom'],
  },

  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __USE_MOCK__: process.env.VITE_USE_MOCK !== undefined
      ? process.env.VITE_USE_MOCK === 'true'
      : undefined,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: './src/main.tsx',
      ...(bundleReact ? {} : {
        external: ['react', 'react-dom', 'react-dom/client'],
      }),
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        ...(bundleReact ? {} : {
          globals: {
            'react': 'React',
            'react-dom': 'ReactDOM',
            'react-dom/client': 'ReactDOM',
          },
        }),
      },
    },
  },

  server: {
    open: false,
    port: 5175,
    proxy: auth.server ? {
      '/slm': {
        target: auth.server,
        changeOrigin: true,
        headers: {
          'ZSESSIONID': auth.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
    } : undefined,
  },
});
