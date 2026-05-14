import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/jcpdtracker/' : '/',
  root: './app',
  envDir: '..', // .env lives at /JCPD/, one level above the app root
  cacheDir: './app/.vite', // Inside the app root → served as /.vite/deps/… (no /@fs/ prefix)
  server: {
    port: 3737,
    host: true,
    fs: {
      allow: ['..'] // Allow serving files from parent (node_modules at /JCPD/node_modules/)
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
}));
