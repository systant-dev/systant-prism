import { describe, expect, it } from 'vitest'
import { contrastRatio, parseColor } from './color'
import { isLargeText, minContrast } from './readability'
import { readableForeground } from './readableForeground'

describe('minContrast', () => {
  it.each([
    ['AA', false, 4.5],
    ['AA', true, 3],
    ['AAA', false, 7],
    ['AAA', true, 4.5],
  ] as const)('asks %s %s text for %s:1', (level, large, ratio) => {
    expect(minContrast(level, large)).toBe(ratio)
  })
})

describe('isLargeText', () => {
  it.each([
    [24, 400, true],
    [23.9, 400, false],
    [18.66, 700, true],
    [18.66, '700', true],
    [18.66, 600, false],
    [18, 700, false],
  ])('%spx at weight %s is large: %s', (size, weight, large) => {
    expect(isLargeText(size, weight)).toBe(large)
  })
})

describe('readableForeground', () => {
  it('picks black on white and white on black', () => {
    expect(readableForeground('#ffffff')).toMatchObject({ color: '#000000', passes: true })
    expect(readableForeground('#000000')).toMatchObject({ color: '#ffffff', passes: true })
    expect(readableForeground('#ffffff').ratio).toBeCloseTo(21, 10)
  })

  it('picks whichever has more contrast on a mid tone', () => {
    // A saturated blue: white is 5.17:1, black 4.06:1.
    expect(readableForeground('#2563eb').color).toBe('#ffffff')
    // A bright orange: black is 7.5:1, white 2.8:1.
    expect(readableForeground('#f97316').color).toBe('#000000')
  })

  it('chooses from the candidates given', () => {
    const ink = { candidates: ['#111318', '#eceef2'] }
    expect(readableForeground('#f3f4f6', ink).color).toBe('#111318')
    expect(readableForeground('#24272e', ink).color).toBe('#eceef2')
  })

  it('reports the target and whether it is met', () => {
    // #767676 on white is 4.54:1: enough for AA, not for AAA.
    const grey = { candidates: ['#767676'] }
    expect(readableForeground('#fff', grey)).toMatchObject({ target: 4.5, passes: true })
    expect(readableForeground('#fff', { ...grey, level: 'AAA' })).toMatchObject({ target: 7, passes: false })
    expect(readableForeground('#fff', { ...grey, level: 'AAA', large: true })).toMatchObject({
      target: 4.5,
      passes: true,
    })
    expect(readableForeground('#fff', { ...grey, minRatio: 5 })).toMatchObject({ target: 5, passes: false })
  })

  it('still returns the best candidate when none passes', () => {
    const result = readableForeground('#808080', { candidates: ['#999999', '#666666'] })
    expect(result.passes).toBe(false)
    expect(result.color).toBe('#666666')
  })

  describe('a preferred colour', () => {
    it('is used as it is when it passes', () => {
      expect(readableForeground('#ffffff', { prefer: '#2563eb' })).toMatchObject({ color: '#2563eb', passes: true })
    })

    it('is darkened just enough to pass, keeping its hue', () => {
      // A light blue, 2.5:1 on white.
      const result = readableForeground('#ffffff', { prefer: '#60a5fa' })
      expect(result.passes).toBe(true)
      expect(result.ratio).toBeLessThan(5)
      const { r, g, b } = parseColor(result.color)!
      expect(b).toBeGreaterThan(g)
      expect(g).toBeGreaterThan(r)
    })

    it('is lightened on a dark background', () => {
      const result = readableForeground('#111318', { prefer: '#1d4ed8' })
      expect(result.passes).toBe(true)
      expect(contrastRatio(parseColor(result.color)!, parseColor('#ffffff')!)).toBeLessThan(
        contrastRatio(parseColor('#1d4ed8')!, parseColor('#ffffff')!),
      )
    })

    it('gives way to the candidates when no shade of it can pass', () => {
      // Nothing reaches 7:1 over both white and black, not even black or white themselves.
      const result = readableForeground(['#ffffff', '#000000'], { prefer: '#2563eb', level: 'AAA' })
      expect(result.passes).toBe(false)
      expect(['#000000', '#ffffff']).toContain(result.color)
    })
  })

  describe('several backgrounds', () => {
    it('judges each colour by its worst contrast across them', () => {
      // A pale gradient: black is fine at both ends.
      const result = readableForeground(['#ffffff', '#cbd5e1'])
      expect(result.color).toBe('#000000')
      expect(result.ratio).toBeCloseTo(contrastRatio(parseColor('#000')!, parseColor('#cbd5e1')!), 10)
    })
  })

  describe('a translucent background', () => {
    // prism's card glass: #f3f4f6 at 30%.
    const glass = 'rgb(243 244 246 / 0.3)'

    it('must hold up over both white and black by default, which a faint tint cannot', () => {
      expect(readableForeground(glass).passes).toBe(false)
    })

    it('is judged over the backdrop given', () => {
      expect(readableForeground(glass, { backdrop: ['#cbd5e1', '#f8fafc'] })).toMatchObject({
        color: '#000000',
        passes: true,
      })
      expect(readableForeground(glass, { backdrop: ['#0f172a', '#334155'] })).toMatchObject({
        color: '#ffffff',
        passes: true,
      })
    })

    it('is judged as itself when fully opaque, whatever the backdrop', () => {
      expect(readableForeground('#000000', { backdrop: ['#ffffff'] }).color).toBe('#ffffff')
    })
  })

  it('throws on a colour it cannot read, naming it', () => {
    expect(() => readableForeground('nonsense')).toThrow('"nonsense"')
    expect(() => readableForeground('#fff', { candidates: ['nope'] })).toThrow('"nope"')
  })

  it('throws when given nothing to choose from', () => {
    expect(() => readableForeground([])).toThrow('at least one background')
    expect(() => readableForeground('#fff', { candidates: [] })).toThrow('at least one candidate')
  })
})

describe('readableForeground with dimmed text', () => {
  it('judges the text as it shows, laid over the background', () => {
    // Black on white is 21:1; at 30% it shows as a light grey.
    const faint = readableForeground('#ffffff', { candidates: ['#000000'], opacity: 0.3 })
    expect(faint.passes).toBe(false)
    expect(faint.ratio).toBeCloseTo(contrastRatio(parseColor('#b3b3b3')!, parseColor('#ffffff')!), 1)
  })

  it('shades a preferred colour further to make up for it', () => {
    const full = readableForeground('#ffffff', { prefer: '#60a5fa' })
    const dimmed = readableForeground('#ffffff', { prefer: '#60a5fa', opacity: 0.8 })
    expect(dimmed.passes).toBe(true)
    expect(brightness(dimmed.color)).toBeLessThan(brightness(full.color))
  })
})

/** The sum of its channels: enough to say which of two colours is the darker. */
function brightness(css: string) {
  const { r, g, b } = parseColor(css)!
  return r + g + b
}
