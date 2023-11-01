import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, './src/index.ts'),
      name: '_mybricks_render_web_vue2',
      fileName: 'index',
    },
    outDir: path.resolve(__dirname, './dist'),
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  },
  plugins: [vue()]
})
