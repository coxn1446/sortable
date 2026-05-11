import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

dotenv.config({ quiet: true });

function readDevHttps() {
  const crt = process.env.SSL_CRT_FILE?.trim();
  const key = process.env.SSL_KEY_FILE?.trim();
  if (!crt || !key) return undefined;
  const crtPath = path.resolve(process.cwd(), crt);
  const keyPath = path.resolve(process.cwd(), key);
  if (!fs.existsSync(crtPath) || !fs.existsSync(keyPath)) {
    // eslint-disable-next-line no-console
    console.warn('[vite] SSL_CRT_FILE / SSL_KEY_FILE set but file missing; using HTTP.');
    return undefined;
  }
  return {
    cert: fs.readFileSync(crtPath),
    key: fs.readFileSync(keyPath),
  };
}

const devHttps = readDevHttps();
const anyHttpsDevUrl = [process.env.CAPACITOR_DEV_SERVER_URL, process.env.CAP_DEV_URL, process.env.CAP_SERVER_URL_DEV]
  .filter((v) => typeof v === 'string' && v.trim())
  .some((v) => /^https:\/\//i.test(v.trim()));
if (!devHttps && anyHttpsDevUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    '[vite] A dev WebView URL is https:// but Vite has no TLS (set SSL_CRT_FILE + SSL_KEY_FILE in .env and run `npm run cert`). Serving HTTP will cause ERR_SSL_PROTOCOL_ERROR on device.'
  );
}

export default defineConfig({
  plugins: [
    react({
      include: '**/*.{js,jsx,ts,tsx}',
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    https: devHttps,
    // ngrok / tunnel + LAN IP (Capacitor on a physical device): allow non-localhost Host headers.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'build',
    assetsDir: 'static',
    sourcemap: false,
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
});
