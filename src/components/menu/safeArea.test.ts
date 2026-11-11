import { describe, expect, it } from 'vitest'
import { inTriangle, safeArea } from './safeArea'

const submenu = DOMRect.fromRect({ x: 200, y: 100, width: 100, height: 200 })

describe('safeArea', () => {
  it('spreads from behind the pointer to the near side of a submenu on its right', () => {
    expect(safeArea({ x: 180, y: 150 }, submenu)).toEqual([
      { x: 176, y: 150 },
      { x: 200, y: 100 },
      { x: 200, y: 300 },
    ])
  })

  it('spreads to the other side of a submenu on its left', () => {
    expect(safeArea({ x: 320, y: 150 }, submenu)).toEqual([
      { x: 324, y: 150 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
    ])
  })
})

describe('inTriangle', () => {
  const area = safeArea({ x: 180, y: 150 }, submenu)

  it('holds what lies on the way to the submenu', () => {
    expect(inTriangle({ x: 180, y: 150 }, area)).toBe(true)
    expect(inTriangle({ x: 195, y: 120 }, area)).toBe(true)
    expect(inTriangle({ x: 195, y: 260 }, area)).toBe(true)
  })

  it('holds its corners and edges', () => {
    expect(inTriangle({ x: 200, y: 100 }, area)).toBe(true)
    expect(inTriangle({ x: 200, y: 200 }, area)).toBe(true)
  })

  it('leaves out what lies away from it', () => {
    expect(inTriangle({ x: 170, y: 150 }, area)).toBe(false)
    expect(inTriangle({ x: 180, y: 120 }, area)).toBe(false)
    expect(inTriangle({ x: 201, y: 200 }, area)).toBe(false)
  })
})
