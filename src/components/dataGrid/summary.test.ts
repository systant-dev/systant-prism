import { describe, expect, it } from 'vitest'
import { summarize } from './summary'

const rows = (...values: unknown[]) => values.map((n) => ({ n }))

describe('summarize', () => {
  it('totals, without the noise of adding floats', () => {
    expect(summarize(rows(0.1, 0.2), 'n', 'total')).toBe(0.3)
    expect(summarize(rows(49.99, 19.5, 32, 8.75), 'n', 'total')).toBe(110.24)
    expect(summarize(rows(1, 2, 3), 'n', 'total')).toBe(6)
  })

  it('finds the least and the most', () => {
    expect(summarize(rows(4, -2.5, 9), 'n', 'min')).toBe(-2.5)
    expect(summarize(rows(4, -2.5, 9), 'n', 'max')).toBe(9)
  })

  it('averages to two places more than the most precise value', () => {
    expect(summarize(rows(1, 2, 2), 'n', 'average')).toBe(1.67)
    expect(summarize(rows(1.5, 2.25), 'n', 'average')).toBe(1.875)
    expect(summarize(rows(2, 4), 'n', 'average')).toBe(3)
  })

  it('counts numbers written as text, and leaves out empty values and anything else', () => {
    const mixed = rows(10, '5', null, undefined, '', 'n/a', true, { n: 1 }, Number.NaN)
    expect(summarize(mixed, 'n', 'total')).toBe(15)
    expect(summarize(mixed, 'n', 'average')).toBe(7.5)
  })

  it('totals nothing as 0, and has no least, most or average of nothing', () => {
    expect(summarize([], 'n', 'total')).toBe(0)
    expect(summarize(rows(null), 'n', 'min')).toBeNull()
    expect(summarize([], 'n', 'max')).toBeNull()
    expect(summarize([], 'n', 'average')).toBeNull()
  })

  it('keeps the places of tiny numbers written with an exponent', () => {
    expect(summarize(rows(1e-7, 2e-7), 'n', 'total')).toBe(3e-7)
  })

  it('summarises a hundred thousand rows without overflowing the stack', () => {
    const many = Array.from({ length: 100_000 }, (_, i) => ({ n: i }))
    expect(summarize(many, 'n', 'max')).toBe(99_999)
    expect(summarize(many, 'n', 'total')).toBe(4_999_950_000)
  })
})
