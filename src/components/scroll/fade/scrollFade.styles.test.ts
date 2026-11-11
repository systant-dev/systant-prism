import { describe, expect, it } from 'vitest'
import { fadeEase } from '../../../shared'
import { FADE_SIZE, fadeMask, scrollFadeStyles } from './scrollFade.styles'

describe('FADE_SIZE', () => {
  it('is how far a scroller fades unless told otherwise', () => {
    expect(FADE_SIZE).toBe('32px')
    expect(scrollFadeStyles).toMatch(/@property --prism-scroll-fade-size \{[^}]*initial-value: 32px;/)
  })
})

describe('fadeMask', () => {
  /** The stops of a mask: how much shows at each, and where it is. */
  function stops(mask: string) {
    const list = mask.slice(mask.indexOf(', ') + 2, -1).split(/, (?=rgb)/)
    return list.map((stop) => {
      const colour = stop.slice(0, stop.indexOf(')') + 1)
      return { alpha: Number(colour.slice(colour.indexOf('/') + 2, -1)), at: stop.slice(colour.length + 1) }
    })
  }

  it('is solid but for fading out over a length at each end of its axis', () => {
    const mask = fadeMask('bottom', '8px', 'var(--end)')
    expect(mask.startsWith('linear-gradient(to bottom, rgb(0 0 0 / 0) calc(8px * 0), ')).toBe(true)

    const all = stops(mask)
    expect(all).toHaveLength(18)
    // Nothing at each edge, everything from the fade's length in.
    expect(all[0]).toEqual({ alpha: 0, at: 'calc(8px * 0)' })
    expect(all[8]).toEqual({ alpha: 1, at: 'calc(8px * 1)' })
    expect(all[9]).toEqual({ alpha: 1, at: 'calc(100% - var(--end) * 1)' })
    expect(all[17]).toEqual({ alpha: 0, at: 'calc(100% - var(--end) * 0)' })
  })

  it('falls off by fadeEase, the same towards both ends, not in a straight line', () => {
    const all = stops(fadeMask('right', '8px', '8px'))
    const from = all.slice(0, 9)
    expect(from.map((stop) => stop.at)).toEqual(
      [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((t) => `calc(8px * ${t})`),
    )
    for (const [i, stop] of from.entries()) expect(stop.alpha).toBeCloseTo(fadeEase(i / 8), 4)
    // Slow to leave the edge, and slow to arrive: a straight line would be at an eighth, and an eighth short.
    expect(from[1].alpha).toBeLessThan(0.125 / 2)
    expect(from[7].alpha).toBeGreaterThan(1 - 0.125 / 2)
    expect(all.slice(9).map((stop) => stop.alpha)).toEqual(from.map((stop) => stop.alpha).reverse())
  })

  it('is the mask a scroller fades by, both ways', () => {
    expect(scrollFadeStyles).toContain(
      fadeMask('bottom', 'var(--prism-scroll-fade-top)', 'var(--prism-scroll-fade-bottom)'),
    )
    expect(scrollFadeStyles).toContain(
      fadeMask('right', 'var(--prism-scroll-fade-left)', 'var(--prism-scroll-fade-right)'),
    )
  })
})
