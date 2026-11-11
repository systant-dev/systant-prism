import { describe, expect, it } from 'vitest'
import { dot, type Vec3 } from '../maths'
import type { Patch } from './catalog'
import {
  crossesView,
  equatorial,
  galactic,
  galaxyAxes,
  heavensAt,
  milkyWayOut,
  placePatch,
  starsInReach,
  starsOut,
  toGalactic,
  viewBand,
  viewSlice,
} from './celestial'
import { HEAVENS_SIZE, HEAVENS_TURN_SIZE } from './heavensShaders'

const LONDON = { latitude: 51.5, longitude: -0.1 }
const SYDNEY = { latitude: -33.9, longitude: 151.2 }

const degrees = (radians: number) => (radians * 180) / Math.PI

/** The way to a star from the ground, by its right ascension in hours and declination in degrees. */
function fromGround(date: string, place: typeof LONDON, rightAscension: number, declination: number, facing = 0): Vec3 {
  const at = equatorial(rightAscension, declination)
  const rows = heavensAt(new Date(date), place, facing)
  const row = (i: number) => rows[i * 4] * at[0] + rows[i * 4 + 1] * at[1] + rows[i * 4 + 2] * at[2]
  return [row(0), row(1), row(2)]
}

const altitude = ([, y]: Vec3) => degrees(Math.asin(y))
const azimuth = ([x, , z]: Vec3) => degrees(Math.atan2(x, z))

/** Galactic longitude, 0–360, and latitude, in degrees, of a galactic way. */
const lonLat = (way: number[]) => [(degrees(Math.atan2(way[1], way[0])) + 360) % 360, degrees(Math.asin(way[2]))]

describe('heavensAt', () => {
  it('gives the turn of the sky and of the galaxy', () => {
    expect(heavensAt(new Date(), LONDON)).toHaveLength(HEAVENS_TURN_SIZE)
    expect(HEAVENS_TURN_SIZE).toBeLessThan(HEAVENS_SIZE)
  })

  it('turns without stretching', () => {
    const [x, y, z] = fromGround('2026-08-01T22:00:00Z', LONDON, 4.2, 33)
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
  })

  it('keeps the pole at the height of the latitude, all night', () => {
    for (const time of ['20:00', '23:00', '02:00']) {
      expect(altitude(fromGround(`2026-02-01T${time}:00Z`, LONDON, 0, 90))).toBeCloseTo(51.5, 3)
    }
  })

  it('has Sirius due south, at its true height, at its real transit', () => {
    // Sidereal time at 22:00 UTC on 1 February is about 6.75 hours, Sirius's right ascension.
    const sirius = fromGround('2026-02-01T22:00:00Z', LONDON, 6.752, -16.72)
    expect(altitude(sirius)).toBeCloseTo(90 - 51.5 - 16.72, 0)
    expect(Math.abs(azimuth(sirius))).toBeLessThan(2)
  })

  it('has stars rise in the east, on the left when facing south, and set in the west', () => {
    const rising = azimuth(fromGround('2026-02-01T20:00:00Z', LONDON, 6.752, -16.72))
    const setting = azimuth(fromGround('2026-02-02T02:00:00Z', LONDON, 6.752, -16.72))
    expect(rising).toBeLessThan(0)
    expect(setting).toBeGreaterThan(0)
  })

  it('faces north south of the equator, where stars rise on the right', () => {
    // Orion crosses the northern sky from Sydney on a summer night.
    const early = azimuth(fromGround('2026-01-15T10:00:00Z', SYDNEY, 5.6, 0))
    const late = azimuth(fromGround('2026-01-15T16:00:00Z', SYDNEY, 5.6, 0))
    expect(early).toBeGreaterThan(0)
    expect(late).toBeLessThan(0)
  })

  it('turns the view to face another side of the sky, the sky the same', () => {
    // Sirius due south at its transit: facing a quarter turn to the right, west, it is on the left.
    const ahead = fromGround('2026-02-01T22:00:00Z', LONDON, 6.752, -16.72)
    const turned = fromGround('2026-02-01T22:00:00Z', LONDON, 6.752, -16.72, Math.PI / 2)
    expect(azimuth(turned)).toBeCloseTo(azimuth(ahead) - 90, 1)
    expect(altitude(turned)).toBeCloseTo(altitude(ahead), 6)
  })

  it('has the galactic centre low in the south on a summer evening, in Sagittarius', () => {
    // Its row of the galaxy's axes gives the way to it.
    const rows = heavensAt(new Date('2026-07-15T22:30:00Z'), LONDON)
    const centre: Vec3 = [rows[12], rows[13], rows[14]]
    expect(altitude(centre)).toBeGreaterThan(7)
    expect(altitude(centre)).toBeLessThan(11)
    expect(Math.abs(azimuth(centre))).toBeLessThan(25)
  })

  it('turns the galaxy with the stars, through the night', () => {
    // The galactic centre stays where Sagittarius is, hour by hour.
    for (const time of ['21:00', '23:00', '01:00']) {
      const date = `2026-07-${time < '12' ? '16' : '15'}T${time}:00Z`
      const rows = heavensAt(new Date(date), LONDON)
      const centre = [rows[12], rows[13], rows[14]]
      const sagittarius = fromGround(date, LONDON, 17.761, -28.94)
      expect(dot(centre, sagittarius)).toBeCloseTo(1, 5)
    }
  })
})

describe('the galaxy', () => {
  it('has its axes square to each other', () => {
    const [centre, along, pole] = galaxyAxes()
    expect(dot(centre, along)).toBeCloseTo(0, 9)
    expect(dot(centre, pole)).toBeCloseTo(0, 9)
    expect(dot(along, pole)).toBeCloseTo(0, 9)
  })

  it.each([
    ['Deneb', 20.69, 45.28, 84.3, 2],
    ['the Large Magellanic Cloud', 5.392, -69.76, 280.5, -32.9],
    ['Andromeda', 0.712, 41.27, 121.2, -21.6],
    ['the Orion Nebula', 5.588, -5.39, 209, -19.4],
  ])('puts %s at its galactic longitude and latitude', (_, ra, dec, l, b) => {
    const [longitude, latitude] = lonLat(toGalactic(equatorial(ra, dec)))
    expect(longitude).toBeCloseTo(l, -0.3)
    expect(latitude).toBeCloseTo(b, -0.3)
  })

  it('places a patch by right ascension along its tilt from north through east', () => {
    const patch: Patch = { at: [6, 0], long: 1, wide: 1, tilt: 90, strength: 1 }
    const [middle, length] = placePatch(patch, true)
    // Tilted to the east, its length lies the way right ascension grows.
    const east = toGalactic(equatorial(6.01, 0))
    expect(
      dot(
        length,
        east.map((v, i) => v - middle[i]),
      ),
    ).toBeGreaterThan(0)
    expect(dot(length, middle)).toBeCloseTo(0, 9)
  })

  it('places a patch by galactic coordinates along the plane, untilted', () => {
    const [middle, length] = placePatch({ at: [30, 0], long: 1, wide: 1, tilt: 0, strength: 1 }, false)
    expect(middle).toEqual(galactic(30, 0))
    expect(length[2]).toBeCloseTo(0, 9)
    expect(dot(length, galactic(31, 0))).toBeGreaterThan(0)
  })
})

describe('starsOut', () => {
  it('shows none by day, nor at the end of sunset', () => {
    expect(starsOut(0.8)).toBe(0)
    expect(starsOut(0)).toBe(0)
    expect(starsOut(-0.05)).toBe(0)
  })

  it('brings them out through twilight', () => {
    const civil = starsOut(Math.sin((-8 * Math.PI) / 180))
    const nautical = starsOut(Math.sin((-12 * Math.PI) / 180))
    expect(civil).toBeGreaterThan(0)
    expect(nautical).toBeGreaterThan(civil)
    expect(nautical).toBeLessThan(1)
  })

  it('shows them all in the full dark', () => {
    expect(starsOut(Math.sin((-18 * Math.PI) / 180))).toBe(1)
    expect(starsOut(-1)).toBe(1)
  })
})

describe('milkyWayOut', () => {
  const at = (degreesDown: number) => milkyWayOut(starsOut(Math.sin((-degreesDown * Math.PI) / 180)))

  it('waits for the stars to be well out, past the end of civil twilight', () => {
    expect(at(6)).toBe(0)
    expect(at(8)).toBe(0)
    expect(at(10)).toBeLessThan(0.15)
  })

  it('comes out through nautical twilight, behind the stars, and is all there in the dark', () => {
    expect(at(13)).toBeGreaterThan(0.3)
    expect(at(13)).toBeLessThan(starsOut(Math.sin((-13 * Math.PI) / 180)))
    expect(at(18)).toBe(1)
  })

  it('only ever grows as the sun sinks, so dawn takes it away the same', () => {
    let last = 0
    for (let down = 0; down <= 20; down += 0.25) {
      expect(at(down)).toBeGreaterThanOrEqual(last)
      last = at(down)
    }
  })
})

describe('viewBand', () => {
  it.each([
    ['London', LONDON],
    ['Sydney', SYDNEY],
    ['the equator', { latitude: 0, longitude: 0 }],
    ['Tromsø', { latitude: 69.6, longitude: 19 }],
  ])('holds just the declinations crossesView keeps from %s', (_, place) => {
    const [low, high] = viewBand(place.latitude)
    const wrong: number[] = []
    for (let z = -0.999; z < 1; z += 0.001) {
      const inside = z >= low && z <= high
      const atEdge = Math.abs(z - low) < 1e-6 || Math.abs(z - high) < 1e-6
      if (!atEdge && crossesView(z, place.latitude) !== inside) wrong.push(z)
    }
    expect(wrong).toEqual([])
    expect(high).toBeGreaterThan(low)
  })
})

describe('starsInReach', () => {
  const sorted = Float64Array.from({ length: 360 }, (_, i) => (i * Math.PI) / 180)
  const covered = (ranges: [number, number][]) =>
    ranges.flatMap(([first, count]) => Array.from({ length: count }, (_, i) => first + i))

  it('gives one run around the middle of the sky', () => {
    const ranges = starsInReach(sorted, Math.PI, 0.5)
    expect(ranges).toHaveLength(1)
    expect(ranges[0][1]).toBeGreaterThan(50)
    expect(ranges[0][1]).toBeLessThan(60)
  })

  it('gives two runs across right ascension 0, with none lost or counted twice', () => {
    const ranges = starsInReach(sorted, 0.1, 0.5)
    expect(ranges).toHaveLength(2)
    const stars = covered(ranges)
    expect(new Set(stars).size).toBe(stars.length)
    expect(stars).toContain(0)
    expect(stars).toContain(359)
    expect(stars.length).toBeGreaterThan(50)
  })

  it('copes with any turn of the sky, however far', () => {
    expect(starsInReach(sorted, 100.4, 0.5)).toEqual(starsInReach(sorted, 100.4 % (2 * Math.PI), 0.5))
    expect(starsInReach(sorted, -1, 0.5)).toEqual(starsInReach(sorted, 2 * Math.PI - 1, 0.5))
  })

  it('gives every star when the reach is all of them', () => {
    expect(starsInReach(sorted, 2, 4)).toEqual([[0, 360]])
  })
})

describe('viewSlice', () => {
  const side = 0.65

  it('is a slice of the sky, far short of half of it, for an ordinary view', () => {
    const [, reach] = viewSlice(heavensAt(new Date('2026-02-01T22:00:00Z'), LONDON), side)
    expect(reach).toBeLessThan(1.2)
  })

  it('is every star for a view by a pole', () => {
    // Near the equator, facing north, the pole is just above the horizon.
    const rows = heavensAt(new Date('2026-02-01T22:00:00Z'), { latitude: 5, longitude: 0 }, Math.PI)
    expect(viewSlice(rows, side)).toEqual([0, Math.PI])
  })

  it.each([
    ['London', LONDON],
    ['Sydney', SYDNEY],
    ['the equator', { latitude: 0, longitude: 0 }],
    ['Tromsø', { latitude: 69.6, longitude: 19 }],
  ])('holds every star in view from %s, whichever way it faces, at any hour', (_, place) => {
    const outside: string[] = []
    let checked = 0
    for (const facing of [0, 0.8, -1.6, 2.4, Math.PI]) {
      for (const hour of [0, 5, 11, 17]) {
        const date = new Date(Date.UTC(2026, 2, 1, hour)).toISOString()
        const rows = heavensAt(new Date(date), place, facing)
        const [middle, reach] = viewSlice(rows, side)
        for (let declination = -88; declination <= 88; declination += 2) {
          for (let hours = 0; hours < 24; hours += 0.1) {
            const at = equatorial(hours, declination)
            const row = (i: number) => rows[i * 4] * at[0] + rows[i * 4 + 1] * at[1] + rows[i * 4 + 2] * at[2]
            const seen: Vec3 = [row(0), row(1), row(2)]
            const inView = altitude(seen) > 0.2 && altitude(seen) < 17 && Math.abs(azimuth(seen)) < degrees(side)
            if (!inView) continue
            checked++
            const off = Math.abs(
              Math.atan2(Math.sin((hours * Math.PI) / 12 - middle), Math.cos((hours * Math.PI) / 12 - middle)),
            )
            if (off > reach) outside.push(`${facing} ${hour} ${declination} ${hours.toFixed(1)}`)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
    expect(outside).toEqual([])
  })
})
