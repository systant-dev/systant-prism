import { readCssTime, reducedMotion } from '../../../shared'
import type { Axis } from './orientation'
import { settleSpring, springAtRest, springFrequency, stepSpring, type Spring } from './spring'

/** Where a pill goes: its entry's offset and size along the axis, in px. */
export interface Place {
  offset: number
  size: number
}

// A pill on a spring: where it is along the axis and how long it is.
interface Motion {
  pill: HTMLElement
  offset: Spring
  size: Spring
  omega: number
}

/** The time a spring pill takes to its target, in ms, from the custom property `duration`; 300 where it has none. */
function springTime(pill: HTMLElement, duration: string) {
  const raw = getComputedStyle(pill).getPropertyValue(duration)
  return Number.isFinite(parseFloat(raw)) ? readCssTime(raw) : 300
}

/** Whether pills move on their springs at all: not with prefers-reduced-motion, nor where there are no frames. */
function springsMove() {
  return typeof requestAnimationFrame !== 'undefined' && !reducedMotion()
}

export interface SpringPills {
  /**
   * Sends pill `i` towards `to`, or with `jump` puts it there, taking about the
   * time the custom property `duration` gives to get there.
   */
  follow(i: number, pill: HTMLElement, to: Place, jump: boolean, duration: string): void
  /** Stops moving every pill. */
  stop(): void
}

/**
 * Moves pills towards their targets frame by frame on springs (spring.ts),
 * writing where each has got to as `${name}-${axis.offsetProperty}` and
 * `-${axis.sizeProperty}`, which its stylesheet puts ahead of the target.
 * They are removed once it is at rest, leaving it on its target.
 */
export function springPills(axis: Axis, name: string): SpringPills {
  const offsetProperty = `${name}-${axis.offsetProperty}`
  const sizeProperty = `${name}-${axis.sizeProperty}`
  // Each pill's motion, once placed, and the frame that moves them.
  const motions: (Motion | undefined)[] = []
  let frame: number | null = null
  let lastFrame: number | null = null

  function write({ pill, offset, size }: Motion) {
    pill.style.setProperty(offsetProperty, `${offset.value}px`)
    pill.style.setProperty(sizeProperty, `${size.value}px`)
  }

  function clear(pill: HTMLElement) {
    pill.style.removeProperty(offsetProperty)
    pill.style.removeProperty(sizeProperty)
  }

  // Moves every pill on by a frame, asking for another while any is moving.
  function step(now: number) {
    frame = null
    // The first frame steps a frame's length. The step is exact however long,
    // so a slow frame (a busy page, a tab in the background) keeps it on time.
    const dt = lastFrame === null ? 1 / 60 : Math.max(now - lastFrame, 0) / 1000
    lastFrame = now
    let moving = false
    for (const motion of motions) {
      if (!motion) continue
      const { offset, size, omega } = motion
      if (springAtRest(offset) && springAtRest(size)) continue
      stepSpring(offset, dt, omega)
      stepSpring(size, dt, omega)
      if (springAtRest(offset) && springAtRest(size)) {
        settleSpring(offset)
        settleSpring(size)
        clear(motion.pill)
        continue
      }
      moving = true
      write(motion)
    }
    if (moving) frame = requestAnimationFrame(step)
  }

  return {
    follow(i, pill, to, jump, duration) {
      const motion = motions[i]
      if (jump || !motion || !springsMove()) {
        motions[i] = {
          pill,
          offset: { value: to.offset, velocity: 0, target: to.offset },
          size: { value: to.size, velocity: 0, target: to.size },
          omega: motion?.omega ?? 0,
        }
        clear(pill)
        return
      }
      motion.pill = pill
      motion.offset.target = to.offset
      motion.size.target = to.size
      motion.omega = springFrequency(springTime(pill, duration))
      // At once, or until the first frame it would show on its new target.
      write(motion)
      if (frame === null) {
        lastFrame = null
        frame = requestAnimationFrame(step)
      }
    },

    stop() {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
    },
  }
}
