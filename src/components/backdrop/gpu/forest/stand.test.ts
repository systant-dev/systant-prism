import { beforeAll, describe, expect, it } from 'vitest'
import { TREE_LINE_DROP } from '../sky'
import { EYE_HEIGHT, forestCamera, panoramaCamera } from './camera'
import {
  blocksInStrip,
  BRANCH_STRIDE,
  CROWN_BITS,
  FIELD_CELL,
  FIELD_COLUMNS,
  FIELD_LEFT,
  FIELD_ROWS,
  groundHeight,
  HULL_STRIDE,
  LEAF_BLOCK,
  leafSize,
  LOBE_STRIDE,
  noise,
  plantStand,
  SECTORS,
  SIDE_REACH,
  type Stand,
  TREE_STRIDE,
} from './stand'

let stand: Stand

beforeAll(async () => {
  stand = await plantStand()
})

function lobeAt(index: number) {
  const at = index * LOBE_STRIDE
  const { lobes } = stand
  return {
    x: lobes[at],
    y: lobes[at + 1],
    z: lobes[at + 2],
    size: lobes[at + 3],
    colour: [lobes[at + 4], lobes[at + 5], lobes[at + 6]],
    droop: lobes[at + 7],
    leaf: lobes[at + 8],
    open: lobes[at + 9],
    treeHeight: lobes[at + 10],
    // Where in its crown, from -1 at the bottom to 1 at the top.
    inCrown: lobes[at + 11],
    ground: lobes[at + 13],
  }
}

describe('noise', () => {
  it('stays within 0–1, and changes smoothly', () => {
    for (let i = 0; i < 400; i++) {
      const x = i * 0.137
      const value = noise(x, x * 0.61)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      expect(Math.abs(noise(x + 0.01, x * 0.61) - value)).toBeLessThan(0.05)
    }
  })
})

describe('plantStand', () => {
  it('gives the page time to paint as it goes, and plants the same forest every time', async () => {
    let pauses = 0
    const again = await plantStand(() => {
      pauses++
      return Promise.resolve()
    })
    expect(pauses).toBeGreaterThan(5)
    expect(again.lobeCount).toBe(stand.lobeCount)
    // Not toEqual, which takes a long time over this many values.
    expect(again.lobes.every((value, i) => value === stand.lobes[i])).toBe(true)
    expect(again.blocks.every((value, i) => value === stand.blocks[i])).toBe(true)
  })

  it('makes millions of leaves, but few enough to draw on any GPU in a moment', () => {
    const leaves = stand.blocks.length * LEAF_BLOCK
    expect(leaves).toBeGreaterThan(10_000_000)
    expect(leaves).toBeLessThan(80_000_000)
  })

  it('makes leaves the size of a large real one up close, and larger only as they get too small to see', () => {
    expect(leafSize(10)).toBeCloseTo(0.11)
    expect(leafSize(400)).toBeCloseTo(leafSize(200) * 2)
    const near = lobeAt(0)
    expect(near.leaf).toBeLessThan(0.8)
  })

  it('finds a lobe for every block of leaves, in order, and leaves out those out of sight', () => {
    const { blocks, lobeCount } = stand
    const given = new Set(blocks)
    expect(Math.max(...given)).toBeLessThan(lobeCount)
    expect(given.size).toBeLessThan(lobeCount)
    // The understorey is mostly out of sight, under the canopy.
    expect(given.size).toBeGreaterThan(lobeCount / 5)
  })

  it('tells each lobe where its tree stands, for the wood', () => {
    for (let lobe = 0; lobe < stand.lobeCount; lobe += 97) {
      const at = lobe * LOBE_STRIDE
      const [x, ground, z, crown] = stand.lobes.subarray(at + 12, at + 16)
      expect(Math.hypot(lobeAt(lobe).x - x, lobeAt(lobe).z - z)).toBeLessThan(lobeAt(lobe).size + 12)
      expect(ground).toBeCloseTo(groundHeight(x, z), 3)
      expect(crown).toBeGreaterThan(ground)
    }
  })

  it('says how far up its tree each branch grows', () => {
    // A branch is the lobe of the same number.
    for (let branch = 0; branch < stand.lobeCount; branch += 53) {
      const { y, ground, treeHeight } = lobeAt(branch)
      const up = stand.branches[branch * BRANCH_STRIDE + 3]
      expect(up).toBeCloseTo(Math.min(1, Math.max(0, (y - ground) / treeHeight)), 4)
    }
  })

  it('has few enough lobes for a part to number them', () => {
    expect(stand.lobeCount).toBeLessThan(65_535)
  })

  it('spreads the trees along the tree line over a range of frequencies, or they would sway in step', () => {
    // These are all much of a height, so what's left is how stiff each is.
    const floats = new Float32Array(stand.trees)
    const rates: number[] = []
    for (let tree = 0; tree < stand.treeCount; tree++) {
      const x = floats[tree * TREE_STRIDE]
      const z = floats[tree * TREE_STRIDE + 1]
      if (Math.hypot(x, z) > 380) rates.push(floats[tree * TREE_STRIDE + 2])
    }
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length
    const spread = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length) / mean
    expect(rates.length).toBeGreaterThan(100)
    expect(spread).toBeGreaterThan(0.12)
  })

  it('gives every tree a number of its own, and a sway that differs from its neighbours', () => {
    const floats = new Float32Array(stand.trees)
    const own = new Set<number>()
    let least = Infinity
    let most = 0
    for (let tree = 0; tree < stand.treeCount; tree++) {
      own.add(floats[tree * TREE_STRIDE + 7])
      least = Math.min(least, floats[tree * TREE_STRIDE + 4])
      most = Math.max(most, floats[tree * TREE_STRIDE + 4])
      expect(floats[tree * TREE_STRIDE + 7]).toBeGreaterThanOrEqual(0)
      expect(floats[tree * TREE_STRIDE + 7]).toBeLessThan(1)
    }
    expect(own.size).toBeGreaterThan(stand.treeCount * 0.99)
    expect(most / least).toBeGreaterThan(4)
  })

  it('numbers the owner of each lobe by how near its tree is, so that the number says which is in front', () => {
    expect(stand.owners.length).toBe(stand.lobeCount)
    const distances = new Float64Array(stand.treeCount).fill(-1)
    for (let lobe = 0; lobe < stand.lobeCount; lobe++) {
      const at = lobe * LOBE_STRIDE
      distances[stand.owners[lobe] >> CROWN_BITS] = Math.hypot(stand.lobes[at + 12], stand.lobes[at + 14])
    }
    for (let rank = 0; rank < stand.treeCount; rank++) {
      expect(distances[rank]).toBeGreaterThanOrEqual(rank === 0 ? 0 : distances[rank - 1] - 0.001)
    }
  })

  it('keeps all of a tree under one owner', () => {
    const ints = new Uint32Array(stand.trees)
    for (let tree = 0; tree < stand.treeCount; tree += 31) {
      const first = ints[tree * TREE_STRIDE + 5]
      const count = ints[tree * TREE_STRIDE + 6]
      const owners = [...stand.owners.subarray(first, first + count)]
      expect(new Set(owners.map((owner) => owner >> CROWN_BITS)).size).toBe(1)
      // Each lobe has a place of its own, from the nearest to the eye.
      expect(owners.map((owner) => owner % (1 << CROWN_BITS)).sort((a, b) => a - b)).toEqual(owners.map((_, n) => n))
      expect(count).toBeLessThanOrEqual(1 << CROWN_BITS)
    }
  })

  it('has one branch to a lobe, in the same order, in the same place', () => {
    expect(stand.branches.length / BRANCH_STRIDE).toBe(stand.lobeCount)
    for (let lobe = 0; lobe < stand.lobeCount; lobe += 97) {
      expect(stand.branches[lobe * BRANCH_STRIDE]).toBeCloseTo(lobeAt(lobe).x)
      expect(stand.branches[lobe * BRANCH_STRIDE + 1]).toBeCloseTo(lobeAt(lobe).z)
    }
  })

  it('gives each tree its own run of branches, all of them used', () => {
    const ints = new Uint32Array(stand.trees)
    let next = 0
    for (let tree = 0; tree < stand.treeCount; tree++) {
      expect(ints[tree * TREE_STRIDE + 5]).toBe(next)
      next += ints[tree * TREE_STRIDE + 6]
    }
    expect(next).toBe(stand.lobeCount)
  })

  it('has trees in the range of real ones, taller ones slower', () => {
    const floats = new Float32Array(stand.trees)
    const ints = new Uint32Array(stand.trees)
    const trees: { height: number; frequency: number }[] = []
    for (let tree = 0; tree < stand.treeCount; tree += 7) {
      const frequency = floats[tree * TREE_STRIDE + 2]
      expect(frequency).toBeGreaterThan(0.15)
      expect(frequency).toBeLessThan(0.9)
      expect(floats[tree * TREE_STRIDE + 3]).toBeLessThan(0.5)
      // Its first lobe says how tall it is.
      trees.push({ height: lobeAt(ints[tree * TREE_STRIDE + 5]).treeHeight, frequency })
    }
    // The taller half sways more slowly than the shorter, for all that stems differ.
    trees.sort((a, b) => a.height - b.height)
    const mean = (some: typeof trees) => some.reduce((sum, { frequency }) => sum + frequency, 0) / some.length
    const half = Math.floor(trees.length / 2)
    expect(mean(trees.slice(half))).toBeLessThan(mean(trees.slice(0, half)))
  })

  it('has several kinds of tree, some hanging and some not', () => {
    const droops = new Set<number>()
    const reds = []
    for (let lobe = 0; lobe < stand.lobeCount; lobe += 3) {
      const { droop, colour } = lobeAt(lobe)
      droops.add(droop)
      if (colour[0] > colour[1] * 1.3) reds.push(lobe)
    }
    expect(droops.size).toBeGreaterThanOrEqual(3)
    // A copper beech is the odd tree, not a kind of wood.
    expect(reds.length / (stand.lobeCount / 3)).toBeLessThan(0.03)
  })

  it('leaves lobes less sky the further down their crown they are', () => {
    const sampled = []
    for (let lobe = 0; lobe < stand.lobeCount; lobe += 53) {
      expect(lobeAt(lobe).open).toBeGreaterThanOrEqual(0.4)
      expect(lobeAt(lobe).open).toBeLessThanOrEqual(1)
      sampled.push(lobeAt(lobe))
    }
    // From the bottom of their crowns to the top, never less open on the way up.
    const open = sampled.sort((a, b) => a.inCrown - b.inCrown).map((lobe) => lobe.open)
    expect(open.every((value, i) => i === 0 || value >= open[i - 1])).toBe(true)
    expect(open.at(-1)).toBeGreaterThan(open[0])
  })
})

describe('blocksInStrip', () => {
  it('rises through the sectors from the first block to the last', () => {
    const { sectors, blocks } = stand
    expect(sectors).toHaveLength(SECTORS + 1)
    expect(sectors[0]).toBe(0)
    expect(sectors[SECTORS]).toBe(blocks.length)
    for (let i = 0; i < SECTORS; i++) expect(sectors[i + 1]).toBeGreaterThanOrEqual(sectors[i])
  })

  it('takes one run of the blocks, more for a wider strip', () => {
    const [firstNarrow, narrow] = blocksInStrip(stand, -0.1, 0.1)
    const [firstWide, wide] = blocksInStrip(stand, -0.4, 0.4)
    expect(firstNarrow).toBeGreaterThan(firstWide)
    expect(firstNarrow + narrow).toBeLessThan(firstWide + wide)
  })

  it('holds every block for a strip as wide as the panorama', () => {
    const { halfWidth } = panoramaCamera()
    expect(halfWidth).toBeLessThan(SIDE_REACH)
    expect(blocksInStrip(stand, -SIDE_REACH, SIDE_REACH)).toEqual([0, stand.blocks.length])
  })
})

describe('the land', () => {
  /** How high above the view's middle the canopy rises along the line through `slope`, in radians. */
  function skyline(slope: number) {
    let highest = -Infinity
    for (let z = 40; z < FIELD_ROWS * FIELD_CELL; z += FIELD_CELL) {
      const x = z * slope
      const column = Math.floor((x - FIELD_LEFT) / FIELD_CELL)
      const row = Math.floor(z / FIELD_CELL)
      if (column < 0 || column >= FIELD_COLUMNS) continue
      const height = stand.canopy[row * FIELD_COLUMNS + column]
      highest = Math.max(highest, Math.atan2(height - EYE_HEIGHT, Math.hypot(x, z)))
    }
    return highest
  }

  it('leaves sky above the trees in every view, and more trees than sky', () => {
    const { forward, halfHeight } = forestCamera(16 / 9)
    const pitch = Math.atan2(forward[1], forward[2])
    for (const slope of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const onScreen = Math.tan(skyline(slope) - pitch) / halfHeight
      // 1 would be the top of the view.
      expect(onScreen).toBeLessThan(0.92)
      expect(onScreen).toBeGreaterThan(0.2)
    }
  })

  it('keeps the tree line level all the way across, with no tree standing out above it', () => {
    const heights = Array.from({ length: 121 }, (_, i) => skyline(-0.6 + i * 0.01))
    // In radians: 0.01 is about 13 pixels of a 1080p view.
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.02)
    const middle = [...heights].sort((a, b) => a - b)[60]
    expect(Math.abs(middle)).toBeLessThan(0.008)
  })

  it('puts the tree line where the ocean meets the sky in the ocean scene', () => {
    const horizon = Math.tan(0.1) / Math.tan(0.36)
    const { forward, halfHeight } = forestCamera(16 / 9)
    const pitch = Math.atan2(forward[1], forward[2])
    // Lower than the geometry alone would have it, for what is seen of each (camera.ts).
    const lowered = horizon - TREE_LINE_DROP
    expect(Math.tan(-pitch) / halfHeight).toBeCloseTo(lowered, 3)
    const line = Math.tan(skyline(0.1) - pitch) / halfHeight
    expect(Math.abs(line - lowered)).toBeLessThan(0.04)
  })

  it('climbs away from the eye, up to a crest', () => {
    expect(groundHeight(0, 100)).toBeLessThan(groundHeight(0, 200))
    expect(groundHeight(0, 200)).toBeLessThan(groundHeight(0, 380))
    expect(groundHeight(0, 530)).toBeLessThan(groundHeight(0, 400))
  })

  it('has a canopy over the ground everywhere it stands', () => {
    for (let cell = 0; cell < stand.canopy.length; cell += 97) {
      const x = ((cell % FIELD_COLUMNS) + 0.5) * FIELD_CELL + FIELD_LEFT
      const z = (Math.floor(cell / FIELD_COLUMNS) + 0.5) * FIELD_CELL
      expect(stand.canopy[cell]).toBeGreaterThanOrEqual(groundHeight(x, z) - 0.001)
    }
  })

  it('keeps the hull under the canopy, so that it only shows through the gaps', () => {
    const { hullVertices, canopy } = stand
    for (let at = 0; at < hullVertices.length; at += HULL_STRIDE * 13) {
      const column = Math.floor((hullVertices[at] - FIELD_LEFT) / FIELD_CELL)
      const row = Math.floor(hullVertices[at + 2] / FIELD_CELL)
      expect(hullVertices[at + 1]).toBeLessThanOrEqual(canopy[row * FIELD_COLUMNS + column] + 0.001)
      expect(hullVertices[at + 3]).toBeGreaterThanOrEqual(0)
      expect(hullVertices[at + 3]).toBeLessThanOrEqual(1)
    }
  })

  it('indexes only vertices the hull has', () => {
    const vertices = stand.hullVertices.length / HULL_STRIDE
    expect(vertices).toBeLessThan(65_536)
    expect(Math.max(...stand.hullIndices.subarray(0, 60_000))).toBeLessThan(vertices)
  })
})
