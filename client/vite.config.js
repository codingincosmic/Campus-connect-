import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    /**
     * Proxy API calls to the Express server.
     *
     * This is the reason auth "just works": the browser sees everything as
     * http://localhost:5173, so the httpOnly cookie is same-origin and there
     * are no CORS or third-party-cookie problems during development.
     */
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
      },
    },
  },
});
