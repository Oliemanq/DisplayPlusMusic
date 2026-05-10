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
    // If Even Hub, use relative paths ('./'). 
    // Otherwise, fallback to your GitHub pages logic.
    base: isEvenHubBuild ? './' : (command === 'serve' ? '/' : '/DisplayPlusMusic/'),

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