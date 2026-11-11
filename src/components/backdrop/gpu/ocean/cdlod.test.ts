import { describe, expect, it } from 'vitest'
import { footprintInView, oceanCamera } from './camera'
import {
  levelReach,
  LEVELS,
  levelSpacing,
  MORPH_START,
  morphAmount,
  REACH_SPACINGS,
  ROOT_TILES,
  selectTiles,
  TILE_QUADS,
  TILE_STRIDE,
  tileIndices,
  tileInstances,
  type Tile,
} from './cdlod'

const size = ({ level }: Tile) => TILE_QUADS * levelSpacing(level)

/** Whether two tiles share any of an edge. */
function neighbours(a: Tile, b: Tile) {
  const touchX = a.x + size(a) === b.x || b.x + size(b) === a.x
  const touchZ = a.z + size(a) === b.z || b.z + size(b) === a.z
  const overlapX = a.x < b.x + size(b) && b.x < a.x + size(a)
  const overlapZ = a.z < b.z + size(b) && b.z < a.z + size(a)
  return (touchX && overlapZ) || (touchZ && overlapX)
}

describe('the mesh', () => {
  it('has 17 levels, from 6.25 cm between vertices', () => {
    expect(LEVELS).toBe(17)
    expect(levelSpacing(0)).toBe(0.0625)
    expect(levelSpacing(16)).toBe(4096)
  })

  it('reaches 160 km', () => {
    const reach = (ROOT_TILES * TILE_QUADS * levelSpacing(LEVELS - 1)) / 2
    expect(reach).toBeCloseTo(163_840, 0)
  })

  it('has an even number of quads to a tile, so that a morph ends on the next level', () => {
    expect(TILE_QUADS % 2).toBe(0)
  })

  it('uses its finest vertices at the origin', () => {
    expect(selectTiles()[0].level).toBe(0)
  })

  it('covers the whole ocean, with no tile over another', () => {
    const tiles = selectTiles()
    const area = tiles.reduce((sum, tile) => sum + size(tile) ** 2, 0)
    expect(area).toBeCloseTo((ROOT_TILES * TILE_QUADS * levelSpacing(LEVELS - 1)) ** 2, 0)
  })

  it('stays small enough to draw in a call', () => {
    expect(selectTiles().length).toBeLessThan(2000)
  })

  it('goes out from fine to coarse', () => {
    const tiles = selectTiles()
    expect(tiles.at(-1)!.level).toBeGreaterThan(14)
  })
})

describe('morphing', () => {
  it('starts each level unmorphed, and finishes at the end of its reach', () => {
    for (let level = 0; level < LEVELS; level++) {
      expect(morphAmount(levelReach(level) * MORPH_START, level)).toBe(0)
      expect(morphAmount(levelReach(level), level)).toBe(1)
      expect(morphAmount(levelReach(level) * 3, level)).toBe(1)
    }
  })

  it('moves smoothly, with no jump', () => {
    const level = 5
    const reach = levelReach(level)
    let last = 0
    for (let at = MORPH_START; at <= 1; at += 0.002) {
      const amount = morphAmount(reach * at, level)
      expect(amount - last).toBeLessThan(0.02)
      expect(amount).toBeGreaterThanOrEqual(last)
      last = amount
    }
  })

  it('has a level finished morphing before the next one begins, wherever they meet', () => {
    // Where a tile meets a coarser one is as far as the finer's reach plus the
    // diagonal of its parent. It must be morphed by then, and the coarser not begun.
    for (let level = 0; level < LEVELS - 1; level++) {
      const parent = TILE_QUADS * levelSpacing(level + 1)
      const furthestSeam = levelReach(level) + Math.SQRT2 * parent
      expect(morphAmount(levelReach(level), level)).toBe(1)
      expect(morphAmount(furthestSeam, level + 1)).toBe(0)
    }
  })

  it('leaves no seam that needs morphing further than a level', () => {
    // What keeps a level from being skipped between two neighbours: see cdlod.ts.
    expect(REACH_SPACINGS).toBeGreaterThan(2 * Math.SQRT2 * TILE_QUADS)
  })
})

describe('neighbouring tiles', () => {
  it('never differ by more than one level', () => {
    // Only those well within their level's reach, or there are too many pairs to
    // check, and each level's seam with the next is in there.
    const tiles = selectTiles().filter(({ x, z, level }) => Math.hypot(x, z) < levelReach(level) * 3)
    expect(tiles.length).toBeGreaterThan(100)
    const gaps = tiles.flatMap((a) =>
      tiles.filter((b) => a !== b && neighbours(a, b)).map((b) => Math.abs(a.level - b.level)),
    )
    expect(gaps.length).toBeGreaterThan(100)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(1)
  })
})

describe('tileInstances', () => {
  it('gives each tile its corner and spacing', () => {
    const data = tileInstances([{ x: 3, z: -4, level: 2 }])
    expect(data).toHaveLength(TILE_STRIDE)
    expect([...data]).toEqual([3, -4, 0.25])
  })
})

describe('tileIndices', () => {
  it('makes two triangles of every quad, from vertices all in the grid', () => {
    const indices = tileIndices()
    expect(indices).toHaveLength(TILE_QUADS * TILE_QUADS * 6)
    expect(Math.max(...indices)).toBe((TILE_QUADS + 1) ** 2 - 1)
  })
})

describe('the view', () => {
  const camera = oceanCamera(16 / 9)
  const inView = footprintInView(camera)

  it('leaves out what is out of sight, and most of the ocean with it', () => {
    const visible = selectTiles(inView)
    expect(visible.length).toBeGreaterThan(50)
    expect(visible.length).toBeLessThan(selectTiles().length / 2)
  })

  it('still sees the finest tiles, which lie at the bottom of the view', () => {
    expect(selectTiles(inView).some(({ level }) => level === 0)).toBe(true)
  })

  it('still sees the far edge of the ocean', () => {
    const far = selectTiles(inView).filter(({ z }) => z > 100_000)
    expect(far.length).toBeGreaterThan(0)
  })

  it('sees nothing behind the camera', () => {
    expect(inView({ left: -10, back: -2000, right: 10, front: -1000 })).toBe(false)
  })

  it('sees nothing off to the side', () => {
    expect(inView({ left: 5000, back: 100, right: 5100, front: 200 })).toBe(false)
  })

  it('has its bottom edge on the origin', () => {
    const { eye, forward, up, halfHeight } = camera
    const bottom = [0, 1, 2].map((i) => forward[i] - up[i] * halfHeight)
    const along = -eye[1] / bottom[1]
    expect(eye[2] + bottom[2] * along).toBeCloseTo(0, 3)
  })
})
