import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'react-hot-toast'],
        }
      }
    },
    chunkSizeWarningLimit: 900
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
  configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[PROXY] → ${req.method} ${req.url}`);
          });

          proxy.on('proxyRes', (proxyRes, req) => {
            console.log(`[PROXY] ← ${req.method} ${req.url} → ${proxyRes.statusCode}`);
          });

          proxy.on('error', (err, req) => {
            console.error(`[PROXY] ❌ error on ${req.url}:`, err.message);
          });
        },
      },
    },
  },
});
