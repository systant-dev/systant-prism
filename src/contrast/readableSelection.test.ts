import { describe, expect, it } from 'vitest'
import { contrastRatio, parseColor } from './color'
import { readableSelection } from './readableSelection'

const INK = '#111318'
const ACCENT = '#6d7cff'

function ratioBetween(a: string, b: string) {
  return contrastRatio(parseColor(a)!, parseColor(b)!)
}

describe('readableSelection', () => {
  it('keeps the preferred colour and the text where both clear their ratios', () => {
    const selection = readableSelection('#ffffff', { text: INK, prefer: ACCENT })
    expect(selection).toMatchObject({ background: ACCENT, color: INK, passes: true })
  })

  it('reports both ratios and their targets', () => {
    const selection = readableSelection('#ffffff', { text: INK, prefer: ACCENT })
    expect(selection.ratio).toBeCloseTo(ratioBetween(INK, ACCENT), 10)
    expect(selection.separation).toBeCloseTo(ratioBetween('#ffffff', ACCENT), 10)
    expect(selection).toMatchObject({ target: 4.5, separationTarget: 3 })
  })

  it('shades the preferred colour as little as it must for the highlight to show', () => {
    // On pale grey the accent is too close to the field, so it darkens, keeping the text if it can.
    const prefer = '#b8c0ff'
    const selection = readableSelection('#f3f4f6', { text: INK, prefer })

    expect(selection.background).not.toBe(prefer)
    expect(selection.passes).toBe(true)
    expect(selection.color).toBe(INK)
    expect(selection.separation).toBeGreaterThanOrEqual(3)
    // Only just: a little more than needed, from rounding to one step at a time.
    expect(selection.separation).toBeLessThan(3.2)
  })

  it('shades the preferred colour for the text to read on it', () => {
    const selection = readableSelection('#24272e', { text: '#eceef2', prefer: '#3a46b8', minSeparation: 1.5 })
    expect(selection.color).toBe('#eceef2')
    expect(selection.ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('changes the text when no shade works with the one given', () => {
    // Light text needs a dark highlight, but the field is dark too.
    const selection = readableSelection('#24272e', { text: '#eceef2', prefer: ACCENT })

    expect(selection.color).not.toBe('#eceef2')
    expect(selection.background).toBe(ACCENT)
    expect(selection.passes).toBe(true)
  })

  it('takes the text that leaves the highlight nearest the preferred colour, with none given', () => {
    expect(readableSelection('#ffffff', { prefer: ACCENT })).toMatchObject({
      background: ACCENT,
      color: '#000000',
    })
    // Pale wouldn't show on white and dark text can't read on what would: white text on a dark accent.
    expect(readableSelection('#ffffff', { prefer: '#101a6b' })).toMatchObject({
      background: '#101a6b',
      color: '#ffffff',
    })
  })

  it('chooses from the candidates given', () => {
    const selection = readableSelection('#24272e', { prefer: ACCENT, candidates: ['#111318', '#eceef2'] })
    expect(selection.color).toBe('#111318')
  })

  it('judges a translucent background over each colour of the backdrop', () => {
    const tint = 'rgb(243 244 246 / 0.6)'
    const pale = readableSelection(tint, { text: INK, prefer: ACCENT, backdrop: ['#ffffff', '#e2e8f0'] })
    const anywhere = readableSelection(tint, { text: INK, prefer: ACCENT })

    expect(pale).toMatchObject({ background: ACCENT, color: INK, passes: true })
    // Over black as well as white the field runs to a mid grey, which the accent is too near.
    expect(anywhere.background).not.toBe(ACCENT)
    expect(anywhere.passes).toBe(true)
  })

  it('judges every colour the background may be', () => {
    const selection = readableSelection(['#ffffff', '#0f172a'], { text: INK, prefer: ACCENT })
    expect(selection.separation).toBeGreaterThanOrEqual(3)
    expect(selection.separation).toBeCloseTo(
      Math.min(ratioBetween('#ffffff', selection.background), ratioBetween('#0f172a', selection.background)),
      10,
    )
  })

  it('asks more of the text at AAA, and less of large text', () => {
    const aaa = readableSelection('#ffffff', { text: INK, prefer: ACCENT, level: 'AAA' })
    expect(aaa.target).toBe(7)
    expect(aaa.ratio).toBeGreaterThanOrEqual(7)
    expect(readableSelection('#ffffff', { text: INK, prefer: ACCENT, large: true }).target).toBe(3)
  })

  it('meets the ratios it is given instead', () => {
    const selection = readableSelection('#ffffff', { prefer: ACCENT, minRatio: 6, minSeparation: 4 })
    expect(selection).toMatchObject({ target: 6, separationTarget: 4, passes: true })
    expect(selection.ratio).toBeGreaterThanOrEqual(6)
    expect(selection.separation).toBeGreaterThanOrEqual(4)
  })

  it('returns the closest it can find when nothing clears both ratios', () => {
    // Greys from black to white leave no shade 3:1 from all of them.
    const selection = readableSelection(['#000000', '#777777', '#ffffff'], { text: INK, prefer: ACCENT })

    expect(selection.passes).toBe(false)
    expect(selection.background).toMatch(/^#[\da-f]{6}$/)
    expect(selection.separation).toBeGreaterThan(1)
  })

  it('writes out colours as #rrggbb, however they came in', () => {
    const selection = readableSelection('rgb(255 255 255)', { text: 'rgb(17 19 24)', prefer: 'rgb(109 124 255)' })
    expect(selection).toMatchObject({ background: ACCENT, color: INK })
  })

  it('throws on a colour it cannot read, and with nothing to judge against', () => {
    expect(() => readableSelection('nonsense')).toThrow('nonsense')
    expect(() => readableSelection([])).toThrow('at least one background')
  })
})
