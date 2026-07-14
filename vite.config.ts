import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => {
  return {
    server: {
      host: '0.0.0.0',
      allowedHosts: [
        'archhyprland',
      ]
    },
    // Use relative paths for every built artifact so the app works from the
    // local Even Hub package as well as from GitHub Pages.
    base: command === 'serve' ? '/' : './',

    // Always inject the single-file plugin for production builds to avoid asset path bugs
    plugins: command === 'build' ? [viteSingleFile()] : [],

    build: {
      target: 'es2018',
      emptyOutDir: true,
    }
  };
});