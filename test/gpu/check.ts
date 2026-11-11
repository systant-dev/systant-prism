// The page `npm run gpu` drives in a headless Chrome (run.mjs). It builds every scene and
// the glass on the real GPU, which compiles every shader, renders each case below with
// this working tree and, when given one, with another version of src, and compares the
// two pixel by pixel. On one device the scenes are deterministic, wind, waves and rain
// included, so any byte that differs is a change to how something looks.
//
// A shader the GPU refuses doesn't fail anything a unit test can see: GlassBackdrop
// quietly shows the scene's picture instead. Here it is an error.
// oxlint-disable-next-line no-restricted-imports -- it drives the renderer itself, as the renderer's tests do
import type { BackdropScene, LensDraw, Renderer, SceneFactory } from '../../src/components/backdrop/gpu/renderer'

export interface CheckOptions {
  /** Where the version being checked is served from: /src, the working tree, or a commit checked out. */
  ours: string
  /** Where the other version's src is served from; null to build and render this one alone. */
  base: string | null
}

export interface CaseResult {
  name: string
  /** What went wrong in either version: a scene that wouldn't build, an error from the GPU. */
  errors: string[]
  /** How many bytes differ between the versions, and by how much at most; null with nothing to compare. */
  differing: number | null
  largest: number | null
  /** The mean brightness of this version's render, 0–255, to show it drew something. */
  brightness: number
  /** Where the versions differ, in red, as a PNG data URL. */
  diff?: string
}

export interface CheckResult {
  /** The GPU it ran on: renders are only comparable on one. */
  adapter: string
  cases: CaseResult[]
}

declare global {
  interface Window {
    gpuCheck?: (options: CheckOptions) => Promise<CheckResult>
    gpuPictures?: () => Promise<Picture[]>
  }
}

const WIDTH = 960
const HEIGHT = 540

/** London, at set moments, so that the sky is the same whatever the machine's time zone. */
const PLACE = { latitude: 51.5, longitude: -0.1 }
const NIGHT = new Date('2026-06-21T23:00:00Z')
const DUSK = new Date('2026-06-21T20:40:00Z')
const DAY = new Date('2026-06-21T11:00:00Z')

/** A second and a half at 60 frames a second: long enough for wind, waves, rain and the Milky Way's bake. */
const MOVING = 90

const PICTURE = '/src/components/dynamicBackground/pictures/forest.webp'

type SceneName = 'forest' | 'ocean'

type Case =
  | { name: string; scene: SceneName; time: Date; frames: number; rain: boolean; still: boolean }
  | { name: string; glassOver: 'picture' | 'ocean' }

const CASES: Case[] = [
  { name: 'forest, night', scene: 'forest', time: NIGHT, frames: MOVING, rain: false, still: false },
  { name: 'forest, day', scene: 'forest', time: DAY, frames: MOVING, rain: false, still: false },
  { name: 'forest, night in the rain', scene: 'forest', time: NIGHT, frames: MOVING, rain: true, still: false },
  { name: 'ocean, night', scene: 'ocean', time: NIGHT, frames: MOVING, rain: false, still: false },
  { name: 'ocean, dusk', scene: 'ocean', time: DUSK, frames: MOVING, rain: false, still: false },
  { name: 'ocean, day in the rain', scene: 'ocean', time: DAY, frames: MOVING, rain: true, still: false },
  { name: 'ocean, night held still', scene: 'ocean', time: NIGHT, frames: 1, rain: false, still: true },
  { name: 'glass over a picture', glassOver: 'picture' },
  { name: 'glass over the ocean, held still', glassOver: 'ocean' },
]

/** Glass of every kind: a frosted ring (Progress), a squircle card fading at a scroller's edges, and a button's blur with no bend. */
const LENSES: LensDraw[] = [
  {
    x: 100,
    y: 80,
    width: 220,
    height: 220,
    clip: [0, 0, WIDTH, HEIGHT],
    feather: [0, 0, 0, 0],
    radius: 110,
    squircle: false,
    strength: 18,
    bezel: 30,
    hole: 50,
    soft: 1.5,
    blur: 1,
    frost: 6,
    opacity: 1,
  },
  {
    x: 400,
    y: 100,
    width: 300,
    height: 180,
    clip: [0, 0, WIDTH, HEIGHT],
    feather: [0, 8, 0, 8],
    radius: 28,
    squircle: true,
    strength: 12,
    bezel: 24,
    hole: 0,
    soft: 0,
    blur: 3,
    frost: 0,
    opacity: 0.9,
  },
  {
    x: 420,
    y: 320,
    width: 120,
    height: 44,
    clip: [0, 0, WIDTH, HEIGHT],
    feather: [0, 0, 0, 0],
    radius: 22,
    squircle: false,
    strength: 0,
    bezel: 10,
    hole: 0,
    soft: 0,
    blur: 10,
    frost: 0,
    opacity: 1,
  },
]

interface Rendered {
  pixels: Uint8Array | null
  errors: string[]
}

type RendererModule = typeof import('../../src/components/backdrop/gpu/renderer')

async function sceneFactory(root: string, scene: SceneName, time: Date): Promise<SceneFactory> {
  const options = { ...PLACE, now: () => time }
  if (scene === 'forest') {
    const { createForestScene } = await import(/* @vite-ignore */ `${root}/components/backdrop/gpu/forest/index.ts`)
    return createForestScene(options)
  }
  const { createOceanScene } = await import(/* @vite-ignore */ `${root}/components/backdrop/gpu/ocean/index.ts`)
  return createOceanScene(options)
}

/** Every error the GPU reports, and a device lost for any reason but being destroyed. */
function watchErrors(device: GPUDevice, errors: string[]) {
  device.addEventListener('uncapturederror', (event) => errors.push(event.error.message))
  device.lost.then(({ reason, message }) => {
    if (reason !== 'destroyed') errors.push(`device lost: ${message}`)
  })
}

/** What has been reported by now: errors arrive as events, after the work they come from. */
async function settledErrors(errors: string[]) {
  await new Promise((resolve) => setTimeout(resolve, 0))
  return errors
}

async function readTexture(device: GPUDevice, texture: GPUTexture) {
  const { width, height } = texture
  // A copy's rows must be a multiple of 256 bytes, as 960 and 1920 pixels are.
  const buffer = device.createBuffer({
    size: width * 4 * height,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  const encoder = device.createCommandEncoder()
  encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: width * 4 }, [width, height])
  device.queue.submit([encoder.finish()])
  await buffer.mapAsync(GPUMapMode.READ)
  const pixels = new Uint8Array(buffer.getMappedRange()).slice()
  buffer.destroy()
  return pixels
}

/** A scene on a device of its own, `frames` frames at 1/60 s each, as the renderer would hand them over. */
async function renderScene(
  root: string,
  c: Extract<Case, { scene: SceneName }>,
  [width, height] = [WIDTH, HEIGHT],
): Promise<Rendered> {
  const errors: string[] = []
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return { pixels: null, errors: ['no WebGPU adapter'] }
  const device = await adapter.requestDevice({
    requiredLimits: { maxTextureDimension2D: adapter.limits.maxTextureDimension2D },
  })
  watchErrors(device, errors)
  let scene: BackdropScene | null = null
  try {
    scene = await (await sceneFactory(root, c.scene, c.time))(device)
    const target = device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    })
    for (let i = 0; i < c.frames; i++) {
      const encoder = device.createCommandEncoder()
      const seconds = c.still ? 0 : i / 60
      const delta = c.still ? 0 : 1 / 60
      scene.render({
        encoder,
        target: target.createView(),
        width,
        height,
        seconds,
        delta,
        still: c.still,
        time: c.time,
        rain: c.rain,
      })
      device.queue.submit([encoder.finish()])
    }
    const pixels = await readTexture(device, target)
    return { pixels, errors: await settledErrors(errors) }
  } catch (error) {
    errors.push(`would not build: ${error instanceof Error ? error.message : String(error)}`)
    return { pixels: null, errors: await settledErrors(errors) }
  } finally {
    scene?.dispose()
    device.destroy()
  }
}

/** The renderer's glass over a picture, or over the ocean held still, read back from its canvas. */
async function renderGlass(root: string, over: 'picture' | 'ocean'): Promise<Rendered> {
  const errors: string[] = []
  const { createRenderer, loadImage }: RendererModule = await import(
    /* @vite-ignore */ `${root}/components/backdrop/gpu/renderer.ts`
  )
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  let renderer: Renderer | null = null
  try {
    renderer = await createRenderer(canvas, {
      signal: new AbortController().signal,
      onLost: () => errors.push('the renderer was lost: the GPU refused something'),
    })
    if (!renderer) return { pixels: null, errors: ['no renderer: no WebGPU, or a shader the GPU refused'] }
    if (over === 'picture') {
      renderer.setImage(await loadImage(PICTURE))
    } else {
      // Held still, so that its one frame doesn't go by the clock.
      renderer.holdScene(true, NIGHT)
      const scene = await renderer.prepareScene(await sceneFactory(root, 'ocean', NIGHT))
      renderer.setImage(null, false, scene)
    }
    renderer.draw(WIDTH, HEIGHT, 1, LENSES)
    // Read in the same task as the draw, while the canvas still holds it.
    const copy = new OffscreenCanvas(WIDTH, HEIGHT)
    const context = copy.getContext('2d', { willReadFrequently: true })!
    context.drawImage(canvas, 0, 0)
    const pixels = new Uint8Array(context.getImageData(0, 0, WIDTH, HEIGHT).data.buffer)
    await renderer.settled()
    return { pixels, errors: await settledErrors(errors) }
  } catch (error) {
    errors.push(`failed: ${error instanceof Error ? error.message : String(error)}`)
    return { pixels: null, errors: await settledErrors(errors) }
  } finally {
    renderer?.dispose()
    canvas.remove()
  }
}

/** Where two renders differ, in red by how much over this one in grey, as a PNG data URL. */
async function diffPicture(ours: Uint8Array, theirs: Uint8Array) {
  const image = new ImageData(WIDTH, HEIGHT)
  for (let i = 0; i < ours.length; i += 4) {
    let most = 0
    for (let c = 0; c < 3; c++) most = Math.max(most, Math.abs(ours[i + c] - theirs[i + c]))
    const grey = (ours[i] + ours[i + 1] + ours[i + 2]) / 12
    image.data.set(most ? [Math.min(255, 128 + most * 8), 0, 0, 255] : [grey, grey, grey, 255], i)
  }
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT)
  canvas.getContext('2d')!.putImageData(image, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

function render(root: string, c: Case) {
  return 'scene' in c ? renderScene(root, c) : renderGlass(root, c.glassOver)
}

async function check(c: Case, root: string, base: string | null): Promise<CaseResult> {
  const ours = await render(root, c)
  const theirs = base ? await render(base, c) : null
  const errors = [...ours.errors, ...(theirs?.errors.map((error) => `in the base: ${error}`) ?? [])]
  let brightness = 0
  if (ours.pixels) {
    for (let i = 0; i < ours.pixels.length; i += 4)
      brightness += ours.pixels[i] + ours.pixels[i + 1] + ours.pixels[i + 2]
    brightness /= WIDTH * HEIGHT * 3
  }
  if (!ours.pixels || !theirs?.pixels) return { name: c.name, errors, differing: null, largest: null, brightness }
  let differing = 0
  let largest = 0
  for (let i = 0; i < ours.pixels.length; i++) {
    const by = Math.abs(ours.pixels[i] - theirs.pixels[i])
    if (by) {
      differing++
      largest = Math.max(largest, by)
    }
  }
  const diff = differing ? await diffPicture(ours.pixels, theirs.pixels) : undefined
  return { name: c.name, errors, differing, largest, brightness, diff }
}

window.gpuCheck = async ({ ours, base }) => {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) throw new Error('This browser has no WebGPU adapter')
  const { vendor, architecture, description } = adapter.info
  const cases: CaseResult[] = []
  for (const c of CASES) {
    // Read by run.mjs as progress.
    console.info(c.name)
    cases.push(await check(c, ours, base))
  }
  return { adapter: [vendor, architecture, description].filter(Boolean).join(' '), cases }
}

// DynamicBackground's fallback pictures (src/components/dynamicBackground/pictures), each a scene as it looks at
// noon or at midnight in London on midsummer's day, two seconds in, as it shows them
// where a scene can't be drawn. They have to be made again whenever a scene's
// camera moves, or where its sun, moon or stars are drawn, or they stop matching it.

/** A picture made afresh, as WebP, and how it compares with the one it would replace. */
export interface Picture {
  name: string
  errors: string[]
  /** The picture, as a WebP data URL. */
  webp: string | null
  /** How far it is from the old one, decoded, on average, in 255ths: over the sky, and over all of it. */
  skyChange: number | null
  change: number | null
  /** What the page's colours are chosen from in it, by `samplePicture`, for PAGE_IMAGES in pictures.ts. */
  pageImage: unknown
  /** Where the moon's disc is, in the new picture and the old: night pictures only. */
  moon: [number, number] | null
  oldMoon: [number, number] | null
}

const PICTURE_SIZE: [number, number] = [1920, 1080]

/** The pictures, and what each is of. */
const PICTURES: { name: string; scene: SceneName; time: Date }[] = [
  { name: 'forest', scene: 'forest', time: DAY },
  { name: 'forest-night', scene: 'forest', time: NIGHT },
  { name: 'ocean', scene: 'ocean', time: DAY },
  { name: 'ocean-night', scene: 'ocean', time: NIGHT },
]

/** Two seconds of frames, as the pictures always had. */
const PICTURE_FRAMES = 120

/** How closely a picture is kept, 0–1: about 310 kB for the forest by day. */
const PICTURE_QUALITY = 0.7

/** The rows that are only sky in every picture, at 1080p, above the tree line and the horizon. */
const SKY_ROWS = 380

/** Where to look for the moon, at 1080p: away from its glitter on the ocean and the brightest of the Milky Way. */
const MOON_SEARCH = { left: 860, top: 20, right: 1060, bottom: 210 }

async function decode(source: Blob) {
  const bitmap = await createImageBitmap(source)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(bitmap, 0, 0)
  return context.getImageData(0, 0, bitmap.width, bitmap.height)
}

/** The middle of the moon's disc: of the pixels over 60% as bright as the brightest where it is looked for. */
function moonIn({ data, width }: ImageData): [number, number] {
  const { left, top, right, bottom } = MOON_SEARCH
  const light = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return data[i] + data[i + 1] + data[i + 2]
  }
  let brightest = 0
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) brightest = Math.max(brightest, light(x, y))
  let sumX = 0
  let sumY = 0
  let count = 0
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (light(x, y) > brightest * 0.6) {
        sumX += x
        sumY += y
        count++
      }
    }
  }
  return [sumX / count, sumY / count]
}

/** The mean difference between two pictures of a size, in 255ths, over rows `from` to `to`. */
function meanChange(a: ImageData, b: ImageData, from: number, to: number) {
  let sum = 0
  for (let i = from * a.width * 4; i < to * a.width * 4; i += 4) {
    for (let c = 0; c < 3; c++) sum += Math.abs(a.data[i + c] - b.data[i + c])
  }
  return sum / ((to - from) * a.width * 3)
}

function dataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

async function makePicture({ name, scene, time }: (typeof PICTURES)[number]): Promise<Picture> {
  const made: Picture = {
    name,
    errors: [],
    webp: null,
    pageImage: null,
    skyChange: null,
    change: null,
    moon: null,
    oldMoon: null,
  }
  const [width, height] = PICTURE_SIZE
  const shot = { name, scene, time, frames: PICTURE_FRAMES, rain: false, still: false }
  const { pixels, errors } = await renderScene('/src', shot, PICTURE_SIZE)
  made.errors = errors
  if (!pixels) return made
  // Opaque, whatever the scene left in its alpha.
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255
  const canvas = new OffscreenCanvas(width, height)
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: PICTURE_QUALITY })
  made.webp = await dataUrl(blob)
  const { samplePicture }: typeof import('../../src/server') = await import(/* @vite-ignore */ `${'/src'}/server.ts`)
  made.pageImage = samplePicture(await decode(blob))

  // Compared as both are seen: decoded from WebP, which alone accounts for about 0.7/255.
  const response = await fetch(`/src/components/dynamicBackground/pictures/${name}.webp`, { cache: 'no-store' })
  if (!response.ok) return made
  const [fresh, old] = await Promise.all([decode(blob), decode(await response.blob())])
  if (old.width !== width || old.height !== height) return made
  made.skyChange = meanChange(fresh, old, 0, SKY_ROWS)
  made.change = meanChange(fresh, old, 0, height)
  if (time === NIGHT) {
    made.moon = moonIn(fresh)
    made.oldMoon = moonIn(old)
  }
  return made
}

window.gpuPictures = async () => {
  const pictures: Picture[] = []
  for (const picture of PICTURES) {
    console.info(picture.name)
    pictures.push(await makePicture(picture))
  }
  return pictures
}
