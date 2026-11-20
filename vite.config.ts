import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // ドメイン直下でも /eiyouseibun/ でも同じファイルで動く
  base: './',
  server: {
    port: 5173,
    open: true,
  },
});
