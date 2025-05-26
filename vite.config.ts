import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path, { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  publicDir: 'public',

  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.tsx'),
      },
      output: {
        entryFileNames: '[name].js', // e.g., popup.js, content.js
        assetFileNames: '[name].[ext]',
      },
    },
    outDir: 'dist',
  },
})
