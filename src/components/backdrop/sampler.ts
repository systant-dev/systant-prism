// Reads what a page's colours are chosen from (readablePage, src/contrast): the
// tones and dominant colour of its backdrop image, once per image, from a small
// copy of it (at most SAMPLE_SIZE px a side) that costs little to scan and blurs
// it as the glass does anyway. They are read from the whole image, not from what
// lies behind any one element, so every control on the page gets the same answer.
//
// The tones are the image's quartiles by luminance, the middle half of what the
// page lies over, and its range the 2nd and 98th percentiles, the dark and light
// ends a card may still lie over: a sea under a sky is a band of each. Only the
// deepest shadows and brightest highlights beyond those are set aside, which
// would otherwise speak for the whole image.
//
// The dominant colour is the colour someone would name the image by, to take an
// accent from. The commonest pixels of a photo are often near black or a pale
// sky, which says little, so every pixel with a hue counts for its hue by how
// vivid it is. A hue in a photo spreads across neighbouring bins, so three bins
// side by side are weighed together, and the colour is the average of the pixels
// in the heaviest three. An image with too little colour in it has no dominant
// colour.
// oxlint-disable-next-line no-restricted-imports -- straight from the module, not the index, which takes in hooks: a server imports this (src/server.ts)
import { luminance, toHex } from '../../contrast/color'
// oxlint-disable-next-line no-restricted-imports -- straight from the module, not the index, which takes in hooks: a server imports this (src/server.ts)
import type { PageImage } from '../../contrast/readablePage'

/** The longest side of the copy kept of the image, in px. */
const SAMPLE_SIZE = 64
/** How many degrees of hue each bin of the dominant colour's count spans. */
const HUE_BIN = 10
/** How far from grey a pixel must be to count as having a hue: its highest channel less its lowest, 0–255. */
const MIN_CHROMA = 32
/** The share of pixels left out at each end of the image's range, darkest and lightest: a glint, or a deep shadow. */
const RANGE_ENDS = 0.02
/** The share of pixels that must have a hue for an image to have a dominant colour. */
const MIN_COLOURFUL = 0.05

/** A colour's hue in degrees, 0–360; it must not be grey. */
function hueOf(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const chroma = max - Math.min(r, g, b)
  if (max === r) return (((g - b) / chroma + 6) % 6) * 60
  if (max === g) return ((b - r) / chroma + 2) * 60
  return ((r - g) / chroma + 4) * 60
}

/** The dominant colour of RGBA pixels, as `#rrggbb`; null if too few of them have a hue. See above. */
export function dominantColor(pixels: Uint8ClampedArray): string | null {
  const bins = Array.from({ length: 360 / HUE_BIN }, () => ({ weight: 0, r: 0, g: 0, b: 0 }))
  let colourful = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    if (chroma < MIN_CHROMA) continue
    colourful++
    const bin = bins[Math.floor(hueOf(r, g, b) / HUE_BIN) % bins.length]
    bin.weight += chroma
    bin.r += r * chroma
    bin.g += g * chroma
    bin.b += b * chroma
  }
  if (colourful < (pixels.length / 4) * MIN_COLOURFUL) return null

  const around = (i: number) => [-1, 0, 1].map((step) => bins[(i + step + bins.length) % bins.length])
  const weigh = (group: typeof bins) => group.reduce((sum, bin) => sum + bin.weight, 0)
  const heaviest = bins.map((_, i) => around(i)).reduce((best, next) => (weigh(next) > weigh(best) ? next : best))
  const weight = weigh(heaviest)
  const channel = (key: 'r' | 'g' | 'b') => heaviest.reduce((sum, bin) => sum + bin[key], 0) / weight
  return toHex({ r: channel('r'), g: channel('g'), b: channel('b') })
}

/** The tones and dominant colour of RGBA pixels. See above. */
export function pageImage(pixels: Uint8ClampedArray): PageImage {
  const rgb = (i: number) => ({ r: pixels[i * 4], g: pixels[i * 4 + 1], b: pixels[i * 4 + 2] })
  const count = pixels.length / 4
  const byLuminance = Array.from({ length: count }, (_, i) => ({ i, lum: luminance(rgb(i)) })).sort(
    (a, b) => a.lum - b.lum,
  )
  const quartile = (share: number) => toHex(rgb(byLuminance[Math.floor((count - 1) * share)].i))
  return {
    tones: [quartile(0.25), quartile(0.5), quartile(0.75)],
    range: [quartile(RANGE_ENDS), quartile(1 - RANGE_ENDS)],
    dominant: dominantColor(pixels),
  }
}

/** A decoded picture: `width` × `height` pixels, row by row, RGBA or RGB with a byte to each channel. */
export interface Picture {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

/**
 * What a page's colours are chosen from in a decoded picture, as samplePageImage
 * reads them in a browser: from a copy at most SAMPLE_SIZE px a side, each of its
 * pixels the average of those it covers. Anything see-through is taken over white.
 * Nothing here needs a DOM, so a server or a build can do it once for a picture.
 */
export function samplePicture({ data, width, height }: Picture): PageImage {
  const channels = data.length / (width * height)
  if (!(width >= 1 && height >= 1) || (channels !== 3 && channels !== 4)) {
    throw new RangeError(`${data.length} bytes aren't RGB or RGBA pixels for ${width} × ${height}`)
  }
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height))
  const across = Math.max(1, Math.round(width * scale))
  const down = Math.max(1, Math.round(height * scale))
  const pixels = new Uint8ClampedArray(across * down * 4)
  for (let y = 0; y < down; y++) {
    const top = Math.floor((y * height) / down)
    const bottom = Math.max(top + 1, Math.floor(((y + 1) * height) / down))
    for (let x = 0; x < across; x++) {
      const left = Math.floor((x * width) / across)
      const right = Math.max(left + 1, Math.floor(((x + 1) * width) / across))
      const sum = [0, 0, 0]
      for (let row = top; row < bottom; row++) {
        for (let column = left; column < right; column++) {
          const i = (row * width + column) * channels
          const alpha = channels === 4 ? data[i + 3] / 255 : 1
          for (let c = 0; c < 3; c++) sum[c] += data[i + c] * alpha + 255 * (1 - alpha)
        }
      }
      const count = (bottom - top) * (right - left)
      pixels.set([sum[0] / count, sum[1] / count, sum[2] / count, 255], (y * across + x) * 4)
    }
  }
  return pageImage(pixels)
}

/**
 * What a page's colours are chosen from in `image`, as it looks over the CSS
 * colour `behind`, or null if its pixels can't be read: no 2D canvas, or a
 * cross-origin image without CORS headers.
 */
export function samplePageImage(image: HTMLImageElement, behind: string): PageImage | null {
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = behind
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return pageImage(context.getImageData(0, 0, width, height).data)
  } catch {
    return null
  }
}
