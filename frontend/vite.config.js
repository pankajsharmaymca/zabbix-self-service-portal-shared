import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the Spring Boot backend runs on :8081; Vite proxies /api to it
// so the session cookie stays same-origin.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
});
