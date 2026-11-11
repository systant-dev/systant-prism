import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { compactCss } from './vite.css.ts'
import { libraryPictures } from './vite.pictures.ts'
import { compactWgsl } from './vite.wgsl.ts'

export default defineConfig({
  plugins: [react(), compactWgsl(), compactCss(), libraryPictures()],
  server: {
    // Fixed port; fail instead of drifting to the next free one if it's taken.
    port: 5180,
    strictPort: true,
    // Visual Studio keeps its index files under .vs locked, which the watcher can't open.
    watch: { ignored: ['**/.vs/**'] },
  },
  build: {
    lib: {
      // The server entry is what a server can work out ahead for a GlassBackdrop (src/server.ts).
      entry: { index: 'src/index.ts', server: 'src/server.ts' },
      formats: ['es'],
      fileName: (_, name) => `${name}.js`,
    },
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/],
      // Its components use hooks and context, so a React Server Components framework
      // (Next.js's App Router) must load it as client code. Only that entry needs saying:
      // the scenes' chunks are only ever loaded from it. The server entry must not, or a
      // server component would be handed a reference to it rather than its functions.
      output: { banner: (chunk) => (chunk.isEntry && chunk.name === 'index' ? "'use client';" : '') },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    // npm run gpu checks out another version of src there for a while.
    exclude: [...configDefaults.exclude, '.gpu-check/**'],
    // Each file still runs in a context of its own, but on a worker that keeps its
    // jsdom, which is most of the cost of starting a file.
    pool: 'vmThreads',
  },
})
