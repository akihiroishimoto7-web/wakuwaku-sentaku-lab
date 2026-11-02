import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // 洗濯機ラボ（/）と扇風機ラボ（/fan/）の2ページ
      input: {
        main: resolve(__dirname, 'index.html'),
        fan: resolve(__dirname, 'fan/index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
})
