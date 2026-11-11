import { describe, expect, it } from 'vitest'
import { CLOUD_TILES, CLOUD_TURN, REGION_TILES, REGION_TURN, WARP_TILES } from './cloudShaders'
import { bandRows, BANDS, type CloudClock, cloudsAt, rowsAboveHorizon, sharedClock, SPEED, tick } from './clouds'
import { HEAVENS, HEAVENS_SIZE } from './heavens/heavensShaders'

const moving = { delta: 0.5, still: false }

describe('tick', () => {
  it('moves the clock on by the frames of one scene, however many share it', () => {
    const [first, second] = [{}, {}]
    const clock: CloudClock = { owner: null, seconds: 10 }
    tick(clock, first, moving)
    // On a display faster than the scenes, their frames may come apart.
    tick(clock, second, { ...moving, delta: 2 })
    expect(clock.seconds).toBe(10.5)
    tick(clock, first, { ...moving, delta: 0.25 })
    expect(clock.seconds).toBe(10.75)
  })

  it('stands still with a scene held still, and lets another move it on', () => {
    const [first, second] = [{}, {}]
    const clock: CloudClock = { owner: null, seconds: 3 }
    tick(clock, first, moving)
    tick(clock, first, { delta: 1, still: true })
    expect(clock.seconds).toBe(3.5)
    tick(clock, second, moving)
    expect(clock.seconds).toBe(4)
  })
})

describe('sharedClock', () => {
  it('is one clock for all the clouds on a device, begun by whichever asks first', () => {
    const device = {} as GPUDevice
    const clock = sharedClock(device, 5000)
    expect(clock).toEqual({ owner: null, seconds: 5 })
    // Two scenes made before either was lit both find it, and so stay in step.
    expect(sharedClock(device, 9000)).toBe(clock)
    expect(sharedClock({} as GPUDevice, 9000)).toEqual({ owner: null, seconds: 9 })
  })
})

describe('bandRows', () => {
  it('lights every row once over the bands, each from an even row', () => {
    for (const rows of [0, 1, 7, 120, 133, 360]) {
      let next = 0
      for (let band = 0; band < BANDS; band++) {
        const [top, bottom] = bandRows(rows, band)
        expect(top).toBe(next)
        expect(top % 2 === 0 || top === rows).toBe(true)
        expect(bottom).toBeGreaterThanOrEqual(top)
        next = bottom
      }
      expect(next).toBe(rows)
    }
  })
})

describe('rowsAboveHorizon', () => {
  const lens = (pitch: number, halfHeight: number) => {
    const data = new Float32Array(HEAVENS_SIZE)
    data.set([1, 0, 0, 1], HEAVENS.lens)
    data.set([0, Math.cos(pitch), Math.sin(pitch), 1 / halfHeight], HEAVENS.lens + 4)
    data.set([0, -Math.sin(pitch), Math.cos(pitch), 0], HEAVENS.lens + 8)
    return data
  }

  it('finds the horizon above the middle of a view that looks down', () => {
    // Looking down by as much as half the view is high puts the horizon at the top.
    const halfHeight = Math.tan(0.36)
    const rows = rowsAboveHorizon(lens(0.1, halfHeight), 360)
    const horizon = (1 - Math.tan(0.1) / halfHeight) / 2
    expect(rows).toBe(Math.ceil(horizon * 360) + 2)
    expect(rowsAboveHorizon(lens(Math.atan(halfHeight), halfHeight), 360)).toBe(2)
  })

  it('keeps every row where the sky is all of the view', () => {
    expect(rowsAboveHorizon(lens(-0.5, Math.tan(0.36)), 360)).toBe(360)
  })
})

describe('cloudsAt', () => {
  it('keeps everything within a tile of the noise, however long it has run', () => {
    for (const seconds of [0, 1, 1e4, 1.8e9]) {
      for (const tiles of cloudsAt(seconds)) {
        expect(tiles).toBeGreaterThanOrEqual(0)
        expect(tiles).toBeLessThan(1)
      }
    }
  })

  it('drifts the noise left, which carries the clouds right', () => {
    const [drift, regions, bends] = cloudsAt(0)
    const [driftLater, regionsLater, bendsLater] = cloudsAt(1)
    expect((drift - driftLater + 1) % 1).toBeCloseTo((SPEED * CLOUD_TILES) / CLOUD_TURN)
    expect((regions - regionsLater + 1) % 1).toBeCloseTo((SPEED * CLOUD_TILES * REGION_TILES) / REGION_TURN)
    expect((bends - bendsLater + 1) % 1).toBeCloseTo((SPEED * CLOUD_TILES * WARP_TILES) / REGION_TURN)
  })
})

describe('HEAVENS', () => {
  it('has the clouds’ fields after the rest, all within the uniforms', () => {
    expect(HEAVENS.clouds).toBe(HEAVENS.moon + 4)
    expect(HEAVENS.cloudSteps).toBe(HEAVENS.clouds + 4)
    expect(HEAVENS.sun).toBe(HEAVENS.cloudSteps + 4)
    expect(HEAVENS.sun + 4).toBe(HEAVENS_SIZE)
  })
})
