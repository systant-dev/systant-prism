import { afterEach, describe, expect, it, vi } from 'vitest'
import { startCrossfade } from './crossfade'

function duration(value: string) {
  return {
    getPropertyValue: (name: string) => (name === '--prism-fade-background-duration' ? value : ''),
  } as CSSStyleDeclaration
}

afterEach(() => {
  vi.restoreAllMocks()
})

/** Reads `progress` once a frame, `frameMs` apart, from `from` ms to `to`, returning the last reading. */
function framesTo(now: ReturnType<typeof vi.spyOn>, progress: () => number, from: number, to: number, frameMs = 16) {
  let value = 0
  for (let t = from; t <= to; t += frameMs) {
    now.mockReturnValue(1000 + t)
    value = progress()
  }
  return value
}

describe('startCrossfade', () => {
  it('eases in and out over the background fade duration, then stays at 1', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const progress = startCrossfade(duration('0.4s'))!

    expect(progress()).toBe(0)
    expect(framesTo(now, progress, 10, 50, 10)).toBeCloseTo(0.0078)
    expect(framesTo(now, progress, 60, 200, 10)).toBe(0.5)
    expect(framesTo(now, progress, 210, 350, 10)).toBeCloseTo(0.9922)
    expect(framesTo(now, progress, 360, 400, 10)).toBe(1)
    expect(framesTo(now, progress, 410, 1000, 10)).toBe(1)
  })

  it('starts from its first reading, not from when it was set up', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const progress = startCrossfade(duration('0.4s'))!

    now.mockReturnValue(1300)
    expect(progress()).toBe(0)
  })

  it('holds where it was through a stall, rather than jumping on', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const progress = startCrossfade(duration('0.4s'))!

    progress()
    // A frame 300ms late counts as no more than a slow one.
    now.mockReturnValue(1300)
    expect(progress()).toBeLessThan(0.05)
    expect(framesTo(now, progress, 316, 700)).toBeCloseTo(1, 1)
  })

  it.each(['0s', ''])('is instant with a duration of %j', (value) => {
    expect(startCrossfade(duration(value))).toBeNull()
  })
})
