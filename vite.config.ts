import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Increase the limit to 5MiB to accommodate your large JS chunk
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
        // Optional: Force all assets to be cached
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Factory Monitoring Dashboard',
        short_name: 'FactoryDash',
        description: 'Real-time Machine Monitoring and Analytics',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            // Ensure logo.png actually exists in your /public folder
            src: 'logo.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // Using __dirname with path.resolve is safe now that the space is gone
      '@': path.resolve(__dirname, './src'),
    },
  },
})