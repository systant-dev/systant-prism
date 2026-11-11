import { clamp } from '../../shared'

export type PopupSide = 'top' | 'bottom' | 'left' | 'right'
export type PopupAlign = 'start' | 'center' | 'end'

export interface PopupRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PopupSize {
  width: number
  height: number
}

export interface PlacePopupOptions {
  side: PopupSide
  align: PopupAlign
  /** The gap between the anchor and the popup. */
  offset: number
  /** Moves it along the anchor from where `align` puts it, in from that edge: below 0, out past it. */
  alignOffset?: number
  /** The least gap between the popup and the edge of the viewport. */
  margin: number
}

/** The computed styles that scale an element, as getComputedStyle gives them. */
export type ScaleStyle = Pick<CSSStyleDeclaration, 'scale' | 'transform' | 'transformOrigin'>

/**
 * An element's drawn box (its getBoundingClientRect) without its own scale:
 * the `scale` property and the scale in `transform`, both about its
 * transform-origin. A popup is placed from this, so one opened while a press
 * shrinks its anchor (as a Button's does) lands where it will stay, rather
 * than a pixel or so off until it next re-places. Anything else the element is
 * transformed by, and every ancestor's transform, is kept.
 */
export function unscaledRect(rect: PopupRect, style: ScaleStyle): PopupRect {
  const [x = 1, y = x] = style.scale && style.scale !== 'none' ? style.scale.split(' ').map(Number) : []
  // matrix(a, b, c, d, e, f): its columns' lengths are the scale along each axis.
  const matrix = /^matrix\(([^)]+)\)$/
    .exec(style.transform ?? '')?.[1]
    .split(',')
    .map(Number)
  const sx = x * (matrix ? Math.hypot(matrix[0], matrix[1]) : 1)
  const sy = y * (matrix ? Math.hypot(matrix[2], matrix[3]) : 1)
  if (!(sx > 0 && sy > 0) || (sx === 1 && sy === 1)) return rect

  // A point at the origin stays put; every other point is drawn s times as far from it.
  const [ox = 0, oy = 0] = (style.transformOrigin ?? '').split(' ').map(parseFloat)
  return {
    left: rect.left - ox * (1 - sx),
    top: rect.top - oy * (1 - sy),
    width: rect.width / sx,
    height: rect.height / sy,
  }
}

/**
 * Where a popup of `size` goes beside `anchor`, as its top-left corner, all in
 * viewport px, and the side of the anchor it went on. It goes on `side` of the
 * anchor, `offset` away, unless it would overflow there and the opposite side has
 * more room. Along the anchor it lines
 * up by `align` (start: their left or top edges together), switching start for
 * end, or end for start, where only that fits. It is then kept `margin` inside
 * the viewport, which may overlap the anchor where nothing else fits.
 *
 * An anchor of zero size is a point: below it, aligned to start, puts the
 * popup's corner on the point, flipping up or to the left near the viewport's
 * edges, as a context menu does.
 */
export function placePopup(
  anchor: PopupRect,
  size: PopupSize,
  viewport: PopupSize,
  { side, align, offset, alignOffset = 0, margin }: PlacePopupOptions,
): { x: number; y: number; side: PopupSide } {
  const vertical = side === 'top' || side === 'bottom'

  // Across the side: before the anchor (above or to its left) or after it.
  const start = vertical ? anchor.top : anchor.left
  const end = start + (vertical ? anchor.height : anchor.width)
  const length = vertical ? size.height : size.width
  const room = vertical ? viewport.height : viewport.width
  const roomBefore = start - offset - margin
  const roomAfter = room - margin - end - offset
  let after = side === 'bottom' || side === 'right'
  if (after ? length > roomAfter && roomBefore > roomAfter : length > roomBefore && roomAfter > roomBefore) {
    after = !after
  }
  const main = clamp(after ? end + offset : start - offset - length, margin, room - margin - length)

  // Along the anchor.
  const crossStart = vertical ? anchor.left : anchor.top
  const crossLength = vertical ? anchor.width : anchor.height
  const span = vertical ? size.width : size.height
  const crossRoom = vertical ? viewport.width : viewport.height
  const at = {
    start: crossStart + alignOffset,
    center: crossStart + (crossLength - span) / 2,
    end: crossStart + crossLength - span - alignOffset,
  }
  const fits = (position: number) => position >= margin && position + span <= crossRoom - margin
  let cross = at[align]
  if (!fits(cross) && align !== 'center') {
    const flipped = at[align === 'start' ? 'end' : 'start']
    if (fits(flipped)) cross = flipped
  }
  cross = clamp(cross, margin, crossRoom - margin - span)

  const placed: PopupSide = vertical ? (after ? 'bottom' : 'top') : after ? 'right' : 'left'
  return vertical ? { x: cross, y: main, side: placed } : { x: main, y: cross, side: placed }
}
