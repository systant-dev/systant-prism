import { describe, expect, it } from 'vitest'
import { stack, visibleRange } from './virtualWindow'

describe('stack', () => {
  it('gives where each item starts, and where the last ends', () => {
    expect(stack([10, 20, 5])).toEqual([0, 10, 30, 35])
    expect(stack([])).toEqual([0])
  })
})

describe('visibleRange', () => {
  // 1000 rows of 40px, with a 200px detail under row 2.
  const offsets = stack(Array.from({ length: 1000 }, (_, i) => (i === 2 ? 200 : 40)))

  it('takes the items in view and no more with no overscan', () => {
    expect(visibleRange(offsets, 0, 100, 0)).toEqual({ start: 0, end: 3 })
    // Row 3 runs from 280, so a view from 300 starts in it; row 5 starts at 360, inside it.
    expect(visibleRange(offsets, 300, 80, 0)).toEqual({ start: 3, end: 6 })
  })

  it('adds the overscan on each side, inside the list', () => {
    expect(visibleRange(offsets, 0, 100, 4)).toEqual({ start: 0, end: 7 })
    expect(visibleRange(offsets, offsets.at(-1)! - 100, 100, 4)).toEqual({ start: 993, end: 1000 })
  })

  it('draws a few dozen of a million rows', () => {
    const million = stack(new Array<number>(1_000_000).fill(44))
    const { start, end } = visibleRange(million, 44 * 500_000, 600, 4)
    expect(start).toBe(499_996)
    expect(end - start).toBeLessThan(30)
  })

  it('is empty with no items', () => {
    expect(visibleRange([0], 0, 500, 4)).toEqual({ start: 0, end: 0 })
  })
})
