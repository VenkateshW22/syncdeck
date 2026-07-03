/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env vars for the current mode (development | staging | production).
  // Vite automatically picks up .env, .env.[mode], .env.local, .env.[mode].local
  // — all VITE_* vars are inlined into the bundle; server-side vars are NOT exposed.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      port: parseInt(env.PORT || '3000', 10),
    },
    build: {
      // Generate a manifest so the server can resolve hashed asset filenames.
      manifest: true,
      rollupOptions: {
        output: {
          // Separate vendor chunks for better long-term caching.
          manualChunks: {
            react: ['react', 'react-dom'],
            router: ['react-router'],
            socketio: ['socket.io-client'],
            charts: ['recharts', 'd3'],
            editor: ['@monaco-editor/react'],
            canvas: ['konva', 'react-konva'],
            motion: ['motion'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      exclude: ['tests/**', 'node_modules/**', 'dist/**'],
    },
  };
});
