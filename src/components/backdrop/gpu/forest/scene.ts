import type { SceneFactory } from '../renderer'
import { skyScene, type SkyOptions } from '../sky'

export type ForestOptions = SkyOptions

/**
 * A forest, its day and night by local time. Sunrise and sunset are for `latitude`
 * and `longitude`, in degrees, which default to where the browser's time zone suggests
 * it is. The forest itself (forest.ts) is a module of its own, downloaded only once
 * the scene is wanted.
 */
export function createForestScene(options: ForestOptions = {}): SceneFactory {
  return skyScene(options, () => import('./forest').then((forest) => forest.makeForest))
}

/** The forest, as `createForestScene` makes it with no options. */
export const forestScene: SceneFactory = /* @__PURE__ */ createForestScene()
