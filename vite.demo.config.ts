// The demo as a site of static files, for GitHub Pages (.github/workflows/pages.yml):
// `npm run build:demo` builds index.html and demo/ into dist-demo, and `npm run
// preview:demo` serves that at http://localhost:5181/systant-prism/, in a folder as
// Pages does. vite.config.ts builds the library, and serves the demo while it is worked on.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compactCss } from './vite.css.ts'
import { appPictures } from './vite.pictures.ts'
import { compactWgsl } from './vite.wgsl.ts'

export default defineConfig({
  // Every address in what is built is relative to the page, so it works wherever it is
  // served from: https://<owner>.github.io/<repository>/, a domain of its own, or a folder.
  base: './',
  plugins: [react(), compactWgsl(), compactCss(), appPictures()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    // The demo shows every component at once, so its one script is past Vite's 500 kB warning.
    chunkSizeWarningLimit: 800,
  },
})
