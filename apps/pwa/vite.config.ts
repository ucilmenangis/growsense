import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'logo-mark.png'],
      manifest: {
        name: 'GrowSense Kader',
        short_name: 'GrowSense',
        description: 'Pencatatan pertumbuhan balita untuk kader Posyandu',
        lang: 'id',
        display: 'standalone',
        start_url: '/',
        theme_color: '#006194',
        background_color: '#faf8ff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
