import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  publicDir: 'assets',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        debug: 'index.html',
        avatar: 'avatar.html',
      },
    },
  },
});
