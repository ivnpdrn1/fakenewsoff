import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        'content-script': resolve(__dirname, 'src/content-script.ts'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es', // Use ES modules format for code splitting
      },
    },
    // Ensure source maps for debugging
    sourcemap: process.env.NODE_ENV === 'development',
  },
  // Resolve shared modules
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
});
