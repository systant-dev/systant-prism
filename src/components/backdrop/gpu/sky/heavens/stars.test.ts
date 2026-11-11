import { describe, expect, it } from 'vitest'
import { BRIGHT_STARS } from './catalog'
import { dot, type Vec3 } from '../maths'
import { mulberry32 } from '../random'
import { crossesView, equatorial, galactic, heavensAt, toGalactic } from './celestial'
import {
  crowdingMap,
  FAINTEST,
  packStars,
  PACKED_STRIDE,
  STAR_STRIDE,
  starAscensions,
  starColour,
  starField,
  unpackStar,
} from './stars'

const LONDON = { latitude: 51.5, longitude: -0.1 }
const SYDNEY = { latitude: -33.9, longitude: 151.2 }

// Made once, for every test of the London sky to share.
const LONDON_FIELD = starField(LONDON)

/** The way to a star from the ground, by its right ascension in hours and declination in degrees. */
function fromGround(date: string, place: typeof LONDON, rightAscension: number, declination: number): Vec3 {
  const at = equatorial(rightAscension, declination)
  const rows = heavensAt(new Date(date), place)
  const row = (i: number) => rows[i * 4] * at[0] + rows[i * 4 + 1] * at[1] + rows[i * 4 + 2] * at[2]
  return [row(0), row(1), row(2)]
}

const degrees = (radians: number) => (radians * 180) / Math.PI
const altitude = ([, y]: Vec3) => degrees(Math.asin(y))

const magnitudesOf = (field: Float32Array) =>
  Array.from({ length: field.length / STAR_STRIDE }, (_, i) => field[i * STAR_STRIDE + 3])

describe('starColour', () => {
  it('has hot stars blue, the sun yellow-white, and cool stars orange', () => {
    const [hotRed, , hotBlue] = starColour(-0.2)
    const [coolRed, , coolBlue] = starColour(1.6)
    expect(hotBlue).toBeGreaterThan(hotRed)
    expect(coolRed).toBeGreaterThan(coolBlue)
    expect(starColour(0.3)).toEqual([1, 1, 1])
  })

  it('stays within the colours it knows', () => {
    expect(starColour(-1)).toEqual([0.66, 0.77, 1])
    expect(starColour(4)).toEqual([1, 0.68, 0.45])
  })
})

describe('the catalogue', () => {
  it('has every star in the sky', () => {
    for (const [ra, dec, magnitude, index] of BRIGHT_STARS) {
      expect(ra).toBeGreaterThanOrEqual(0)
      expect(ra).toBeLessThan(24)
      expect(Math.abs(dec)).toBeLessThanOrEqual(90)
      expect(magnitude).toBeLessThan(6)
      expect(index).toBeGreaterThan(-0.4)
      expect(index).toBeLessThan(2)
    }
  })

  it('has no star twice', () => {
    const places = BRIGHT_STARS.map(([ra, dec]) => `${ra},${dec}`)
    expect(new Set(places).size).toBe(places.length)
  })

  it('has the shapes the eye knows, such as the Plough, whole', () => {
    // Dubhe, Merak, Phecda, Megrez, Alioth, Mizar and Alkaid.
    const plough = [1.79, 2.37, 2.44, 3.31, 1.77, 2.23, 1.86]
    for (const magnitude of plough) expect(BRIGHT_STARS.some(([, , m]) => m === magnitude)).toBe(true)
  })
})

describe('starField', () => {
  const field = LONDON_FIELD
  const magnitudes = magnitudesOf(field)

  it('holds thousands of stars, fewer than the whole sky, which only the equator sees all of', () => {
    const everywhere = starField({ latitude: 0 }).length / STAR_STRIDE
    expect(magnitudes.length).toBeGreaterThan(5000)
    expect(magnitudes.length).toBeLessThan(everywhere * 0.8)
    expect(everywhere).toBeLessThan(30_000)
  })

  it('is in order of right ascension', () => {
    const ascensions = starAscensions(field)
    expect(ascensions.every((value, i) => i === 0 || value >= ascensions[i - 1])).toBe(true)
  })

  it('is the same sky every time', () => {
    const again = starField(LONDON)
    // Not toEqual, which takes a long time over this many values.
    expect(again.length).toBe(field.length)
    expect(again.every((value, i) => value === field[i])).toBe(true)
  })

  it('has about three times as many for each magnitude fainter', () => {
    const between = (low: number) => magnitudes.filter((m) => m >= low && m < low + 1).length
    expect(between(5) / between(4)).toBeGreaterThan(2.3)
    expect(between(5) / between(4)).toBeLessThan(3.9)
    expect(between(6) / between(5)).toBeGreaterThan(2.3)
    expect(between(6) / between(5)).toBeLessThan(3.9)
  })

  it('goes no fainter than the eye over the ocean sees', () => {
    expect(Math.max(...magnitudes)).toBeLessThanOrEqual(FAINTEST + 1e-4)
  })

  it('goes deeper when asked, with about three times as many stars for each magnitude', () => {
    const depth = 1.1
    const deeper = magnitudesOf(starField(LONDON, depth))
    expect(Math.max(...deeper)).toBeGreaterThan(FAINTEST + depth - 0.05)
    expect(deeper.length / magnitudes.length).toBeGreaterThan(2.8)
    expect(deeper.length / magnitudes.length).toBeLessThan(4)
    // Without the bright ones changing.
    expect(deeper.filter((m) => m < 3).length).toBe(magnitudes.filter((m) => m < 3).length)
  })

  it('leaves out what never crosses the view', () => {
    const out = magnitudes.filter((_, i) => !crossesView(field[i * STAR_STRIDE + 2], LONDON.latitude))
    expect(out).toEqual([])
    // Vega skims the northern horizon at the bottom of its circle, and Polaris never moves.
    expect(crossesView(Math.sin((38.78 * Math.PI) / 180), LONDON.latitude)).toBe(true)
    expect(crossesView(Math.sin((89.26 * Math.PI) / 180), LONDON.latitude)).toBe(false)
    // Nor does Canopus ever rise there.
    expect(crossesView(Math.sin((-52.7 * Math.PI) / 180), LONDON.latitude)).toBe(false)
  })

  it.each([
    ['London', LONDON],
    ['Sydney', SYDNEY],
    ['the equator', { latitude: 0, longitude: 0 }],
    ['Tromsø', { latitude: 69.6, longitude: 19 }],
  ])('keeps every star that can ever be in the view from %s', (_, place) => {
    // Across a very wide view, up to the top of it, at every hour of the day. How high a
    // star is goes only by its declination and how far the sky has turned past it, so one
    // right ascension, turned through the day, stands for them all.
    const missed = new Set<string>()
    for (let declination = -88; declination <= 88; declination += 2) {
      for (let hour = 0; hour < 24; hour += 0.25) {
        const time = new Date(Date.UTC(2026, 0, 1, hour, (hour % 1) * 60)).toISOString()
        const seen = fromGround(time, place, 0, declination)
        // Whichever way the view faces.
        const inView = altitude(seen) > 0.5 && altitude(seen) < 16
        const kept = crossesView(Math.sin((declination * Math.PI) / 180), place.latitude)
        if (inView && !kept) missed.add(String(declination))
      }
    }
    expect([...missed]).toEqual([])
  })

  it('has the brightest real star of its band in it', () => {
    // Fomalhaut and Antares both skim the south from London, Vega the north; Canopus never rises.
    const has = (magnitude: number) => magnitudes.includes(Math.fround(magnitude))
    expect(has(1.16)).toBe(true)
    expect(has(0.96)).toBe(true)
    expect(has(0.03)).toBe(true)
    expect(has(-0.74)).toBe(false)
  })

  it('has a different band of stars from the other side of the world', () => {
    const sydney = starField(SYDNEY)
    expect(sydney).not.toEqual(field)
    expect(sydney.length).toBeGreaterThan(1000)
  })

  it('crowds the faint stars into the star clouds and thins them in the dust', () => {
    // From far enough north for the band from Scutum to Aquila to skim the view.
    const deep = starField({ latitude: 72 }, 1)
    const near = (l: number, b: number, radius: number) => {
      const centre = galactic(l, b)
      let count = 0
      for (let i = 0; i < deep.length / STAR_STRIDE; i++) {
        if (deep[i * STAR_STRIDE + 3] < 6) continue
        const at = Array.from(deep.subarray(i * STAR_STRIDE, i * STAR_STRIDE + 3))
        if (dot(toGalactic(at), centre) > Math.cos((radius * Math.PI) / 180)) count++
      }
      return count
    }
    const scutum = near(27, -2.5, 2)
    const rift = near(36, 3, 2)
    const away = near(50, -40, 2)
    expect(scutum).toBeGreaterThan(rift * 2)
    expect(scutum).toBeGreaterThan(away * 2)
  })
})

describe('crowdingMap', () => {
  const crowding = crowdingMap()

  it('has the faint stars thickest in the band, thickest of all in its star clouds', () => {
    const [pole] = crowding.at(galactic(0, 89))
    const [anticentre] = crowding.at(galactic(180, 0))
    const [scutum] = crowding.at(galactic(27, -2.5))
    expect(pole).toBeCloseTo(1, 1)
    expect(anticentre).toBeGreaterThan(pole)
    expect(scutum).toBeGreaterThan(anticentre * 2)
  })

  it('picks ways as often as it is crowded there', () => {
    const random = mulberry32(7)
    const picked = Array.from({ length: 100_000 }, () => crowding.pick(random(), random(), random()))
    const within = (l: number, b: number) =>
      picked.filter((way) => dot(way, galactic(l, b)) > Math.cos((5 * Math.PI) / 180)).length
    expect(within(27, -2.5)).toBeGreaterThan(within(180, 0) * 2)
    expect(within(180, 0)).toBeGreaterThan(within(180, 60))
    for (const way of picked.slice(0, 200)) expect(Math.hypot(...way)).toBeCloseTo(1, 9)
  })

  it('has the Coalsack and the Great Rift hide what is behind them', () => {
    expect(crowding.at(galactic(301, -1))[1]).toBeLessThan(0.3)
    expect(crowding.at(galactic(36, 3))[1]).toBeLessThan(0.35)
    expect(crowding.at(galactic(200, 40))[1]).toBe(1)
  })
})

describe('packStars', () => {
  const field = LONDON_FIELD
  const packed = packStars(field)

  it('takes 8 bytes a star', () => {
    expect(PACKED_STRIDE).toBe(8)
    expect(packed.byteLength).toBe((field.length / STAR_STRIDE) * PACKED_STRIDE)
  })

  it('keeps where each is to well under a pixel of the longest lens, and its brightness and colour', () => {
    for (let i = 0; i < field.length / STAR_STRIDE; i += 37) {
      const [x, y, z, magnitude, index] = field.subarray(i * STAR_STRIDE, (i + 1) * STAR_STRIDE)
      const [ra, dec, m, bv] = unpackStar(packed, i)
      const at = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
      expect(Math.hypot(at[0] - x, at[1] - y, at[2] - z)).toBeLessThan(1e-4)
      expect(Math.abs(m - magnitude)).toBeLessThan(0.03)
      expect(Math.abs(bv - Math.min(2, Math.max(-0.4, index)))).toBeLessThan(0.006)
    }
  })
})
