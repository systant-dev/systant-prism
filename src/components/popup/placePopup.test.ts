import { describe, expect, it } from 'vitest'
import { placePopup, unscaledRect, type PlacePopupOptions, type ScaleStyle } from './placePopup'

const viewport = { width: 1000, height: 800 }
const size = { width: 200, height: 100 }
const below: PlacePopupOptions = { side: 'bottom', align: 'start', offset: 8, margin: 8 }

describe('placePopup', () => {
  it('opens on its side of the anchor, lined up with its start', () => {
    const anchor = { left: 100, top: 100, width: 80, height: 30 }
    expect(placePopup(anchor, size, viewport, below)).toEqual({ x: 100, y: 138, side: 'bottom' })
    expect(placePopup(anchor, size, viewport, { ...below, side: 'right' })).toEqual({ x: 188, y: 100, side: 'right' })
  })

  it('lines up by its centre or end', () => {
    const anchor = { left: 400, top: 100, width: 100, height: 30 }
    expect(placePopup(anchor, size, viewport, { ...below, align: 'center' }).x).toBe(350)
    expect(placePopup(anchor, size, viewport, { ...below, align: 'end' }).x).toBe(300)
  })

  it('flips to the other side where it would overflow and there is more room there', () => {
    const anchor = { left: 100, top: 700, width: 80, height: 30 }
    expect(placePopup(anchor, size, viewport, below)).toMatchObject({ y: 592, side: 'top' })
    const atRight = { left: 900, top: 100, width: 40, height: 30 }
    expect(placePopup(atRight, size, viewport, { ...below, side: 'right' })).toMatchObject({ x: 692, side: 'left' })
  })

  it('stays on its side where the other has less room', () => {
    // 62px below, 42px above: it stays below, kept inside the viewport.
    const anchor = { left: 100, top: 50, width: 80, height: 680 }
    expect(placePopup(anchor, size, viewport, below).y).toBe(692)
  })

  it('switches start for end along the anchor where only that fits', () => {
    const anchor = { left: 850, top: 100, width: 100, height: 30 }
    expect(placePopup(anchor, size, viewport, below).x).toBe(750)
    const nearLeft = { left: 50, top: 100, width: 100, height: 30 }
    expect(placePopup(nearLeft, size, viewport, { ...below, align: 'end' }).x).toBe(50)
  })

  it('keeps inside the viewport by the margin where neither alignment fits', () => {
    const anchor = { left: 900, top: 100, width: 20, height: 30 }
    const wide = { width: 950, height: 100 }
    expect(placePopup(anchor, wide, viewport, below).x).toBe(42)
    expect(placePopup(anchor, wide, viewport, { ...below, align: 'center' }).x).toBe(42)
  })

  it('puts its corner on a point, flipping up and to the left near the far edges', () => {
    const at = (left: number, top: number) =>
      placePopup({ left, top, width: 0, height: 0 }, size, viewport, { ...below, offset: 0 })
    expect(at(300, 200)).toEqual({ x: 300, y: 200, side: 'bottom' })
    expect(at(900, 750)).toEqual({ x: 700, y: 650, side: 'top' })
  })

  it('keeps a popup bigger than the viewport at its top-left margin', () => {
    const anchor = { left: 100, top: 100, width: 80, height: 30 }
    expect(placePopup(anchor, { width: 1200, height: 900 }, viewport, below)).toEqual({ x: 8, y: 8, side: 'bottom' })
  })
})

describe('unscaledRect', () => {
  // Laid out at (100, 100), 80 × 30, scaled about its centre.
  const style = (scale: string, transform = 'none'): ScaleStyle => ({ scale, transform, transformOrigin: '40px 15px' })

  it('leaves an unscaled box as it is', () => {
    const rect = { left: 100, top: 100, width: 80, height: 30 }
    expect(unscaledRect(rect, style('none'))).toBe(rect)
  })

  it('undoes the scale property, as a press shrinks it', () => {
    const drawn = { left: 102, top: 100.75, width: 76, height: 28.5 }
    expect(unscaledRect(drawn, style('0.95'))).toEqual({ left: 100, top: 100, width: 80, height: 30 })
  })

  it('undoes a scale in transform, with one for each axis', () => {
    const drawn = { left: 120, top: 103, width: 40, height: 24 }
    const rect = unscaledRect(drawn, style('1', 'matrix(0.5, 0, 0, 0.8, 0, 0)'))
    expect(rect.left).toBeCloseTo(100)
    expect(rect.top).toBeCloseTo(100)
    expect(rect.width).toBeCloseTo(80)
    expect(rect.height).toBeCloseTo(30)
  })

  it('ignores a scale of zero, which it can’t undo', () => {
    const drawn = { left: 140, top: 115, width: 0, height: 0 }
    expect(unscaledRect(drawn, style('0'))).toBe(drawn)
  })

  it('moves along the anchor by alignOffset, in from the edge it lines up with', () => {
    const options = { side: 'right', align: 'start', offset: 0, alignOffset: -4, margin: 8 } as const
    const anchor = { left: 100, top: 300, width: 80, height: 30 }

    expect(placePopup(anchor, size, viewport, options).y).toBe(296)
    // Its bottom on the anchor's, and past it the same way.
    expect(placePopup(anchor, size, viewport, { ...options, align: 'end' }).y).toBe(234)
    expect(placePopup(anchor, size, { width: 1000, height: 400 }, options).y).toBe(234)
  })
})
