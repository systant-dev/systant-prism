// Pointer-following shared by the glare (src/effects/glare) and the inner sheen
// (src/effects/innerSheen): a light that glides after the pointer over an
// element.
import type { Point } from './localPoint'
import { reducedMotionQuery } from './reducedMotion'

/** Close enough to the pointer to stop gliding. */
const SETTLED_PX = 0.1

export interface GlideOptions {
  /** How quickly it closes on the pointer: about 95% of the way in 3× this. */
  glideMs: number
  /** Follow a touch too, which has no hover. */
  touch?: boolean
}

/**
 * Glides a point after the pointer while it moves over `el`, at most one
 * `draw` per frame. Each frame, `target` is handed the pointer in viewport px
 * and gives where the point should head for; `draw` is handed where it has got
 * to. It glides rather than jumping to each pointer event, which arrive
 * unevenly and often less often than frames, and keeps gliding frame by frame
 * until it arrives. The first position after the pointer enters is taken as
 * is, as is every one with prefers-reduced-motion.
 *
 * Scrolling moves the element under a still pointer, so scroll is followed
 * from the first move over the element until the pointer leaves: every element
 * listening all the time would cost a measure per element per scrolled frame.
 * Not from pointerenter, which never fires if the element appears under the
 * pointer. Leaving, the point stays where it was, and starts afresh on the next
 * entry. Returns a function that stops following.
 */
export function glideAfterPointer(
  el: HTMLElement,
  { glideMs, touch = true }: GlideOptions,
  target: (pointer: Point) => Point,
  draw: (at: Point) => void,
): () => void {
  const lessMotion = reducedMotionQuery()
  const pointer = { x: 0, y: 0 }
  let frame = 0
  let followingScroll = false
  // Where the point is drawn, and when it was last moved; null until the
  // pointer first moves over the element.
  let shown: { x: number; y: number; time: number } | null = null

  function update(time: number) {
    frame = 0
    const to = target(pointer)
    if (!shown || lessMotion?.matches) {
      shown = { ...to, time }
    } else {
      // Frame-rate independent: the same glide at 60Hz or 144Hz. A long gap
      // (the first frame after it came to rest) counts as one 60Hz frame.
      const elapsed = time - shown.time
      const step = 1 - Math.exp(-(elapsed > 0 && elapsed < 100 ? elapsed : 1000 / 60) / glideMs)
      shown.x += (to.x - shown.x) * step
      shown.y += (to.y - shown.y) * step
      shown.time = time
      if (Math.abs(to.x - shown.x) < SETTLED_PX && Math.abs(to.y - shown.y) < SETTLED_PX) {
        shown.x = to.x
        shown.y = to.y
      } else {
        frame = requestAnimationFrame(update)
      }
    }
    draw(shown)
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  function onMove(event: PointerEvent) {
    if (!touch && event.pointerType === 'touch') return
    pointer.x = event.clientX
    pointer.y = event.clientY
    if (!followingScroll) {
      followingScroll = true
      window.addEventListener('scroll', schedule, { passive: true, capture: true })
    }
    schedule()
  }

  function onLeave() {
    followingScroll = false
    window.removeEventListener('scroll', schedule, { capture: true })
    cancelAnimationFrame(frame)
    frame = 0
    shown = null
  }

  el.addEventListener('pointermove', onMove, { passive: true })
  el.addEventListener('pointerleave', onLeave)
  return () => {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerleave', onLeave)
    onLeave()
  }
}
