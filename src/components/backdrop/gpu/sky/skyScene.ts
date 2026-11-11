import type { BackdropScene, SceneFactory } from '../renderer'
import { isNight, localPlace, type Place } from './daylight'
import { keeper, type Kept } from './kept'

export interface SkyOptions extends Partial<Place> {
  /** What time it is. By default it is now; a fixed time holds the sky at that moment. */
  now?: () => Date
}

/** What makes a scene under the sky on a device. All it makes goes in `kept`. */
export type SkyMaker = (device: GPUDevice, place: Place, now: () => Date, kept: Kept) => Promise<BackdropScene>

/**
 * A scene under the sky at a place, which defaults to where the browser's time zone
 * suggests it is. It can say when it is night there without being on a GPU, which a
 * GlassBackdrop asks to know what to show until it is ready. All it makes goes in
 * `kept`, for it to let go of as it is disposed, and if it fails this does that for it.
 *
 * What makes it comes from `load`, which a scene fetches as a module of its own, so a
 * page downloads a scene's code only once it wants that scene: when it is preloaded, or
 * else first made. One that fails to load is tried again the next time.
 */
export function skyScene(
  { latitude, longitude, now = () => new Date() }: SkyOptions,
  load: () => Promise<SkyMaker>,
): SceneFactory {
  function placeAt(moment: Date): Place {
    const guess = localPlace(moment)
    return { latitude: latitude ?? guess.latitude, longitude: longitude ?? guess.longitude }
  }
  let loading: Promise<SkyMaker> | null = null
  function loaded() {
    loading ??= load().catch((error: unknown) => {
      loading = null
      throw error
    })
    return loading
  }
  const factory: SceneFactory = async (device, signal) => {
    const make = await loaded()
    signal?.throwIfAborted()
    const kept = keeper(device, signal)
    try {
      return await make(device, placeAt(now()), now, kept)
    } catch (error) {
      kept.release()
      throw error
    }
  }
  factory.isNight = (time = now()) => isNight(time, placeAt(time))
  factory.preload = () => void loaded().catch(() => {})
  return factory
}
