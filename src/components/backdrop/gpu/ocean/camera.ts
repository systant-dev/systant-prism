// The view of the ocean: a camera that stays put, looking a little down at it, and
// what that means for which tiles can be seen. X runs to the right, Y up and Z
// out over the ocean.
//
// The surface's finest vertices belong in the front of the image, not under the
// camera, where nothing can see them. So the origin, which they gather around,
// is where the bottom of the view meets the water, and the camera stands back
// from it.
import { type Camera, HORIZON_HALF_FOV as HALF_FOV, HORIZON_PITCH as PITCH, type Vec3 } from '../sky'
import type { Footprint } from './cdlod'

/** How far above the ocean the camera is, in metres. */
const EYE_HEIGHT = 8

/** The nearest depth drawn, in metres. */
export const NEAR = 0.25

/** How far a wave may lift or shift the surface from the tile it belongs to, in metres. */
const WAVE_MARGIN = 10

/** `a * scaleA + b * scaleB` */
function mix(a: Vec3, scaleA: number, b: Vec3, scaleB: number): Vec3 {
  return [a[0] * scaleA + b[0] * scaleB, a[1] * scaleA + b[1] * scaleB, a[2] * scaleA + b[2] * scaleB]
}

/** The camera for a view `aspect` times as wide as it is high. */
export function oceanCamera(aspect: number): Camera {
  const forward: Vec3 = [0, -Math.sin(PITCH), Math.cos(PITCH)]
  const up: Vec3 = [0, Math.cos(PITCH), Math.sin(PITCH)]
  const halfHeight = Math.tan(HALF_FOV)
  return {
    eye: [0, EYE_HEIGHT, -EYE_HEIGHT / Math.tan(PITCH + HALF_FOV)],
    right: [1, 0, 0],
    up,
    forward,
    halfWidth: halfHeight * aspect,
    halfHeight,
    near: NEAR,
  }
}

/** Whether a footprint of the ocean, waves and all, may be in view. */
export function footprintInView({ eye, right, up, forward, halfWidth, halfHeight }: Camera) {
  // Each points into the view from one of its four sides, all of them through the eye.
  const sides = [
    mix(right, 1, forward, halfWidth),
    mix(right, -1, forward, halfWidth),
    mix(up, 1, forward, halfHeight),
    mix(up, -1, forward, halfHeight),
  ]
  return ({ left, back, right: farRight, front }: Footprint) =>
    sides.every(([x, y, z]) => {
      // The corner of the box furthest into the view from this side.
      const corner: Vec3 = [
        x > 0 ? farRight + WAVE_MARGIN : left - WAVE_MARGIN,
        y > 0 ? WAVE_MARGIN : -WAVE_MARGIN,
        z > 0 ? front + WAVE_MARGIN : back - WAVE_MARGIN,
      ]
      return (corner[0] - eye[0]) * x + (corner[1] - eye[1]) * y + (corner[2] - eye[2]) * z >= 0
    })
}
