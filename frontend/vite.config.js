import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // --- CẤU HÌNH PROXY QUAN TRỌNG ---
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Chuyển hướng mọi request /api sang Backend
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8000', // Chuyển hướng ảnh/file
        changeOrigin: true,
        secure: false,
      }
    }
  }
})