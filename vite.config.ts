import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command, mode }) => {
  const isEvenHubBuild = mode === 'evenhub'; // run npm run build -- --mode evenhub for even hub build

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

    // Only inject the single-file plugin if we are building for the glasses
    plugins: isEvenHubBuild ? [viteSingleFile()] : [],

    // Apply the specific build targets only for Even Hub
    build: isEvenHubBuild ? {
      target: 'esnext',
      emptyOutDir: true,
    } : {
      emptyOutDir: true,
    }
  };
});