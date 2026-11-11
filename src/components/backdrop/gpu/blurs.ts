// The blurs of the backdrop's layers, which glass reads: each blur radius is made once
// into a viewport-covering texture and shared by every element that asks for it, kept
// while it is drawn, and made again once the viewport has settled on another size. A
// scene's are made again with every frame it draws. The renderer (renderer.ts) says
// when a frame begins and asks for the blur each lens needs; what is made is recorded
// with the renderer's own passes.
import type { Pass } from './renderer'
import { coverMap, type Map4, screenMap } from './viewMaps'

/**
 * A blur's standard deviation, in texels of the target it is made in. A wider
 * blur is made at a lower resolution, where it is this wide: after linear
 * upsampling it looks the same, for a fraction of the taps and memory, and no
 * blur is too wide for its taps.
 */
const BLUR_TEXELS = 4

/** Blur radii are cached to the nearest quarter px, so an animated blur reuses its textures. */
function blurKey(radius: number) {
  return Math.round(radius * 4) / 4
}

/**
 * How many blurred textures to keep. Every blur on screen is kept however many
 * there are; beyond those, the least recently drawn go first.
 */
const MAX_BLURS = 4

/** As BLUR_TEXELS for the blurs of a scene, which are made every frame. */
const SCENE_BLUR_TEXELS = 2

/** The most of the canvas's resolution a scene's blur is made at. */
const SCENE_BLUR_SCALE = 0.5

export interface Target {
  texture: GPUTexture
  view: GPUTextureView
  /** Binds it to be read from. */
  group: GPUBindGroup
}

export interface Blurred extends Target {
  /** The viewport it was made for, in CSS px, and its device pixel ratio. */
  viewWidth: number
  viewHeight: number
  dpr: number
  /** Its size in texels, and its standard deviation in them. */
  texelsWide: number
  texelsHigh: number
  sigma: number
  /** Where a scene's first pass goes, kept between frames; null for an image's, which is made once. */
  scratch: Target | null
  /** The frame it was last made in. */
  painted: number
}

/** What is blurred: a layer's image or scene, with the blurs made of it so far. */
export interface Blurrable extends Target {
  width: number
  height: number
  /**
   * The image blurred, by blurKey, least recently drawn first. Each is made
   * again once the viewport has settled on another size.
   */
  blurred: Map<number, Blurred>
  /** Set if it is a scene, in place of an image: whether it has drawn since the last frame. */
  live: { fresh: boolean } | null
}

/** What the blurs need of the renderer they are made for. */
export interface BlurHost {
  /** The canvas, whose size in pixels theirs go by. */
  canvas: HTMLCanvasElement
  /** A texture to make a blur on and to read it from. */
  target(width: number, height: number): Target
  /** The pipeline that blurs along one axis: asked for as a blur is made, as it is compiled after this is. */
  pipeline(): GPURenderPipeline
  /** Records a pass, to go with the frame's. */
  record(pass: Pass): void
  /** Gives up a texture that nothing reads after what is recorded. */
  spend(texture: GPUTexture): void
}

export interface Blurs {
  /**
   * Begins a frame. `settling`, the viewport has just changed, and the frame can make do
   * with blurs made for the last one. Says whether the frame before did.
   */
  begin(settling: boolean): boolean
  /** Whether a blur drawn since the frame began was made for another viewport. */
  readonly stale: boolean
  /**
   * The blur of `layer` at a radius, in CSS px, for a viewport so wide and high, in CSS px,
   * at a pixel ratio: the one it has, or made now.
   */
  of(layer: Blurrable, radius: number, width: number, height: number, dpr: number): Blurred
  /** Drops the blurs of `layer` past those kept, least recently drawn first, but none of those `drawn`. */
  evict(layer: Blurrable, drawn: Set<Blurred>): void
  /** Destroys all of a layer's blurs. */
  drop(layer: Blurrable): void
}

/**
 * `uv = px * map.xy + map.zw` for reading a blur of `layer` in the viewport `now`
 * covers it (coverMap): to where that px lies in the image, then to where that
 * lies in the viewport the blur was made for, so glass stays on the image however
 * the viewport has changed since. Off the blur's edge, it reads the edge.
 */
export function blurMap(layer: Blurrable, blur: Blurred, now: Map4): Map4 {
  const then = coverMap(blur.viewWidth, blur.viewHeight, layer.width, layer.height)
  const scaleX = 1 / (then[0] * blur.viewWidth)
  const scaleY = 1 / (then[1] * blur.viewHeight)
  return [now[0] * scaleX, now[1] * scaleY, (now[2] - then[2]) * scaleX, (now[3] - then[3]) * scaleY]
}

export function createBlurs({ canvas, target, pipeline, record, spend }: BlurHost): Blurs {
  let frameNumber = 0
  // Whether this frame can make do with blurs from before the viewport changed,
  // and whether it has.
  let settling = false
  let stale = false

  function destroy({ texture, scratch }: Blurred) {
    texture.destroy()
    scratch?.texture.destroy()
  }

  /** Makes a blur of `layer`: across the image onto its scratch target, then down that onto itself. */
  function paint(layer: Blurrable, blur: Blurred, scratch: Target) {
    const { viewWidth, viewHeight, texelsWide, texelsHigh, sigma } = blur
    const full = [0, 0, viewWidth, viewHeight]
    const uniforms = { quad: full, view: full, taps: Math.ceil(sigma * 3), sigma }
    // A tap per texel, which is viewWidth / texelsWide CSS px.
    const across = {
      ...uniforms,
      map: coverMap(viewWidth, viewHeight, layer.width, layer.height),
      axis: [viewWidth / texelsWide, 0],
    }
    const down = { ...uniforms, map: screenMap(viewWidth, viewHeight), axis: [0, viewHeight / texelsHigh] }
    record({ target: scratch.view, draws: [{ pipeline: pipeline(), source: layer.group, uniforms: across }] })
    record({ target: blur.view, draws: [{ pipeline: pipeline(), source: scratch.group, uniforms: down }] })
    blur.painted = frameNumber
  }

  return {
    begin(nowSettling) {
      const left = stale
      settling = nowSettling
      stale = false
      frameNumber++
      return left
    },

    get stale() {
      return stale
    },

    of(layer, radius, width, height, dpr) {
      const { blurred, live: running } = layer
      const key = blurKey(radius)
      const cached = blurred.get(key)
      const sigma = Math.max(key, 0) * dpr
      const scale = running ? Math.min(SCENE_BLUR_SCALE, SCENE_BLUR_TEXELS / sigma) : Math.min(1, BLUR_TEXELS / sigma)
      const texelsWide = Math.max(1, Math.round(canvas.width * scale))
      const texelsHigh = Math.max(1, Math.round(canvas.height * scale))
      if (cached) {
        const moved = cached.viewWidth !== width || cached.viewHeight !== height
        // Painted afresh, a scene's blur can show the new viewport on the texture it has.
        if (running && settling) {
          cached.viewWidth = width
          cached.viewHeight = height
        }
        const sharp = !running || (cached.texelsWide === texelsWide && cached.texelsHigh === texelsHigh)
        const current = cached.viewWidth === width && cached.viewHeight === height && cached.dpr === dpr && sharp
        // Most recently drawn last.
        blurred.delete(key)
        if (current || settling) {
          blurred.set(key, cached)
          stale ||= !current
          if (running && (running.fresh || moved) && cached.painted !== frameNumber) {
            paint(layer, cached, cached.scratch!)
          }
          return cached
        }
        // Nothing reads it from here on, and this frame gets the one made below.
        spend(cached.texture)
        if (cached.scratch) spend(cached.scratch.texture)
      }
      const scratch = target(texelsWide, texelsHigh)
      const result: Blurred = {
        ...target(texelsWide, texelsHigh),
        viewWidth: width,
        viewHeight: height,
        dpr,
        texelsWide,
        texelsHigh,
        sigma: sigma * scale,
        scratch: running ? scratch : null,
        painted: frameNumber,
      }
      paint(layer, result, scratch)
      if (!running) spend(scratch.texture)
      blurred.set(key, result)
      return result
    },

    evict({ blurred }, drawn) {
      for (const [key, blur] of blurred) {
        if (blurred.size <= MAX_BLURS) break
        if (drawn.has(blur)) continue
        destroy(blur)
        blurred.delete(key)
      }
    },

    drop(layer) {
      for (const blur of layer.blurred.values()) destroy(blur)
    },
  }
}
