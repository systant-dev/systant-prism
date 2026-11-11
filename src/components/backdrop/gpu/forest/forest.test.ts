import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../sky'
import { EYE_HEIGHT, forestCamera, WIDEST_ASPECT } from './camera'
import { lampWay } from './forest'
import { firstShapeSource, tipBendSource } from './beam'
import { forestSource, lightSource, shadowSource, viewSource, windSource } from './forestShaders'
import { mipSource, sunWay } from '../sky'
import { hollowSource, leafSource, openSource, PANORAMA_HEIGHT, PANORAMA_WIDTH, viewShare } from './panorama'

const LONDON = { latitude: 51.5, longitude: -0.1 }
const AHEAD: Vec3 = [0, 0.03, 0.9995]

describe('forestCamera', () => {
  it('looks a little down, along unit axes at right angles', () => {
    const { eye, right, up, forward } = forestCamera(16 / 9)
    expect(eye[1]).toBe(EYE_HEIGHT)
    expect(forward[1]).toBeLessThan(0)
    expect(Math.hypot(...up)).toBeCloseTo(1)
    expect(Math.hypot(...forward)).toBeCloseTo(1)
    expect(up[0] * forward[0] + up[1] * forward[1] + up[2] * forward[2]).toBeCloseTo(0)
    expect(right).toEqual([1, 0, 0])
  })

  it('shows more forest for a wider view, at the same height', () => {
    const wide = forestCamera(2)
    const narrow = forestCamera(1)
    expect(wide.halfWidth).toBeCloseTo(narrow.halfWidth * 2)
    expect(wide.halfHeight).toBeCloseTo(narrow.halfHeight)
  })

  it('crops the top and bottom of a view wider than the forest', () => {
    const widest = forestCamera(WIDEST_ASPECT)
    const wider = forestCamera(WIDEST_ASPECT * 2)
    expect(wider.halfWidth).toBeCloseTo(widest.halfWidth)
    expect(wider.halfHeight).toBeCloseTo(widest.halfHeight / 2)
  })
})

describe('lampWay', () => {
  const summerNoon = new Date('2026-06-21T12:02:00Z')
  const lowMorning = new Date('2026-06-21T04:10:00Z')

  it('is a unit vector', () => {
    const way = lampWay(summerNoon, LONDON, AHEAD, 0.8)
    expect(Math.hypot(...way)).toBeCloseTo(1, 5)
  })

  it('comes from where the disc is drawn while the sun is low', () => {
    const way = lampWay(lowMorning, LONDON, AHEAD, 0.005)
    expect(way[0]).toBeCloseTo(AHEAD[0], 1)
    expect(way[2]).toBeCloseTo(AHEAD[2], 1)
  })

  it('lights the forest from higher than the sun really is, once it has climbed', () => {
    const way = lampWay(summerNoon, LONDON, AHEAD, 0.8)
    expect(way[1]).toBeGreaterThan(0.85)
  })

  it('swings round to where the sun really is as it climbs', () => {
    const bearing = ([x, , z]: Vec3) => Math.atan2(x, z)
    // Morning and afternoon, when the real sun is well off to one side of the view.
    for (const time of ['2026-06-21T09:00:00Z', '2026-06-21T16:00:00Z']) {
      const date = new Date(time)
      const real = bearing(sunWay(date, LONDON))
      const turned = [0.005, 0.1, 0.2].map((height) => bearing(lampWay(date, LONDON, AHEAD, height)))
      expect(Math.abs(turned[0])).toBeLessThan(0.05)
      expect(Math.abs(turned[1])).toBeGreaterThan(Math.abs(turned[0]))
      expect(Math.abs(turned[2])).toBeGreaterThan(Math.abs(turned[1]))
      expect(bearing(lampWay(date, LONDON, AHEAD, 0.9))).toBeCloseTo(real, 5)
    }
  })

  it('comes from where the full moon really is, high at midnight in winter', () => {
    const way = lampWay(new Date('2026-12-21T00:00:00Z'), LONDON, AHEAD, -0.9)
    expect(way[1]).toBeGreaterThan(0.85)
    expect(Math.abs(way[0])).toBeLessThan(0.1)
  })

  it('crosses the sky through the night, as the moon does', () => {
    const evening = lampWay(new Date('2026-12-20T20:00:00Z'), LONDON, AHEAD, -0.5)
    const morning = lampWay(new Date('2026-12-21T04:00:00Z'), LONDON, AHEAD, -0.5)
    expect(evening[0]).toBeLessThan(-0.2)
    expect(morning[0]).toBeGreaterThan(0.2)
  })

  it('never comes from so low that the hill would shade everything', () => {
    const way = lampWay(new Date('2026-06-21T00:00:00Z'), LONDON, AHEAD, -0.2)
    expect(way[1]).toBeGreaterThan(0.4)
  })
})

describe('viewShare', () => {
  it('shows the whole panorama in the widest view', () => {
    const [across, down] = viewShare(WIDEST_ASPECT)
    expect(across).toBeCloseTo(1)
    expect(down).toBeCloseTo(1)
  })

  it('shows less of its width in a narrower view, and all of its height', () => {
    const [across, down] = viewShare(WIDEST_ASPECT / 2)
    expect(across).toBeCloseTo(0.5)
    expect(down).toBeCloseTo(1)
  })

  it('crops its top and bottom for a view wider than it is', () => {
    const [across, down] = viewShare(WIDEST_ASPECT * 2)
    expect(across).toBeCloseTo(1)
    expect(down).toBeCloseTo(0.5)
  })

  it('is as wide as the widest view, at the height of the largest scene', () => {
    expect(PANORAMA_HEIGHT).toBe(1440)
    expect(PANORAMA_WIDTH / PANORAMA_HEIGHT).toBeCloseTo(WIDEST_ASPECT, 2)
  })
})

describe('the shaders', () => {
  // WGSL keeps these for itself, and one of them as a name loses the whole shader, which
  // only a GPU would say. The commonest of them to reach for as the name of something.
  const RESERVED = ['shared', 'final', 'filter', 'self', 'this', 'move', 'match', 'mod']
  const sources = {
    firstShapeSource,
    tipBendSource,
    forestSource,
    lightSource,
    shadowSource: shadowSource(1, 1),
    windSource,
    viewSource,
    leafSource,
    hollowSource,
    mipSource,
    openSource: openSource(
      1,
      1,
      [0, 0, 0],
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    ),
  }

  it.each(Object.entries(sources))('keeps clear of reserved words in %s', (_, source) => {
    const declared = [...source.matchAll(/\b(?:let|var|const|fn)\s+([A-Za-z_]\w*)/g)].map((name) => name[1])
    expect(declared.filter((name) => RESERVED.includes(name))).toEqual([])
  })
})
