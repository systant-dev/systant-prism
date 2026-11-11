// A DynamicBackground's pictures are files read with `new URL('./pictures/…',
// import.meta.url)` (src/components/dynamicBackground/pictures.ts), which the library
// build leaves as it is, for an app's own bundler to pick up. This copies them next to
// the bundle, to dist/pictures, where that expression points once built, and stops the
// build if what reads them would end up anywhere else, where it would point at nothing.
import type { Plugin } from 'vite'

const SOURCE = 'src/components/dynamicBackground/pictures'
const REFERENCE = /new URL\(\s*(?:\/\*[^*]*\*\/\s*)?["']\.\/pictures\/([^"']+)["']/g

/** The comment that keeps this build's hands off, which would keep an app's Vite's off too. */
const IGNORED = /(new URL\(\s*)\/\*\s*@vite-ignore\s*\*\/\s*(["']\.\/pictures\/)/g

/** The module that reads the pictures, as Vite names it. */
const READER = '/src/components/dynamicBackground/pictures.ts'

/**
 * For a build of an app straight from this source (the demo, vite.demo.config.ts) rather
 * than of the library: takes the comment off before Vite reads the module, so that it
 * treats each picture as a file of the app's own, as an app's bundler does with the built
 * library. It stops the build if a picture didn't come out as one, as nothing else would
 * say: the page would only show no picture where the scene can't be drawn.
 */
export function appPictures(): Plugin {
  let pictures = 0
  return {
    name: 'prism:app-pictures',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith(READER)) return null
      pictures = [...code.matchAll(IGNORED)].length
      return { code: code.replace(IGNORED, '$1$2'), map: null }
    },
    generateBundle(_, bundle) {
      const built = Object.values(bundle).filter((file) => file.type === 'asset' && file.fileName.endsWith('.webp'))
      if (pictures === 0 || built.length < pictures) {
        this.error(`${READER} reads ${pictures} pictures, but ${built.length} were built`)
      }
    },
  }
}

export function libraryPictures(): Plugin {
  return {
    name: 'prism:library-pictures',
    apply: 'build',
    renderChunk(code) {
      const kept = code.replace(IGNORED, '$1$2')
      return kept === code ? null : { code: kept, map: null }
    },
    async generateBundle(_, bundle) {
      const files = await this.fs.readdir(SOURCE)
      const read = new Set<string>()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const [, name] of chunk.code.matchAll(REFERENCE)) {
          if (chunk.fileName.includes('/')) {
            this.error(`${chunk.fileName} reads ./pictures/${name}, but it isn't next to dist/pictures`)
          }
          if (!files.includes(name)) this.error(`${chunk.fileName} reads ./pictures/${name}, which isn't in ${SOURCE}`)
          read.add(name)
        }
      }
      for (const name of read) {
        this.emitFile({
          type: 'asset',
          fileName: `pictures/${name}`,
          source: await this.fs.readFile(`${SOURCE}/${name}`),
        })
      }
    },
  }
}
