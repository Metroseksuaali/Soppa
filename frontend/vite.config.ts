import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Viivakoodilukijan wasm (~1 Mt) ei kuulu esilatattavaan pakettiin: sitä tarvitsee
        // vain se osa käyttäjistä jolla ei ole selaimen omaa lukijaa (iPhone), ja heillekin
        // vasta kun skanneri avataan. Selain hakee sen silloin normaalisti verkosta.
        globIgnores: ['**/*.wasm'],
      },
      manifest: {
        name: 'Soppa — Catering-varastonhallinta',
        short_name: 'Soppa',
        description: 'Soppa: catering-tiimin varastonhallinta',
        // Vastaa yläpalkin pintaa (index.css --c-surface), ei brand-väriä:
        // asennetun sovelluksen otsikkopalkki jatkuu suoraan yläpalkkiin.
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Kehityksessä välitä /api Vitestä backendiin.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
