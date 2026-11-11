// A single page-wide light source that follows a mouse or pen. A touch has no
// hover, and a finger dragged across the page would only flash the edges it
// passed, so it is ignored, as the glare ignores it. Every registered element
// gets the light's position relative to its own padding box, in its own CSS
// pixels (localPoint.ts), so elements near the cursor light up even when they
// aren't hovered.
//
// Per frame, all boxes are read before any styles are written (avoiding a forced
// layout per element), and elements beyond the light's reach are skipped so they
// aren't restyled or repainted.
//
// The properties it writes are registered in light.styles.ts, which anything
// lit by it renders.
import { localPoint, type Point } from './localPoint'
import { readCssNumber } from './readCssNumber'

interface Tracked {
  reach: number
  inRange: boolean
}

interface Measured {
  el: HTMLElement
  tracked: Tracked
  rect: DOMRect
  /** The light, relative to the element's padding box. */
  light: Point
}

const DEFAULT_REACH = 280

/** The custom property a light's reach is read from, unless another is given. */
const REACH_PROPERTY = '--prism-card-highlight-size'

const elements = new Map<HTMLElement, Tracked>()

let x = 0
let y = 0
let lit = false
let frame = 0

function distanceToRect(rect: DOMRect) {
  const dx = Math.max(rect.left - x, 0, x - rect.right)
  const dy = Math.max(rect.top - y, 0, y - rect.bottom)
  return Math.hypot(dx, dy)
}

function update() {
  frame = 0

  const measured: Measured[] = []
  for (const [el, tracked] of elements) {
    const rect = el.getBoundingClientRect()
    measured.push({ el, tracked, rect, light: localPoint(el, rect, x, y) })
  }

  for (const { el, tracked, rect, light } of measured) {
    const inRange = distanceToRect(rect) < tracked.reach
    // One last write after leaving range moves the light fully off the element.
    if (!inRange && !tracked.inRange) continue
    tracked.inRange = inRange

    el.style.setProperty('--prism-light-x', `${light.x}px`)
    el.style.setProperty('--prism-light-y', `${light.y}px`)
    el.style.setProperty('--prism-light-on', lit ? '1' : '0')
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update)
}

function onMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  x = event.clientX
  y = event.clientY
  lit = true
  schedule()
}

function onLeave() {
  lit = false
  schedule()
}

function listen() {
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('scroll', schedule, { passive: true, capture: true })
  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('blur', onLeave)
  document.documentElement.addEventListener('pointerleave', onLeave)
}

function unlisten() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('scroll', schedule, { capture: true })
  window.removeEventListener('resize', schedule)
  window.removeEventListener('blur', onLeave)
  document.documentElement.removeEventListener('pointerleave', onLeave)
  cancelAnimationFrame(frame)
  frame = 0
}

/**
 * Reach, how far from the element the light still lights it, is read once when
 * tracking starts, from `reachProperty`: the radius of whatever the element
 * paints with the light, since beyond it nothing would show.
 */
export function trackLight(el: HTMLElement, reachProperty = REACH_PROPERTY) {
  const reach = readCssNumber(getComputedStyle(el), reachProperty, DEFAULT_REACH)
  elements.set(el, { reach, inRange: true })
  if (elements.size === 1) listen()
  schedule()

  return () => {
    elements.delete(el)
    if (elements.size === 0) unlisten()
  }
}
