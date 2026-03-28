import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendDomain = process.env.BACKEND_PRIVATE_DOMAIN;
const backendTarget = backendDomain ? `http://${backendDomain}:8080` : 'http://backend.railway.internal:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
});
