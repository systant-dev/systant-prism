export interface Point {
  x: number
  y: number
}

/**
 * A viewport point relative to the element's padding box, in the element's own
 * CSS px. A scale on the element (a button's press) shrinks its box on screen,
 * `rect`, but not its own pixels, so the point is scaled back up to match.
 */
export function localPoint(el: HTMLElement, rect: DOMRect, x: number, y: number): Point {
  const scaleX = el.offsetWidth ? rect.width / el.offsetWidth : 1
  const scaleY = el.offsetHeight ? rect.height / el.offsetHeight : 1
  return { x: (x - rect.left) / scaleX - el.clientLeft, y: (y - rect.top) / scaleY - el.clientTop }
}
