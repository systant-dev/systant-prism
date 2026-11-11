import { loadImage } from './gpu/renderer'

/**
 * Loads a backdrop's picture once, however many want it, as one loaded twice is
 * decoded twice. It holds on to the latest only, and one that failed is tried again.
 */
export function createPictureLoader() {
  let latest: { src: string; load: Promise<HTMLImageElement>; image: HTMLImageElement | null } | null = null
  return {
    load(src: string) {
      if (latest?.src === src) return latest.load
      const entry = { src, load: loadImage(src), image: null as HTMLImageElement | null }
      latest = entry
      entry.load.then(
        (image) => (entry.image = image),
        () => {
          if (latest === entry) latest = null
        },
      )
      return entry.load
    },
    /** The picture, if it has loaded by now, for what has no reason to wait for it. */
    loaded(src: string) {
      return latest?.src === src ? latest.image : null
    },
  }
}
