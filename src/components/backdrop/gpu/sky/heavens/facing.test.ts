import { describe, expect, it } from 'vitest'
import { facingForNight, facingPlanner, midnightNear } from './facing'
import { crowdingMap } from './stars'

const LONDON = { latitude: 51.5, longitude: -0.1 }
const SIDE = 0.5

const turnBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)))

describe('midnightNear', () => {
  it('is the middle of the night either side of it, and the same all night', () => {
    const evening = midnightNear(new Date('2026-11-07T20:00:00Z'), LONDON)
    const morning = midnightNear(new Date('2026-11-08T04:00:00Z'), LONDON)
    expect(Math.abs(evening - morning)).toBeLessThan(5 * 60_000)
    // In London, the sun is lowest within half an hour of midnight in November.
    expect(Math.abs(evening - Date.parse('2026-11-08T00:00:00Z'))).toBeLessThan(30 * 60_000)
  })
})

describe('facingForNight', () => {
  const crowding = crowdingMap()
  const facing = (date: string, place = LONDON) =>
    facingForNight(midnightNear(new Date(date), place), place, crowding, SIDE)

  it('faces the equator on a summer night, when the centre of the galaxy is low in the south', () => {
    expect(turnBetween(facing('2026-07-15T23:00:00Z'), 0)).toBeLessThan(0.6)
  })

  it('turns away from the south on an autumn night, when the Milky Way is overhead', () => {
    expect(turnBetween(facing('2026-11-07T22:00:00Z'), 0)).toBeGreaterThan(0.6)
  })

  it('keeps to the equator where the night never gets dark enough', () => {
    expect(facing('2026-06-21T23:00:00Z', { latitude: 69.6, longitude: 19 })).toBe(0)
  })
})

describe('facingPlanner', () => {
  it('faces one way all night, so the sky turns across the view as the real one does', () => {
    const plan = facingPlanner(LONDON, crowdingMap(), SIDE)
    const evening = plan(new Date('2026-11-07T16:00:00Z'))
    for (let minute = 0; minute < 15 * 60; minute += 7) {
      expect(plan(new Date(Date.parse('2026-11-07T16:00:00Z') + minute * 60_000))).toBe(evening)
    }
  })

  it('may face another way the next night, from noon', () => {
    const plan = facingPlanner(LONDON, crowdingMap(), SIDE)
    const ways = ['2026-03-01', '2026-06-01', '2026-09-01', '2026-12-01'].map((day) =>
      plan(new Date(`${day}T23:00:00Z`)),
    )
    expect(new Set(ways).size).toBeGreaterThan(1)
  })
})
