import { describe, expect, it } from 'vitest'
import { blurMap, type Blurrable, createBlurs, type Target } from './blurs'
import type { Pass } from './renderer'
import { coverMap } from './viewMaps'

interface FakeTexture {
  width: number
  height: number
  destroyed: boolean
  destroy(): void
}

/** Blurs made for a canvas of 1600 by 900 pixels, with what they record, make and give up. */
function made() {
  const textures: FakeTexture[] = []
  const passes: Pass[] = []
  const spent: FakeTexture[] = []
  const target = (width: number, height: number): Target => {
    const texture: FakeTexture = { width, height, destroyed: false, destroy: () => void (texture.destroyed = true) }
    textures.push(texture)
    return { texture, view: { of: texture }, group: { of: texture } } as unknown as Target
  }
  const blurs = createBlurs({
    canvas: { width: 1600, height: 900 } as HTMLCanvasElement,
    target,
    pipeline: () => ({}) as GPURenderPipeline,
    record: (pass) => void passes.push(pass),
    spend: (texture) => void spent.push(texture as unknown as FakeTexture),
  })
  /** A layer the size of the canvas: an image, or a scene that has or hasn't drawn since the last frame. */
  const layer = (live: Blurrable['live'] = null): Blurrable => ({
    ...target(1600, 900),
    width: 1600,
    height: 900,
    blurred: new Map(),
    live,
  })
  return { blurs, layer, passes, spent, textures }
}

/** The viewport the canvas shows, in CSS px, at a pixel ratio of 2. */
const VIEW = [800, 450, 2] as const

describe('createBlurs', () => {
  it("makes an image's blur once, small enough for its taps, and gives the same one again", () => {
    const { blurs, layer, passes, spent } = made()
    const image = layer()
    blurs.begin(false)
    const blur = blurs.of(image, 12, ...VIEW)
    // 24 pixels of blur at a sixth of the canvas's size is 4 texels of it.
    expect([blur.texelsWide, blur.texelsHigh, blur.sigma]).toEqual([267, 150, 4])
    // Across the image onto a scratch texture, then down that: the scratch is done with.
    expect(passes).toHaveLength(2)
    expect(passes[1].target).toBe(blur.view)
    expect(spent).toHaveLength(1)
    expect(blur.scratch).toBeNull()

    blurs.begin(false)
    expect(blurs.of(image, 12, ...VIEW)).toBe(blur)
    // To the nearest quarter px, so a radius that is animated reuses it.
    expect(blurs.of(image, 12.1, ...VIEW)).toBe(blur)
    expect(passes).toHaveLength(2)
    expect(blurs.stale).toBe(false)
  })

  it('keeps four past those drawn, and drops the least recently drawn first', () => {
    const { blurs, layer } = made()
    const image = layer()
    blurs.begin(false)
    const all = [1, 2, 3, 4, 5, 6].map((radius) => blurs.of(image, radius, ...VIEW))
    blurs.evict(image, new Set([all[0]]))
    expect([...image.blurred.keys()]).toEqual([1, 4, 5, 6])
    expect(all.map((blur) => (blur.texture as unknown as FakeTexture).destroyed)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
    ])
    // Asked for again, one goes to the back of the queue.
    blurs.of(image, 4, ...VIEW)
    expect([...image.blurred.keys()]).toEqual([1, 5, 6, 4])
  })

  it('makes do with the old blur while the viewport settles, says so, and makes a new one after', () => {
    const { blurs, layer, passes, spent } = made()
    const image = layer()
    blurs.begin(false)
    const old = blurs.of(image, 12, ...VIEW)

    expect(blurs.begin(true)).toBe(false)
    expect(blurs.of(image, 12, 900, 450, 2)).toBe(old)
    expect(blurs.stale).toBe(true)
    expect(passes).toHaveLength(2)
    // Read through a map from the new viewport to the one it was made for.
    const now = coverMap(900, 450, 1600, 900)
    expect(blurMap(image, old, now)).not.toEqual(blurMap(image, { ...old, viewWidth: 900 }, now))

    // The next frame is told a blur was left behind, and with the viewport settled makes it again.
    expect(blurs.begin(false)).toBe(true)
    const fresh = blurs.of(image, 12, 900, 450, 2)
    expect(fresh).not.toBe(old)
    expect(fresh.viewWidth).toBe(900)
    expect(spent).toContain(old.texture)
    expect(blurs.stale).toBe(false)
    expect(blurs.begin(false)).toBe(false)
  })

  it("makes a scene's blur again in each frame the scene has drawn, once however many ask for it", () => {
    const { blurs, layer, passes, spent } = made()
    const live = { fresh: true }
    const scene = layer(live)
    blurs.begin(false)
    const blur = blurs.of(scene, 12, ...VIEW)
    // At no more than half the canvas's size, and its scratch texture kept for the next frame.
    expect([blur.texelsWide, blur.texelsHigh]).toEqual([133, 75])
    expect(blur.scratch).not.toBeNull()
    expect(spent).toHaveLength(0)
    expect(passes).toHaveLength(2)
    expect(blurs.of(scene, 12, ...VIEW)).toBe(blur)
    expect(passes).toHaveLength(2)

    blurs.begin(false)
    expect(blurs.of(scene, 12, ...VIEW)).toBe(blur)
    expect(passes).toHaveLength(4)

    // A frame the scene drew nothing new in leaves its blur as it is.
    live.fresh = false
    blurs.begin(false)
    blurs.of(scene, 12, ...VIEW)
    expect(passes).toHaveLength(4)
  })

  it("destroys a layer's blurs, and their scratch textures, as the layer goes", () => {
    const { blurs, layer, textures } = made()
    const scene = layer({ fresh: true })
    blurs.begin(false)
    blurs.of(scene, 6, ...VIEW)
    blurs.of(scene, 12, ...VIEW)
    blurs.drop(scene)
    // All but the layer's own, which is the renderer's to destroy.
    expect(textures.map((texture) => texture.destroyed)).toEqual([false, true, true, true, true])
  })
})
