import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // Native plugin packages ship extensionless ESM imports that need Vite resolution.
        inline: [/capacitor-/, /@awesome-cordova-plugins/],
      },
    },
  },
});
