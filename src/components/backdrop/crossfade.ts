import { easeInOut, readCssTime, steadyClock } from '../../shared'

/**
 * Starts the clock for a new image crossfading in, over a Fade's background
 * duration (--prism-fade-background-duration, src/components/fade) as
 * `computed` has it. Returns how far the fade has come, 0–1, eased in and out
 * as the Fade's is; null where it would be instant, at a duration of 0.
 *
 * It is read once a frame, from 0 at the first read (the frame that puts the
 * new image up), on a steadyClock: setting the image up and what follows it
 * (its colours read for every element's text, the page re-rendering) can stall
 * a frame or two, and a fade timed by the wall clock would lose them, jumping
 * most of the way in on the first frame seen.
 */
export function startCrossfade(computed: CSSStyleDeclaration): (() => number) | null {
  const duration = readCssTime(computed.getPropertyValue('--prism-fade-background-duration'))
  if (duration <= 0) return null
  const elapsed = steadyClock()
  return () => easeInOut(Math.min(1, elapsed() / duration))
}
