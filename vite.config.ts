// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // ⚠️ Usa '/mindflux/' solo si publicas como Project Pages.
  // Si publicas como User/Org Pages (https://tu-usuario.github.io/) o con dominio propio, cambia a '/' o elimina esta línea.
  base: '/mindflux/',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
});
