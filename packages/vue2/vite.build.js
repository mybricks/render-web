import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, './src/index.ts'),
      name: 'mybricks-render-vue2',
      fileName: 'index',
      output: path.resolve(__dirname, './dist')
    },
    outDir: path.resolve(__dirname, './dist'),
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    },
    // cssCodeSplit: false
  },
  plugins: [vue()]
})
