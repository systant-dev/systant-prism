import type { Point } from '../../shared'

export type Triangle = readonly [Point, Point, Point]

/** How far behind the pointer the triangle starts, in px, so a straight line to the submenu stays inside it. */
const SLACK = 4

/**
 * The triangle the pointer crosses going from `from`, where it left the row that
 * opened a submenu, to the submenu's nearer side. Heading for a submenu that lies
 * a little above or below it, the pointer passes over the rows next door, which
 * are not to take over while it is in here.
 */
export function safeArea(from: Point, submenu: DOMRectReadOnly): Triangle {
  const toTheRight = from.x <= (submenu.left + submenu.right) / 2
  const x = toTheRight ? submenu.left : submenu.right
  return [
    { x: from.x + (toTheRight ? -SLACK : SLACK), y: from.y },
    { x, y: submenu.top },
    { x, y: submenu.bottom },
  ]
}

// Which side of the line from a to b the point lies on, by the sign.
function side(point: Point, a: Point, b: Point) {
  return (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y)
}

/** Whether `point` lies in `triangle`, or on its edge. */
export function inTriangle(point: Point, [a, b, c]: Triangle) {
  const sides = [side(point, a, b), side(point, b, c), side(point, c, a)]
  return !(sides.some((s) => s < 0) && sides.some((s) => s > 0))
}
