// The Milky Way's light and dust, from the catalogue, as both the GPU bakes it and the
// stars are scattered by it: the same lobes, clouds and lanes for each, so that the
// faint stars crowd into the star clouds and thin out in the Great Rift, as they do.
import { BULGE, DARK_CLOUDS, DEEP_SKY, type DeepSky, DISK_LOBES, type Patch, STAR_CLOUDS } from './catalog'
import { RADIANS } from '../daylight'
import { cross, type Vec3 } from '../maths'
import { galaxyAxes, placePatch } from './celestial'

/** A patch put in the galaxy's own coordinates, ready to measure a way against. */
export interface Placed {
  middle: Vec3
  length: Vec3
  patch: Patch
}

/** The patches of a list, placed: those given by right ascension and declination, or by galactic coordinates. */
export function placeAll(patches: Patch[], equatorialAt: boolean): Placed[] {
  const axes = galaxyAxes()
  return patches.map((patch) => {
    const [middle, length] = placePatch(patch, equatorialAt, axes)
    return { middle, length, patch }
  })
}

/** Galactic longitude, −π to π, and latitude of a galactic way, in radians. */
function lonLat(way: readonly number[]): [number, number] {
  return [Math.atan2(way[1], way[0]), Math.asin(Math.max(-1, Math.min(1, way[2])))]
}

/** How strong a lobe of the band is at a galactic longitude and latitude, in radians, 0–1. */
export function lobeAt(longitude: number, latitude: number, { at, long, wide }: Patch) {
  let across = longitude - at[0] * RADIANS
  across -= 2 * Math.PI * Math.round(across / (2 * Math.PI))
  const along = across / (long * RADIANS)
  const up = (latitude - at[1] * RADIANS) / (wide * RADIANS)
  return Math.exp(-0.5 * (along * along + up * up))
}

/**
 * Light and dust of the Milky Way at a galactic way, before the noise that breaks
 * them up: the band and its bulge, the star clouds on it, and how much of what
 * lies behind the dust gets through it, 0–1.
 */
export function milkyWayModel() {
  const lobes = [...DISK_LOBES, BULGE]
  const clouds = measures(placeAll(STAR_CLOUDS, false))
  const dust = measures(placeAll(DARK_CLOUDS, false))
  return {
    band(way: readonly number[]) {
      const [longitude, latitude] = lonLat(way)
      let light = 0
      for (const lobe of lobes) light += lobe.strength * lobeAt(longitude, latitude, lobe)
      return light
    },
    clouds(way: readonly number[]) {
      let light = 0
      for (const { measure } of clouds) light += measure(way)
      return light
    },
    through(way: readonly number[]) {
      let left = 1
      for (const { measure } of dust) left *= 1 - measure(way)
      return left
    },
    /** Each star cloud and dark cloud, to be measured only as far as it reaches. */
    cloudPatches: clouds,
    dustPatches: dust,
  }
}

/**
 * Each placed patch as a function of a way, giving its strength there, with what it
 * needs worked out once: it is asked tens of thousands of times as a sky is made.
 * Further than five spreads from its middle, it is nothing.
 */
function measures(placed: Placed[]): Measured[] {
  return placed.map(({ middle, length, patch }) => {
    const side = cross(middle, length)
    const overLong = 1 / (patch.long * RADIANS)
    const overWide = 1 / (patch.wide * RADIANS)
    const reach = 5 * Math.max(patch.long, patch.wide)
    const near = Math.cos(Math.min(Math.PI / 2, reach * RADIANS))
    const measure = (way: readonly number[]) => {
      if (way[0] * middle[0] + way[1] * middle[1] + way[2] * middle[2] <= near) return 0
      const along = (way[0] * length[0] + way[1] * length[1] + way[2] * length[2]) * overLong
      const across = (way[0] * side[0] + way[1] * side[1] + way[2] * side[2]) * overWide
      return patch.strength * Math.exp(-0.5 * (along * along + across * across))
    }
    return { patch, reach, measure }
  })
}

/** A patch's strength at a way, and how far it reaches from its middle, in degrees. */
export interface Measured {
  patch: Patch
  reach: number
  measure(way: readonly number[]): number
}

/** The deep-sky glows, placed. */
export const placeDeepSky = (): (Placed & { patch: DeepSky })[] =>
  placeAll(DEEP_SKY, true) as (Placed & { patch: DeepSky })[]
