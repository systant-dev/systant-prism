// Where things in the sky lie, and how the sky has turned: the frames the stars and the
// galaxy are given in, the turn that takes them to the way they lie from the ground at
// a moment and a place, and which of them a view can ever take in. Nothing here touches
// a GPU, so all of it can be tested.
import { localSidereal, type Place, RADIANS } from '../daylight'
import { cross, dot, saturate, unit, type Vec3 } from '../maths'
import type { Patch } from './catalog'

/** Where the galaxy's north pole and centre are, as right ascension in hours and declination in degrees. */
const GALACTIC_POLE: [number, number] = [12.857, 27.13]
const GALACTIC_CENTRE: [number, number] = [17.761, -28.94]

/** The lowest a star can culminate and still reach the view, in radians. */
const LOWEST_CULMINATION = -0.05

/** The top of the tallest view there is, in radians above the horizon. */
const VIEW_TOP = 0.3

/** The view nearest a celestial pole whose slice of the stars is worked out, as the sine of the declination. */
const NEAR_POLE = Math.sin((70 * Math.PI) / 180)

/** How many times as many stars there are for each magnitude fainter, as the made-up ones are counted. */
export const STARS_PER_MAGNITUDE = 10 ** 0.5

/** The way to a point on a sphere from its longitude and latitude, in radians: +x at 0, 0, +z at the pole. */
function onSphere(longitude: number, latitude: number): Vec3 {
  return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)]
}

/** The way to a star, with +x at right ascension 0 and +z at the north celestial pole. */
export function equatorial(rightAscension: number, declination: number): Vec3 {
  return onSphere(rightAscension * 15 * RADIANS, declination * RADIANS)
}

/**
 * The axes of the galaxy's own coordinates, in equatorial ones: towards its centre,
 * along its plane, and to its pole. Worked out when asked, not when the module loads,
 * so that a page with no sky can leave all of this out of its bundle.
 */
export function galaxyAxes(): Vec3[] {
  const pole = equatorial(...GALACTIC_POLE)
  const towards = equatorial(...GALACTIC_CENTRE)
  const centre = unit(towards.map((v, i) => v - pole[i] * dot(towards, pole)))
  return [centre, cross(pole, centre), pole]
}

/** An equatorial way, in the galaxy's own coordinates. */
export function toGalactic(at: readonly number[], axes = galaxyAxes()): Vec3 {
  return [dot(at, axes[0]), dot(at, axes[1]), dot(at, axes[2])]
}

/** A galactic way from galactic longitude and latitude, in degrees. */
export function galactic(longitude: number, latitude: number): Vec3 {
  return onSphere(longitude * RADIANS, latitude * RADIANS)
}

/** The way east and the way north on a sphere, at a point on it. */
function compass(at: Vec3): [Vec3, Vec3] {
  const ring = Math.hypot(at[0], at[1])
  if (ring < 1e-9)
    return [
      [0, 1, 0],
      [-1, 0, 0],
    ]
  const east: Vec3 = [-at[1] / ring, at[0] / ring, 0]
  return [east, cross(at, east)]
}

/**
 * A patch, in the galaxy's own coordinates: the way to its middle, and the way its
 * length lies across the sky there. One given by right ascension and declination
 * tilts from north through east; one given by galactic longitude and latitude tilts
 * from the way of growing longitude towards growing latitude.
 */
export function placePatch({ at, tilt }: Patch, equatorialAt: boolean, axes = galaxyAxes()): [Vec3, Vec3] {
  const angle = tilt * RADIANS
  if (equatorialAt) {
    const middle = equatorial(at[0], at[1])
    const [east, north] = compass(middle)
    const length = north.map((v, i) => v * Math.cos(angle) + east[i] * Math.sin(angle))
    return [toGalactic(middle, axes), toGalactic(length, axes)]
  }
  const middle = galactic(at[0], at[1])
  const [east, north] = compass(middle)
  return [middle, unit(east.map((v, i) => v * Math.cos(angle) + north[i] * Math.sin(angle)))]
}

/**
 * Whether a star can ever be in the view from a latitude, whichever side of the sky
 * the view faces (facing.ts): low enough at the bottom of its daily circle to pass
 * under the top of the view, and high enough at the top of it to clear the horizon.
 */
export function crossesView(sinDeclination: number, latitude: number) {
  const declination = Math.asin(sinDeclination) * Math.sign(latitude || 1)
  const north = Math.abs(latitude) * RADIANS
  const highest = Math.PI / 2 - Math.abs(north - declination)
  const lowest = declination + north - Math.PI / 2
  return highest >= LOWEST_CULMINATION && lowest <= VIEW_TOP
}

/**
 * The sines of the lowest and highest declinations that crossesView keeps from a
 * latitude: the stars of a band, as the bottom and top of a star's circle go with
 * its declination.
 */
export function viewBand(latitude: number): [number, number] {
  const north = Math.abs(latitude) * RADIANS
  const clamp = (declination: number) => Math.sin(Math.min(Math.PI / 2, Math.max(-Math.PI / 2, declination)))
  const low = north - Math.PI / 2 + LOWEST_CULMINATION
  const high = Math.min(north + Math.PI / 2 - LOWEST_CULMINATION, Math.PI / 2 + VIEW_TOP - north)
  // South of the equator, the same band turned over.
  return latitude >= 0 ? [clamp(low), clamp(high)] : [clamp(-high), clamp(-low)]
}

/** The way from the ground `across` radians to the right of the way the view faces, and `up` above the horizon. */
export function groundWay(across: number, up: number): Vec3 {
  return [Math.sin(across) * Math.cos(up), Math.sin(up), Math.cos(across) * Math.cos(up)]
}

/** A way from the ground, as x to the right of the way the view faces, y up and z ahead, as an equatorial one. */
export function fromGround(rows: ArrayLike<number>, ground: readonly number[]): Vec3 {
  return [0, 1, 2].map((j) => rows[j] * ground[0] + rows[4 + j] * ground[1] + rows[8 + j] * ground[2]) as Vec3
}

/**
 * The right ascensions a view can see, from the sky's turn (heavensAt), for a view
 * reaching `side` radians either way and up to `top`: the middle of them and how far
 * either side of it, in radians. Worked out from points around the view, with room
 * between them to spare; a view near a pole has every right ascension in it.
 */
export function viewSlice(rows: ArrayLike<number>, side: number, top = VIEW_TOP): [number, number] {
  const ascensions: number[] = []
  for (let a = 0; a <= 16; a++) {
    const across = -side + (2 * side * a) / 16
    for (let e = 0; e <= 6; e++) {
      const up = LOWEST_CULMINATION + ((top - LOWEST_CULMINATION) * e) / 6
      const way = fromGround(rows, groundWay(across, up))
      if (Math.abs(way[2]) > NEAR_POLE) return [0, Math.PI]
      const ascension = Math.atan2(way[1], way[0])
      ascensions.push(ascension < 0 ? ascension + 2 * Math.PI : ascension)
    }
  }
  ascensions.sort((a, b) => a - b)
  // The slice is all but the widest gap between them.
  let gap = ascensions[0] + 2 * Math.PI - ascensions[ascensions.length - 1]
  let after = ascensions[0]
  for (let i = 1; i < ascensions.length; i++) {
    if (ascensions[i] - ascensions[i - 1] > gap) {
      gap = ascensions[i] - ascensions[i - 1]
      after = ascensions[i]
    }
  }
  const width = 2 * Math.PI - gap
  return [after + width / 2, width / 2 + 0.08]
}

/** The first of a sorted run of `values` not below `value`. */
function lowerBound(values: Float64Array, value: number) {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (values[middle] < value) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Which stars lie within `reach` of the middle of the sky at this sidereal angle:
 * the first of them and how many, once, or twice if they run past 2π and on from 0.
 */
export function starsInReach(ascensions: Float64Array, sidereal: number, reach: number): [number, number][] {
  const turn = 2 * Math.PI
  if (reach >= Math.PI) return [[0, ascensions.length]]
  const from = (((sidereal - reach) % turn) + turn) % turn
  const to = (((sidereal + reach) % turn) + turn) % turn
  const first = lowerBound(ascensions, from)
  const last = lowerBound(ascensions, to)
  if (from <= to) return [[first, last - first]]
  return [
    [first, ascensions.length - first],
    [0, last],
  ]
}

/** How far the stars have come out, 0–1, as the sine of the real sun's height falls. */
export function starsOut(sunHeight: number) {
  const out = saturate((-sunHeight - 0.07) / (0.27 - 0.07))
  return out * out * (3 - 2 * out)
}

/**
 * How far the Milky Way and the glows beyond it have come out, 0–1, from how far the
 * stars have: they need a far darker sky than the brightest stars, so they come out
 * late in twilight, after nearly all of the stars, and go first at dawn.
 */
export function milkyWayOut(out: number) {
  const late = saturate((out - MILKY_WAY_FROM) / (1 - MILKY_WAY_FROM))
  return late * late
}

/** How far out the stars are when the Milky Way starts to show. */
const MILKY_WAY_FROM = 0.55

/**
 * The turn of the sky at a moment, at a place, and the same for the galaxy's own
 * axes, each as rows that take a way to a star to the way it lies from the ground,
 * as seen by a view that faces `facing` radians to the right (westwards, north of
 * the equator) of the way to the equator.
 */
export function heavensAt(date: Date, { latitude, longitude }: Place, facing = 0): number[] {
  const sidereal = localSidereal(date, longitude)
  const north = latitude * RADIANS
  const hemisphere = latitude >= 0 ? 1 : -1
  const across = [Math.cos(sidereal), Math.sin(sidereal), 0]
  const past = [Math.sin(sidereal), -Math.cos(sidereal), 0]
  const pole = [0, 0, 1]
  const right = past.map((v) => v * hemisphere)
  const ahead = pole.map((v, i) => -hemisphere * (Math.cos(north) * v - Math.sin(north) * across[i]))
  const rows = [
    right.map((v, i) => Math.cos(facing) * v - Math.sin(facing) * ahead[i]),
    pole.map((v, i) => Math.sin(north) * v + Math.cos(north) * across[i]),
    ahead.map((v, i) => Math.cos(facing) * v + Math.sin(facing) * right[i]),
  ]
  const turn = rows.flatMap((row) => [...row, 0])
  const galaxy = galaxyAxes().flatMap((axis) => [...rows.map((row) => dot(row, axis)), 0])
  return [...turn, ...galaxy]
}
