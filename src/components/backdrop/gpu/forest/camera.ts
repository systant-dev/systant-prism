// The view of the forest: a long lens on a hill, looking across the valley at the
// wooded slope opposite, as you would from a viewpoint. X runs to the right, Y up and
// Z away, with the eye over the origin.
//
// It stays put, which is what the whole scene is built on. Everything that can be
// seen from here is drawn once, in a panorama as wide as the widest view (panorama.ts),
// and a view of any shape shows part of it.
import { type Camera, type Lens, LONG_LENS } from '../sky'

/** How far above the valley floor the camera is, in metres. */
export const EYE_HEIGHT = 60

/**
 * How the view lies: the sky's long lens, looking as far down as puts the tree line as
 * high on the screen as the ocean's horizon, for the sun to set behind it there. The
 * sky puts the sun and moon as high on the screen through it as over the ocean, and
 * draws their discs for it.
 */
export const FOREST_LENS: Lens = LONG_LENS

/** How far the camera looks down, and the view's height as an angle from the middle to the top, in radians. */
const { pitch: PITCH, halfFov: HALF_FOV } = FOREST_LENS

/** The nearest depth drawn, in metres. */
const NEAR = 1

/** The widest view that shows more forest: past this the top and bottom are cropped instead. */
export const WIDEST_ASPECT = 3.2

/** The camera for a view `aspect` times as wide as it is high. */
export function forestCamera(aspect: number): Camera {
  const tall = Math.tan(HALF_FOV)
  const halfWidth = tall * Math.min(aspect, WIDEST_ASPECT)
  return {
    eye: [0, EYE_HEIGHT, 0],
    right: [1, 0, 0],
    up: [0, Math.cos(PITCH), Math.sin(PITCH)],
    forward: [0, -Math.sin(PITCH), Math.cos(PITCH)],
    halfWidth,
    halfHeight: halfWidth / aspect,
    near: NEAR,
  }
}

/**
 * How far down the panorama nothing can be seen but sky, 0–1: the highest the tops of
 * the trees come, and a little for them to move in.
 */
export const SKY_ONLY = 0.5 - Math.tan(PITCH + 0.03) / Math.tan(HALF_FOV) / 2

/** The camera the whole panorama is drawn with. */
export const panoramaCamera = () => forestCamera(WIDEST_ASPECT)
