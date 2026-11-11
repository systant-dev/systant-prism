import type { SceneFactory } from '../renderer'
import { skyScene, type SkyOptions } from '../sky'

export type OceanOptions = SkyOptions

/**
 * The ocean, its day and night by local time. Sunrise and sunset are for
 * `latitude` and `longitude`, in degrees, which default to where the browser's
 * time zone suggests it is. The ocean itself (ocean.ts) is a module of its own,
 * downloaded only once the scene is wanted.
 */
export function createOceanScene(options: OceanOptions = {}): SceneFactory {
  return skyScene(options, () => import('./ocean').then((ocean) => ocean.makeOcean))
}

/** The ocean, as `createOceanScene` makes it with no options. */
export const oceanScene: SceneFactory = /* @__PURE__ */ createOceanScene()
