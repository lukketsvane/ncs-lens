import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    plugins: [sveltekit()],
    server: {
      port: 3000,
      host: '0.0.0.0',
      fs: {
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, '../../..'),
        ],
      },
    }
});
