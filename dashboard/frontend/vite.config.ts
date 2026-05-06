import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5006,
    proxy: {
      '/api': {
        target: process.env.VITE_DASHBOARD_API_BASE_URL || 'http://localhost:5005',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5006,
  },
});
