/** The prefers-reduced-motion query, to read or to watch; null where it can't be asked. */
export function reducedMotionQuery(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
}

/** Whether the user asks for less motion (prefers-reduced-motion); false where that can't be asked. */
export function reducedMotion() {
  return reducedMotionQuery()?.matches ?? false
}
