// Which tiles of the ocean's surface to draw. It is a CDLOD quadtree (Strugar's
// continuous distance-dependent level of detail): one small grid of vertices,
// drawn once per tile, each tile twice the size of the one nearer in.
//
// A tile divides into four while it lies within reach of the level below. What
// that leaves can't be gapless on its own, as a tile's edge can meet a tile with
// twice the vertices. So every vertex morphs: as it nears the far end of its
// level's reach, each odd vertex slides onto its even neighbour, until the
// tile's grid is the next level's and the seam is gone.
//
// That needs a level to have finished morphing before the next begins (see
// MORPH_START), and tiles never to differ by more than one level, which the
// tests hold it to. Distances are in the plane of the ocean, from the origin, as
// the ocean has no use for the height of the camera.

import { saturate } from '../sky'

/** How many levels of detail there are. */
export const LEVELS = 17

/** The distance between vertices in the finest level, in metres. */
const FINEST_SPACING = 0.0625

/** How many quads each side of a tile has; even, so that a morph ends on the next level's grid. */
export const TILE_QUADS = 16

/** How far a level reaches from the origin, in its own vertex spacings. */
export const REACH_SPACINGS = 64

/** How many of the coarsest tiles the ocean is across: 5 × 65.536 km, or 163.84 km each way from the origin. */
export const ROOT_TILES = 5

/** Where in its reach a level starts to morph into the next, 0–1. */
export const MORPH_START = 0.5 + (Math.SQRT2 * TILE_QUADS) / REACH_SPACINGS

/** What a tile of a level has between its vertices, in metres. */
export function levelSpacing(level: number) {
  return FINEST_SPACING * 2 ** level
}

/** How far from the origin a level reaches, in metres. */
export function levelReach(level: number) {
  return REACH_SPACINGS * levelSpacing(level)
}

/** How far through its morph, 0–1, a vertex `distance` from the origin is in a tile of a level. */
export function morphAmount(distance: number, level: number) {
  const reach = levelReach(level)
  return saturate((distance - MORPH_START * reach) / ((1 - MORPH_START) * reach))
}

export interface Tile {
  /** Its corner nearest −x, −z, in metres. */
  x: number
  z: number
  level: number
}

/** A box in the plane of the ocean, in metres, that the waves may stray beyond a little. */
export interface Footprint {
  left: number
  back: number
  right: number
  front: number
}

/** The distance from the origin to the nearest point of a square. */
function distanceTo(x: number, z: number, size: number) {
  const dx = Math.max(x, -(x + size), 0)
  const dz = Math.max(z, -(z + size), 0)
  return Math.hypot(dx, dz)
}

/**
 * The tiles to draw, nearest first, as a depth test then has most of what
 * it would have drawn twice over behind what is already there. A tile `inView`
 * says is out of sight is left out, with all it divides into.
 */
export function selectTiles(inView: (footprint: Footprint) => boolean = () => true): Tile[] {
  const tiles: Tile[] = []
  function visit(x: number, z: number, level: number) {
    const size = TILE_QUADS * levelSpacing(level)
    if (!inView({ left: x, back: z, right: x + size, front: z + size })) return
    if (level === 0 || distanceTo(x, z, size) >= levelReach(level - 1)) {
      tiles.push({ x, z, level })
      return
    }
    const half = size / 2
    for (const [dx, dz] of [
      [0, 0],
      [half, 0],
      [0, half],
      [half, half],
    ])
      visit(x + dx, z + dz, level - 1)
  }
  const root = TILE_QUADS * levelSpacing(LEVELS - 1)
  const start = (-ROOT_TILES / 2) * root
  for (let i = 0; i < ROOT_TILES; i++)
    for (let j = 0; j < ROOT_TILES; j++) visit(start + i * root, start + j * root, LEVELS - 1)
  const nearness = ({ x, z, level }: Tile) => distanceTo(x, z, TILE_QUADS * levelSpacing(level))
  return tiles.sort((a, b) => nearness(a) - nearness(b))
}

/** How many values tileInstances gives per tile. */
export const TILE_STRIDE = 3

/** The tiles as instance data: x, z and vertex spacing. */
export function tileInstances(tiles: Tile[]): Float32Array<ArrayBuffer> {
  const out = new Float32Array(tiles.length * TILE_STRIDE)
  tiles.forEach(({ x, z, level }, i) => out.set([x, z, levelSpacing(level)], i * TILE_STRIDE))
  return out
}

/** The triangles of one tile: a vertex's index is `z * (TILE_QUADS + 1) + x`. */
export function tileIndices(): Uint16Array<ArrayBuffer> {
  const side = TILE_QUADS + 1
  const out = new Uint16Array(TILE_QUADS * TILE_QUADS * 6)
  let at = 0
  for (let z = 0; z < TILE_QUADS; z++) {
    for (let x = 0; x < TILE_QUADS; x++) {
      const corner = z * side + x
      out.set([corner, corner + side, corner + 1, corner + 1, corner + side, corner + side + 1], at)
      at += 6
    }
  }
  return out
}
