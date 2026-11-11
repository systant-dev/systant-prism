import { describe, expect, it } from 'vitest'
import {
  HORIZON_HALF_FOV,
  HORIZON_PITCH,
  isNight,
  localPlace,
  LONG_LENS,
  moonWay,
  placeOfZone,
  skyAt,
  skyClock,
  solarDay,
  sunWay,
} from './daylight'
import type { Vec3 } from './maths'

const LONDON = { latitude: 51.5, longitude: -0.1 }
const SYDNEY = { latitude: -33.9, longitude: 151.2 }
const EQUATOR = { latitude: 0, longitude: 0 }
const TROMSO = { latitude: 69.6, longitude: 19 }

const degrees = (radians: number) => (radians * 180) / Math.PI
const elevation = ([, y]: Vec3) => Math.asin(y)

describe('solarDay', () => {
  // Published times for each, in UTC, to the minute.
  it.each([
    ['London at the midsummer sunrise', '2026-06-21T03:43:00Z', LONDON],
    ['London at the midsummer sunset', '2026-06-21T20:21:00Z', LONDON],
    ['London at the midwinter sunrise', '2026-12-21T08:04:00Z', LONDON],
    ['London at the midwinter sunset', '2026-12-21T15:53:00Z', LONDON],
    ['Sydney at the midsummer sunset', '2026-12-21T09:05:00Z', SYDNEY],
  ])('finds the sun on the horizon for %s', (_, time, place) => {
    expect(degrees(Math.asin(solarDay(new Date(time), place).height))).toBeCloseTo(-0.83, 0)
  })

  it('has the sun at its highest at solar noon, to within the equation of time', () => {
    const { hourAngle } = solarDay(new Date('2026-04-15T12:00:00Z'), { latitude: 40, longitude: 0 })
    expect(Math.abs(degrees(hourAngle))).toBeLessThan(1)
  })

  it('reaches the height of the tropic at midsummer noon', () => {
    const { height } = solarDay(new Date('2026-06-21T12:03:00Z'), LONDON)
    expect(degrees(Math.asin(height))).toBeCloseTo(90 - 51.5 + 23.44, 0)
  })

  it('has twelve hours of day at the equator', () => {
    const { sunset } = solarDay(new Date('2026-03-20T12:00:00Z'), EQUATOR)
    expect(degrees(sunset)).toBeGreaterThan(90)
    expect(degrees(sunset)).toBeLessThan(91)
  })

  it('has a longer day in summer than in winter, and the opposite south of the equator', () => {
    const june = new Date('2026-06-21T12:00:00Z')
    const december = new Date('2026-12-21T12:00:00Z')
    expect(solarDay(june, LONDON).sunset).toBeGreaterThan(solarDay(december, LONDON).sunset)
    expect(solarDay(june, SYDNEY).sunset).toBeLessThan(solarDay(december, SYDNEY).sunset)
  })

  it('has no sunset in the Arctic summer, and no sunrise in its winter', () => {
    expect(solarDay(new Date('2026-06-21T12:00:00Z'), TROMSO).sunset).toBeCloseTo(Math.PI, 5)
    expect(solarDay(new Date('2026-12-21T12:00:00Z'), TROMSO).sunset).toBe(0)
  })
})

describe('skyAt', () => {
  const noon = new Date('2026-04-15T12:00:00Z')
  const midnight = new Date('2026-04-15T00:00:00Z')
  const sky = (time: string, place = LONDON) => skyAt(new Date(time), place)

  it('has the sun up and the moon gone by day', () => {
    const { sun, moonlight, sunHeight } = skyAt(noon, LONDON)
    expect(elevation(sun)).toBeGreaterThan(0.15)
    expect(sunHeight).toBeGreaterThan(0.5)
    expect(moonlight).toBe(0)
  })

  it('has the moon up and the sun gone by night', () => {
    const { sun, moon, moonlight, sunHeight } = skyAt(midnight, LONDON)
    expect(elevation(moon)).toBeGreaterThan(0.15)
    expect(moonlight).toBe(1)
    expect(sunHeight).toBeLessThan(0)
    expect(elevation(sun)).toBeLessThan(0)
  })

  it('keeps both within the top of the view at their highest', () => {
    expect(elevation(skyAt(noon, LONDON).sun)).toBeLessThan(0.25)
    expect(elevation(skyAt(midnight, LONDON).moon)).toBeLessThan(0.25)
  })

  it('keeps both in the middle of the view at every hour, only rising and sinking', () => {
    for (let hour = 0; hour < 24; hour++) {
      const { sun, moon } = skyAt(new Date(Date.UTC(2026, 3, 15, hour)), LONDON)
      expect([sun[0], moon[0]]).toEqual([0, 0])
    }
  })

  it('has the sun on the horizon at the real sunrise and sunset', () => {
    expect(degrees(elevation(sky('2026-06-21T03:43:00Z').sun))).toBeCloseTo(0, 0)
    expect(degrees(elevation(sky('2026-06-21T20:21:00Z').sun))).toBeCloseTo(0, 0)
  })

  it('has the sun climb through the morning and sink through the afternoon', () => {
    const heights = ['07:00', '09:00', '12:00', '15:00', '17:00'].map((time) =>
      elevation(sky(`2026-04-15T${time}:00Z`).sun),
    )
    expect(heights[0]).toBeLessThan(heights[1])
    expect(heights[1]).toBeLessThan(heights[2])
    expect(heights[2]).toBeGreaterThan(heights[3])
    expect(heights[3]).toBeGreaterThan(heights[4])
  })

  it('has the moon come up where the sun went down', () => {
    const justAfterSunset = sky('2026-06-21T20:40:00Z')
    expect(elevation(justAfterSunset.sun)).toBeLessThan(0)
    expect(elevation(justAfterSunset.moon)).toBeGreaterThan(0)
    expect(elevation(justAfterSunset.moon)).toBeLessThan(0.05)
  })

  it('has the moon go down as the sun comes up', () => {
    const justBeforeSunrise = sky('2026-06-21T03:30:00Z')
    expect(elevation(justBeforeSunrise.sun)).toBeLessThan(0)
    expect(elevation(justBeforeSunrise.moon)).toBeLessThan(0.05)
  })

  it('brings the moon up gradually through dusk', () => {
    const dusk = [20.4, 20.8, 21.2, 21.8, 22.4].map((hour) => {
      const time = new Date('2026-06-21T00:00:00Z')
      time.setUTCMinutes(hour * 60)
      return skyAt(time, LONDON).moonlight
    })
    expect(dusk).toEqual([...dusk].sort((a, b) => a - b))
    expect(dusk[0]).toBeLessThan(0.15)
    expect(dusk[4]).toBeGreaterThan(0.9)
  })

  it('has the moon upright at the top of its arc, leaning one way then the other', () => {
    const tilts = ['2026-04-15T19:30:00Z', '2026-04-15T23:50:00Z', '2026-04-16T04:30:00Z'].map(
      (time) => sky(time).moonTilt,
    )
    expect(tilts[0]).toBeLessThan(-0.3)
    expect(Math.abs(tilts[1])).toBeLessThan(0.1)
    expect(tilts[2]).toBeGreaterThan(0.3)
  })

  it('has the moon upside down south of the equator', () => {
    expect(Math.abs(sky('2026-04-15T14:30:00Z', SYDNEY).moonTilt - Math.PI)).toBeLessThan(0.15)
  })

  it('never shows the sun and the moon together', () => {
    for (let hour = 0; hour < 48; hour++) {
      const { sun, moonlight } = skyAt(new Date(Date.UTC(2026, 2, 20, hour / 2, (hour % 2) * 30)), LONDON)
      expect(elevation(sun) > 0.01 && moonlight > 0).toBe(false)
    }
  })

  it('copes with a day that has no sunset, showing no moon', () => {
    const { moonlight, sunHeight } = skyAt(new Date('2026-06-21T23:00:00Z'), TROMSO)
    expect(sunHeight).toBeGreaterThan(0)
    expect(moonlight).toBe(0)
  })

  it('copes with a day that has no sunrise, showing the moon all day', () => {
    const { moon, moonlight, sun } = skyAt(new Date('2026-12-21T01:00:00Z'), TROMSO)
    expect(moon.every(Number.isFinite)).toBe(true)
    expect(sun.every(Number.isFinite)).toBe(true)
    expect(moonlight).toBe(1)
  })
})

describe('isNight', () => {
  it('is day at noon, and night at midnight', () => {
    expect(isNight(new Date('2026-03-20T12:00:00Z'), LONDON)).toBe(false)
    expect(isNight(new Date('2026-03-20T00:00:00Z'), LONDON)).toBe(true)
  })

  it('is day just after sunset, and night by the middle of twilight', () => {
    expect(isNight(new Date('2026-03-20T18:15:00Z'), LONDON)).toBe(false)
    expect(isNight(new Date('2026-03-20T18:45:00Z'), LONDON)).toBe(true)
  })

  it('goes by the place', () => {
    const noon = new Date('2026-03-20T12:00:00Z')
    expect(isNight(noon, { latitude: -33.9, longitude: 151.2 })).toBe(true)
  })
})

describe('moonWay', () => {
  it('lies opposite the sun, as a full moon does', () => {
    const date = new Date('2026-03-01T21:00:00Z')
    const sun = sunWay(date, LONDON)
    moonWay(date, LONDON).forEach((part, i) => expect(part).toBeCloseTo(-sun[i]))
  })

  it('rides high at midnight in winter and low in summer', () => {
    expect(moonWay(new Date('2026-12-21T00:00:00Z'), LONDON)[1]).toBeGreaterThan(0.85)
    expect(moonWay(new Date('2026-06-21T00:00:00Z'), LONDON)[1]).toBeLessThan(0.3)
  })
})

describe('skyClock', () => {
  const NOON = Date.parse('2026-04-15T12:00:00Z')
  const MINUTE = 60_000
  const HOUR = 60 * MINUTE

  /** What the clock shows over `seconds` at 60 frames a second, with the true time moving on as it does. */
  function run(clock: ReturnType<typeof skyClock>, from: number, start: number, seconds: number) {
    const shown: number[] = []
    for (let frame = 0; frame <= seconds * 60; frame++) {
      const elapsed = frame / 60
      shown.push(clock(from + elapsed * 1000, start + elapsed))
    }
    return shown
  }

  it('gives the true time while the frames keep coming', () => {
    const clock = skyClock()
    for (let frame = 0; frame < 120; frame++) {
      expect(clock(NOON + frame * 16, frame / 60)).toBe(NOON + frame * 16)
    }
  })

  it('starts at the true time, with nothing to catch up on', () => {
    expect(skyClock()(NOON, 3)).toBe(NOON)
  })

  it('carries on from where it was after time away, without a jump', () => {
    const clock = skyClock()
    clock(NOON, 10)
    expect(clock(NOON + 5 * MINUTE, 10.016)).toBeCloseTo(NOON, -3)
  })

  it('moves only forwards, in small steps, and arrives', () => {
    const clock = skyClock()
    clock(NOON, 10)
    const shown = run(clock, NOON + 5 * MINUTE, 10.016, 3)
    const steps = shown.slice(1).map((time, i) => time - shown[i])
    expect(Math.min(...steps)).toBeGreaterThan(0)
    expect(Math.max(...steps)).toBeLessThan(0.1 * 5 * MINUTE)
    expect(shown.at(-1)).toBe(NOON + 5 * MINUTE + 3000)
  })

  it('takes about a second over a few minutes', () => {
    const clock = skyClock()
    clock(NOON, 10)
    const shown = run(clock, NOON + 5 * MINUTE, 10, 3)
    expect(shown[Math.round(0.5 * 60)]).toBeLessThan(NOON + 5 * MINUTE)
    expect(shown[Math.round(1.2 * 60)]).toBeCloseTo(NOON + 5 * MINUTE + 1200, -1)
  })

  it('takes longer over hours, and four seconds at the most', () => {
    const clock = skyClock()
    clock(NOON, 10)
    const moment = NOON + 12 * HOUR
    const shown = run(clock, moment, 10, 5)
    expect(shown[Math.round(3 * 60)]).toBeLessThan(moment)
    expect(shown[Math.round(4.1 * 60)]).toBeCloseTo(moment + 4100, -1)
  })

  it('goes straight to a time when told to, however far off it is', () => {
    const clock = skyClock()
    clock(NOON, 10)
    expect(clock(NOON + 6 * HOUR, 10.016, true)).toBe(NOON + 6 * HOUR)
  })

  it('leaves off catching up when told to go straight', () => {
    const clock = skyClock()
    clock(NOON, 10)
    clock(NOON + 6 * HOUR, 10.016)
    expect(clock(NOON + 2 * HOUR, 10.032, true)).toBe(NOON + 2 * HOUR)
    expect(clock(NOON + 2 * HOUR, 10.048)).toBe(NOON + 2 * HOUR)
  })

  it('runs on from a time it went straight to, once it is let go of', () => {
    const clock = skyClock()
    clock(NOON, 10)
    clock(NOON + 6 * HOUR, 10.016, true)
    expect(clock(NOON, 10.032)).toBeCloseTo(NOON + 6 * HOUR, -4)
    expect(clock(NOON, 15)).toBe(NOON)
  })

  it('does not run through whole days, only what is left over', () => {
    const clock = skyClock()
    clock(NOON, 10)
    const moment = NOON + 3 * 24 * HOUR + 2 * HOUR
    expect(moment - clock(moment, 10)).toBeCloseTo(2 * HOUR, -3)
  })

  it('goes back smoothly if the clock is put back', () => {
    const clock = skyClock()
    clock(NOON, 10)
    expect(clock(NOON - HOUR, 10.016)).toBeCloseTo(NOON, -4)
    expect(clock(NOON - HOUR, 15)).toBe(NOON - HOUR)
  })

  it('carries on from where it had got to if the page is hidden again part way', () => {
    const clock = skyClock()
    clock(NOON, 10)
    clock(NOON + 10 * MINUTE, 10)
    const partWay = clock(NOON + 10 * MINUTE + 500, 10.5)
    expect(partWay).toBeGreaterThan(NOON)
    expect(partWay).toBeLessThan(NOON + 10 * MINUTE)
    const back = clock(NOON + 30 * MINUTE, 10.516)
    expect(Math.abs(back - partWay)).toBeLessThan(MINUTE)
  })
})

describe('placeOfZone', () => {
  it('knows the time zones of the largest cities', () => {
    expect(placeOfZone('Europe/London', 0)).toEqual({ latitude: 51.5, longitude: -0.1 })
    expect(placeOfZone('Asia/Tokyo', 540).longitude).toBeCloseTo(139.7)
  })

  it('takes one it does not know from its region and its time', () => {
    expect(placeOfZone('Europe/Vaduz', 60)).toEqual({ latitude: 50, longitude: 15 })
    expect(placeOfZone('America/Halifax', -240)).toEqual({ latitude: 38, longitude: -60 })
  })

  it('has something for any name at all', () => {
    expect(placeOfZone('UTC', 0)).toEqual({ latitude: 40, longitude: 0 })
  })
})

describe('localPlace', () => {
  it('finds a place on Earth', () => {
    const { latitude, longitude } = localPlace(new Date('2026-04-15T12:00:00Z'))
    expect(Math.abs(latitude)).toBeLessThanOrEqual(90)
    expect(Math.abs(longitude)).toBeLessThanOrEqual(180)
  })
})

describe('sunWay', () => {
  it('is a unit vector as high as the sun really is', () => {
    const date = new Date('2026-06-21T09:30:00Z')
    const way = sunWay(date, LONDON)
    expect(Math.hypot(...way)).toBeCloseTo(1, 5)
    expect(way[1]).toBeCloseTo(solarDay(date, LONDON).height, 5)
  })

  it('passes from left to right in front of the view through the day', () => {
    expect(sunWay(new Date('2026-03-20T08:00:00Z'), LONDON)[0]).toBeLessThan(0)
    const noon = sunWay(new Date('2026-03-20T12:05:00Z'), LONDON)
    expect(Math.abs(noon[0])).toBeLessThan(0.05)
    expect(noon[2]).toBeGreaterThan(0.5)
    expect(sunWay(new Date('2026-03-20T16:00:00Z'), LONDON)[0]).toBeGreaterThan(0)
  })

  it('passes from right to left south of the equator, where the view looks north', () => {
    // Noon in Sydney is about 02:00 UTC.
    expect(sunWay(new Date('2026-03-20T22:30:00Z'), SYDNEY)[0]).toBeGreaterThan(0)
    expect(sunWay(new Date('2026-03-20T02:00:00Z'), SYDNEY)[2]).toBeGreaterThan(0.5)
    expect(sunWay(new Date('2026-03-20T05:30:00Z'), SYDNEY)[0]).toBeLessThan(0)
  })
})

describe('skyAt through another lens', () => {
  const lens = { pitch: 0.04, halfFov: 0.2 }
  /** How high on the screen a way lies, as a share of the view's height from the middle. */
  const onScreen = ([, y, z]: Vec3, { pitch, halfFov }: typeof lens) =>
    Math.tan(Math.atan2(y, z) + pitch) / Math.tan(halfFov)
  const ocean = { pitch: HORIZON_PITCH, halfFov: HORIZON_HALF_FOV }

  it('puts the sun and moon as high on the screen as over the ocean, all day and all night', () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      const date = new Date(Date.UTC(2026, 2, 20, 0, hour * 60))
      const overOcean = skyAt(date, LONDON)
      const through = skyAt(date, LONDON, lens)
      expect(onScreen(through.sun, lens)).toBeCloseTo(onScreen(overOcean.sun, ocean), 6)
      expect(onScreen(through.moon, lens)).toBeCloseTo(onScreen(overOcean.moon, ocean), 6)
    }
  })

  it('draws the discs as big and as round on the screen through any lens as through the long one they are sized for', () => {
    /**
     * How far across and up the screen a disc at `way` spans, `size` times as wide and as
     * tall as sized, flattened by the air as onDisc has it.
     */
    const span = ([, y, z]: Vec3, [wide, tall]: [number, number], { pitch, halfFov }: typeof lens) => {
      const slant = Math.atan2(y, z) + pitch
      const flattened = 0.88 + 0.12 * Math.min(1, Math.max(0, y / 0.05))
      const across = 0.01 * wide
      const up = 0.01 * tall * flattened
      return [
        (2 * Math.tan(across)) / Math.cos(slant) / Math.tan(halfFov),
        (Math.tan(slant + up) - Math.tan(slant - up)) / Math.tan(halfFov),
      ]
    }
    for (let hour = 0; hour < 24; hour += 0.5) {
      const date = new Date(Date.UTC(2026, 2, 20, 0, hour * 60))
      const overOcean = skyAt(date, LONDON)
      const through = skyAt(date, LONDON, LONG_LENS)
      expect([through.sunSize, through.moonSize]).toEqual([
        [1, 1],
        [1, 1],
      ])
      for (const disc of ['sun', 'moon'] as const) {
        const seen = span(overOcean[disc], overOcean[`${disc}Size`], ocean)
        const sized = span(through[disc], [1, 1], LONG_LENS)
        expect(seen[0]).toBeCloseTo(sized[0], 4)
        expect(seen[1]).toBeCloseTo(sized[1], 4)
      }
    }
  })
})
