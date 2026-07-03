import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Sistema de Gestão de Tickets',
        short_name: 'SGT',
        description: 'Aplicação PWA para gestão de projetos, Kanban e Roadmap',
        theme_color: '#1e1e2d',
        background_color: '#12121c',
        display: 'standalone',
        icons: [
          {
            src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GitHub_Invertocat_Logo.svg/192px-GitHub_Invertocat_Logo.svg.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GitHub_Invertocat_Logo.svg/512px-GitHub_Invertocat_Logo.svg.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
