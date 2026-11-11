import { describe, expect, it } from 'vitest'
import { RIPPLE_MIPS, RIPPLE_SAMPLES, splashCount } from './rainShaders'

describe('rain on the ocean', () => {
  it('mips the rings down to 2×2, as the slopes are', () => {
    expect(RIPPLE_SAMPLES >> (RIPPLE_MIPS - 1)).toBe(2)
  })

  it('draws no splashes without rain, and more of them as it sets in', () => {
    expect(splashCount(0)).toBe(0)
    expect(splashCount(0.5)).toBeLessThan(splashCount(1))
  })
})
