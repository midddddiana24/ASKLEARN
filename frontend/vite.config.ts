import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
    { name: 'markdown', test: /node_modules[\\/](react-markdown|remark-[^/\\]+|rehype-[^/\\]+|micromark[^/\\]*|mdast-[^/\\]+|hast-[^/\\]+|unist-[^/\\]+|unified|vfile[^/\\]*)[\\/]/ },
  ] } } } },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } } },
})
