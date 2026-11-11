import { describe, expect, it } from 'vitest'
import { entryForKey, firstEnabled } from './navigation'
import { axes } from './orientation'

const items = [
  { value: 'a', label: 'A', disabled: true },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E', disabled: true },
]

const across = axes.horizontal.steps(false)

function key(at: number, k: string, steps = across) {
  return entryForKey(items, at, k, steps)?.value
}

describe('entryForKey', () => {
  it('steps along the list, skipping disabled entries', () => {
    expect(key(1, 'ArrowRight')).toBe('d')
    expect(key(3, 'ArrowLeft')).toBe('b')
  })

  it('stays put at either end, still taking the key', () => {
    expect(key(3, 'ArrowRight')).toBe('d')
    expect(key(1, 'ArrowLeft')).toBe('b')
  })

  it('starts from either end while nothing has focus', () => {
    expect(key(-1, 'ArrowRight')).toBe('b')
    expect(key(-1, 'ArrowLeft')).toBe('d')
  })

  it('goes to the first and last enabled entries with Home and End', () => {
    expect(key(3, 'Home')).toBe('b')
    expect(key(1, 'End')).toBe('d')
  })

  it('picks the focused entry with Enter or Space, but only one with focus', () => {
    expect(key(3, 'Enter')).toBe('d')
    expect(key(3, ' ')).toBe('d')
    expect(key(-1, 'Enter')).toBeUndefined()
  })

  it('leaves other keys, and the cross axis’s arrows, alone', () => {
    expect(key(1, 'a')).toBeUndefined()
    expect(key(1, 'ArrowDown')).toBeUndefined()
    expect(key(1, 'ArrowDown', axes.vertical.steps(false))).toBe('d')
  })

  it('swaps the arrows across a list that runs right to left', () => {
    expect(key(1, 'ArrowLeft', axes.horizontal.steps(true))).toBe('d')
    // Down a list, the text direction changes nothing.
    expect(axes.vertical.steps(true)).toEqual(axes.vertical.steps(false))
  })

  it('takes no key with nothing to pick', () => {
    expect(entryForKey([items[0]], 0, 'Home', across)).toBeUndefined()
    expect(firstEnabled([items[0]])).toBeUndefined()
    expect(firstEnabled(items)?.value).toBe('b')
  })
})
