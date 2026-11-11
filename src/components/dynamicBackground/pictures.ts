import type { PageImage } from '../../contrast'

// The pictures a DynamicBackground shows where its scene can't be drawn: each scene at
// noon and at midnight on midsummer's day in London, made by `npm run gpu -- --pictures`,
// which says what to put in PAGE_IMAGES when it makes them afresh.
//
// They are files beside the code rather than imports. Vite's library build would put an
// imported picture into the JavaScript as base64, a megabyte that every page would load
// for the one picture it shows. `/* @vite-ignore */` keeps Vite's hands off, so the build
// leaves each `new URL('./pictures/…', import.meta.url)` as it is, and vite.config.ts
// copies the files to dist/pictures, next to the bundle that reads them. An app's own
// bundler (Vite, webpack 5, Next.js, Parcel) sees the same expression and treats the
// file as an asset of its own, and in Vite's dev server this module is served from src,
// where the pictures already are. Each is a function, so nothing is resolved until it
// is shown. Each URL stays a literal of its own, as a bundler can only follow those.

/** The scenes a DynamicBackground can show. */
export type DynamicScene = 'forest' | 'ocean'

/** Where each scene's pictures are, by day and by night. */
export const PICTURES: Record<DynamicScene, { day: () => string; night: () => string }> = {
  forest: {
    day: () => new URL(/* @vite-ignore */ './pictures/forest.webp', import.meta.url).href,
    night: () => new URL(/* @vite-ignore */ './pictures/forest-night.webp', import.meta.url).href,
  },
  ocean: {
    day: () => new URL(/* @vite-ignore */ './pictures/ocean.webp', import.meta.url).href,
    night: () => new URL(/* @vite-ignore */ './pictures/ocean-night.webp', import.meta.url).href,
  },
}

/**
 * What the page's colours are chosen from in each picture, worked out ahead with
 * `samplePicture`, so the page has them from its first render rather than once the
 * picture has been read on the GPU.
 */
export const PAGE_IMAGES: Record<DynamicScene, { day: PageImage; night: PageImage }> = {
  forest: {
    day: { tones: ['#697443', '#8e9250', '#c9dbe2'], range: ['#393c29', '#efefed'], dominant: '#77814a' },
    night: { tones: ['#1d231f', '#252e26', '#313c2e'], range: ['#0d0f0e', '#868689'], dominant: '#222f48' },
  },
  ocean: {
    day: { tones: ['#407fb0', '#6197bb', '#b4d0dd'], range: ['#226ca7', '#ededed'], dominant: '#4b89b6' },
    night: { tones: ['#0d121b', '#1c202a', '#252f47'], range: ['#050c18', '#89898e'], dominant: '#1f2b44' },
  },
}
