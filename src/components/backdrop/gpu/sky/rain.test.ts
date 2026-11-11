import { describe, expect, it } from 'vitest'
import { rainFade } from './rain'

describe('rainFade', () => {
  it('starts out as it should be, with nothing to ease from', () => {
    expect(rainFade()(true, 1 / 60, false)).toBe(1)
    expect(rainFade()(false, 1 / 60, false)).toBe(0)
  })

  it('sets in a little at a time, and stops at full', () => {
    const rain = rainFade()
    rain(false, 0, false)
    const first = rain(true, 1, false)
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(1)
    expect(rain(true, 1, false)).toBeGreaterThan(first)
    expect(rain(true, 100, false)).toBe(1)
    expect(rain(true, 1, false)).toBe(1)
  })

  it('clears a little at a time, and stops at none', () => {
    const rain = rainFade()
    rain(true, 0, false)
    const first = rain(false, 1, false)
    expect(first).toBeLessThan(1)
    expect(first).toBeGreaterThan(0)
    expect(rain(false, 100, false)).toBe(0)
  })

  it('turns back from where it has got to', () => {
    const rain = rainFade()
    rain(false, 0, false)
    const part = rain(true, 1, false)
    expect(rain(false, 0.5, false)).toBeLessThan(part)
  })

  it('goes straight there for a still scene, which has no frames to ease over', () => {
    const rain = rainFade()
    rain(false, 0, false)
    expect(rain(true, 0, true)).toBe(1)
    expect(rain(false, 0, true)).toBe(0)
  })
})
