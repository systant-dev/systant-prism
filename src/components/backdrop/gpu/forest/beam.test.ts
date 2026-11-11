import { describe, expect, it } from 'vitest'
import {
  CROWN_FROM,
  CROWN_WEIGHT,
  FIRST_SHAPE,
  polynomial,
  SECOND_SHAPE,
  SECOND_SHAPE_RATE,
  TAPER,
  SHAPE_HEIGHTS,
  shapeTable,
  tipBend,
} from './beam'

const POWERS = [2, 3, 4, 5, 6, 7]

/**
 * The first two bending shapes of a beam fixed at one end, from the physics, by Rayleigh
 * and Ritz's method: its stiffness goes as the fourth power of its width, and its mass
 * as the second, with a crown on top of that.
 */
function solve(tip: number, crown: number, crownFrom: number) {
  const steps = 4000
  const n = POWERS.length
  const grid = () => Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const stiff = grid()
  const heavy = grid()
  let stem = 0
  for (let s = 0; s < steps; s++) stem += (1 - (1 - tip) * ((s + 0.5) / steps)) ** 2 / steps
  for (let s = 0; s < steps; s++) {
    const x = (s + 0.5) / steps
    const width = 1 - (1 - tip) * x
    const mass = width ** 2 + (x >= crownFrom ? (crown * stem) / (1 - crownFrom) : 0)
    for (let i = 0; i < n; i++) {
      const a = POWERS[i]
      for (let j = 0; j < n; j++) {
        const b = POWERS[j]
        stiff[i][j] += (width ** 4 * a * (a - 1) * x ** (a - 2) * b * (b - 1) * x ** (b - 2)) / steps
        heavy[i][j] += (mass * x ** a * x ** b) / steps
      }
    }
  }

  // Cholesky takes it to an ordinary symmetric problem, which Jacobi's rotations solve.
  const lower = grid()
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = heavy[i][j]
      for (let k = 0; k < j; k++) sum -= lower[i][k] * lower[j][k]
      lower[i][j] = i === j ? Math.sqrt(sum) : sum / lower[j][j]
    }
  }
  const down = (b: number[]) => {
    const y = new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) {
      let sum = b[i]
      for (let k = 0; k < i; k++) sum -= lower[i][k] * y[k]
      y[i] = sum / lower[i][i]
    }
    return y
  }
  const up = (b: number[]) => {
    const y = new Array<number>(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i]
      for (let k = i + 1; k < n; k++) sum -= lower[k][i] * y[k]
      y[i] = sum / lower[i][i]
    }
    return y
  }
  const columns = stiff.map((_, j) => down(stiff.map((row) => row[j])))
  const c = Array.from({ length: n }, (_, i) => down(columns.map((column) => column[i])))
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)))
  const turn = (m: number[][], p: number, q: number, cos: number, sin: number, rows: boolean) => {
    for (let k = 0; k < n; k++) {
      const [a, b] = rows ? [m[p][k], m[q][k]] : [m[k][p], m[k][q]]
      const [x, y] = [cos * a - sin * b, sin * a + cos * b]
      if (rows) [m[p][k], m[q][k]] = [x, y]
      else [m[k][p], m[k][q]] = [x, y]
    }
  }
  for (let sweep = 0; sweep < 200; sweep++) {
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(c[p][q]) < 1e-14 * Math.sqrt(Math.abs(c[p][p] * c[q][q]))) continue
        const theta = (c[q][q] - c[p][p]) / (2 * c[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const cos = 1 / Math.sqrt(t * t + 1)
        const sin = t * cos
        turn(c, p, q, cos, sin, false)
        turn(c, p, q, cos, sin, true)
        turn(v, p, q, cos, sin, false)
      }
    }
  }
  const order = [...Array(n).keys()].sort((a, b) => c[a][a] - c[b][b])
  const shapes = order.slice(0, 2).map((mode) => {
    const terms = up(v.map((row) => row[mode]))
    const atTip = terms.reduce((a, b) => a + b, 0)
    return terms.map((term) => term / atTip)
  })
  return { rate: Math.sqrt(c[order[1]][order[1]] / c[order[0]][order[0]]), shapes }
}

describe('the solver', () => {
  it('gives the textbook answer for a beam of even thickness, so that its other answers can be trusted', () => {
    const { rate, shapes } = solve(1, 0, 0.5)
    expect(rate).toBeCloseTo(6.267, 2)
    expect(polynomial(shapes[0], 0.5)).toBeCloseTo(0.3395, 2)
  })
})

describe('the shapes of a tree', () => {
  const tree = solve(TAPER, CROWN_WEIGHT, CROWN_FROM)

  it('are what the physics gives for a tapered trunk carrying a crown', () => {
    expect(tree.rate).toBeCloseTo(SECOND_SHAPE_RATE, 2)
    for (let i = 0; i <= 100; i++) {
      const along = i / 100
      expect(polynomial(FIRST_SHAPE, along)).toBeCloseTo(polynomial(tree.shapes[0], along), 3)
      expect(polynomial(SECOND_SHAPE, along)).toBeCloseTo(polynomial(tree.shapes[1], along), 3)
    }
  })

  it('are 1 at the top and 0 at the ground, with no slope there, as a trunk fixed in the ground must have', () => {
    for (const shape of [FIRST_SHAPE, SECOND_SHAPE]) {
      expect(polynomial(shape, 1)).toBeCloseTo(1, 3)
      expect(polynomial(shape, 0)).toBeCloseTo(0, 9)
      expect(Math.abs(polynomial(shape, 0.001))).toBeLessThan(1e-4)
    }
  })

  it('move the top far more than the middle', () => {
    expect(polynomial(FIRST_SHAPE, 0.5)).toBeLessThan(0.16)
    expect(polynomial(FIRST_SHAPE, 0.75)).toBeLessThan(0.45)
    expect(polynomial(FIRST_SHAPE, 0.9)).toBeGreaterThan(0.7)
  })

  it('only ever get further from the ground in the first shape', () => {
    for (let i = 1; i <= 100; i++) {
      expect(polynomial(FIRST_SHAPE, i / 100)).toBeGreaterThan(polynomial(FIRST_SHAPE, (i - 1) / 100))
    }
  })

  it('whip the top against the rest in the second shape, about a still point near the top', () => {
    expect(polynomial(SECOND_SHAPE, 0.75)).toBeLessThan(-0.3)
    const still = Array.from({ length: 100 }, (_, i) => i / 100).find(
      (along) => along > 0.3 && polynomial(SECOND_SHAPE, along) > 0,
    )
    expect(still).toBeGreaterThan(0.85)
    expect(still).toBeLessThan(0.95)
  })

  it('go at a rate between what real trees are measured at', () => {
    expect(SECOND_SHAPE_RATE).toBeGreaterThan(2.5)
    expect(SECOND_SHAPE_RATE).toBeLessThan(4.5)
  })
})

describe('shapeTable', () => {
  it('holds both shapes at every height a part can be at', () => {
    const table = shapeTable()
    expect(table.length).toBe(SHAPE_HEIGHTS * 2)
    expect(table[0]).toBeCloseTo(0, 9)
    expect(table[1]).toBeCloseTo(0, 9)
    expect(table[(SHAPE_HEIGHTS - 1) * 2]).toBeCloseTo(1, 4)
    expect(table[(SHAPE_HEIGHTS - 1) * 2 + 1]).toBeCloseTo(1, 4)
    const height = 170
    expect(table[height * 2]).toBeCloseTo(polynomial(FIRST_SHAPE, height / 255), 5)
    expect(table[height * 2 + 1]).toBeCloseTo(polynomial(SECOND_SHAPE, height / 255), 5)
  })
})

describe('tipBend', () => {
  it('leaves the root still and takes the tip furthest', () => {
    expect(tipBend(0)).toBe(0)
    expect(tipBend(1)).toBe(1)
    expect(tipBend(0.5)).toBeCloseTo(0.3125)
  })
})
