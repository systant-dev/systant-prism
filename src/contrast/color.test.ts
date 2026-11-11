import { describe, expect, it } from 'vitest'
import { contrastRatio, luminance, over, parseColor, toCss, toHex } from './color'

describe('parseColor', () => {
  it.each([
    ['#fff', { r: 255, g: 255, b: 255, alpha: 1 }],
    ['#FF0000', { r: 255, g: 0, b: 0, alpha: 1 }],
    ['#0f08', { r: 0, g: 255, b: 0, alpha: 0x88 / 255 }],
    ['#00000080', { r: 0, g: 0, b: 0, alpha: 0x80 / 255 }],
    ['rgb(255, 0, 0)', { r: 255, g: 0, b: 0, alpha: 1 }],
    ['rgba(0, 0, 0, 0.5)', { r: 0, g: 0, b: 0, alpha: 0.5 }],
    ['rgb(255 0 0 / 50%)', { r: 255, g: 0, b: 0, alpha: 0.5 }],
    ['rgb(100% 50% 0%)', { r: 255, g: 127.5, b: 0, alpha: 1 }],
    ['hsl(120 100% 50%)', { r: 0, g: 255, b: 0, alpha: 1 }],
    ['hsla(0deg, 100%, 25%, 0.4)', { r: 127.5, g: 0, b: 0, alpha: 0.4 }],
    ['hsl(0.5turn 100 50)', { r: 0, g: 255, b: 255, alpha: 1 }],
    ['color(srgb 1 0.5 0 / 0.3)', { r: 255, g: 127.5, b: 0, alpha: 0.3 }],
    [' Transparent ', { r: 0, g: 0, b: 0, alpha: 0 }],
    ['white', { r: 255, g: 255, b: 255, alpha: 1 }],
  ])('reads %j', (css, expected) => {
    const color = parseColor(css)!
    for (const key of ['r', 'g', 'b', 'alpha'] as const) expect(color[key]).toBeCloseTo(expected[key], 6)
  })

  it.each(['', 'nope', '#12345', '#ggg', 'rgb(1, 2)', 'rgb(1 2 3 4 5)', 'constructor', '__proto__'])(
    'returns null for %j',
    (css) => {
      expect(parseColor(css)).toBeNull()
    },
  )

  it('wraps a negative hue round the circle', () => {
    expect(parseColor('hsl(-120 100% 50%)')).toEqual(parseColor('hsl(240 100% 50%)'))
    expect(parseColor('hsl(-480deg 100% 50%)')).toEqual(parseColor('hsl(240deg 100% 50%)'))
  })

  it('clamps channels and alpha into range', () => {
    expect(parseColor('rgb(300 -5 0 / 2)')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 })
  })

  it('reads back what toCss writes', () => {
    const color = { r: 12.345, g: 200.5, b: 0.25, alpha: 0.123 }
    expect(parseColor(toCss(color))).toEqual(color)
  })
})

describe('luminance and contrastRatio', () => {
  it('runs from 0 for black to 1 for white', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10)
  })

  it('gives 21:1 for black on white, either way round', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }
    expect(contrastRatio(black, white)).toBeCloseTo(21, 10)
    expect(contrastRatio(white, black)).toBeCloseTo(21, 10)
  })

  // The well-known pair either side of AA's 4.5:1 on white.
  it('puts #767676 just over 4.5:1 on white and #777777 just under', () => {
    const white = parseColor('#fff')!
    expect(contrastRatio(parseColor('#767676')!, white)).toBeCloseTo(4.54, 2)
    expect(contrastRatio(parseColor('#777777')!, white)).toBeCloseTo(4.48, 2)
  })
})

describe('over', () => {
  it('lays a translucent colour over an opaque one', () => {
    expect(over({ r: 0, g: 0, b: 0, alpha: 0.5 }, { r: 255, g: 255, b: 255, alpha: 1 })).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      alpha: 1,
    })
  })

  it('stacks translucent layers into one translucent colour', () => {
    const stacked = over({ r: 255, g: 0, b: 0, alpha: 0.5 }, { r: 0, g: 0, b: 255, alpha: 0.5 })
    expect(stacked.alpha).toBeCloseTo(0.75, 10)
    // Laid over white, the stack matches the layers laid over white one by one.
    const white = { r: 255, g: 255, b: 255, alpha: 1 }
    const oneByOne = over({ r: 255, g: 0, b: 0, alpha: 0.5 }, over({ r: 0, g: 0, b: 255, alpha: 0.5 }, white))
    const together = over(stacked, white)
    for (const key of ['r', 'g', 'b'] as const) expect(together[key]).toBeCloseTo(oneByOne[key], 10)
  })

  it('leaves nothing from nothing', () => {
    const none = { r: 0, g: 0, b: 0, alpha: 0 }
    expect(over(none, none).alpha).toBe(0)
  })
})

describe('toHex', () => {
  it('rounds and clamps each channel', () => {
    expect(toHex({ r: 127.5, g: 0.4, b: 300 })).toBe('#8000ff')
  })
})
