import { useMemo } from 'react'
import {
  createForestScene,
  createOceanScene,
  forestScene,
  GlassBackdrop,
  oceanScene,
  type GlassBackdropProps,
  type SceneFactory,
} from '../backdrop'
import { useHydrated } from '../../shared'
import { PAGE_IMAGES, PICTURES, type DynamicScene } from './pictures'

export interface DynamicBackgroundProps extends Omit<
  GlassBackdropProps,
  'src' | 'nightSrc' | 'scene' | 'still' | 'sceneTime' | 'pageImage' | 'nightPageImage'
> {
  /** Which scene to show. A new one crossfades in over the last, as a new `scene` does on a GlassBackdrop. */
  scene?: DynamicScene
  /**
   * Whether the scene moves (waves, wind in the leaves, drifting clouds, rain) or holds
   * still, drawn afresh once a minute. It eases to a stop or back up to speed as this
   * changes. Left out, it goes by prefers-reduced-motion.
   */
  animated?: boolean
  /**
   * The time of day to show: a `Date`, or minutes past midnight today (0–1439), as a
   * slider gives them. Left out, or null, the scene follows the local time, and runs on
   * to it over a few seconds when let go of.
   */
  time?: Date | number | null
  /**
   * Where in the world the page is, in degrees, for sunrise, sunset and the night sky.
   * Left out, it is where the browser's time zone suggests. Both or neither.
   */
  latitude?: number
  longitude?: number
  /** A picture of the scene by day to show where it can't be drawn, in place of the one that comes with it. */
  src?: string
  /** The same by night. */
  nightSrc?: string
}

const SCENES: Record<DynamicScene, { shared: SceneFactory; create: typeof createForestScene }> = {
  forest: { shared: forestScene, create: createForestScene },
  ocean: { shared: oceanScene, create: createOceanScene },
}

// A scene made for a place, kept while the page is open: a new one would be made from
// scratch, seconds of work, each time a component mounted or the place came back. Only
// for the last few places asked for, the latest last: a page that moves its place about
// (a slider, a map) would otherwise keep one for every place it had ever been.
const placed = new Map<string, SceneFactory>()

/** How many places' scenes are kept. */
const PLACES_KEPT = 8

function sceneFor(scene: DynamicScene, latitude: number | undefined, longitude: number | undefined) {
  if (latitude === undefined || longitude === undefined) return SCENES[scene].shared
  const key = `${scene} ${latitude} ${longitude}`
  const made = placed.get(key) ?? SCENES[scene].create({ latitude, longitude })
  placed.delete(key)
  placed.set(key, made)
  // The first is the one longest unasked for.
  if (placed.size > PLACES_KEPT) placed.delete(placed.keys().next().value!)
  return made
}

/** `time` as a moment: minutes past midnight are today's, by the local clock. */
function momentOf(time: Date | number | null | undefined) {
  if (time === null || time === undefined || time instanceof Date) return time ?? undefined
  const moment = new Date()
  moment.setHours(0, time, 0, 0)
  return moment
}

/**
 * A GlassBackdrop showing a living landscape: the forest or the ocean under the real sky
 * for the time and place, with the sun, moon, stars, Milky Way and drifting clouds, and
 * rain at a word. It comes with pictures of each scene by day and by night, shown where
 * the scene can't be drawn (no WebGPU), and the page's colours in them worked out ahead.
 * Everything a GlassBackdrop takes, besides what it sets itself, passes through.
 *
 * A server's markup holds none of its own pictures, which go on as the page hydrates;
 * give it `src` and `nightSrc` to have a picture there from the first.
 */
export function DynamicBackground({
  scene = 'ocean',
  animated,
  time,
  latitude,
  longitude,
  src,
  nightSrc,
  ...rest
}: DynamicBackgroundProps) {
  // Held on to while the place is the same, so one that is showing isn't made again for
  // having been let go of above, as other places came and went.
  const factory = useMemo(() => sceneFor(scene, latitude, longitude), [scene, latitude, longitude])
  const pictures = PICTURES[scene]
  // Its own pictures are found only in the browser, once the page has hydrated. Where they
  // are is worked out from where this code is (pictures.ts), and for a server that loads
  // the package as it stands that is a folder on its disk: put in the markup it would tell
  // every reader the server's folders, and show nothing. So a server never asks, and the
  // markup holds a picture only where the page gives its own.
  const hydrated = useHydrated()
  const day = useMemo(() => src ?? (hydrated ? pictures.day() : undefined), [src, hydrated, pictures])
  const night = useMemo(() => nightSrc ?? (hydrated ? pictures.night() : undefined), [nightSrc, hydrated, pictures])
  return (
    <GlassBackdrop
      src={day}
      nightSrc={night}
      pageImage={src === undefined ? PAGE_IMAGES[scene].day : undefined}
      nightPageImage={nightSrc === undefined ? PAGE_IMAGES[scene].night : undefined}
      scene={factory}
      still={animated === undefined ? undefined : !animated}
      sceneTime={momentOf(time)}
      {...rest}
    />
  )
}
