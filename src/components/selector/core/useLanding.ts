import { useLayoutEffect, useState, type RefObject } from 'react'
import { runningTransition } from '../../../shared'

export interface Landing<T> {
  /** The entry the pill is gliding to, pressed, if any. */
  landing: T | null
  /** Keeps the pill pressed until it lands on `value`, once it is selected. */
  land: (value: T) => void
}

const TRANSLATE = new Set(['translate'])

/**
 * Keeps the glass pill pressed until it lands on an entry selected by a press.
 *
 * A press selects as it begins, so the pill glides over sunk. A quick click
 * lets go long before the glide ends, and the pill would settle back in
 * mid-flight and arrive at rest. Held pressed until it lands, it arrives sunk
 * and settles back there, however short the click.
 *
 * It lands when its translate transition ends, found by the pill's
 * getAnimations() (which brings its style up to date first, so the transition
 * the new place starts is there to be found). With no glide to wait for (the
 * pill appeared in place, prefers-reduced-motion, or a browser without the
 * Web Animations API) it has already landed. It is let go too if the value
 * doesn't follow the press (the selector is controlled and the change was
 * refused), or another entry is landed on first.
 */
export function useLanding<T>(pillRef: RefObject<HTMLElement | null>, target: T | null): Landing<T> {
  const [landing, setLanding] = useState<T | null>(null)

  // After the pill is placed, so its glide has started.
  useLayoutEffect(() => {
    if (landing === null) return
    const pill = pillRef.current
    const glide = landing === target && pill ? runningTransition(pill, TRANSLATE) : undefined
    if (!glide) {
      setLanding(null)
      return
    }
    let waiting = true
    // A glide cut short (retargeted, or the pill hidden) rejects, and lands too.
    const landed = () => {
      if (waiting) setLanding(null)
    }
    glide.finished.then(landed, landed)
    return () => {
      waiting = false
    }
  }, [landing, target, pillRef])

  return { landing, land: setLanding }
}
