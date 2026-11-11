import { afterEach, describe, expect, it } from 'vitest'
import type { PageImage } from '../../contrast'
import { PAGE_TEXT, pagePalette, paletteStyle, samePalette } from './pagePalette'

const IMAGE: PageImage = { tones: ['#c0b0a0', '#d0c0b0', '#e0d0c0'], dominant: '#9d6437' }

function themed(theme: Record<string, string>) {
  const el = document.createElement('div')
  for (const [name, value] of Object.entries(theme)) el.style.setProperty(`--prism-backdrop-${name}`, value)
  document.body.append(el)
  return getComputedStyle(el)
}

const THEME = { fg: '#111318', bg: '#f3f4f6', 'alt-fg': '#eceef2', 'alt-bg': '#24272e', accent: '#6d7cff' }

afterEach(() => {
  document.body.replaceChildren()
})

describe('pagePalette', () => {
  it('chooses from the pairs the styles hold', () => {
    expect(pagePalette(themed(THEME), IMAGE)).toMatchObject({ foreground: '#111318', background: '#f3f4f6' })
  })

  it('gives nothing until they are all colours it can read', () => {
    const { bg: _, ...unset } = THEME
    expect(pagePalette(themed(unset), IMAGE)).toBeNull()
    expect(pagePalette(themed({ ...THEME, fg: 'nonsense' }), IMAGE)).toBeNull()
  })

  it('goes without an accent it cannot read', () => {
    expect(pagePalette(themed({ ...THEME, accent: 'nonsense' }), IMAGE)).not.toBeNull()
  })
})

describe('samePalette', () => {
  const palette = pagePalette(themed(THEME), IMAGE)!

  it('compares the colours, not the objects', () => {
    expect(samePalette(palette, { ...palette })).toBe(true)
    expect(samePalette(palette, { ...palette, foreground: '#000000' })).toBe(false)
    expect(samePalette(palette, { ...palette, selection: { ...palette.selection, color: '#000000' } })).toBe(false)
    expect(samePalette(palette, { ...palette, glassOpacity: 0.4 })).toBe(false)
    expect(samePalette(palette, { ...palette, dimmest: 1 })).toBe(false)
    expect(samePalette(null, null)).toBe(true)
    expect(samePalette(palette, null)).toBe(false)
  })
})

describe('paletteStyle', () => {
  it('gives every control the one tint', () => {
    const style = paletteStyle(pagePalette(themed(THEME), IMAGE)!) as Record<string, string>
    const tints = ['card', 'button', 'textbox', 'toggle-track', 'horizontal-selector-track', 'progress']
    expect(style['--_prism-page-bg']).toBe('#f3f4f6')
    expect(new Set(tints.map((name) => style[`--prism-${name}-bg`]))).toEqual(new Set(['var(--_prism-page-bg)']))
  })

  it('says how thick the glass must be, and how far text may be dimmed on it', () => {
    // A pale sky over a dark sea: no pair reads from one end to the other on a card's 30%.
    const sea: PageImage = { ...IMAGE, tones: ['#1f4257', '#3f6f8a', '#b9c4c9'], range: ['#07222e', '#e6dfc8'] }
    const thin = paletteStyle(pagePalette(themed(THEME), IMAGE)!) as Record<string, number>
    const thick = paletteStyle(pagePalette(themed(THEME), sea)!) as Record<string, number>
    expect(thin['--_prism-page-glass']).toBe(0.3)
    expect(thick['--_prism-page-glass']).toBeGreaterThan(0.3)
    expect(thin['--_prism-page-dimmest']).toBeLessThan(thick['--_prism-page-dimmest'])
  })

  it("thins the horizontal selector's white pill on dark glass, for pale text to read on it", () => {
    const pale = pagePalette(themed(THEME), IMAGE)!
    const opacity = (background: string) =>
      (paletteStyle({ ...pale, background }) as Record<string, number>)['--_prism-page-pill-opacity']
    expect(opacity('#f3f4f6')).toBe(0.45)
    expect(opacity('#24272e')).toBe(0.16)
    expect((paletteStyle(pale) as Record<string, string>)['--prism-horizontal-selector-glass-opacity']).toBe(
      'var(--_prism-page-pill-opacity)',
    )
  })

  it("dims a progress ring's light on dark glass", () => {
    const pale = pagePalette(themed(THEME), IMAGE)!
    const light = (background: string) =>
      (paletteStyle({ ...pale, background }) as Record<string, number>)['--_prism-page-light']
    expect(light('#f3f4f6')).toBe(1)
    expect(light('#24272e')).toBe(0.6)
    expect((paletteStyle(pale) as Record<string, string>)['--prism-progress-light']).toBe('var(--_prism-page-light)')
  })

  it('draws borders in a coat of the text colour, to show on either tint', () => {
    const style = paletteStyle(pagePalette(themed(THEME), IMAGE)!) as Record<string, string>
    expect(style['--_prism-page-fg']).toBe('#111318')
    expect(style['--prism-textbox-border']).toContain(PAGE_TEXT)
  })
})
