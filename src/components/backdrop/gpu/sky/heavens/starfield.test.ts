import { describe, expect, it } from 'vitest'
// oxlint-disable-next-line no-restricted-imports -- a test of the sky against each scene's own camera
import { forestCamera } from '../../forest/camera'
// oxlint-disable-next-line no-restricted-imports -- as above
import { oceanCamera } from '../../ocean/camera'
import type { Camera } from '../dome'
import { LONG_LENS, skyAt } from '../daylight'
import { skyCamera } from './starfield'

/** Where a camera puts a way on the screen, in clip space. */
function onScreen({ right, up, forward, halfWidth, halfHeight }: Camera, d: readonly number[]) {
  const along = (axis: readonly number[]) => axis[0] * d[0] + axis[1] * d[1] + axis[2] * d[2]
  const depth = along(forward)
  return [along(right) / depth / halfWidth, along(up) / depth / halfHeight]
}

const WAYS = [
  [0, 0.05, 1],
  [0.3, 0.2, 1],
  [-0.5, 0.01, 1],
  [0.8, 0.25, 1],
].map(([x, y, z]) => {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
})

describe('skyCamera', () => {
  it('is the scene camera over the ocean', () => {
    const camera = oceanCamera(16 / 9)
    expect(skyCamera(camera)).toBe(camera)
  })

  it.each([4 / 3, 16 / 9, 21 / 9])('puts every star where the ocean puts it, at %f', (aspect) => {
    const sky = skyCamera(forestCamera(aspect), LONG_LENS)
    const ocean = oceanCamera(aspect)
    for (const d of WAYS) {
      const [x, y] = onScreen(sky, d)
      const [oceanX, oceanY] = onScreen(ocean, d)
      expect(x).toBeCloseTo(oceanX, 6)
      expect(y).toBeCloseTo(oceanY, 6)
    }
  })

  it.each([16 / 9, 4])('keeps the moon where it is among the stars, at %f', (aspect) => {
    const place = { latitude: 51.5, longitude: -0.1 }
    const date = new Date('2026-11-05T23:00:00Z')
    const forest = forestCamera(aspect)
    const [x, y] = onScreen(forest, skyAt(date, place, LONG_LENS).moon)
    const [skyX, skyY] = onScreen(skyCamera(forest, LONG_LENS), skyAt(date, place).moon)
    expect(skyX).toBeCloseTo(x, 6)
    expect(skyY).toBeCloseTo(y, 6)
  })
})
