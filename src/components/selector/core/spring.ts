/**
 * A critically damped spring along one dimension, in px: it heads for
 * `target` as fast as it can without overshooting, so it never wobbles.
 *
 * Unlike a transition, it keeps its speed when its target changes. A
 * transition retargeted mid-glide starts its curve over from where it is,
 * from standing to its fastest at once, so a pill following a pointer across
 * several entries surges at each one. A spring starts from rest smoothly and
 * carries its speed on into the next target.
 */
export interface Spring {
  value: number
  /** In px per second. */
  velocity: number
  target: number
}

// (1 + u)e^-u, how far a spring from rest still has to go after u radians,
// is 1% at u = 6.64.
const SETTLED = 6.64

/** The angular frequency that brings a spring within 1% of its target in `ms`. */
export function springFrequency(ms: number) {
  return SETTLED / (Math.max(ms, 1) / 1000)
}

/**
 * Steps the spring on by `dt` seconds at angular frequency `omega`, exactly
 * rather than by integration, so a long frame never makes it overshoot.
 */
export function stepSpring(spring: Spring, dt: number, omega: number) {
  const x = spring.value - spring.target
  const k = spring.velocity + omega * x
  const decay = Math.exp(-omega * dt)
  spring.value = spring.target + (x + k * dt) * decay
  spring.velocity = (spring.velocity - omega * k * dt) * decay
}

/** Close enough to its target, and slow enough, to put it there and stop. */
export function springAtRest(spring: Spring) {
  return Math.abs(spring.value - spring.target) < 0.25 && Math.abs(spring.velocity) < 10
}

/** Puts the spring at `target`, at rest. */
export function settleSpring(spring: Spring, target = spring.target) {
  spring.value = spring.target = target
  spring.velocity = 0
}
