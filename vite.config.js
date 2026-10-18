import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
        },
      },
    },
  },
})
