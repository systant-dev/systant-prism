// What a server, or a build, can work out ahead for a GlassBackdrop, as
// `@systant/prism/server`. None of it touches React or a DOM, so it can run in a
// React Server Component, a route handler or a build script, and none of it
// imports anything that does (server.test.ts keeps it that way).
import { isNight, type Place } from './components/backdrop/gpu/sky/daylight'

export { samplePicture } from './components/backdrop/sampler'
export type { Picture } from './components/backdrop/sampler'
export type { PageImage } from './contrast/readablePage'
export type { Place }

/**
 * Whether `oceanScene` and `forestScene` show night at `place` at `time` (now, by
 * default): the sun about 3° or more below the horizon, as they reckon it. A GlassBackdrop
 * given it as `initialNight` renders its `nightSrc` from the first.
 */
export function isNightAt(place: Place, time: Date = new Date()) {
  return isNight(time, place)
}
