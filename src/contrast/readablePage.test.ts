import { describe, expect, it } from 'vitest'
import { contrastRatio, over, parseColor, toCss } from './color'
import { readableForeground } from './readableForeground'
import { readablePage, type PageImage } from './readablePage'

const LIGHT = { foreground: '#111318', background: '#f3f4f6' }
const DARK = { foreground: '#eceef2', background: '#24272e' }
const OPTIONS = { theme: LIGHT, alternate: DARK }

const PALE: PageImage = { tones: ['#c0b0a0', '#d0c0b0', '#e0d0c0'], dominant: '#9d6437' }
const NIGHT: PageImage = { tones: ['#07081c', '#0c0e24', '#161b39'], dominant: '#132552' }
// A pale sky over a dark sea, as the ocean is with the sun low: a band of each beyond the middle half.
const SEA: PageImage = { tones: ['#1f4257', '#3f6f8a', '#b9c4c9'], range: ['#07222e', '#e6dfc8'], dominant: '#2f6f93' }

function rgb(css: string) {
  return parseColor(css)!
}

/** Whether `foreground`, drawn at `opacity`, meets AA on `background` at `glass` over every colour of `image`. */
function reads(image: PageImage, foreground: string, background: string, glass: number, opacity = 1) {
  const backdrop = [...(image.range ?? []), ...image.tones]
  const tint = toCss({ ...rgb(background), alpha: glass })
  return readableForeground(tint, { candidates: [foreground], backdrop, opacity }).passes
}

describe('readablePage', () => {
  it("keeps the theme's pair where its text reads over the image", () => {
    expect(readablePage(PALE, OPTIONS)).toMatchObject(LIGHT)
  })

  it('turns to the alternate pair where it would not', () => {
    expect(readablePage(NIGHT, OPTIONS)).toMatchObject(DARK)
  })

  it("keeps a dark theme's pair over a dark image, and turns pale over a pale one", () => {
    expect(readablePage(NIGHT, { theme: DARK, alternate: LIGHT })).toMatchObject(DARK)
    expect(
      readablePage({ ...PALE, tones: ['#ffffff', '#ffffff', '#ffffff'] }, { theme: DARK, alternate: LIGHT }),
    ).toMatchObject(LIGHT)
  })

  it('holds the theme to the dark and light ends of the middle half, not just the median', () => {
    // #111318 reads over this median, but not over the dark quarter.
    const busy: PageImage = { tones: ['#202020', '#606060', '#707070'], dominant: null }
    expect(readablePage({ ...busy, tones: ['#606060', '#606060', '#606060'] }, OPTIONS)).toMatchObject(LIGHT)
    expect(readablePage(busy, OPTIONS)).toMatchObject(DARK)
  })

  it('keeps the theme where either pair reads, whichever theme it is', () => {
    const grey: PageImage = { tones: ['#777777', '#777777', '#777777'], dominant: null }
    expect(readablePage(grey, OPTIONS)).toMatchObject(LIGHT)
    expect(readablePage(grey, { theme: DARK, alternate: LIGHT })).toMatchObject(DARK)
  })

  it('leaves the glass as thin as it was given where the text reads on it', () => {
    expect(readablePage(PALE, OPTIONS).glassOpacity).toBe(0.3)
    expect(readablePage(NIGHT, OPTIONS).glassOpacity).toBe(0.3)
    expect(readablePage(PALE, { ...OPTIONS, glassOpacity: 0.5 }).glassOpacity).toBe(0.5)
  })

  it('thickens the glass, no further than it must, where neither pair reads from the dark end to the light', () => {
    const { foreground, background, glassOpacity } = readablePage(SEA, OPTIONS)
    expect(reads(SEA, LIGHT.foreground, LIGHT.background, 0.3)).toBe(false)
    expect(reads(SEA, DARK.foreground, DARK.background, 0.3)).toBe(false)
    expect(glassOpacity).toBeGreaterThan(0.3)
    expect(glassOpacity).toBeLessThan(0.6)
    expect(reads(SEA, foreground, background, glassOpacity)).toBe(true)
    expect(reads(SEA, foreground, background, glassOpacity - 0.01)).toBe(false)
  })

  it('takes the pair that needs the less glass, whichever the theme', () => {
    // Pale glass has only the dark sea to lift; dark glass would have a bright sky to dim.
    expect(readablePage(SEA, OPTIONS)).toMatchObject(LIGHT)
    expect(readablePage(SEA, { theme: DARK, alternate: LIGHT })).toMatchObject(LIGHT)
    // Black below and no more than grey above: dark glass has less to do.
    const dusk: PageImage = { tones: ['#101010', '#202020', '#404040'], range: ['#000000', '#8a8a8a'], dominant: null }
    expect(readablePage(dusk, OPTIONS)).toMatchObject(DARK)
    expect(readablePage(dusk, OPTIONS).glassOpacity).toBeLessThan(readablePage(SEA, OPTIONS).glassOpacity)
  })

  it('judges the middle half alone of an image given without its range', () => {
    const { range: _, ...middle } = SEA
    expect(readablePage(middle, OPTIONS).glassOpacity).toBeLessThan(readablePage(SEA, OPTIONS).glassOpacity)
  })

  it('says how far text may be dimmed on that glass and still read', () => {
    const { foreground, background, glassOpacity, dimmest } = readablePage(NIGHT, OPTIONS)
    expect(dimmest).toBeGreaterThan(0)
    expect(dimmest).toBeLessThan(0.85)
    expect(reads(NIGHT, foreground, background, glassOpacity, dimmest)).toBe(true)
    expect(reads(NIGHT, foreground, background, glassOpacity, dimmest - 0.01)).toBe(false)
  })

  it('leaves next to no room to dim text on glass thickened only as far as it reads', () => {
    expect(readablePage(SEA, OPTIONS).dimmest).toBeGreaterThan(0.95)
  })

  it('judges the text on the thinnest glass', () => {
    // Over this grey #111318 falls short on thin dark glass's opposite, but not on thick pale glass.
    const grey: PageImage = { tones: ['#404040', '#505050', '#606060'], dominant: null }
    expect(readablePage(grey, { ...OPTIONS, glassOpacity: 0.05 })).toMatchObject(DARK)
    expect(readablePage(grey, { ...OPTIONS, glassOpacity: 0.8 })).toMatchObject(LIGHT)
  })

  it('takes the highlight from the dominant colour, shaded as far as the contrast asks', () => {
    const { selection, background } = readablePage(PALE, OPTIONS)
    expect(selection.passes).toBe(true)
    // Still orange: red the highest channel, blue the lowest.
    const { r, g, b } = rgb(selection.background)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    // It shows even on a field as thick as the tint itself.
    expect(contrastRatio(rgb(selection.background), rgb(background))).toBeGreaterThanOrEqual(3)
  })

  it('shows the highlight on a field over every tone of the image', () => {
    const { selection, background } = readablePage(PALE, OPTIONS)
    for (const tone of PALE.tones) {
      const field = over({ ...rgb(background), alpha: 0.6 }, { ...rgb(tone), alpha: 1 })
      expect(contrastRatio(rgb(selection.background), field)).toBeGreaterThanOrEqual(3)
    }
  })

  it("takes the selected text from the pairs, the other pair's where the highlight needs it", () => {
    const { foreground, selection } = readablePage(PALE, OPTIONS)
    expect(selection.color).not.toBe(foreground)
    expect(selection.color).toBe(DARK.foreground)
    expect(selection.ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('falls back on the accent where the image has no dominant colour', () => {
    const page = readablePage({ ...NIGHT, dominant: null }, { ...OPTIONS, accent: '#6d7cff' })
    const named = readablePage({ ...NIGHT, dominant: '#6d7cff' }, OPTIONS)
    expect(page.selection.background).toBe(named.selection.background)
  })

  it('gives the same colours for the same image', () => {
    expect(readablePage(PALE, OPTIONS)).toEqual(readablePage(PALE, OPTIONS))
  })
})
