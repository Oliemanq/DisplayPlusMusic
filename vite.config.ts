import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  server: {
    host: '0.0.0.0',
  },
  base: command === 'serve' ? '/' : '/DisplayPlusMusic/',
}));
