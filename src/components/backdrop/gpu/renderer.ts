// Draws a backdrop image covering the viewport, then glass over it wherever an
// element sits: the image blurred, bent at the element's edges and saturated, in a
// few GPU passes rather than a CPU filter per element per repaint.
//
// Each blur radius is made once into a viewport-covering texture and shared by every
// element until the image or the viewport changes; a viewport being resized keeps its
// old blurs until it settles (blurs.ts). A new image can crossfade in over the old, each
// with its own blurs. Glass over the page (a popup's) is drawn onto a canvas of its
// own, sharing all of that.
//
// In place of an image there can be a scene, which the GPU draws for itself onto a
// texture that is then treated as the image was. Its blurs are made again with every
// frame, so they are kept, made small, and read the scene's mips. It is drawn at most
// 60 times a second, less sharply if the GPU can't keep up, at the new size on every
// frame of a resize, and eases to a stop or back up to speed by its clock alone, one
// number here, so that everything in it slows as one.
//
// A frame is recorded first, as a list of passes, and only then encoded: its
// uniforms all go in one buffer, whose size is known only once they are counted.
import { clamp, DISPERSION, reducedMotionQuery, steadyClock } from '../../../shared'
import { OVER } from './blend'
import { type Blurred, blurMap, createBlurs, type Target } from './blurs'
import { shaderSource, UNIFORM, UNIFORM_SIZE } from './shaders'
import { coverMap } from './viewMaps'

export interface LensDraw {
  /** The element's border box, in CSS px from the viewport's top-left. */
  x: number
  y: number
  width: number
  height: number
  /** The part of the viewport the element is visible in: left, top, right, bottom. */
  clip: [number, number, number, number]
  /**
   * How far in from each side of `clip` the glass fades out, in px: left, top,
   * right, bottom. Where a scroller fades its content out
   * (src/components/scroll); 0 is a hard edge.
   */
  feather: [number, number, number, number]
  radius: number
  squircle: boolean
  /** Displacement at the edge, in px. */
  strength: number
  /** How far in from the edge the bend reaches, in px. */
  bezel: number
  /** The radius of a round hole through its middle, in px, making it a ring; 0 for none. */
  hole: number
  /** How far its edges fade across, centred on them, in px; 0 for as sharp as a pixel allows. */
  soft: number
  /** Blur radius (the Gaussian's standard deviation), in px. */
  blur: number
  /**
   * If above 0, the glass is frosted: the bend fades out on the way up the box as the
   * blur rises from `blur` to this, in px, so the top doesn't bend and only blurs. It
   * reads the image itself, as a blur made ahead has one width, so it needs none of
   * those, and costs by its area instead. For small glass.
   */
  frost: number
  /** How much of the glass shows over the image, 0–1: the element's opacity on screen. */
  opacity: number
}

/** Glass that lies over the page, drawn over a bare image onto a canvas of its own. */
export interface OverlayDraw {
  lens: LensDraw
  /** Sized to the lens at the device pixel ratio by each draw. */
  canvas: HTMLCanvasElement
}

/** What a scene is given to draw a frame. */
export interface SceneFrame {
  /** What to record the frame on, before the glass is drawn from it. */
  encoder: GPUCommandEncoder
  /** Where to draw it: rgba8unorm, as sRGB-encoded as an image is, and opaque. */
  target: GPUTextureView
  width: number
  height: number
  /**
   * How long the scene has been running, in seconds, leaving out any stall. It slows to
   * a stop as the scene is held still and gathers way as it is let go, so everything
   * that goes by this, or by `delta`, eases with it.
   */
  seconds: number
  /** How far `seconds` has moved on since the last frame. */
  delta: number
  /** Whether it has come to rest, held still: nothing should animate, and `seconds` stays where it is. */
  still: boolean
  /** The moment to show, if it has been set from outside; otherwise it goes by its own time. */
  time?: Date
  /** Whether it should be raining. A scene that can't ignores it. */
  rain: boolean
}

/** Something a GlassBackdrop can draw in place of its image. */
export interface BackdropScene {
  render(frame: SceneFrame): void
  dispose(): void
}

/**
 * Sets a scene up on a device. It may reject, and the image is shown instead. Once
 * `signal` is aborted the scene is no longer wanted, and it may give up and reject.
 */
export interface SceneFactory {
  (device: GPUDevice, signal?: AbortSignal): Promise<BackdropScene>
  /** Whether it shows night at `time`, or at the time it goes by. */
  isNight?(time?: Date): boolean
  /** Starts fetching what it needs to be made, ahead of being asked, if it has anything to fetch. */
  preload?(): void
}

export interface Renderer {
  /**
   * Sets a scene up on this renderer's device, for `setImage`. It rejects if the GPU
   * refuses any of it, or `signal` is aborted, and leaves the renderer as it was.
   */
  prepareScene(factory: SceneFactory, signal?: AbortSignal): Promise<BackdropScene>
  /**
   * Draws `image` from now on, or `scene` in its place; with `crossfade`,
   * fading in over what was drawn until now.
   */
  setImage(image: HTMLImageElement | null, crossfade?: boolean, scene?: BackdropScene): void
  /** Settles once the GPU has finished everything drawn so far. */
  settled(): Promise<void>
  /**
   * How scenes are held from now on, the next draw included, even for a still one:
   * `still` or moving, or as prefers-reduced-motion has it if undefined, and at
   * `time`, or by their own time if undefined. One that is moving eases to a stop, and
   * one that is held gathers way, unless the reader asks for less motion.
   */
  holdScene(still: boolean | undefined, time: Date | undefined): void
  /** Whether it rains in scenes from now on, the next draw included, even for a still one. */
  setRain(rain: boolean): void
  /**
   * The RGBA pixels of the scene as it is now, at its smallest mip; null if it isn't
   * a scene that is being drawn, or the device went before they could be read.
   */
  readScene(): Promise<Uint8ClampedArray | null>
  /** The colour behind the image, 0–1, showing wherever it is see-through. */
  setMatte(red: number, green: number, blue: number): void
  /**
   * Draws the image covering a `width`×`height` CSS px viewport, then each lens
   * over it. While crossfading, the new image and its glass are drawn over the
   * old by `mix`, 0–1; the old one is let go at 1. Each of `overlays` is drawn
   * the same way, onto its own canvas.
   *
   * True if there is more to draw: glass was drawn from a blur the viewport has
   * since left behind, as one being resized does, or a scene is running. Draw
   * again next frame, until it comes back false.
   */
  draw(width: number, height: number, dpr: number, lenses: LensDraw[], mix?: number, overlays?: OverlayDraw[]): boolean
  dispose(): void
}

export interface RendererOptions {
  /** Once aborted, it gives up: the canvas is left as it is and it resolves to null. */
  signal: AbortSignal
  /**
   * Called, once at most and never after `dispose`, when the renderer is no more
   * use: the device is lost (a GPU reset, say), or the GPU refused something (out
   * of memory, say), which costs the whole frame and says so nowhere else.
   */
  onLost(): void
}

/**
 * How long the viewport must stay as it is before its blurs are made again, in
 * ms: each costs two textures and two passes, every frame of a resize otherwise.
 */
const RESIZE_SETTLE = 150

/** The room each draw's uniforms take in their buffer: the default alignment of a dynamic offset. */
const UNIFORM_STRIDE = 256

/** How many draws' uniforms the buffer starts with room for. */
const MIN_UNIFORM_SLOTS = 64

/** The most pixels a scene is drawn at, whatever the canvas's size: 1440p's. */
const SCENE_MAX_PIXELS = 2560 * 1440

/** How many mips a scene's texture has, for its blurs to read. */
const SCENE_MIPS = 5

/** The time between two of a scene's frames, in ms: 60 a second. */
const SCENE_FRAME = 1000 / 60

/** How early a scene's frame may come and still be drawn, in ms, as a display's frames jitter. */
const SCENE_FRAME_EARLY = 1

/** How often a scene that is held still is drawn afresh, in ms: it may still change with the time of day. */
const SCENE_STILL_FRAME = 60_000

/** The longest a scene's clock moves on between frames, in ms. */
const SCENE_LONGEST_STEP = 100

/** How long a scene takes to ease to a stop, or to get back up to speed, in ms. */
const SCENE_EASE = 1500

/** How many of a scene's frames to judge the GPU by. */
const SCENE_JUDGED_FRAMES = 45

/** How many frames to let by before judging, as everything is still settling. */
const SCENE_SETTLING_FRAMES = 90

/** How long the GPU may typically take over a frame, in ms: at under 48 frames a second, the scene is too much. */
const SCENE_SLOW_FRAME = 1000 / 48

/** How much sharpness a scene loses each time, and the least it can be left with. */
const SCENE_SCALE_STEP = 0.84
const SCENE_SMALLEST_SCALE = 0.5

/**
 * How fast a scene's clock runs, 0–1, `pace` of the way from held still to moving. It is
 * only a speed: what is seen is that summed over time, already smoother than this, so
 * smoothstep will do, and leaves fewer frames drawn at full cost with nothing to show
 * for them than a sharper curve would at either end.
 */
function sceneSpeed(pace: number) {
  return pace * pace * (3 - 2 * pace)
}

/**
 * The scale to draw a scene at next, given how long the GPU took over its last frames,
 * in ms. That is by the GPU's own clock where it has one (frameClock), or else from
 * submitting a frame to its being done, rather than from one frame to the next, which
 * goes by the display and the page as much as the GPU: a slow refresh rate or a busy
 * page would cost sharpness and win nothing back. A typical
 * frame rather than the average, as one long stall says nothing about the GPU, and only
 * ever downwards: rising again would bring back the frames it dropped, over and over.
 */
export function nextSceneScale(scale: number, times: readonly number[]) {
  const typical = [...times].sort((a, b) => a - b)[times.length >> 1]
  return typical > SCENE_SLOW_FRAME ? Math.max(SCENE_SMALLEST_SCALE, scale * SCENE_SCALE_STEP) : scale
}

/** The size to draw a scene at for a canvas of this size, in pixels. */
export function sceneSize(canvasWidth: number, canvasHeight: number, scale: number): [number, number] {
  const fit = Math.min(1, Math.sqrt(SCENE_MAX_PIXELS / (canvasWidth * canvasHeight))) * scale
  return [Math.max(1, Math.round(canvasWidth * fit)), Math.max(1, Math.round(canvasHeight * fit))]
}

/** The format of the image and its blurs. */
const TEXTURE_FORMAT: GPUTextureFormat = 'rgba8unorm'

/** How far each channel's bend is spread, the same for every lens. */
const DISPERSION_RGB = [DISPERSION.R, DISPERSION.G, DISPERSION.B]

/** Premultiplied, so a lens's anti-aliased outline, and a fading image, blend into what is under it. */
const PREMULTIPLIED: GPUBlendState = { color: OVER, alpha: OVER }

/**
 * The largest viewport to expect, in device px: wide, high. A window fills its
 * screen at most, and is measured too as a zoomed-out page can show more CSS px
 * than `screen` says there are. A screen that may be a phone or tablet can turn,
 * so it is taken to be as high as it is wide.
 */
function screenPixels(): [number, number] {
  const width = Math.max(screen.width, innerWidth) * devicePixelRatio
  const height = Math.max(screen.height, innerHeight) * devicePixelRatio
  return navigator.maxTouchPoints > 0 ? [Math.max(width, height), Math.max(width, height)] : [width, height]
}

/**
 * The image, scaled down if it is larger than is any use: to at most `max` px a
 * side, as a texture beyond the GPU's limit can't be made, and to just cover
 * `viewport`, the largest it will be drawn over (wide, high), as a texture costs
 * memory for every pixel whether it is seen or not.
 */
export function fitTexture(
  image: HTMLImageElement,
  max: number,
  [viewWidth, viewHeight]: readonly [number, number] = [Infinity, Infinity],
): HTMLImageElement | HTMLCanvasElement {
  const { naturalWidth, naturalHeight } = image
  const covering = Math.max(viewWidth / naturalWidth, viewHeight / naturalHeight)
  const scale = Math.min(max / Math.max(naturalWidth, naturalHeight), covering)
  if (!(scale < 1)) return image
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(naturalWidth * scale))
  canvas.height = Math.max(1, Math.floor(naturalHeight * scale))
  const context = canvas.getContext('2d')
  // A browser out of room for another canvas gives none: the image goes as it is, and if
  // that is past what the GPU takes, making its texture says so.
  if (!context) return image
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Loads an image for use as a texture: CORS-enabled, so a cross-origin image needs CORS headers. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = src
  return image.decode().then(() => image)
}

/** A device, or null where there is none to be had: no WebGPU, no adapter, or a refused request. */
async function requestDevice() {
  try {
    const adapter = await navigator.gpu?.requestAdapter()
    if (!adapter) return null
    // The default limit, 8192, is too small for a canvas on a large display.
    const { maxTextureDimension2D } = adapter.limits
    // To time scenes by the GPU's own clock (frameClock), where it has one to read.
    const requiredFeatures: GPUFeatureName[] = adapter.features.has('timestamp-query') ? ['timestamp-query'] : []
    return await adapter.requestDevice({ requiredLimits: { maxTextureDimension2D }, requiredFeatures })
  } catch {
    return null
  }
}

/** Reads how long a frame's work took on the GPU, in ms, once it is done; null if that can't be read. */
type FrameTime = () => Promise<number | null>

/**
 * Times a frame's work by the GPU's own clock, with a timestamp either side of it: how
 * long the GPU spent on it, where the time from submitting it to its being done also
 * counts the queue, which a page held to 30 frames a second stretches.
 */
function frameClock(device: GPUDevice) {
  const querySet = device.createQuerySet({ type: 'timestamp', count: 2 })
  const resolved = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC })
  // Buffers to read the times back through, free to be written: each is mapped for a while after its frame.
  const free: GPUBuffer[] = []
  return {
    /** Takes a timestamp ahead of the frame's work. */
    begin(encoder: GPUCommandEncoder) {
      encoder.beginComputePass({ timestampWrites: { querySet, beginningOfPassWriteIndex: 0 } }).end()
    },
    /** Takes one after it, and gives what reads the time between them once the frame is submitted. */
    end(encoder: GPUCommandEncoder): FrameTime {
      encoder.beginComputePass({ timestampWrites: { querySet, endOfPassWriteIndex: 1 } }).end()
      encoder.resolveQuerySet(querySet, 0, 2, resolved, 0)
      const readback =
        free.pop() ?? device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })
      encoder.copyBufferToBuffer(resolved, 0, readback, 0, 16)
      return async () => {
        try {
          await readback.mapAsync(GPUMapMode.READ)
          const [start, end] = new BigUint64Array(readback.getMappedRange())
          readback.unmap()
          free.push(readback)
          // In ns. Some drivers' clocks can run backwards between passes, which says nothing.
          return end > start ? Number(end - start) / 1e6 : null
        } catch {
          return null
        }
      }
    },
  }
}

export type Uniforms = Partial<Record<keyof typeof UNIFORM, number | number[]>>

/** What a pass that makes a mip from the one above it needs: blurMain with no taps is a plain copy. */
const MIP_UNIFORMS: Uniforms = {
  quad: [0, 0, 1, 1],
  view: [0, 0, 1, 1],
  map: [1, 1, 0, 0],
  axis: [0, 0],
  sigma: 0,
  taps: 0,
}

/** What a layer needs to be redrawn frame after frame. */
interface Live {
  scene: BackdropScene
  /** The mip of the scene being drawn on, and how each of the others is made from the last. */
  drawn: GPUTextureView
  mips: { target: GPUTextureView; source: GPUBindGroup }[]
  /** How long it has run, in ms, whatever its pace, and what that was at its last frame. */
  clock: (now?: number) => number
  ran: number
  /** How far it has eased from held still, 0, to moving, 1. */
  pace: number
  seconds: number
  /** Whether it has drawn since the last frame, so that its blurs need making again. */
  fresh: boolean
  /** Whether how it is held has changed since it last drew, so that it can't wait for its next frame. */
  changed: boolean
  /** When it last drew, and when its next frame is due, in ms. */
  drewAt: number
  dueAt: number
  /** Whether this frame says anything about the GPU, and how long the GPU took over those lately, in ms. */
  judged: boolean
  times: number[]
  frames: number
  /** How much of its full resolution it draws at; see nextSceneScale. */
  scale: number
}

interface Layer extends Target {
  width: number
  height: number
  /**
   * The image blurred, by blurKey, least recently drawn first. Each is made
   * again once the viewport has settled on another size.
   */
  blurred: Map<number, Blurred>
  /** Set if it is a scene, in place of an image. */
  live: Live | null
}

export interface Draw {
  pipeline: GPURenderPipeline
  source: GPUBindGroup
  uniforms: Uniforms
}

/** A render pass over a whole target, which it clears first. */
export interface Pass {
  target: GPUTextureView
  draws: Draw[]
}

/**
 * A WebGPU renderer on `canvas`, or null where it can't draw: no WebGPU, no
 * adapter, or a shader the driver rejects. It never rejects.
 *
 * It is asynchronous, unlike all that follows, as a device and pipelines known
 * to have compiled can only be waited for.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  { signal, onLost }: RendererOptions,
): Promise<Renderer | null> {
  const requested = await requestDevice()
  if (!requested) return null
  const device: GPUDevice = requested

  const module = device.createShaderModule({ code: shaderSource })
  const sharedLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: UNIFORM_SIZE },
      },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  })
  const sourceLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }],
  })
  const layout = device.createPipelineLayout({ bindGroupLayouts: [sharedLayout, sourceLayout] })
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat()

  function pipeline(entryPoint: string, format: GPUTextureFormat, blend?: GPUBlendState, vertex = 'vertexMain') {
    return device.createRenderPipelineAsync({
      layout,
      vertex: { module, entryPoint: vertex },
      fragment: { module, entryPoint, targets: [{ format, blend }] },
      primitive: { topology: 'triangle-strip' },
    })
  }

  let pipelines: Record<'image' | 'lens' | 'blur', GPURenderPipeline>
  try {
    const [image, lens, blur] = await Promise.all([
      pipeline('imageMain', canvasFormat, PREMULTIPLIED),
      pipeline('lensMain', canvasFormat, PREMULTIPLIED, 'lensVertex'),
      pipeline('blurMain', TEXTURE_FORMAT),
    ])
    pipelines = { image, lens, blur }
  } catch {
    device.destroy()
    return null
  }

  // After the last wait: a canvas is configured for one device at a time, and a
  // renderer given up on mustn't take it from the one that replaced it.
  const context = signal.aborted ? null : canvas.getContext('webgpu')
  if (!context) {
    device.destroy()
    return null
  }
  const main: GPUCanvasContext = context
  main.configure({ device, format: canvasFormat })

  let live = true
  function fail() {
    if (!live) return
    live = false
    onLost()
  }
  device.lost.then(({ reason }) => {
    if (reason !== 'destroyed') fail()
  })
  // The scenes being set up, each with what stops it.
  const making = new Set<AbortController>()
  // One refused call and the frame's whole submit is thrown away, with nothing
  // thrown here: the canvas would go black and stay that way. While a scene is being
  // set up, it is the scene that is too much for this GPU, and the image can stay.
  device.addEventListener('uncapturederror', () => {
    if (!making.size) fail()
    for (const scene of making) scene.abort(new Error('The GPU refused a scene'))
  })

  const sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' })
  const clock = device.features.has('timestamp-query') ? frameClock(device) : null

  let uniformBuffer: GPUBuffer | null = null
  let uniformData = new Float32Array()
  let sharedGroup: GPUBindGroup | null = null
  let uniformSlots = 0

  /** Makes room for `slots` draws' uniforms, keeping it for the frames after. */
  function reserveUniforms(slots: number) {
    if (slots <= uniformSlots) return
    uniformBuffer?.destroy()
    uniformSlots = Math.max(slots, uniformSlots * 2, MIN_UNIFORM_SLOTS)
    const size = uniformSlots * UNIFORM_STRIDE
    uniformBuffer = device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    uniformData = new Float32Array(size / Float32Array.BYTES_PER_ELEMENT)
    sharedGroup = device.createBindGroup({
      layout: sharedLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer, size: UNIFORM_SIZE } },
        { binding: 1, resource: sampler },
      ],
    })
  }

  function sourceGroup(view: GPUTextureView) {
    return device.createBindGroup({ layout: sourceLayout, entries: [{ binding: 0, resource: view }] })
  }

  // What is recorded and not yet submitted, and the textures nothing reads after it.
  let passes: Pass[] = []
  let spent: GPUTexture[] = []
  // What goes on the encoder ahead of the passes: scenes drawing, which they read.
  let scenes: ((encoder: GPUCommandEncoder) => void)[] = []
  const stillness = reducedMotionQuery()
  // How scenes are held, if that isn't left to them.
  let heldStill: boolean | undefined
  let heldTime: Date | undefined
  let raining = false

  function isStill() {
    return heldStill ?? stillness?.matches ?? false
  }

  /** Whether a scene is held still and has eased to a stop. */
  function isResting(running: Live) {
    return running.pace === 0 && isStill()
  }

  /** Submits what is recorded. `timed`, it gives what reads how long the GPU took over it, if it can tell. */
  function submit(timed = false): FrameTime | undefined {
    reserveUniforms(passes.reduce((slots, { draws }) => slots + draws.length, 0))
    const encoder = device.createCommandEncoder()
    const timing = timed ? clock : null
    timing?.begin(encoder)
    for (const draw of scenes) draw(encoder)
    let slot = 0
    for (const { target, draws } of passes) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: target, loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }],
      })
      for (const draw of draws) {
        const offset = slot++ * UNIFORM_STRIDE
        const start = offset / Float32Array.BYTES_PER_ELEMENT
        for (const key in draw.uniforms) {
          const name = key as keyof typeof UNIFORM
          const at = start + UNIFORM[name]
          const value = draw.uniforms[name]!
          if (typeof value === 'number') uniformData[at] = value
          else uniformData.set(value, at)
        }
        pass.setPipeline(draw.pipeline)
        pass.setBindGroup(0, sharedGroup, [offset])
        pass.setBindGroup(1, draw.source)
        pass.draw(4)
      }
      pass.end()
    }
    const took = timing?.end(encoder)
    if (uniformBuffer) device.queue.writeBuffer(uniformBuffer, 0, uniformData, 0, (slot * UNIFORM_STRIDE) / 4)
    device.queue.submit([encoder.finish()])
    // Work already submitted keeps what it needs.
    for (const texture of spent) texture.destroy()
    passes = []
    spent = []
    scenes = []
    return took
  }

  function targetOf(texture: GPUTexture): Target {
    const view = texture.createView()
    return { texture, view, group: sourceGroup(view) }
  }

  /** Records a pass that makes a mip from the one above it. */
  function copyDown(target: GPUTextureView, source: GPUBindGroup) {
    passes.push({ target, draws: [{ pipeline: pipelines.blur, source, uniforms: MIP_UNIFORMS }] })
  }

  function blurTarget(width: number, height: number) {
    return targetOf(
      device.createTexture({
        label: 'blur',
        size: [width, height],
        format: TEXTURE_FORMAT,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      }),
    )
  }

  // The blurs of each layer, made with this renderer's passes and textures.
  const layerBlurs = createBlurs({
    canvas,
    target: blurTarget,
    pipeline: () => pipelines.blur,
    record: (pass) => passes.push(pass),
    spend: (texture) => spent.push(texture),
  })

  /** The image as a texture with mipmaps, which WebGPU doesn't make for you. */
  function imageTarget(source: HTMLImageElement | HTMLCanvasElement, width: number, height: number) {
    const mipLevelCount = Math.floor(Math.log2(Math.max(width, height))) + 1
    const texture = device.createTexture({
      label: 'image',
      size: [width, height],
      mipLevelCount,
      format: TEXTURE_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })
    try {
      device.queue.copyExternalImageToTexture({ source }, { texture, premultipliedAlpha: true }, [width, height])
    } catch (error) {
      // A cross-origin image without CORS headers can't be a texture.
      texture.destroy()
      throw error
    }
    for (let level = 1; level < mipLevelCount; level++) {
      const above = sourceGroup(texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }))
      copyDown(texture.createView({ baseMipLevel: level, mipLevelCount: 1 }), above)
    }
    submit()
    return targetOf(texture)
  }

  /** A texture for a scene to draw on, with mips for its blurs to read. */
  function sceneTarget(width: number, height: number) {
    const mipLevelCount = Math.min(SCENE_MIPS, Math.floor(Math.log2(Math.max(width, height))) + 1)
    const texture = device.createTexture({
      label: 'scene',
      size: [width, height],
      mipLevelCount,
      format: TEXTURE_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    })
    const level = (baseMipLevel: number) => texture.createView({ baseMipLevel, mipLevelCount: 1 })
    const mips = Array.from({ length: mipLevelCount - 1 }, (_, i) => ({
      target: level(i + 1),
      source: sourceGroup(level(i)),
    }))
    return { ...targetOf(texture), width, height, drawn: level(0), mips }
  }

  function sceneLayer(scene: BackdropScene): Layer {
    // It has no size until the first frame, which gives it one.
    const { drawn, mips, ...target } = sceneTarget(1, 1)
    const running: Live = {
      scene,
      drawn,
      mips,
      clock: steadyClock(SCENE_LONGEST_STEP),
      ran: 0,
      // There is nothing to ease from in one that has only just been made.
      pace: isStill() ? 0 : 1,
      seconds: 0,
      fresh: false,
      changed: false,
      drewAt: -Infinity,
      dueAt: -Infinity,
      judged: false,
      times: [],
      frames: 0,
      scale: 1,
    }
    return { ...target, blurred: new Map(), live: running }
  }

  /** Moves a scene's target to the size it should be. */
  function sizeScene(layer: Layer, running: Live, canvasWidth: number, canvasHeight: number) {
    const [width, height] = sceneSize(canvasWidth, canvasHeight, running.scale)
    if (width === layer.width && height === layer.height) return
    spent.push(layer.texture)
    const { drawn, mips, ...target } = sceneTarget(width, height)
    Object.assign(layer, target)
    running.drawn = drawn
    running.mips = mips
  }

  /** Records a scene's next frame, if it is time for one. */
  function advanceScene(layer: Layer, running: Live, canvasWidth: number, canvasHeight: number) {
    const now = performance.now()
    running.fresh = false
    running.judged = false
    const held = isStill()
    const resting = isResting(running)
    // A still scene is drawn once, and again only as its size or the time changes.
    const [width, height] = sceneSize(canvasWidth, canvasHeight, running.scale)
    // A frame at the wrong size, or at the wrong time, would show, however soon after the last it comes.
    const due = running.changed || width !== layer.width || height !== layer.height
    running.changed = false
    if (resting && running.frames && !due && now - running.drewAt < SCENE_STILL_FRAME) return
    if (!due && now < running.dueAt - SCENE_FRAME_EARLY) return

    // Each frame is due a set time after the last was due, not after it came, so that a
    // display whose rate doesn't divide 60 evenly still comes to 60 on average. One that
    // has fallen right behind starts again from now rather than trying to catch up.
    running.dueAt = due || now - running.dueAt > SCENE_FRAME ? now + SCENE_FRAME : running.dueAt + SCENE_FRAME
    // None of those say anything about the GPU, and nor does a still scene's pace.
    running.judged = !due && !resting && running.frames > SCENE_SETTLING_FRAMES
    if (running.times.length >= SCENE_JUDGED_FRAMES) {
      running.scale = nextSceneScale(running.scale, running.times)
      running.times = []
    }
    sizeScene(layer, running, canvasWidth, canvasHeight)

    const ran = running.clock(now)
    const step = ran - running.ran
    running.ran = ran
    // Whoever asks for less motion doesn't get more of it on the way to none.
    const eased = stillness?.matches ? 1 : step / SCENE_EASE
    running.pace = clamp(running.pace + (held ? -eased : eased), 0, 1)
    // It comes to rest on the last of its moving frames, which doubles as its first still
    // one. Every still frame is the same moment, or the ocean would creep on as the time
    // is moved.
    const still = isResting(running)
    const delta = (step / 1000) * sceneSpeed(running.pace)
    running.seconds += delta
    running.drewAt = now
    running.frames++
    running.fresh = true
    const { scene, drawn: target, seconds } = running
    const size = { width: layer.width, height: layer.height }
    const time = heldTime
    const rain = raining
    scenes.push((encoder) => scene.render({ encoder, target, ...size, seconds, delta, still, time, rain }))
    for (const { target: mip, source } of running.mips) copyDown(mip, source)
  }

  /**
   * Notes how long the GPU took over the frame just submitted for each of `judged`, by
   * `took` where it can tell, or else from now until the frame is done.
   */
  function timeScenes(judged: Live[], took: FrameTime | undefined) {
    if (!judged.length) return
    const sent = performance.now()
    const time = took ? took() : device.queue.onSubmittedWorkDone().then(() => performance.now() - sent)
    time.then(
      (ms) => {
        if (ms !== null) for (const running of judged) running.times.push(ms)
      },
      () => {},
    )
  }

  let image: Layer | null = null
  // The image being faded from, while crossfading.
  let previous: Layer | null = null
  // The viewport and pixel ratio of the last draw, and when either last changed.
  let lastWidth = 0
  let lastHeight = 0
  let lastDpr = 0
  let viewChanged = -Infinity
  let matte = [1, 1, 1]
  // Whether the canvas may not show what the next draw would, and the glass and
  // crossfade it was last drawn with, which say the same of any that follow.
  let stale = true
  let shownGlass: LensDraw[] = []
  let shownMix = 1

  function layers() {
    return previous ? [previous, image!] : image ? [image] : []
  }

  function dropLayer(layer: Layer) {
    layerBlurs.drop(layer)
    layer.texture.destroy()
    layer.live?.scene.dispose()
  }

  // Null for a canvas that can't be drawn on.
  const overlayContexts = new WeakMap<HTMLCanvasElement, GPUCanvasContext | null>()

  function overlayContext(target: HTMLCanvasElement) {
    if (!overlayContexts.has(target)) {
      const overlay = target.getContext('webgpu')
      overlay?.configure({ device, format: canvasFormat })
      overlayContexts.set(target, overlay)
    }
    return overlayContexts.get(target)
  }

  function imageLayer(next: HTMLImageElement): Layer {
    const source = fitTexture(next, device.limits.maxTextureDimension2D, screenPixels())
    const [textureWidth, textureHeight] =
      source === next ? [next.naturalWidth, next.naturalHeight] : [source.width, source.height]
    return {
      ...imageTarget(source, textureWidth, textureHeight),
      width: next.naturalWidth,
      height: next.naturalHeight,
      blurred: new Map(),
      live: null,
    }
  }

  return {
    async prepareScene(factory, wanted) {
      const building = new AbortController()
      const stop = () => building.abort(wanted?.reason)
      if (wanted?.aborted) stop()
      wanted?.addEventListener('abort', stop)
      making.add(building)
      try {
        const scene = await factory(device, building.signal)
        // What the GPU makes of a scene it only says later, so a scene isn't made until then.
        await device.queue.onSubmittedWorkDone()
        if (building.signal.aborted) {
          scene.dispose()
          throw building.signal.reason
        }
        return scene
      } finally {
        making.delete(building)
        wanted?.removeEventListener('abort', stop)
      }
    },

    setImage(next, crossfade = false, scene) {
      const layer = scene ? sceneLayer(scene) : imageLayer(next!)
      if (previous) dropLayer(previous)
      previous = null
      if (crossfade && image) previous = image
      else if (image) dropLayer(image)
      image = layer
      stale = true
    },

    settled() {
      return device.queue.onSubmittedWorkDone()
    },

    holdScene(still, time) {
      heldStill = still
      heldTime = time
      for (const { live: running } of layers()) if (running) running.changed = true
    },

    setRain(rain) {
      raining = rain
      for (const { live: running } of layers()) if (running) running.changed = true
    },

    async readScene() {
      if (!image?.live) return null
      const { texture, live: running, width: fullWidth, height: fullHeight } = image
      const mipLevel = running.mips.length
      const width = Math.max(1, fullWidth >> mipLevel)
      const height = Math.max(1, fullHeight >> mipLevel)
      // A row of a copy has to start on a multiple of 256.
      const bytesPerRow = Math.ceil((width * 4) / 256) * 256
      const buffer = device.createBuffer({
        label: 'scene pixels',
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })
      const encoder = device.createCommandEncoder()
      encoder.copyTextureToBuffer({ texture, mipLevel }, { buffer, bytesPerRow }, [width, height])
      device.queue.submit([encoder.finish()])
      try {
        await buffer.mapAsync(GPUMapMode.READ)
        const mapped = buffer.getMappedRange()
        const pixels = new Uint8ClampedArray(width * height * 4)
        for (let y = 0; y < height; y++) {
          pixels.set(new Uint8ClampedArray(mapped, y * bytesPerRow, width * 4), y * width * 4)
        }
        return pixels
      } catch {
        return null
      } finally {
        buffer.destroy()
      }
    },

    setMatte(red, green, blue) {
      stale ||= matte[0] !== red || matte[1] !== green || matte[2] !== blue
      matte = [red, green, blue]
    },

    draw(width, height, dpr, lenses, mix = 1, overlays = []) {
      const max = device.limits.maxTextureDimension2D
      const pixelWidth = Math.min(max, Math.max(1, Math.round(width * dpr)))
      const pixelHeight = Math.min(max, Math.max(1, Math.round(height * dpr)))
      const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight
      if (resized) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      // A browser zoom keeps the pixels and changes the ratio, and a blur's radius is in CSS px.
      if (width !== lastWidth || height !== lastHeight || dpr !== lastDpr) {
        lastWidth = width
        lastHeight = height
        lastDpr = dpr
        viewChanged = performance.now()
        stale = true
      }
      // Blurs left behind by the viewport, last time, have yet to be made again.
      const leftBehind = layerBlurs.begin(performance.now() - viewChanged < RESIZE_SETTLE)
      stale ||= leftBehind || resized
      if (!image) {
        passes.push({ target: main.getCurrentTexture().createView(), draws: [] })
        submit()
        return false
      }

      if (previous && mix >= 1) {
        dropLayer(previous)
        previous = null
      }
      // Oldest first, each drawn over the last: the new image by `mix`.
      const drawn = layers().map((layer, i) => ({ layer, opacity: i ? mix : 1 }))
      for (const { layer } of drawn) if (layer.live) advanceScene(layer, layer.live, pixelWidth, pixelHeight)

      const running = drawn.some(({ layer }) => layer.live && !isResting(layer.live))
      const glass = [...overlays.map(({ lens }) => lens), ...lenses]
      // A scene is held to 60 frames a second, and on a faster display the frames between
      // those have nothing new to show. The canvas keeps what it was last given.
      const same =
        !stale &&
        mix === shownMix &&
        !drawn.some(({ layer }) => layer.live?.fresh) &&
        glass.length === shownGlass.length &&
        glass.every((lens, i) => lens === shownGlass[i])
      if (same) return running
      stale = false
      shownGlass = glass
      shownMix = mix

      // Where each layer's image lies in the viewport, for it and for frosted glass, which reads it directly.
      const covers = drawn.map(({ layer }) => coverMap(width, height, layer.width, layer.height))
      const blurring = glass.filter((lens) => !lens.frost)
      const blurs = drawn.map(({ layer }) => {
        const own = new Map(blurring.map((lens) => [lens, layerBlurs.of(layer, lens.blur, width, height, dpr)]))
        layerBlurs.evict(layer, new Set(own.values()))
        return own
      })

      /** The image and `frame` over it, on `target`, which shows the `view` of the viewport. */
      function drawFrame(target: GPUTextureView, view: number[], frame: LensDraw[]) {
        const draws: Draw[] = drawn.map(({ layer, opacity }, l) => ({
          pipeline: pipelines.image,
          source: layer.group,
          uniforms: {
            quad: [0, 0, width, height],
            view,
            map: covers[l],
            matte,
            opacity,
          },
        }))
        for (const lens of frame) {
          for (const [l, { layer, opacity }] of drawn.entries()) {
            const blur = blurs[l].get(lens)
            draws.push({
              pipeline: pipelines.lens,
              source: blur ? blur.group : layer.group,
              uniforms: {
                quad: [lens.x, lens.y, lens.width, lens.height],
                view,
                map: blur ? blurMap(layer, blur, covers[l]) : covers[l],
                matte,
                clip: lens.clip,
                feather: lens.feather,
                radius: lens.radius,
                bezel: lens.bezel,
                hole: lens.hole,
                soft: lens.soft,
                sigma: lens.blur,
                frost: lens.frost,
                strength: lens.strength,
                squircle: lens.squircle ? 1 : 0,
                opacity: lens.opacity * opacity,
                pixel: 1 / dpr,
                dispersion: DISPERSION_RGB,
              },
            })
          }
        }
        passes.push({ target, draws })
      }

      for (const { lens, canvas: target } of overlays) {
        const overlay = overlayContext(target)
        if (!overlay) continue
        const overlayWidth = Math.min(max, Math.max(1, Math.round(lens.width * dpr)))
        const overlayHeight = Math.min(max, Math.max(1, Math.round(lens.height * dpr)))
        if (target.width !== overlayWidth) target.width = overlayWidth
        if (target.height !== overlayHeight) target.height = overlayHeight
        drawFrame(overlay.getCurrentTexture().createView(), [lens.x, lens.y, lens.width, lens.height], [lens])
      }
      drawFrame(main.getCurrentTexture().createView(), [0, 0, width, height], lenses)
      const judged = drawn.flatMap(({ layer }) => (layer.live?.judged ? [layer.live] : []))
      timeScenes(judged, submit(judged.length > 0))
      return layerBlurs.stale || running
    },

    // All that was made on the device goes with it, but a scene may hold more than that.
    // The canvas stays configured, for the renderer that follows (React's StrictMode
    // remounts onto it) to redo.
    dispose() {
      live = false
      for (const layer of layers()) layer.live?.scene.dispose()
      image = null
      previous = null
      for (const scene of making) scene.abort(new Error('The renderer has gone'))
      device.destroy()
    },
  }
}
