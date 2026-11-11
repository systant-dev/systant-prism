// The stars, as the GPU is given them. The real bright ones, where they are, then as
// many fainter ones as there really are of each brightness, made up: few enough of
// them by the galactic poles, crowding into the band of the Milky Way and its star
// clouds, and thinning out where its dust hides what is behind it.
//
// Only stars that can ever cross the view from the place are kept, in order of right
// ascension so that only the slice of them in view is drawn, and each is packed into
// 8 bytes: where it is, how bright, and its colour index.
import { type Place, RADIANS } from '../daylight'
import { saturate, type Vec3 } from '../maths'
import { mulberry32 } from '../random'
import { BRIGHT_STARS, BULGE, DISK_LOBES } from './catalog'
import { crossesView, equatorial, galaxyAxes, STARS_PER_MAGNITUDE, viewBand } from './celestial'
import { lobeAt, type Measured, milkyWayModel } from './milkyWay'

/** The faintest star drawn over the ocean, and the brightest made up: brighter than that, the catalogue has them all. */
export const FAINTEST = 7.5
const BRIGHTEST_MADE_UP = 3

/** How many stars to make up across the whole sky, down to FAINTEST. */
const MADE_UP_STARS = 26_000

/** How many values each star has in a starField: where it is, its magnitude and its colour index. */
export const STAR_STRIDE = 5

/** How many bytes each star takes on the GPU, and what is in them. */
export const PACKED_STRIDE = 8
export const PACKED_ATTRIBUTES: GPUVertexAttribute[] = [
  { shaderLocation: 0, offset: 0, format: 'unorm16x2' },
  { shaderLocation: 1, offset: 4, format: 'unorm8x4' },
]

/** The range a magnitude and a colour index are packed into a byte across. */
export const MAGNITUDE_RANGE: [number, number] = [-2, 10]
export const INDEX_RANGE: [number, number] = [-0.4, 2]

/** A star's colour by its B−V index: blue-white, through white and yellow, to orange. */
export const COLOUR_STOPS: [number, Vec3][] = [
  [-0.3, [0.66, 0.77, 1]],
  [0.3, [1, 1, 1]],
  [0.9, [1, 0.9, 0.72]],
  [1.8, [1, 0.68, 0.45]],
]

/** A star's colour from its B−V index. */
export function starColour(index: number): Vec3 {
  const beyond = COLOUR_STOPS.findIndex(([at]) => at >= index)
  const next = beyond < 0 ? COLOUR_STOPS.length - 1 : Math.max(1, beyond)
  const [lowAt, low] = COLOUR_STOPS[next - 1]
  const [highAt, high] = COLOUR_STOPS[next]
  const t = saturate((index - lowAt) / (highAt - lowAt))
  return [0, 1, 2].map((i) => low[i] + (high[i] - low[i]) * t) as Vec3
}

/** How much the faint stars crowd into the Milky Way's light, and the most crowded they get, against the emptiest sky. */
const CROWDING = 4.5
const MOST_CROWDED = 12

/** How faint a star is before the Milky Way and its dust count for it, 0–1: the brightest are near and everywhere. */
function faintness(magnitude: number) {
  return saturate((magnitude - 4) / 3)
}

/** How many cells of galactic longitude and of latitude, a degree each, the sky is worked out in for the stars. */
const COLUMNS = 360
const ROWS = 180

export interface CrowdingMap {
  /** How crowded faint stars are at a galactic way, against the emptiest sky, and how much the dust lets through, 0–1. */
  at(way: readonly number[]): [number, number]
  /** A galactic way picked from three random numbers, as often as faint stars are seen there. */
  pick(cell: number, across: number, up: number): Vec3
}

/**
 * How crowded the faint stars are across the sky, and how much of them the dust lets
 * through, from cells of a degree of galactic longitude and latitude, worked out once.
 * The band's lobes split into a part by longitude and a part by latitude, so it costs
 * a few hundred exponentials rather than one for each lobe in each cell.
 */
export function crowdingMap(): CrowdingMap {
  const model = milkyWayModel()
  const lobes = [...DISK_LOBES, BULGE]
  const cellAngle = Math.PI / ROWS
  const longitudeOf = (column: number) => (column + 0.5) * cellAngle - Math.PI
  const latitudeOf = (row: number) => (row + 0.5) * cellAngle - Math.PI / 2
  const byColumn = lobes.map((lobe) =>
    Array.from({ length: COLUMNS }, (_, c) => lobeAt(longitudeOf(c), lobe.at[1] * RADIANS, lobe)),
  )
  const byRow = lobes.map((lobe) =>
    Array.from({ length: ROWS }, (_, r) => lobeAt(lobe.at[0] * RADIANS, latitudeOf(r), lobe)),
  )

  const crowded = new Float32Array(COLUMNS * ROWS)
  const through = new Float32Array(COLUMNS * ROWS).fill(1)
  const clouds = new Float32Array(COLUMNS * ROWS)
  const way = [0, 0, 0]
  // Each cloud is measured only over the cells it reaches.
  const over = ({ patch, reach, measure }: Measured, each: (cell: number, strength: number) => void) => {
    const [l, b] = patch.at
    const first = Math.max(0, Math.floor(((b - reach + 90) / 180) * ROWS))
    const last = Math.min(ROWS - 1, Math.floor(((b + reach + 90) / 180) * ROWS))
    for (let row = first; row <= last; row++) {
      const latitude = latitudeOf(row)
      const narrowest = Math.cos(Math.min(Math.PI / 2, Math.abs(latitude) + cellAngle))
      const wide = Math.min(COLUMNS / 2, Math.ceil(reach / Math.max(0.01, narrowest)))
      const start = Math.floor(l + 180) - wide
      for (let step = 0; step < Math.min(COLUMNS, 2 * wide + 1); step++) {
        const column = (((start + step) % COLUMNS) + COLUMNS) % COLUMNS
        const longitude = longitudeOf(column)
        way[0] = Math.cos(latitude) * Math.cos(longitude)
        way[1] = Math.cos(latitude) * Math.sin(longitude)
        way[2] = Math.sin(latitude)
        each(row * COLUMNS + column, measure(way))
      }
    }
  }
  for (const cloud of model.cloudPatches) over(cloud, (cell, strength) => (clouds[cell] += strength))
  for (const lane of model.dustPatches) over(lane, (cell, strength) => (through[cell] *= 1 - strength))
  // A running total of how many faint stars there are up to each cell, to pick from.
  const total = new Float64Array(COLUMNS * ROWS)
  let sum = 0
  for (let row = 0; row < ROWS; row++) {
    const latitude = latitudeOf(row)
    const area = Math.cos(latitude)
    for (let column = 0; column < COLUMNS; column++) {
      const cell = row * COLUMNS + column
      let light = clouds[cell]
      for (let i = 0; i < lobes.length; i++) light += lobes[i].strength * byColumn[i][column] * byRow[i][row]
      crowded[cell] = Math.min(MOST_CROWDED, 1 + CROWDING * light)
      sum += crowded[cell] * through[cell] * area
      total[cell] = sum
    }
  }

  // Where to start looking for each share of the total, so that a pick takes a step or two, not a search.
  const guide = new Uint32Array(total.length)
  for (let cell = 0, at = 0; at < guide.length; at++) {
    while (total[cell] < (at / guide.length) * sum) cell++
    guide[at] = cell
  }
  // The sines of the bottom and top of each row of cells.
  const sines = Float64Array.from({ length: ROWS + 1 }, (_, row) => Math.sin(row * cellAngle - Math.PI / 2))

  return {
    at(at) {
      const column = Math.min(COLUMNS - 1, Math.floor((Math.atan2(at[1], at[0]) + Math.PI) / cellAngle))
      const row = Math.min(
        ROWS - 1,
        Math.floor((Math.asin(Math.max(-1, Math.min(1, at[2]))) + Math.PI / 2) / cellAngle),
      )
      return [crowded[row * COLUMNS + column], through[row * COLUMNS + column]]
    },

    pick(chosen, across, up) {
      const wanted = chosen * sum
      let cell = guide[Math.min(guide.length - 1, Math.floor(chosen * guide.length))]
      while (cell < total.length - 1 && total[cell] < wanted) cell++
      const row = Math.floor(cell / COLUMNS)
      const longitude = longitudeOf(cell % COLUMNS) + (across - 0.5) * cellAngle
      // Evenly over the cell's area, which is wider towards the equator.
      const z = sines[row] + (sines[row + 1] - sines[row]) * up
      const ring = Math.sqrt(1 - z * z)
      return [ring * Math.cos(longitude), ring * Math.sin(longitude), z]
    },
  }
}

/**
 * The stars that can ever cross the view from a latitude, as `STAR_STRIDE` values
 * each, `depth` magnitudes fainter than over the ocean: for a long lens, which shows
 * fainter stars. Made-up ones follow the real count of stars by magnitude, about three
 * times as many for each magnitude fainter. The crowding map can be made beforehand.
 */
export function starField(
  { latitude }: Pick<Place, 'latitude'>,
  depth = 0,
  crowding = crowdingMap(),
): Float32Array<ArrayBuffer> {
  const making = starFieldInSteps({ latitude }, depth, crowding)
  let step = making.next()
  while (!step.done) step = making.next()
  return step.value
}

/** How many stars are made between the pauses of starFieldInSteps. */
const STARS_A_STEP = 15_000

/**
 * As starField, a step at a time, for the page to paint between them: through a long
 * lens there are tens of thousands of stars, and making them takes a while.
 */
export function* starFieldInSteps(
  { latitude }: Pick<Place, 'latitude'>,
  depth = 0,
  crowding = crowdingMap(),
): Generator<void, Float32Array<ArrayBuffer>> {
  const random = mulberry32(1609)
  const [centre, along, pole] = galaxyAxes()
  const values: number[] = []
  const add = (x: number, y: number, z: number, magnitude: number, index: number) =>
    values.push(x, y, z, magnitude, index)

  for (const [rightAscension, declination, magnitude, index] of BRIGHT_STARS) {
    const [x, y, z] = equatorial(rightAscension, declination)
    if (crossesView(z, latitude)) add(x, y, z, magnitude, index)
  }

  // Every star of the whole sky is made, so that the count is the same from anywhere,
  // but only those in the band of declinations the view can reach are worked out: as
  // the sines of declinations go, the sky's area is spread evenly. A share of them,
  // by how faint each is, goes where the Milky Way crowds them.
  const faintest = FAINTEST + depth
  const spread = STARS_PER_MAGNITUDE ** (BRIGHTEST_MADE_UP - faintest)
  const [low, high] = viewBand(latitude)
  const count = Math.round(MADE_UP_STARS * STARS_PER_MAGNITUDE ** depth)
  for (let made = 0; made < count; made++) {
    if (made % STARS_A_STEP === STARS_A_STEP - 1) yield
    const magnitude = faintest + Math.log(spread + (1 - spread) * random()) / Math.log(STARS_PER_MAGNITUDE)
    const index = 1.5 * random() ** 1.6 - 0.2
    const a = random()
    const b = random()
    const c = random()
    let x: number, y: number, z: number
    if (random() < faintness(magnitude)) {
      const g = crowding.pick(a, b, c)
      z = g[0] * centre[2] + g[1] * along[2] + g[2] * pole[2]
      if (z < low || z > high) continue
      x = g[0] * centre[0] + g[1] * along[0] + g[2] * pole[0]
      y = g[0] * centre[1] + g[1] * along[1] + g[2] * pole[1]
    } else {
      z = 2 * a - 1
      if (z < low || z > high) continue
      const ring = Math.sqrt(1 - z * z)
      x = ring * Math.cos(2 * Math.PI * b)
      y = ring * Math.sin(2 * Math.PI * b)
    }
    // The band is crossesView's own, but for rounding right at its edges.
    if (z - low > 1e-6 && high - z > 1e-6) add(x, y, z, magnitude, index)
    else if (crossesView(z, latitude)) add(x, y, z, magnitude, index)
  }
  return inOrder(values)
}

/**
 * Stars, as `STAR_STRIDE` values each, in order of right ascension: sorted as numbers
 * that hold the right ascension above the star's place in the list, which is far
 * quicker than sorting with a comparison.
 */
function inOrder(values: number[]): Float32Array<ArrayBuffer> {
  const count = values.length / STAR_STRIDE
  const keys = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const turn = ascension(values[i * STAR_STRIDE], values[i * STAR_STRIDE + 1]) / (2 * Math.PI)
    keys[i] = Math.floor(turn * 2 ** 30) * 2 ** 21 + i
  }
  keys.sort()
  const field = new Float32Array(values.length)
  for (let to = 0; to < count; to++) {
    const from = keys[to] % 2 ** 21
    for (let k = 0; k < STAR_STRIDE; k++) field[to * STAR_STRIDE + k] = values[from * STAR_STRIDE + k]
  }
  return field
}

/** A star's right ascension in radians, 0–2π, from where it lies. */
function ascension(x: number, y: number) {
  const angle = Math.atan2(y, x)
  return angle < 0 ? angle + 2 * Math.PI : angle
}

/** The right ascension of each star of a starField, in order. */
export function starAscensions(field: Float32Array): Float64Array<ArrayBuffer> {
  const out = new Float64Array(field.length / STAR_STRIDE)
  for (let i = 0; i < out.length; i++) out[i] = ascension(field[i * STAR_STRIDE], field[i * STAR_STRIDE + 1])
  return out
}

/** A value as a share of a range, 0–1. */
const share = (value: number, [low, high]: [number, number]) => saturate((value - low) / (high - low))

/**
 * A starField as the GPU takes it, `PACKED_STRIDE` bytes a star: right ascension and
 * declination, each as a share of their whole range in 16 bits, then magnitude and
 * colour index in a byte each.
 */
export function packStars(field: Float32Array): ArrayBuffer {
  const count = field.length / STAR_STRIDE
  const packed = new ArrayBuffer(count * PACKED_STRIDE)
  const words = new Uint16Array(packed)
  const bytes = new Uint8Array(packed)
  for (let i = 0; i < count; i++) {
    const [x, y, z, magnitude, index] = field.subarray(i * STAR_STRIDE, (i + 1) * STAR_STRIDE)
    words[i * 4] = Math.round((ascension(x, y) / (2 * Math.PI)) * 65535)
    words[i * 4 + 1] = Math.round((Math.asin(Math.max(-1, Math.min(1, z))) / Math.PI + 0.5) * 65535)
    bytes[i * 8 + 4] = Math.round(share(magnitude, MAGNITUDE_RANGE) * 255)
    bytes[i * 8 + 5] = Math.round(share(index, INDEX_RANGE) * 255)
  }
  return packed
}

/** A packed star's right ascension and declination in radians, magnitude and colour index, as the GPU reads them. */
export function unpackStar(packed: ArrayBuffer, i: number): [number, number, number, number] {
  const words = new Uint16Array(packed, i * PACKED_STRIDE, 2)
  const bytes = new Uint8Array(packed, i * PACKED_STRIDE + 4, 2)
  const at = ([low, high]: [number, number], byte: number) => low + ((high - low) * byte) / 255
  return [
    (words[0] / 65535) * 2 * Math.PI,
    (words[1] / 65535 - 0.5) * Math.PI,
    at(MAGNITUDE_RANGE, bytes[0]),
    at(INDEX_RANGE, bytes[1]),
  ]
}
