import { describe, expect, it } from 'vitest'
import { CRATERS, MARIA, moonPoint } from './moon'

describe('moonPoint', () => {
  it('puts the middle of the near side towards the Earth', () => {
    const [x, y, z] = moonPoint(0, 0)
    expect([x, y]).toEqual([0, 0])
    expect(z).toBe(1)
  })

  it('has east on the right and north at the top', () => {
    expect(moonPoint(0, 90)[0]).toBeCloseTo(1)
    expect(moonPoint(90, 0)[1]).toBeCloseTo(1)
  })

  it('lies on the unit sphere', () => {
    expect(Math.hypot(...moonPoint(33, -16))).toBeCloseTo(1)
  })
})

describe('the near side', () => {
  it('has every mare and crater facing the Earth', () => {
    for (const [latitude, longitude] of [...MARIA, ...CRATERS])
      expect(moonPoint(latitude, longitude)[2]).toBeGreaterThan(0)
  })

  it('has more of its maria to the north, and Tycho in the south', () => {
    const north = MARIA.filter(([latitude]) => latitude > 0).length
    expect(north).toBeGreaterThan(MARIA.length - north)
    expect(CRATERS[0][0]).toBeLessThan(0)
  })
})
