import { describe, expect, it } from 'vitest'
import { readCssNumber } from './readCssNumber'

function computedWith(value: string) {
  return { getPropertyValue: () => value } as unknown as CSSStyleDeclaration
}

describe('readCssNumber', () => {
  it('reads only the number of a length no @property has computed to px', () => {
    expect(readCssNumber(computedWith('1rem'), '--x', 0)).toBe(1)
  })

  it.each([
    ['16px', 16],
    ['0.4', 0.4],
    ['20%', 20],
    ['-3.5px', -3.5],
    [' 12px', 12],
  ])('reads %j as %s', (value, expected) => {
    expect(readCssNumber(computedWith(value), '--x', 99)).toBe(expected)
  })

  it.each(['', 'auto', 'none'])('falls back for %j', (value) => {
    expect(readCssNumber(computedWith(value), '--x', 99)).toBe(99)
  })
})
