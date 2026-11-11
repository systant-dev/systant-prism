import { afterEach, describe, expect, it, vi } from 'vitest'
import { dominantColor, pageImage, samplePageImage, samplePicture } from './sampler'

afterEach(() => {
  vi.restoreAllMocks()
})

/** RGBA pixels, `width` × `height`, each grey from `shade(x, y)` (0–255). */
function pixels(width: number, height: number, shade: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data.set([shade(x, y), shade(x, y), shade(x, y), 255], i)
    }
  }
  return data
}

/** RGBA pixels, each of `colours` repeated `count` times. */
function swatches(...colours: [count: number, r: number, g: number, b: number][]) {
  return new Uint8ClampedArray(colours.flatMap(([count, r, g, b]) => Array(count).fill([r, g, b, 255]).flat()))
}

describe('dominantColor', () => {
  it('gives the colour of an image of one colour', () => {
    expect(dominantColor(swatches([10, 200, 100, 40]))).toBe('#c86428')
  })

  it('passes over black, white and grey, however much of them there is', () => {
    const photo = swatches([50, 10, 10, 12], [30, 245, 245, 245], [10, 120, 120, 120], [10, 200, 100, 40])
    expect(dominantColor(photo)).toBe('#c86428')
  })

  it('takes the hue there is the most of, for the same vividness', () => {
    expect(dominantColor(swatches([30, 200, 100, 40], [10, 40, 100, 200]))).toBe('#c86428')
  })

  it('counts vivid pixels for more than dull ones', () => {
    // As many of each, the same value: the dull blue has a third of the vivid orange's chroma.
    expect(dominantColor(swatches([10, 240, 120, 0], [10, 160, 180, 240]))).toBe('#f07800')
  })

  it("weighs a hue's neighbouring shades together against a single bin of another", () => {
    // Three oranges a bin apart, each outweighed by the blue, together outweigh it.
    const shades = swatches([10, 200, 90, 40], [10, 200, 110, 40], [10, 200, 130, 40], [15, 40, 100, 200])
    const [r, , b] = [1, 3, 5].map((i) => parseInt(dominantColor(shades)!.slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(b)
  })

  it('weighs hues together across red, where the hue wraps round', () => {
    const reds = swatches([10, 220, 40, 70], [10, 220, 70, 40], [15, 40, 100, 200])
    const [r, , b] = [1, 3, 5].map((i) => parseInt(dominantColor(reds)!.slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(b)
  })

  it('has none for an image with too little colour', () => {
    expect(dominantColor(swatches([100, 128, 128, 128]))).toBeNull()
    expect(dominantColor(swatches([97, 128, 128, 128], [3, 200, 100, 40]))).toBeNull()
  })
})

describe('samplePageImage', () => {
  it('reads an image over the colour behind it, as a see-through one looks', () => {
    const calls: string[] = []
    const context = {
      set fillStyle(color: string) {
        calls.push(color)
      },
      fillRect: () => calls.push('fill'),
      drawImage: () => calls.push('image'),
      getImageData: () => ({ data: swatches([4, 200, 100, 40]) }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as GPUCanvasContext)

    const image = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement
    expect(samplePageImage(image, '#336699')?.dominant).toBe('#c86428')
    expect(calls).toEqual(['#336699', 'fill', 'image'])
  })
})

describe('pageImage', () => {
  it('gives the dominant colour of the whole image', () => {
    expect(pageImage(swatches([4, 200, 100, 40])).dominant).toBe('#c86428')
    expect(pageImage(pixels(10, 10, (x) => (x < 5 ? 0 : 255))).dominant).toBeNull()
  })

  it('gives the quartiles of the image by luminance', () => {
    // Eleven greys, in steps of 10 from 0, out of order.
    const greys = pixels(11, 1, (x) => ((x * 7) % 11) * 10)
    expect(pageImage(greys).tones).toEqual(['#141414', '#323232', '#464646'])
  })

  it('sets aside the specks, however bright or dark', () => {
    // One white and one black pixel in a hundred mid greys.
    const speck = pixels(10, 10, (x, y) => (x === 4 && y === 4 ? 255 : x === 5 && y === 5 ? 0 : 128))
    expect(pageImage(speck).tones).toEqual(['#808080', '#808080', '#808080'])
    expect(pageImage(speck).range).toEqual(['#808080', '#808080'])
  })

  it('gives the dark and light ends of the image, a band of either being more than a speck', () => {
    // A sky over a sea: a row in twenty near black, a row in twenty near white, mid grey between.
    const bands = pixels(10, 20, (_, y) => (y === 0 ? 240 : y === 19 ? 16 : 128))
    expect(pageImage(bands).tones).toEqual(['#808080', '#808080', '#808080'])
    expect(pageImage(bands).range).toEqual(['#101010', '#f0f0f0'])
  })

  it('reads the same however the pixels are laid out, so no place in the image counts for more', () => {
    const left = pixels(10, 10, (x) => (x < 5 ? 0 : 255))
    const top = pixels(10, 10, (_, y) => (y < 5 ? 0 : 255))
    expect(pageImage(left).tones).toEqual(pageImage(top).tones)
  })
})

describe('samplePicture', () => {
  it('reads a small picture as pageImage does', () => {
    const greys = pixels(11, 1, (x) => ((x * 7) % 11) * 10)
    expect(samplePicture({ data: greys, width: 11, height: 1 })).toEqual(pageImage(greys))
  })

  it('reads RGB as it reads RGBA', () => {
    const rgba = pixels(4, 2, (x, y) => x * 60 + y)
    const rgb = Uint8Array.from(rgba.filter((_, i) => i % 4 !== 3))
    expect(samplePicture({ data: rgb, width: 4, height: 2 })).toEqual(
      samplePicture({ data: rgba, width: 4, height: 2 }),
    )
  })

  it('reads a large picture from a copy at most 64 px a side, each pixel the average of those it covers', () => {
    // 256 × 128, in stripes one pixel wide of 0 and 200: a 64 × 32 copy is all 100.
    const stripes = pixels(256, 128, (x) => (x % 2 ? 200 : 0))
    expect(samplePicture({ data: stripes, width: 256, height: 128 }).tones).toEqual(['#646464', '#646464', '#646464'])
  })

  it('takes what is see-through over white', () => {
    const black = (alpha: number) => samplePicture({ data: new Uint8Array([0, 0, 0, alpha]), width: 1, height: 1 })
    expect(black(0).tones[1]).toBe('#ffffff')
    expect(black(128).tones[1]).toBe('#7f7f7f')
    expect(black(255).tones[1]).toBe('#000000')
  })

  it("won't read pixels that don't fit the size", () => {
    expect(() => samplePicture({ data: new Uint8Array(10), width: 2, height: 1 })).toThrow(RangeError)
    expect(() => samplePicture({ data: new Uint8Array(0), width: 0, height: 0 })).toThrow(RangeError)
  })
})
