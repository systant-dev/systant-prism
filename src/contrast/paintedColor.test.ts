import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseColor } from './color'
// Every reader of a colour goes through parseColor; one of them shows the canvas is asked.
import { readableForeground } from './readableForeground'

/** What the browser paints each colour as, in RGBA: a real canvas ignores the others, keeping its fillStyle. */
const PAINTED: Record<string, number[]> = {
  rebeccapurple: [102, 51, 153, 255],
  'oklch(0.2 0.05 30)': [40, 20, 15, 255],
  'oklch(0.95 0.01 30)': [245, 238, 235, 255],
  'lab(50 40 20 / 0.5)': [190, 90, 80, 128],
}

const painter = {
  fill: '#000000',
  get fillStyle() {
    return this.fill
  },
  set fillStyle(css: string) {
    if (css.startsWith('#') || css in PAINTED) this.fill = css
  },
  clearRect: () => {},
  fillRect: () => {},
  getImageData() {
    return { data: Uint8ClampedArray.from(PAINTED[this.fill]) }
  },
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(painter as unknown as GPUCanvasContext)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('colours only the browser can read', () => {
  it('reads a named colour', () => {
    expect(parseColor('RebeccaPurple')).toEqual({ r: 102, g: 51, b: 153, alpha: 1 })
  })

  it('reads a colour in another space, translucent or not', () => {
    expect(parseColor('oklch(0.2 0.05 30)')).toEqual({ r: 40, g: 20, b: 15, alpha: 1 })
    expect(parseColor('lab(50 40 20 / 0.5)')).toEqual({ r: 190, g: 90, b: 80, alpha: 128 / 255 })
  })

  it('tells what no browser would paint', () => {
    expect(parseColor('not-a-colour')).toBeNull()
  })

  it('leaves currentcolor, which has no element to resolve against', () => {
    expect(parseColor('currentcolor')).toBeNull()
    expect(parseColor('color-mix(in srgb, currentColor, rebeccapurple)')).toBeNull()
  })

  it('chooses text on one, and a preferred colour by name', () => {
    expect(readableForeground('rebeccapurple').color).toBe('#ffffff')
    expect(readableForeground('#ffffff', { prefer: 'rebeccapurple' }).color).toBe('#663399')
  })
})
