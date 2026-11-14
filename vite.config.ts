import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api/v1/consultas': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/v1/guide-health': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
});
