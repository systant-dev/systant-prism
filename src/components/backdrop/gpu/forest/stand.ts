// What the forest is made of, worked out once. Nothing here touches a GPU, so all of
// it can be tested.
//
// A tree here is a crown of a dozen lobes, and each lobe a few thousand leaves. The
// leaves themselves aren't kept: each is worked out from its number alone by the
// shader that draws them (panorama.ts), as there are millions of them. All that is here
// is what they are worked out from.
//
// Lobes that can't be seen from the eye are left out, and those that can are given
// as many leaves as they need to fill their part of the panorama, so that a leaf is
// about the same few pixels across wherever it is. Further trees are made of fewer
// leaves, a little larger than life, which the eye can't tell.
//
// Everything sits on a hull, a mesh a little inside the crowns, which is the dark
// under the canopy.
import { mulberry32, saturate } from '../sky'
import { EYE_HEIGHT } from './camera'

/** How many values each lobe has on the GPU, and each tree. */
export const LOBE_STRIDE = 16
export const TREE_STRIDE = 8

/** How many bits of a lobe's owner say which lobe of its crown it is: room for any crown. */
export const CROWN_BITS = 4

/** How much faster a limb is than its tree, the slowest and how much more the quickest is. */
const LIMB_SLOWEST = 1.5
const LIMB_RANGE = 1.6

/** How many values each branch has on the GPU: where it is, its frequency and how far up its tree it is, 0–1. */
export const BRANCH_STRIDE = 4

/** How much stiffer and slacker than the mean for its height a tree can be, as a share of its frequency. */
const STIFFEST = 1.32
const SLACKEST = 0.7

/** How far a tree sways for the most sheltered and the most exposed, as a share of what its kind does. */
const SHELTERED = 0.35
const MOST_EXPOSED = 1.45

/** How many values each vertex of the hull has: where it is, and how far out of the shade. */
export const HULL_STRIDE = 4

/** How many leaves go in a block: a lobe has a whole number of them, and a shader finds its lobe by its block. */
export const LEAF_BLOCK = 256

/** How many strips the view is split into, left to right, and how far either way they reach, as x / z. */
export const SECTORS = 64
export const SIDE_REACH = 0.8

/** How far past the edge of a strip of the panorama a tree can be and still reach into it, as x / z. */
const SIDE_MARGIN = 0.08

/** How the heights over the land are stored: its cell in metres, how many a side, and where it starts. */
export const FIELD_CELL = 2
export const FIELD_COLUMNS = 360
export const FIELD_ROWS = 270
export const FIELD_LEFT = -360

/** How many of the height field's cells make a cell of the hull, and how far it lies below them, in metres. */
const HULL_STEP = 2
const HULL_DROP = 2.6

/** How tall the trees along the crest are, in metres: all much alike, for a level line. */
const LINE_HEIGHT = 19

/** How far back from the crest they start to be all alike, and are as alike as they get, in metres. */
const LINE_FROM = 110
const LINE_AT = 40

/** How far apart trees are, in metres, and how a young one compares with a grown one. */
const TREE_SPACING = 7.4
const YOUNG_HEIGHT = 0.62
const YOUNG_SPREAD = 0.74

/** How far inside its crown the hull lies, and how far behind the canopy a lobe is out of sight, in metres. */
const HULL_INSET = 0.72
const HIDDEN_DEPTH = 1.4

/** The angle a leaf covers from the eye, in radians: about 4 pixels of the panorama, from tip to stalk. */
const LEAF_ANGLE = 0.00105

/** The smallest a leaf is drawn, in metres: the size of a large real one. */
const SMALLEST_LEAF = 0.11

/** How many layers of leaves a lobe's face is covered by. */
const LEAF_LAYERS = 3.25

/** The nearest and furthest trees, in metres from the eye. */
const NEAREST_TREE = 72
const PAST_CREST = 30

/** How far a line to the eye is checked, in metres back from a lobe: near it is what counts. */
const SIGHT_STEPS = [6, 10, 15, 22, 32, 46, 66, 96]

/** How many points of each lobe are tried for being in sight. */
const SIGHT_POINTS = 14

/** What each kind of tree looks like and how it moves. */
interface Species {
  /** How common it is, by where on the noise it grows. */
  share: number
  /** Linear albedo. */
  colour: [number, number, number]
  /** Height and crown radius, in metres, and how tall the crown is for its width. */
  height: number
  radius: number
  tall: number
  lobes: number
  /** A lobe's radius, as a share of the crown's. */
  lobeSize: number
  /** How far its leaves hang in strands, 0–1, rather than sit in rounded tufts. */
  droop: number
  /** How far its top leans for a mean wind, in metres. */
  sway: number
}

const GROVE: Species[] = [
  // Oak: broad, dense and dark.
  {
    share: 0.2,
    colour: [0.115, 0.138, 0.03],
    height: 19,
    radius: 5.6,
    tall: 0.86,
    lobes: 14,
    lobeSize: 0.48,
    droop: 0.1,
    sway: 0.26,
  },
  // Birch: tall, thin and bright, always moving, with hanging strands.
  {
    share: 0.24,
    colour: [0.235, 0.285, 0.048],
    height: 21,
    radius: 4.2,
    tall: 1.3,
    lobes: 12,
    lobeSize: 0.47,
    droop: 0.62,
    sway: 0.5,
  },
  // Sallow: a pale grey-green dome.
  {
    share: 0.12,
    colour: [0.21, 0.245, 0.068],
    height: 15,
    radius: 5,
    tall: 0.94,
    lobes: 12,
    lobeSize: 0.48,
    droop: 0.45,
    sway: 0.38,
  },
  // Alder: a deep green and a narrow crown.
  {
    share: 0.14,
    colour: [0.076, 0.118, 0.03],
    height: 18,
    radius: 4.2,
    tall: 1.16,
    lobes: 12,
    lobeSize: 0.5,
    droop: 0.15,
    sway: 0.3,
  },
  // Ash: a light, yellowish green, late to leaf and thin.
  {
    share: 0.12,
    colour: [0.185, 0.225, 0.05],
    height: 20,
    radius: 4.8,
    tall: 1.05,
    lobes: 12,
    lobeSize: 0.47,
    droop: 0.3,
    sway: 0.4,
  },
  // Poplar: a cool, silvered green.
  {
    share: 0.1,
    colour: [0.118, 0.166, 0.06],
    height: 22,
    radius: 3.8,
    tall: 1.45,
    lobes: 12,
    lobeSize: 0.47,
    droop: 0.2,
    sway: 0.45,
  },
  // Lime: a warm yellow-green.
  {
    share: 0.08,
    colour: [0.245, 0.275, 0.046],
    height: 19,
    radius: 5.2,
    tall: 1,
    lobes: 13,
    lobeSize: 0.48,
    droop: 0.25,
    sway: 0.3,
  },
]

/** How many trees are the odd copper beech, and what it is like: a dark red. */
const COPPER_BEECHES = 0.012
const COPPER_BEECH: Species = {
  share: 0,
  colour: [0.086, 0.044, 0.032],
  height: 20,
  radius: 5.8,
  tall: 0.9,
  lobes: 14,
  lobeSize: 0.48,
  droop: 0.1,
  sway: 0.26,
}

export interface Stand {
  /** LOBE_STRIDE values for each lobe: where it is and its size, its colour and droop, its leaves, and its tree. */
  lobes: Float32Array<ArrayBuffer>
  lobeCount: number
  /**
   * The tree each lobe belongs to, counted from the nearest to the eye, above CROWN_BITS
   * bits for how near it is among the lobes of that crown: one number that says at once
   * which tree it is, and which of two lobes is in front.
   */
  owners: Uint32Array<ArrayBuffer>
  /** The lobe each block of leaves belongs to, by sector. */
  blocks: Uint32Array<ArrayBuffer>
  /** Where each sector's blocks start, then where the last one ends. */
  sectors: Uint32Array<ArrayBuffer>
  /** TREE_STRIDE values for each tree: where it is, its frequency, damping and sway, its branches, and a number of its own. */
  trees: ArrayBuffer
  treeCount: number
  /** BRANCH_STRIDE values for each branch, one to a lobe, in the same order. */
  branches: Float32Array<ArrayBuffer>
  /** The height of the canopy over each cell of the land. */
  canopy: Float32Array<ArrayBuffer>
  hullVertices: Float32Array<ArrayBuffer>
  hullIndices: Uint16Array<ArrayBuffer>
}

function mix(a: number, b: number, by: number) {
  return a + (b - a) * by
}

/** A hash of a place on a grid, 0–1. */
function hash(x: number, y: number) {
  let n = Math.imul(x, 73856093) ^ Math.imul(y, 19349663)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

/** Smooth noise, 0–1. */
export function noise(x: number, y: number) {
  const cellX = Math.floor(x)
  const cellY = Math.floor(y)
  const fx = x - cellX
  const fy = y - cellY
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const low = hash(cellX, cellY) * (1 - ux) + hash(cellX + 1, cellY) * ux
  const high = hash(cellX, cellY + 1) * (1 - ux) + hash(cellX + 1, cellY + 1) * ux
  return low * (1 - uy) + high * uy
}

/** How far the crest of the hill is along a line from the eye, and how high: it rolls as it runs across the view. */
function crestAt(angle: number): [number, number] {
  const distance = 398 + 90 * (noise(angle * 2.6 + 11, 3.5) - 0.5) + 30 * Math.sin(angle * 3.1 + 0.6)
  // As high as puts the top of a tree level with the eye, however far away that is.
  return [distance, EYE_HEIGHT - LINE_HEIGHT]
}

/** The height of the ground, in metres. */
export function groundHeight(x: number, z: number) {
  const reach = Math.hypot(x, z)
  const [distance, height] = crestAt(Math.atan2(x, z))
  const along = reach / distance
  const climb = along < 1 ? 1 - (1 - along) ** 1.7 : 1 - (along - 1) ** 2 * 3
  // Folds in the slope, which is what sets one tree above the next.
  const folds = (noise(x * 0.016 + 40, z * 0.016) - 0.5) * 11 + (noise(x * 0.05, z * 0.05 + 9) - 0.5) * 3.5
  // Gone by the crest, or they would stand out along the tree line.
  const smoothed = saturate((1 - along) / 0.25)
  return -12 + (height + 12) * climb + folds * smoothed
}

/** Points spread evenly over a sphere, each in turn. */
function spiral(index: number, count: number, out: number[], from = 1, to = -1) {
  const y = from + ((to - from) * (index + 0.5)) / count
  const around = Math.sqrt(Math.max(0, 1 - y * y))
  const turn = index * 2.39996323
  out[0] = Math.cos(turn) * around
  out[1] = y
  out[2] = Math.sin(turn) * around
}

/** How wide a leaf is drawn at this distance from the eye, in metres. */
export function leafSize(distance: number) {
  return Math.max(SMALLEST_LEAF, distance * LEAF_ANGLE)
}

/** Which sector a place this far across falls in, for a place this far away. */
function sectorOf(x: number, z: number) {
  const across = (x / z + SIDE_REACH) / (2 * SIDE_REACH)
  return Math.max(0, Math.min(SECTORS - 1, Math.floor(across * SECTORS)))
}

/** The blocks of leaves a strip of the panorama needs, from `left` to `right` as x / z: the first and how many. */
export function blocksInStrip({ sectors }: Pick<Stand, 'sectors'>, left: number, right: number): [number, number] {
  const first = sectorOf(Math.max(-SIDE_REACH, left - SIDE_MARGIN), 1)
  const last = sectorOf(Math.min(SIDE_REACH, right + SIDE_MARGIN), 1)
  return [sectors[first], sectors[last + 1] - sectors[first]]
}

class Field {
  values = new Float32Array(FIELD_COLUMNS * FIELD_ROWS)

  at(x: number, z: number) {
    const column = Math.floor((x - FIELD_LEFT) / FIELD_CELL)
    const row = Math.floor(z / FIELD_CELL)
    if (column < 0 || row < 0 || column >= FIELD_COLUMNS || row >= FIELD_ROWS) return 0
    return this.values[row * FIELD_COLUMNS + column]
  }

  /** The dome of a crown laid over the field, wherever it stands above what is there. */
  raise(x: number, z: number, y: number, radius: number, tall: number) {
    const left = Math.max(0, Math.floor((x - radius - FIELD_LEFT) / FIELD_CELL))
    const right = Math.min(FIELD_COLUMNS - 1, Math.ceil((x + radius - FIELD_LEFT) / FIELD_CELL))
    const near = Math.max(0, Math.floor((z - radius) / FIELD_CELL))
    const far = Math.min(FIELD_ROWS - 1, Math.ceil((z + radius) / FIELD_CELL))
    for (let row = near; row <= far; row++) {
      for (let column = left; column <= right; column++) {
        const dx = (column + 0.5) * FIELD_CELL + FIELD_LEFT - x
        const dz = (row + 0.5) * FIELD_CELL - z
        const out = 1 - (dx * dx + dz * dz) / (radius * radius)
        if (out <= 0) continue
        const at = row * FIELD_COLUMNS + column
        this.values[at] = Math.max(this.values[at], y + tall * Math.sqrt(out))
      }
    }
  }
}

interface Tree {
  x: number
  z: number
  ground: number
  species: Species
  height: number
  radius: number
  tall: number
  crownY: number
  distance: number
  sector: number
  colour: number[]
}

/**
 * The trees in reach, by a jittered grid, as near to even as a wood is, with a young
 * one coming up in the gap beside each. Those are the understorey: they fill the holes
 * in the canopy that would otherwise show the bare hull.
 */
function plantTrees(random: () => number): Tree[] {
  const trees: Tree[] = []
  const rows = Math.ceil(520 / TREE_SPACING)
  const columns = Math.ceil(420 / TREE_SPACING)
  for (let cell = 0; cell < (2 * columns + 1) * rows * 2; cell++) {
    const young = cell % 2 === 1
    const spot = cell >> 1
    const row = Math.floor(spot / (2 * columns + 1))
    const column = (spot % (2 * columns + 1)) - columns
    {
      const nudge = young ? 0.5 : 0
      const x = (column + nudge + (row % 2) * 0.5 + (random() - 0.5) * 0.8) * TREE_SPACING
      const z = (row + nudge + 2 + (random() - 0.5) * 0.8) * TREE_SPACING
      const distance = Math.hypot(x, z)
      const [crest] = crestAt(Math.atan2(x, z))
      if (distance < NEAREST_TREE || distance > crest + PAST_CREST) continue
      if (Math.abs(x / z) > SIDE_REACH) continue

      // By where it grows, so that each kind stands in loose groups.
      const grove = noise(x * 0.019 + 7, z * 0.019 - 3)
      const pick = (grove * 1.9 - 0.45 + random() * 0.42) % 1
      let share = (pick + 1) % 1
      const planted = !young && random() < COPPER_BEECHES
      const species = planted ? COPPER_BEECH : (GROVE.find((kind) => (share -= kind.share) < 0) ?? GROVE[0])

      const size = (0.78 + 0.44 * random()) * (young ? YOUNG_HEIGHT : 1)
      const towardsLine = saturate((distance - crest + LINE_FROM) / (LINE_FROM - LINE_AT))
      const height = young ? species.height * size : mix(species.height * size, LINE_HEIGHT, towardsLine * 0.97)
      const radius = species.radius * (0.76 + 0.42 * random()) * (young ? YOUNG_SPREAD : 1)
      const tall = radius * species.tall
      const ground = groundHeight(x, z)
      const shift = 0.76 + 0.48 * random()
      // No two of a kind are quite the same colour.
      const warm = 0.84 + 0.34 * random()
      trees.push({
        x,
        z,
        ground,
        species,
        height,
        radius,
        tall,
        crownY: ground + height - tall,
        distance,
        sector: sectorOf(x, z),
        colour: [species.colour[0] * shift * warm, species.colour[1] * shift, (species.colour[2] * shift) / warm],
      })
    }
  }
  return trees.sort((a, b) => a.sector - b.sector || a.distance - b.distance)
}

/** Whether a line from here to the eye stays clear of the canopy, past the tree it starts in. */
function inSight(canopy: Field, tree: Tree, x: number, y: number, z: number) {
  const distance = Math.hypot(x, y - EYE_HEIGHT, z)
  const toX = -x / distance
  const toY = (EYE_HEIGHT - y) / distance
  const toZ = -z / distance
  const clear = tree.radius * 1.04
  for (const step of SIGHT_STEPS) {
    if (step >= distance) break
    const px = x + toX * step
    const pz = z + toZ * step
    if (Math.hypot(px - tree.x, pz - tree.z) < clear) continue
    if (canopy.at(px, pz) - HIDDEN_DEPTH > y + toY * step) return false
  }
  return true
}

/** The mesh that everything lies over: see above. */
function buildHull(hull: Field, ground: Float32Array) {
  const columns = Math.floor((FIELD_COLUMNS - 1) / HULL_STEP) + 1
  const rows = Math.floor((FIELD_ROWS - 1) / HULL_STEP) + 1
  const vertices = new Float32Array(columns * rows * HULL_STRIDE)
  const indices = new Uint16Array((columns - 1) * (rows - 1) * 6)
  let index = 0
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cell = row * HULL_STEP * FIELD_COLUMNS + column * HULL_STEP
      const at = (row * columns + column) * HULL_STRIDE
      const under = ground[cell]
      // Its cells are too big to follow a crown, so its corners would come up through one.
      const height = Math.max(hull.values[cell] - HULL_DROP, under)
      vertices[at] = (column * HULL_STEP + 0.5) * FIELD_CELL + FIELD_LEFT
      vertices[at + 1] = height
      vertices[at + 2] = (row * HULL_STEP + 0.5) * FIELD_CELL
      vertices[at + 3] = Math.min(1, (height - under) / 18)
      if (column < columns - 1 && row < rows - 1) {
        const next = row * columns + column
        indices.set([next, next + columns, next + 1, next + 1, next + columns, next + columns + 1], index)
        index += 6
      }
    }
  }
  return { hullVertices: vertices, hullIndices: indices }
}

/**
 * The forest, the same every time. It takes a moment, so it gives the page time to
 * paint by awaiting `pause` as it goes.
 */
export async function plantStand(pause: () => Promise<unknown> = () => Promise.resolve()): Promise<Stand> {
  const random = mulberry32(2025)
  const trees = plantTrees(random)

  const ground = new Field()
  const canopy = new Field()
  const hull = new Field()
  for (let row = 0; row < FIELD_ROWS; row++) {
    for (let column = 0; column < FIELD_COLUMNS; column++) {
      const height = groundHeight((column + 0.5) * FIELD_CELL + FIELD_LEFT, (row + 0.5) * FIELD_CELL)
      const at = row * FIELD_COLUMNS + column
      ground.values[at] = height
      canopy.values[at] = height
      hull.values[at] = height
    }
  }
  await pause()
  for (const { x, z, crownY, radius, tall } of trees) {
    canopy.raise(x, z, crownY, radius * 1.02, tall)
    hull.raise(x, z, crownY, radius * HULL_INSET, tall * HULL_INSET)
  }
  await pause()

  const nearestFirst = trees.map((_, index) => index).sort((a, b) => trees[a].distance - trees[b].distance)
  const ranks = new Uint32Array(trees.length)
  for (const [rank, index] of nearestFirst.entries()) ranks[index] = rank

  const lobes: number[] = []
  const owners: number[] = []
  const branches: number[] = []
  const blocks: number[] = []
  const sectors = new Uint32Array(SECTORS + 1)
  const treeBuffer = new ArrayBuffer(trees.length * TREE_STRIDE * 4)
  const treeFloats = new Float32Array(treeBuffer)
  const treeInts = new Uint32Array(treeBuffer)
  const way = [0, 0, 0]
  const point = [0, 0, 0]

  let sector = 0
  for (const [index, tree] of trees.entries()) {
    while (sector < tree.sector) sectors[++sector] = blocks.length
    const { x, z, crownY, radius, tall, species, colour } = tree
    // Tall trees are slower, by about the inverse of their height, as a beam is. Those
    // of one height still differ by as much again, by how thick their stems are, which
    // is much of why a wood's trees don't sway in step.
    const frequency = (5.2 / tree.height) * (STIFFEST - random() * (STIFFEST - SLACKEST))
    const first = branches.length / BRANCH_STRIDE
    const away: number[] = []
    const spin = random() * 6.28
    const cos = Math.cos(spin)
    const sin = Math.sin(spin)

    for (let i = 0; i < species.lobes; i++) {
      // Over the top of the crown and down to below its widest.
      spiral(i, species.lobes, way, 1, -0.45)
      const lobeX = way[0] * cos - way[2] * sin
      const lobeY = way[1]
      const lobeZ = way[0] * sin + way[2] * cos
      const reach = 1 - species.lobeSize * 0.62 + (random() - 0.5) * 0.14
      const atX = x + lobeX * radius * reach
      const atY = crownY + lobeY * tall * reach
      const atZ = z + lobeZ * radius * reach
      const size = radius * species.lobeSize * (0.82 + 0.36 * random())
      const lit = 0.9 + 0.2 * random()

      const share = saturate((atY - tree.ground) / tree.height)
      const lobe = lobes.length / LOBE_STRIDE
      branches.push(atX, atZ, frequency * (LIMB_SLOWEST + LIMB_RANGE * random()), share)

      let seen = 0
      for (let p = 0; p < SIGHT_POINTS && !seen; p++) {
        spiral(p, SIGHT_POINTS, point)
        if (inSight(canopy, tree, atX + point[0] * size, atY + point[1] * size, atZ + point[2] * size)) seen = 1
      }
      const distance = Math.hypot(atX, atY - EYE_HEIGHT, atZ)
      away.push(distance)
      const leaf = leafSize(distance)
      // The half of it that faces the eye, and no more of it than there is.
      const leaves = seen ? (2 * Math.PI * size * size * LEAF_LAYERS) / (leaf * leaf * 0.5) : 0
      const blockCount = Math.ceil(leaves / LEAF_BLOCK)
      for (let b = 0; b < blockCount; b++) blocks.push(lobe)

      // The lobes on top and on the outside see the sky; those beneath don't.
      const open = 0.4 + 0.6 * saturate(0.45 + lobeY * 0.7)
      lobes.push(
        atX,
        atY,
        atZ,
        size,
        colour[0] * lit,
        colour[1] * lit,
        colour[2] * lit,
        species.droop,
        leaf,
        open,
        tree.height,
        lobeY,
        x,
        tree.ground,
        z,
        crownY,
      )
    }

    for (const lobe of away.keys()) {
      const nearer = away.filter((distance) => distance < away[lobe]).length
      owners.push((ranks[index] << CROWN_BITS) + nearer)
    }

    const at = index * TREE_STRIDE
    // How far it sways goes by how exposed it is: some crowns stand clear of their
    // neighbours, and others are sheltered by them.
    const exposed = SHELTERED + (1 - SHELTERED) * random()
    treeFloats.set([x, z, frequency, 0.09 + 0.05 * random(), species.sway * exposed * MOST_EXPOSED], at)
    treeInts[at + 5] = first
    treeInts[at + 6] = branches.length / BRANCH_STRIDE - first
    treeFloats[at + 7] = random()
    if (index % 128 === 127) await pause()
  }
  while (sector < SECTORS) sectors[++sector] = blocks.length

  return {
    lobes: new Float32Array(lobes),
    lobeCount: lobes.length / LOBE_STRIDE,
    owners: new Uint32Array(owners),
    blocks: new Uint32Array(blocks),
    sectors,
    trees: treeBuffer,
    treeCount: trees.length,
    branches: new Float32Array(branches),
    canopy: canopy.values,
    ...buildHull(hull, ground.values),
  }
}
