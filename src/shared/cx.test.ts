import { describe, expect, it } from 'vitest'
import { cx } from './cx'

describe('cx', () => {
  it('joins the parts that are set, in order', () => {
    expect(cx('a', false, 'b', null, undefined, '', 'c')).toBe('a b c')
  })

  it('is empty when none is set', () => {
    expect(cx(false, undefined)).toBe('')
  })
})
