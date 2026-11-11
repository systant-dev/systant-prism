import { describe, expect, it } from 'vitest'
import { onPage } from '../../test/dom'
import { bendShown, bezelWidth, fadeBendIn, frostBlur, holeRadius, softEdge } from './lens'

describe('bezelWidth', () => {
  it.each([
    [16, 16],
    [2, 8],
  ])('is as wide as a %spx corner radius by default, and at least 8px', (radius, bezel) => {
    expect(bezelWidth(getComputedStyle(document.body), radius, 200, 100)).toBe(bezel)
  })

  it('reads --prism-refraction-width over the corner radius', () => {
    const el = onPage()
    el.style.setProperty('--prism-refraction-width', '6px')
    expect(bezelWidth(getComputedStyle(el), 16, 200, 100)).toBe(6)
  })

  it('is at most a quarter of the shorter side', () => {
    expect(bezelWidth(getComputedStyle(document.body), 60, 200, 100)).toBe(25)
  })

  it('is at most half the ring a hole leaves, so the bend has gone where it turns round', () => {
    expect(bezelWidth(getComputedStyle(document.body), 60, 120, 120, 36)).toBe(12)
  })

  it('leaves no bend where a hole leaves no glass', () => {
    expect(bezelWidth(getComputedStyle(document.body), 60, 120, 120, 80)).toBe(0)
  })
})

describe('holeRadius', () => {
  function withHole(hole: string) {
    const el = onPage()
    el.style.setProperty('--prism-refraction-hole', hole)
    return getComputedStyle(el)
  }

  it('reads --prism-refraction-hole, and none where there is none', () => {
    expect(holeRadius(withHole('36px'))).toBe(36)
    expect(holeRadius(getComputedStyle(document.body))).toBe(0)
  })

  it('takes a negative hole as none', () => {
    expect(holeRadius(withHole('-4px'))).toBe(0)
  })
})

describe('frostBlur', () => {
  function withFrost(frost: string) {
    const el = onPage()
    el.style.setProperty('--prism-refraction-frost', frost)
    return getComputedStyle(el)
  }

  it('reads --prism-refraction-frost, and none where there is none', () => {
    expect(frostBlur(withFrost('6px'))).toBe(6)
    expect(frostBlur(getComputedStyle(document.body))).toBe(0)
  })

  it('takes a negative frost as none', () => {
    expect(frostBlur(withFrost('-1px'))).toBe(0)
  })
})

describe('softEdge', () => {
  function withSoft(soft: string) {
    const el = onPage()
    el.style.setProperty('--prism-refraction-soft', soft)
    return getComputedStyle(el)
  }

  it('reads --prism-refraction-soft, and none where there is none', () => {
    expect(softEdge(withSoft('1.5px'))).toBe(1.5)
    expect(softEdge(getComputedStyle(document.body))).toBe(0)
  })

  it('takes a negative softness as none', () => {
    expect(softEdge(withSoft('-1px'))).toBe(0)
  })
})

describe('bendShown', () => {
  function glass(fade = '400ms') {
    const el = onPage()
    el.style.setProperty('--prism-refraction-fade', fade)
    return el
  }

  // Calls it once a frame, 20ms apart, from `from` to `to`, and returns the last.
  function frames(el: Element, from: number, to: number) {
    const computed = getComputedStyle(el)
    let shown = 0
    for (let now = from; now <= to; now += 20) shown = bendShown(el, computed, now)
    return shown
  }

  it('fades in from none over --prism-refraction-fade, easing in and out', () => {
    const el = glass()
    expect(frames(el, 1000, 1000)).toBe(0)
    expect(frames(el, 1020, 1200)).toBeCloseTo(0.5)
    expect(frames(el, 1220, 1400)).toBe(1)
    expect(frames(el, 1420, 5000)).toBe(1)
  })

  it('fades in afresh once restarted', () => {
    const el = glass()
    expect(frames(el, 1000, 1400)).toBe(1)

    fadeBendIn(el)
    expect(frames(el, 2000, 2000)).toBe(0)
    expect(frames(el, 2020, 2200)).toBeCloseTo(0.5)
    expect(frames(el, 2220, 2400)).toBe(1)
  })

  it("keeps each element's clock from its first call", () => {
    const first = glass()
    const second = glass()
    frames(first, 0, 180)
    expect(frames(second, 200, 200)).toBe(0)
    expect(frames(first, 200, 200)).toBeCloseTo(0.5)
  })

  it('holds the fade through a stall rather than skipping it', () => {
    const el = glass()
    const computed = getComputedStyle(el)
    bendShown(el, computed, 0)
    // A frame 400ms long, the whole fade, moves it on by only 50ms…
    expect(bendShown(el, computed, 400)).toBeLessThan(0.1)
    // …so 150ms of frames after it bring it halfway.
    expect(frames(el, 410, 550)).toBeCloseTo(0.5)
  })

  it('shows all of it straight away without a fade', () => {
    const el = glass('0s')
    expect(bendShown(el, getComputedStyle(el), 0)).toBe(1)
  })
})
