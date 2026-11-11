import { clamp } from './clamp'

/** The most a fade moves on between two frames, in ms: about a frame at 20fps. */
export const LONGEST_FADE_STEP = 50

/**
 * A clock for a fade drawn frame by frame: each read gives the ms it has run,
 * from 0 at the first read, moving on by at most `longestStep` (LONGEST_FADE_STEP) between reads.
 * A stall (filters rasterised, shaders compiled, an image decoded, a page of
 * components mounting) holds the fade where it was, rather than the wall
 * clock running it out before the next frame is seen.
 */
export function steadyClock(longestStep = LONGEST_FADE_STEP): (now?: number) => number {
  let elapsed = 0
  let last: number | null = null
  return (now = performance.now()) => {
    if (last !== null) elapsed += clamp(now - last, 0, longestStep)
    last = now
    return elapsed
  }
}
