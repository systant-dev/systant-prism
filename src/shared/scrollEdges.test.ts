import { describe, expect, it } from 'vitest'
import { onPage } from '../../test/dom'
import { fadeEase, fadeEaseWgsl, fadeLengths, hiddenBeyond, scrollFade, type ScrollMetrics } from './scrollEdges'

const metrics = (m: Partial<ScrollMetrics>): ScrollMetrics => ({
  scrollTop: 0,
  scrollLeft: 0,
  scrollWidth: 100,
  scrollHeight: 100,
  clientWidth: 100,
  clientHeight: 100,
  rtl: false,
  ...m,
})

describe('hiddenBeyond', () => {
  it('is nothing for content that fits', () => {
    expect(hiddenBeyond(metrics({}))).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })

  it('splits what is scrolled out of view between the edges', () => {
    expect(hiddenBeyond(metrics({ scrollTop: 30, scrollHeight: 200, scrollLeft: 10, scrollWidth: 150 }))).toEqual({
      top: 30,
      bottom: 70,
      left: 10,
      right: 40,
    })
  })

  it('counts a right-to-left scroll position from the right', () => {
    expect(hiddenBeyond(metrics({ scrollLeft: -10, scrollWidth: 150, rtl: true }))).toEqual({
      top: 0,
      bottom: 0,
      left: 40,
      right: 10,
    })
  })

  it('ignores overscroll past either end', () => {
    expect(hiddenBeyond(metrics({ scrollTop: -20, scrollHeight: 200 })).top).toBe(0)
    expect(hiddenBeyond(metrics({ scrollTop: 130, scrollHeight: 200 })).bottom).toBe(0)
  })
})

describe('fadeLengths', () => {
  it('fades the full size where there is more than that to scroll to, and ramps in below it', () => {
    expect(fadeLengths({ top: 6, right: 0, bottom: 300, left: 16 }, 16)).toEqual({
      top: 6,
      right: 0,
      bottom: 16,
      left: 16,
    })
  })

  it("doesn't fade for under a px left, a fractional position that can't reach the end", () => {
    expect(fadeLengths({ top: 0.5, right: 0, bottom: 0, left: 0 }, 16).top).toBe(0)
  })
})

describe('scrollFade', () => {
  // 100 more across and down than it shows, scrolled 20 each way.
  function scroller(fade: string, overflowX = 'auto', overflowY = 'auto') {
    const el = onPage()
    el.style.setProperty('--prism-scroll-fade', fade)
    // Longhands: jsdom doesn't expand the overflow shorthand into computed style.
    el.style.overflowX = overflowX
    el.style.overflowY = overflowY
    Object.defineProperties(el, {
      clientWidth: { value: 100 },
      scrollWidth: { value: 200 },
      scrollLeft: { value: 20 },
      clientHeight: { value: 100 },
      scrollHeight: { value: 200 },
      scrollTop: { value: 20 },
    })
    return el
  }

  it('fades a scroller with a --prism-scroll-fade by its scroll position', () => {
    const el = scroller('16px')
    expect(scrollFade(el, getComputedStyle(el))).toEqual({ top: 16, right: 16, bottom: 16, left: 16 })
  })

  it("doesn't fade along an axis that clips rather than scrolls", () => {
    const y = scroller('16px', 'hidden', 'auto')
    expect(scrollFade(y, getComputedStyle(y))).toEqual({ top: 16, right: 0, bottom: 16, left: 0 })
    const x = scroller('16px', 'scroll', 'clip')
    expect(scrollFade(x, getComputedStyle(x))).toEqual({ top: 0, right: 16, bottom: 0, left: 16 })
  })

  it("doesn't fade any other scroller", () => {
    const el = scroller('')
    expect(scrollFade(el, getComputedStyle(el))).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})

describe('fadeEase', () => {
  it('runs from nothing at the edge to everything, level at both ends', () => {
    expect(fadeEase(0)).toBe(0)
    expect(fadeEase(0.5)).toBe(0.5)
    expect(fadeEase(1)).toBe(1)
    // No corner for the eye to pick out as a line: next to nothing changes in the first and last 1%.
    expect(fadeEase(0.01)).toBeLessThan(0.001)
    expect(fadeEase(0.99)).toBeGreaterThan(0.999)
  })

  it('is the same curve in WGSL, for the glass', () => {
    // The expression is arithmetic that reads the same in both languages.
    const wgsl = new Function('t', `return ${fadeEaseWgsl('t')}`) as (t: number) => number
    for (const t of [0, 0.1, 0.25, 0.5, 0.8, 1]) expect(wgsl(t)).toBeCloseTo(fadeEase(t), 12)
  })
})
