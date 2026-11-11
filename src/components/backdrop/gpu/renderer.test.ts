import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRenderer,
  fitTexture,
  nextSceneScale,
  sceneSize,
  type BackdropScene,
  type LensDraw,
  type Renderer,
  type RendererOptions,
  type SceneFrame,
} from './renderer'
import { shaderSource, UNIFORM, UNIFORM_SIZE } from './shaders'
import { coverMap } from './viewMaps'

type Field = keyof typeof UNIFORM

interface FakeTexture {
  label?: string
  width: number
  height: number
  destroyed: boolean
  destroy(): void
  createView(descriptor?: GPUTextureViewDescriptor): FakeView
}

interface FakeView {
  texture: FakeTexture
  baseMipLevel: number
}

/** A draw as the GPU would see it: what it was drawn with, on what, and its uniforms. */
interface FakeDraw {
  pipeline: string
  target: FakeView
  source: unknown
  read(field: Field, length?: number): number | number[]
}

function fakeTexture(descriptor: GPUTextureDescriptor | { size: number[]; label?: string }): FakeTexture {
  const [width, height] = descriptor.size as number[]
  const texture: FakeTexture = {
    label: descriptor.label,
    width,
    height,
    destroyed: false,
    destroy: () => {
      texture.destroyed = true
    },
    createView: (view) => ({ texture, baseMipLevel: view?.baseMipLevel ?? 0 }),
  }
  return texture
}

/** A canvas with a context that hands out a texture of the canvas's size. */
function fakeCanvas() {
  const canvas = document.createElement('canvas')
  const context = {
    configure: vi.fn<GPUCanvasContext['configure']>(),
    getCurrentTexture: vi.fn<() => FakeTexture>(() =>
      fakeTexture({ size: [canvas.width, canvas.height], label: 'canvas' }),
    ),
  }
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as GPUCanvasContext)
  return { canvas, context }
}

/**
 * A GPU that does just enough for createRenderer to set up and records what is
 * drawn, with `overrides` in place of its device's defaults. jsdom has no WebGPU
 * of its own; what the shaders do with all this is checked in the browser.
 */
function fakeGpu(overrides: Record<string, unknown> = {}) {
  const textures: FakeTexture[] = []
  const draws: FakeDraw[] = []
  const buffers: { size: number; destroyed: boolean; destroy(): void }[] = []
  const writes = vi.fn<(data: Float32Array, length: number) => void>()
  const copies = vi.fn<GPUCommandEncoder['copyTextureToBuffer']>()
  const mapping = vi.fn<() => Promise<void>>(() => Promise.resolve())
  /** How long the GPU's own clock says each frame took, in ms, where it has timestamps. */
  const clock = { frameMs: 1 }
  let lose: (info: Pick<GPUDeviceLostInfo, 'reason'>) => void = () => {}
  const refusals: (() => void)[] = []

  // Encoded, with their uniforms yet to be written.
  let encoded: { pipeline: string; target: FakeView; source: unknown; offset: number }[] = []

  const device = {
    limits: { maxTextureDimension2D: 4096 },
    features: new Set<string>(),
    lost: new Promise<Pick<GPUDeviceLostInfo, 'reason'>>((resolve) => (lose = resolve)),
    destroy: vi.fn<() => void>(),
    addEventListener: (_: string, listener: () => void) => refusals.push(listener),
    createShaderModule: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createSampler: () => ({}),
    // The entry point stands in for the pipeline.
    createRenderPipelineAsync: (descriptor: GPURenderPipelineDescriptor) =>
      Promise.resolve(descriptor.fragment!.entryPoint),
    createBindGroup: (descriptor: GPUBindGroupDescriptor) => ({ entries: descriptor.entries }),
    createQuerySet: () => ({}),
    createBuffer: (descriptor: GPUBufferDescriptor) => {
      const buffer = {
        size: descriptor.size,
        destroyed: false,
        // Whether timestamps are copied into it.
        timestamps: false,
        destroy: () => {
          buffer.destroyed = true
        },
        mapAsync: () => mapping(),
        unmap: () => {},
        getMappedRange: () => {
          if (buffer.timestamps)
            return new BigUint64Array([5_000_000n, 5_000_000n + BigInt(clock.frameMs * 1e6)]).buffer
          // Every byte its own row's number, to tell the rows apart.
          const bytes = new Uint8Array(descriptor.size)
          for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(i / 256)
          return bytes.buffer
        },
      }
      buffers.push(buffer)
      return buffer
    },
    createTexture: (descriptor: GPUTextureDescriptor) => {
      const texture = fakeTexture(descriptor)
      textures.push(texture)
      return texture
    },
    createCommandEncoder: () => ({
      copyTextureToBuffer: copies,
      beginComputePass: () => ({ end: () => {} }),
      resolveQuerySet: () => {},
      copyBufferToBuffer: (_: unknown, __: number, destination: { timestamps: boolean }) => {
        destination.timestamps = true
      },
      beginRenderPass: (descriptor: GPURenderPassDescriptor) => {
        const target = [...descriptor.colorAttachments][0]!.view as unknown as FakeView
        let pipeline = ''
        let offset = 0
        let source: unknown
        return {
          setPipeline: (next: string) => {
            pipeline = next
          },
          setBindGroup: (index: number, group: unknown, offsets?: number[]) => {
            if (index === 0) offset = offsets![0]
            else source = group
          },
          draw: () => encoded.push({ pipeline, target, source, offset }),
          end: () => {},
        }
      },
      finish: () => ({}),
    }),
    queue: {
      copyExternalImageToTexture: vi.fn<GPUQueue['copyExternalImageToTexture']>(),
      submit: vi.fn<GPUQueue['submit']>(),
      onSubmittedWorkDone: vi.fn<() => Promise<void>>(() => Promise.resolve()),
      writeBuffer: (_: GPUBuffer, __: number, data: Float32Array, ___: number, length: number) => {
        writes(data, length)
        // Later frames write over the same array.
        const snapshot = data.slice()
        for (const { offset, ...draw } of encoded) {
          draws.push({
            ...draw,
            read: (field, size = 1) => {
              const at = offset / 4 + UNIFORM[field]
              return size === 1 ? snapshot[at] : [...snapshot.subarray(at, at + size)]
            },
          })
        }
        encoded = []
      },
    },
    ...overrides,
  }

  const adapter = {
    limits: { maxTextureDimension2D: 16384 },
    features: device.features,
    requestDevice: vi.fn<(descriptor: GPUDeviceDescriptor) => Promise<typeof device>>(() => Promise.resolve(device)),
  }
  const gpu = {
    requestAdapter: vi.fn<() => Promise<typeof adapter | null>>(() => Promise.resolve(adapter)),
    getPreferredCanvasFormat: () => 'bgra8unorm',
  }
  vi.stubGlobal('navigator', { gpu })
  /** The GPU refuses something, as a validation error or running out of memory. */
  const refuse = () => refusals.forEach((listener) => listener())
  return { gpu, adapter, device, textures, draws, buffers, copies, mapping, clock, lose, refuse }
}

function options(overrides: Partial<RendererOptions> = {}): RendererOptions {
  return { signal: new AbortController().signal, onLost: () => {}, ...overrides }
}

const picture = (naturalWidth: number, naturalHeight: number) =>
  ({ naturalWidth, naturalHeight }) as unknown as HTMLImageElement

/** A renderer on a recording GPU, with an image to draw. */
async function drawingRenderer() {
  const gpu = fakeGpu()
  const { canvas, context } = fakeCanvas()
  const renderer = (await createRenderer(canvas, options()))!
  renderer.setImage(picture(2000, 1000))
  gpu.draws.length = 0
  const on = (entryPoint: string) => gpu.draws.filter((draw) => draw.pipeline === entryPoint)
  return {
    ...gpu,
    canvas,
    context,
    renderer,
    blurs: () => on('blurMain'),
    images: () => on('imageMain'),
    lenses: () => on('lensMain'),
    /** Blurred images made and not yet let go. */
    liveBlurs: () => gpu.textures.filter((t) => t.label === 'blur' && !t.destroyed).length,
  }
}

function lensWithBlur(blur: number): LensDraw {
  return {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    clip: [0, 0, 1000, 800],
    feather: [0, 0, 0, 0],
    radius: 16,
    squircle: false,
    strength: 20,
    bezel: 16,
    hole: 0,
    soft: 0,
    blur,
    frost: 0,
    opacity: 1,
  }
}

beforeEach(() => {
  // A screen no image here is too large for, unless a test says otherwise.
  vi.stubGlobal('screen', { width: 16384, height: 16384 })
  // Only ever read as a browser has them; their values don't matter here.
  vi.stubGlobal('GPUShaderStage', { VERTEX: 1, FRAGMENT: 2 })
  vi.stubGlobal('GPUBufferUsage', { UNIFORM: 64, COPY_DST: 8, MAP_READ: 1 })
  vi.stubGlobal('GPUTextureUsage', { TEXTURE_BINDING: 4, RENDER_ATTACHMENT: 16, COPY_DST: 2, COPY_SRC: 1 })
  vi.stubGlobal('GPUMapMode', { READ: 1 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('uniforms', () => {
  /** Each field of the WGSL struct, in floats, by WGSL's layout rules. */
  function layout() {
    const struct = /struct Uniforms \{(.*?)\n\}/s.exec(shaderSource)![1]
    const sizes = { f32: [1, 1], vec2f: [2, 2], vec3f: [3, 4], vec4f: [4, 4] } as const
    const fields: Record<string, number> = {}
    let at = 0
    for (const [, name, type] of struct.matchAll(/^\s*(\w+): (\w+),$/gm)) {
      const [size, align] = sizes[type as keyof typeof sizes]
      at = Math.ceil(at / align) * align
      fields[name] = at
      at += size
    }
    return { fields, bytes: (Math.ceil(at / 4) * 4 * 4) as number }
  }

  it('are written where the shader reads them', () => {
    expect(UNIFORM).toEqual(layout().fields)
    expect(UNIFORM_SIZE).toBe(layout().bytes)
  })
})

describe('glass over the page', () => {
  it('is drawn on its own canvas, over a bare image, showing its part of the viewport', async () => {
    const r = await drawingRenderer()
    const { canvas, context } = fakeCanvas()
    const lens = { ...lensWithBlur(3), x: 100, y: 50, width: 40, height: 20 }

    r.renderer.draw(1000, 800, 2, [lensWithBlur(3)], 1, [{ lens, canvas }])

    expect(context.configure).toHaveBeenCalledOnce()
    expect([canvas.width, canvas.height]).toEqual([80, 40])
    const own = r.draws.filter((draw) => draw.target.texture.width === 80)
    expect(own.map((draw) => draw.pipeline)).toEqual(['imageMain', 'lensMain'])
    expect(own[1].read('view', 4)).toEqual([100, 50, 40, 20])
    expect(own[1].read('quad', 4)).toEqual([100, 50, 40, 20])
  })

  it('leaves the page to be drawn on its own, without the overlay', async () => {
    const r = await drawingRenderer()
    const lens = lensWithBlur(3)
    r.renderer.draw(1000, 800, 1, [lens], 1, [{ lens: lensWithBlur(6), canvas: fakeCanvas().canvas }])

    const page = r.draws.filter((draw) => draw.target.texture.width === 1000 && draw.pipeline !== 'blurMain')
    expect(page.map((draw) => draw.pipeline)).toEqual(['imageMain', 'lensMain'])
    expect(page[0].read('view', 4)).toEqual([0, 0, 1000, 800])
  })

  it('shares blurred images with the page, made once', async () => {
    const r = await drawingRenderer()
    const overlay = { lens: lensWithBlur(3), canvas: fakeCanvas().canvas }
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)], 1, [overlay])
    expect(r.liveBlurs()).toBe(1)
  })

  it('keeps every blur drawn in the frame, past the most it would otherwise keep', async () => {
    const r = await drawingRenderer()
    const page = [1, 2, 3, 4].map(lensWithBlur)
    const overlays = [{ lens: lensWithBlur(6), canvas: fakeCanvas().canvas }]
    r.renderer.draw(1000, 800, 1, page, 1, overlays)
    const before = r.liveBlurs()
    r.renderer.draw(1000, 800, 1, page, 1, overlays)
    expect(r.liveBlurs()).toBe(before)
    expect(before).toBe(5)
  })

  it("stays within what the GPU can make, which would cost the page's frame too", async () => {
    const r = await drawingRenderer()
    const { canvas } = fakeCanvas()
    const lens = { ...lensWithBlur(3), width: 5000, height: 2000 }
    r.renderer.draw(1000, 800, 2, [], 1, [{ lens, canvas }])
    expect([canvas.width, canvas.height]).toEqual([4096, 4000])
  })

  it('configures a canvas once, however many frames it is drawn in', async () => {
    const r = await drawingRenderer()
    const { canvas, context } = fakeCanvas()
    const overlays = [{ lens: lensWithBlur(3), canvas }]
    r.renderer.draw(1000, 800, 1, [], 1, overlays)
    r.renderer.draw(1000, 800, 1, [], 1, overlays)
    expect(context.configure).toHaveBeenCalledOnce()
  })

  it("leaves out a canvas that can't be drawn on", async () => {
    const r = await drawingRenderer()
    const bare = document.createElement('canvas')
    vi.spyOn(bare, 'getContext').mockReturnValue(null)
    r.renderer.draw(1000, 800, 1, [], 1, [{ lens: lensWithBlur(3), canvas: bare }])
    expect(r.images()).toHaveLength(1)
  })
})

describe('blurring', () => {
  let now = 0

  beforeEach(() => {
    now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })

  it('makes a narrow blur at full resolution, a tap per device px', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 2, [lensWithBlur(1.5)])

    const [across] = r.blurs()
    expect([across.target.texture.width, across.target.texture.height]).toEqual([2000, 1600])
    expect(across.read('sigma')).toBe(3)
    expect(across.read('taps')).toBe(9)
  })

  it('makes a wide blur at a lower resolution, where it is 4 texels wide', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 2, [lensWithBlur(20)])

    const [across, down] = r.blurs()
    // Sigma 40 device px: a tenth of the resolution.
    expect([across.target.texture.width, across.target.texture.height]).toEqual([200, 160])
    expect(across.read('sigma')).toBe(4)
    expect(across.read('taps')).toBe(12)
    // A tap per texel, in CSS px.
    expect(across.read('axis', 2)).toEqual([5, 0])
    expect(down.read('axis', 2)).toEqual([0, 5])
  })

  it('reads the first pass back without flipping it, as a texture runs top down', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])

    const [across, down] = r.blurs()
    const [x, y, offsetX, offsetY] = down.read('map', 4) as number[]
    expect(x).toBeCloseTo(1 / 1000)
    expect(y).toBeCloseTo(1 / 800)
    expect([offsetX, offsetY]).toEqual([0, 0])
    const [{ resource }] = (down.source as { entries: { resource: FakeView }[] }).entries
    expect(resource.texture).toBe(across.target.texture)
  })

  it('keeps one texture per blur, made once, sharing one within a quarter px', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3), lensWithBlur(3.1)])
    expect(r.liveBlurs()).toBe(1)

    r.draws.length = 0
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    expect(r.blurs()).toEqual([])
    expect(r.liveBlurs()).toBe(1)
  })

  it('lets go of the scratch texture only once the frame is sent', async () => {
    const r = await drawingRenderer()
    const stillLive: number[] = []
    r.device.queue.submit.mockImplementation(() => {
      stillLive.push(r.textures.filter((t) => t.label === 'blur' && !t.destroyed).length)
    })
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    expect(stillLive).toEqual([2])
    expect(r.liveBlurs()).toBe(1)
  })

  it('keeps every blur on screen, but at most 4 once off it', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [1, 2, 3, 4, 5, 6].map(lensWithBlur))
    expect(r.liveBlurs()).toBe(6)

    // An animated blur: a new radius every frame.
    for (let blur = 7; blur < 30; blur += 0.5) r.renderer.draw(1000, 800, 1, [lensWithBlur(blur)])
    expect(r.liveBlurs()).toBe(4)
  })

  it('makes a blur again when a browser zoom keeps the pixels but changes the ratio', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(1)])
    r.renderer.draw(500, 400, 2, [lensWithBlur(1)])
    now += 1000
    r.draws.length = 0
    r.renderer.draw(500, 400, 2, [lensWithBlur(1)])
    expect(r.blurs()[0].read('sigma')).toBe(2)
    expect(r.liveBlurs()).toBe(1)
  })

  it('makes no blurs while the viewport is resizing, and says it wants another draw', async () => {
    const r = await drawingRenderer()
    expect(r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])).toBe(false)
    r.draws.length = 0

    for (const width of [1100, 1200, 1300]) {
      expect(r.renderer.draw(width, 800, 1, [lensWithBlur(3)])).toBe(true)
      now += 16
    }
    expect(r.blurs()).toEqual([])
    expect(r.liveBlurs()).toBe(1)
  })

  it('makes each blur again once the viewport has settled, and asks for no more draws', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    r.renderer.draw(1200, 800, 1, [lensWithBlur(3)])
    now += 1000
    r.draws.length = 0

    expect(r.renderer.draw(1200, 800, 1, [lensWithBlur(3)])).toBe(false)
    expect(r.blurs()).toHaveLength(2)
    expect(r.liveBlurs()).toBe(1)
    expect(r.renderer.draw(1200, 800, 1, [lensWithBlur(3)])).toBe(false)
    expect(r.blurs()).toHaveLength(2)
  })

  it('keeps glass on the image with a blur made for another viewport', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    r.draws.length = 0
    r.renderer.draw(1300, 700, 1, [lensWithBlur(3)])

    const inBlur = uvAt(r.lenses()[0].read('map', 4) as number[], 300, 200)
    const onImage = uvAt(coverMap(1300, 700, 2000, 1000), 300, 200)
    const then = coverMap(1000, 800, 2000, 1000)
    const [x, y] = [inBlur[0] * 1000, inBlur[1] * 800]
    expect(uvAt(then, x, y)[0]).toBeCloseTo(onImage[0], 5)
    expect(uvAt(then, x, y)[1]).toBeCloseTo(onImage[1], 5)
  })

  it('makes a blur it has none of yet, even while resizing', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    r.draws.length = 0
    r.renderer.draw(1200, 800, 1, [lensWithBlur(3), lensWithBlur(7)])
    expect(r.blurs()).toHaveLength(2)
  })
})

describe('drawing', () => {
  it('draws the image and its glass over the colour behind it', async () => {
    const r = await drawingRenderer()
    r.renderer.setMatte(0.25, 0.5, 0.75)
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    expect(r.images()[0].read('matte', 3)).toEqual([0.25, 0.5, 0.75])
    expect(r.lenses()[0].read('matte', 3)).toEqual([0.25, 0.5, 0.75])
  })

  it('draws over white until told otherwise', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [])
    expect(r.images()[0].read('matte', 3)).toEqual([1, 1, 1])
  })

  it('keeps its blurs when the colour behind the image changes', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    r.draws.length = 0
    r.renderer.setMatte(0, 0, 0)
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    expect(r.blurs()).toEqual([])
  })

  it('draws lenses on a vertex stage of their own, told how wide a device pixel is to reach past their box by', async () => {
    const vertices: Record<string, string> = {}
    fakeGpu({
      createRenderPipelineAsync: ({ vertex, fragment }: GPURenderPipelineDescriptor) => {
        vertices[fragment!.entryPoint!] = vertex.entryPoint!
        return Promise.resolve(fragment!.entryPoint)
      },
    })
    await createRenderer(fakeCanvas().canvas, options())
    expect(vertices).toEqual({ imageMain: 'vertexMain', blurMain: 'vertexMain', lensMain: 'lensVertex' })

    // A device pixel in CSS px, which lensVertex grows the quad by on every side.
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 2, [lensWithBlur(3)])
    expect(r.lenses()[0].read('pixel')).toBe(0.5)
  })

  it('sizes the canvas to the viewport, within what the GPU can make', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 500, 2, [])
    expect([r.canvas.width, r.canvas.height]).toEqual([2000, 1000])

    r.renderer.draw(3000, 500, 2, [])
    expect([r.canvas.width, r.canvas.height]).toEqual([4096, 1000])
  })

  it('makes room for as many draws as a frame has', async () => {
    const r = await drawingRenderer()
    const [first] = r.buffers
    r.renderer.draw(
      1000,
      800,
      1,
      Array.from({ length: 200 }, (_, i) => ({ ...lensWithBlur(3), x: i })),
    )

    expect(first.destroyed).toBe(true)
    expect(r.lenses().map((draw) => draw.read('quad'))).toEqual(Array.from({ length: 200 }, (_, i) => i))
  })

  it('clears the canvas until there is an image', async () => {
    const gpu = fakeGpu()
    const { canvas, context } = fakeCanvas()
    const renderer = (await createRenderer(canvas, options()))!
    renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    expect(context.getCurrentTexture).toHaveBeenCalledOnce()
    expect(gpu.device.queue.submit).toHaveBeenCalledOnce()
    expect(gpu.draws).toEqual([])
  })
})

describe('a ring', () => {
  it('tells the shader the radius of the hole through a lens, and how soft its edges are', async () => {
    const r = await drawingRenderer()
    r.renderer.setImage(picture(100, 100))
    r.draws.length = 0
    r.renderer.draw(1000, 800, 1, [{ ...lensWithBlur(3), hole: 36, soft: 1.5 }, lensWithBlur(3)])

    expect(r.lenses().map((lens) => lens.read('hole'))).toEqual([36, 0])
    expect(r.lenses().map((lens) => lens.read('soft'))).toEqual([1.5, 0])
  })
})

describe('frosted glass', () => {
  const frosted = { ...lensWithBlur(1), frost: 6 }

  it('tells the shader the blurs at its bottom and its top, and that plain glass has no frost', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [frosted, lensWithBlur(3)])

    expect(r.lenses().map((lens) => lens.read('frost'))).toEqual([6, 0])
    expect(r.lenses().map((lens) => lens.read('sigma'))).toEqual([1, 3])
  })

  it('reads the image, which has the mips to blur by, as the image itself is drawn', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [frosted])

    const [image] = r.images()
    const [lens] = r.lenses()
    expect(lens.source).toBe(image.source)
    expect(lens.read('map', 4)).toEqual(image.read('map', 4))
  })

  it('makes no blurred image of its own, which is the whole cost of plain glass', async () => {
    const r = await drawingRenderer()
    r.renderer.draw(1000, 800, 1, [frosted])

    expect(r.blurs()).toEqual([])
    expect(r.liveBlurs()).toBe(0)
  })

  it('draws from both images while crossfading', async () => {
    const r = await drawingRenderer()
    r.renderer.setImage(picture(100, 100), true)
    r.draws.length = 0
    r.renderer.draw(1000, 800, 1, [frosted], 0.25)

    expect(r.lenses().map((lens) => lens.source)).toEqual(r.images().map((image) => image.source))
  })
})

describe('the frost in the shader', () => {
  const frosted = shaderSource.match(/fn frosted\([\s\S]*?\n}/)![0]
  const taps = [...frosted.matchAll(/px \+ vec2f\((-?[\d.]+), (-?[\d.]+)\) \* sigma/g)].map(([, x, y]) => [+x, +y])

  it('takes evenly weighted looks spread as a Gaussian is, centred on the fragment', () => {
    const count = Number(frosted.match(/sum \/ (\d+)\.0/)![1])
    expect(taps.length).toBeGreaterThan(1)
    expect(taps).toHaveLength(count)

    const mean = (at: (tap: number[]) => number) => taps.reduce((sum, tap) => sum + at(tap), 0) / taps.length
    expect(Math.abs(mean(([x]) => x))).toBeLessThan(0.1)
    expect(Math.abs(mean(([, y]) => y))).toBeLessThan(0.1)
    // Each axis's variance, which a Gaussian of one standard deviation has at 1.
    expect(mean(([x, y]) => (x * x + y * y) / 2)).toBeCloseTo(1, 0)
  })
})

describe('crossfading', () => {
  const image = picture(100, 100)

  it('draws the new image and its glass over the old by how far it has come, then lets the old go', async () => {
    const r = await drawingRenderer()
    r.renderer.setImage(image)
    r.renderer.setImage(image, true)
    r.draws.length = 0
    r.renderer.draw(1000, 800, 1, [{ ...lensWithBlur(3), opacity: 0.8 }], 0.25)

    // Old image, new image; then the old glass and the new.
    const opacity = (draw: FakeDraw) => draw.read('opacity') as number
    expect(r.images().map(opacity)).toEqual([1, 0.25])
    expect(r.lenses()[0].read('opacity')).toBeCloseTo(0.8)
    expect(r.lenses()[1].read('opacity')).toBeCloseTo(0.2)
    expect(r.liveBlurs()).toBe(2)

    r.draws.length = 0
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)], 1)
    expect([...r.images(), ...r.lenses()].map(opacity)).toEqual([1, 1])
    expect(r.liveBlurs()).toBe(1)
  })

  it('swaps straight away without a crossfade', async () => {
    const r = await drawingRenderer()
    r.renderer.setImage(image)
    r.renderer.setImage(image)
    r.draws.length = 0
    r.renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    expect(r.images()).toHaveLength(1)
    expect(r.lenses()).toHaveLength(1)
  })
})

describe('setImage', () => {
  it('makes mipmaps, each level copied from the one above it', async () => {
    const gpu = fakeGpu()
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    renderer.setImage(picture(9, 4))

    // 9×4, 4×2, 2×1, 1×1.
    expect(gpu.draws.map((draw) => draw.target.baseMipLevel)).toEqual([1, 2, 3])
    expect(gpu.draws.map((draw) => draw.pipeline)).toEqual(['blurMain', 'blurMain', 'blurMain'])
    expect(gpu.draws.every((draw) => draw.read('taps') === 0)).toBe(true)
    const [{ source }] = gpu.draws
    const [{ resource }] = (source as { entries: { resource: FakeView }[] }).entries
    expect(resource.baseMipLevel).toBe(0)
  })

  it("releases the texture it made if the image can't be one", async () => {
    const gpu = fakeGpu()
    gpu.device.queue.copyExternalImageToTexture.mockImplementation(() => {
      throw new DOMException('Tainted', 'SecurityError')
    })
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    expect(() => renderer.setImage(picture(10, 10))).toThrow('Tainted')
    expect(gpu.textures.map((t) => t.destroyed)).toEqual([true])
  })

  it('keeps an image premultiplied, so that its blurs mix see-through pixels by how much of them there is', async () => {
    const gpu = fakeGpu()
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    renderer.setImage(picture(10, 10))
    expect(gpu.device.queue.copyExternalImageToTexture.mock.lastCall![1].premultipliedAlpha).toBe(true)
  })

  it('uploads no more of an image than the screen can show', async () => {
    vi.stubGlobal('screen', { width: 1920, height: 1080 })
    const gpu = fakeGpu()
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as unknown as GPUCanvasContext)
    renderer.setImage(picture(3840, 2160))
    expect(gpu.textures.map(({ width, height }) => [width, height])).toEqual([[1920, 1080]])
  })

  it('takes a screen that can turn to be as high as it is wide', async () => {
    vi.stubGlobal('screen', { width: 1000, height: 2000 })
    const gpu = fakeGpu()
    vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 5 })
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as unknown as GPUCanvasContext)
    renderer.setImage(picture(3000, 4000))
    // Turned, the viewport is 2000 wide: 2000×2666 covers it.
    expect(gpu.textures[0].width).toBe(2000)
  })

  it('leaves an image alone that only covers the screen', async () => {
    vi.stubGlobal('screen', { width: 1920, height: 1080 })
    const gpu = fakeGpu()
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    const image = picture(1920, 1080)
    renderer.setImage(image)
    expect(gpu.device.queue.copyExternalImageToTexture.mock.lastCall![0].source).toBe(image)
  })

  it("keeps drawing the image it had when the next can't be a texture", async () => {
    const r = await drawingRenderer()
    r.device.queue.copyExternalImageToTexture.mockImplementation(() => {
      throw new DOMException('Tainted', 'SecurityError')
    })
    expect(() => r.renderer.setImage(picture(10, 10))).toThrow('Tainted')
    r.renderer.draw(1000, 800, 1, [])
    expect(r.images()).toHaveLength(1)
  })
})

describe('scenes', () => {
  /** A renderer ready to draw a scene, on a clock that a test moves by hand. */
  async function sceneRenderer(overrides: Record<string, unknown> = {}) {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const gpu = fakeGpu(overrides)
    const { canvas, context } = fakeCanvas()
    const renderer = (await createRenderer(canvas, options()))!
    const render = vi.fn<(frame: SceneFrame) => void>()
    const dispose = vi.fn<() => void>()
    const scene: BackdropScene = { render, dispose }
    return {
      ...gpu,
      canvas,
      context,
      renderer,
      scene,
      render,
      dispose,
      /** Moves on to the next frame. */
      tick: (ms = 17) => (now += ms),
      /** Moves past the wait for a viewport to settle. */
      settle: () => (now += 500),
      blurs: () => gpu.draws.filter((draw) => draw.pipeline === 'blurMain'),
      images: () => gpu.draws.filter((draw) => draw.pipeline === 'imageMain'),
    }
  }

  it('sets a scene up on its device', async () => {
    const { renderer, device, scene } = await sceneRenderer()
    const factory = vi.fn<(device: GPUDevice) => Promise<BackdropScene>>(() => Promise.resolve(scene))
    expect(await renderer.prepareScene(factory)).toBe(scene)
    expect(factory).toHaveBeenCalledWith(device, expect.any(AbortSignal))
  })

  it('gives a scene up, and carries on, if the GPU refuses it while it is being made', async () => {
    const gpu = fakeGpu()
    const onLost = vi.fn<() => void>()
    const renderer = (await createRenderer(fakeCanvas().canvas, options({ onLost })))!
    let stopped: AbortSignal
    const making = renderer.prepareScene((_, signal) => {
      stopped = signal!
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason)))
    })
    gpu.refuse()
    await expect(making).rejects.toThrow('refused')
    expect(stopped!.aborted).toBe(true)
    expect(onLost).not.toHaveBeenCalled()
  })

  it('disposes a scene whose refusal only came once it was made', async () => {
    const { renderer, device, refuse, scene, dispose } = await sceneRenderer()
    device.queue.onSubmittedWorkDone.mockImplementation(() => {
      refuse()
      return Promise.resolve()
    })
    await expect(renderer.prepareScene(() => Promise.resolve(scene))).rejects.toThrow('refused')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('is lost if the GPU refuses something with no scene being made', async () => {
    const gpu = fakeGpu()
    const onLost = vi.fn<() => void>()
    await createRenderer(fakeCanvas().canvas, options({ onLost }))
    gpu.refuse()
    expect(onLost).toHaveBeenCalledOnce()
  })

  it('gives a scene up when it is no longer wanted', async () => {
    const { renderer } = await sceneRenderer()
    const wanted = new AbortController()
    const making = renderer.prepareScene(
      (_, signal) => new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason))),
      wanted.signal,
    )
    wanted.abort(new Error('Replaced'))
    await expect(making).rejects.toThrow('Replaced')
  })

  it.each([60, 75, 90, 120, 144, 165, 240])('comes to about 60 frames a second at %d Hz', async (hertz) => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    render.mockClear()
    for (let frame = 0; frame < hertz * 4; frame++) {
      tick(1000 / hertz)
      renderer.draw(1000, 800, 1, [])
    }
    expect(render.mock.calls.length / 4).toBeGreaterThan(59)
    expect(render.mock.calls.length / 4).toBeLessThan(61)
  })

  it.each([30, 75, 90, 144])('stays sharp at %d Hz while the GPU keeps up', async (hertz) => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    for (let frame = 0; frame < hertz * 10; frame++) {
      tick(1000 / hertz)
      renderer.draw(1000, 800, 1, [])
      await Promise.resolve()
    }
    expect(render.mock.lastCall![0]).toMatchObject({ width: 1000, height: 800 })
  })

  it('draws less sharply once the GPU takes too long over a frame', async () => {
    const { renderer, device, scene, render, tick } = await sceneRenderer()
    device.queue.onSubmittedWorkDone.mockImplementation(() => {
      tick(30)
      return Promise.resolve()
    })
    renderer.setImage(picture(2000, 1000), false, scene)
    for (let frame = 0; frame < 200; frame++) {
      tick()
      renderer.draw(1000, 800, 1, [])
      await Promise.resolve()
    }
    expect(render.mock.lastCall![0].width).toBeLessThan(1000)
  })

  describe("by the GPU's own clock", () => {
    const timed = () => sceneRenderer({ features: new Set(['timestamp-query']) })

    it('draws less sharply once the GPU takes too long over a frame', async () => {
      const { renderer, scene, render, tick, clock } = await timed()
      clock.frameMs = 30
      renderer.setImage(picture(2000, 1000), false, scene)
      for (let frame = 0; frame < 200; frame++) {
        tick()
        renderer.draw(1000, 800, 1, [])
        await Promise.resolve()
      }
      expect(render.mock.lastCall![0].width).toBeLessThan(1000)
    })

    it('stays sharp however long the queue takes to get to a frame, as it does on a page held to 30 frames a second', async () => {
      const { renderer, device, scene, render, tick, clock } = await timed()
      clock.frameMs = 2
      device.queue.onSubmittedWorkDone.mockImplementation(() => {
        tick(30)
        return Promise.resolve()
      })
      renderer.setImage(picture(2000, 1000), false, scene)
      for (let frame = 0; frame < 200; frame++) {
        tick()
        renderer.draw(1000, 800, 1, [])
        await Promise.resolve()
      }
      expect(render.mock.lastCall![0]).toMatchObject({ width: 1000, height: 800 })
    })
  })

  it('leaves the canvas alone between frames of a scene', async () => {
    const { renderer, scene, images, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    const drawn = images().length
    tick(8)
    expect(renderer.draw(1000, 800, 1, [])).toBe(true)
    expect(images()).toHaveLength(drawn)
    tick(9)
    renderer.draw(1000, 800, 1, [])
    expect(images().length).toBeGreaterThan(drawn)
  })

  it('draws between frames of a scene if the glass has moved', async () => {
    const { renderer, scene, images, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [lensWithBlur(3)])
    const drawn = images().length
    tick(8)
    renderer.draw(1000, 800, 1, [{ ...lensWithBlur(3), x: 5 }])
    expect(images().length).toBeGreaterThan(drawn)
  })

  it('makes no texture of the image, which only sets the page colours', async () => {
    const { renderer, device, scene, textures } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    expect(textures.some((t) => t.label === 'image')).toBe(false)
    expect(device.queue.copyExternalImageToTexture).not.toHaveBeenCalled()
  })

  it('draws a frame of the scene on a target the size of the canvas', async () => {
    const { renderer, scene, render, images } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledOnce()
    expect(render.mock.lastCall![0]).toMatchObject({ width: 1000, height: 800, seconds: 0 })
    expect(images()).toHaveLength(1)
  })

  it('asks to be drawn again while a scene runs', async () => {
    const { renderer, scene } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    expect(renderer.draw(1000, 800, 1, [])).toBe(true)
  })

  it('moves its clock on by the time between frames, leaving out a stall', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    tick(20)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].delta).toBeCloseTo(0.02)
    tick(5000)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].delta).toBeCloseTo(0.1)
    expect(render.mock.lastCall![0].seconds).toBeCloseTo(0.12)
  })

  it('holds a scene to 60 frames a second on a faster display, keeping its blur', async () => {
    const { renderer, scene, render, tick, blurs, draws } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [lensWithBlur(12)])
    draws.length = 0
    tick(7)
    expect(renderer.draw(1000, 800, 1, [lensWithBlur(12)])).toBe(true)
    expect(render).toHaveBeenCalledOnce()
    expect(blurs()).toHaveLength(0)
  })

  it('makes its blurs again every frame, on the same textures', async () => {
    const { renderer, scene, tick, settle, textures, draws, blurs } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [lensWithBlur(12)])
    settle()
    renderer.draw(1000, 800, 1, [lensWithBlur(12)])
    const madeSoFar = textures.length
    draws.length = 0
    tick()
    renderer.draw(1000, 800, 1, [lensWithBlur(12)])
    // Across and down, after the scene's mips.
    expect(blurs().filter((draw) => (draw.read('taps') as number) > 0)).toHaveLength(2)
    expect(textures).toHaveLength(madeSoFar)
    expect(textures.filter((t) => t.label === 'blur' && !t.destroyed)).toHaveLength(2)
  })

  it('makes one blur for any number of lenses that share it', async () => {
    const { renderer, scene, tick, settle, draws, blurs } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [lensWithBlur(12)])
    settle()
    renderer.draw(1000, 800, 1, [lensWithBlur(12), lensWithBlur(12)])
    draws.length = 0
    tick()
    renderer.draw(1000, 800, 1, [lensWithBlur(12), lensWithBlur(12), lensWithBlur(12)])
    expect(blurs().filter((draw) => (draw.read('taps') as number) > 0)).toHaveLength(2)
  })

  it('makes a blur of a scene at half resolution at most, however narrow', async () => {
    const { renderer, scene, textures } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [lensWithBlur(1)])
    const blur = textures.find((t) => t.label === 'blur')!
    expect([blur.width, blur.height]).toEqual([500, 400])
  })

  it('goes down the mips of a scene for its blurs to read', async () => {
    const { renderer, scene, blurs } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    expect(blurs()).toHaveLength(4)
    expect(blurs().every((draw) => draw.read('taps') === 0)).toBe(true)
  })

  it('draws a still frame once with prefers-reduced-motion, and asks for no more', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    expect(renderer.draw(1000, 800, 1, [])).toBe(false)
    tick()
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledOnce()
  })

  it('redraws a still frame at a new size', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { renderer, scene, render, settle } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    settle()
    renderer.draw(1200, 800, 1, [])
    settle()
    renderer.draw(1200, 800, 1, [])
    expect(render.mock.lastCall![0]).toMatchObject({ width: 1200, height: 800 })
  })

  it('draws a still frame afresh every minute, as the time of day moves on', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    tick(59_000)
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledOnce()
    tick(2_000)
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('holds a scene still when told to, whatever the system says', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.holdScene(true, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    expect(renderer.draw(1000, 800, 1, [])).toBe(false)
    expect(render.mock.lastCall![0].still).toBe(true)
    tick()
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledOnce()
  })

  it('keeps a scene moving when told to, whatever the system says', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { renderer, scene, render } = await sceneRenderer()
    renderer.holdScene(false, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    expect(renderer.draw(1000, 800, 1, [])).toBe(true)
    expect(render.mock.lastCall![0].still).toBe(false)
  })

  it('tells a scene whether it should be raining', async () => {
    const { renderer, scene, render } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].rain).toBe(false)
    renderer.setRain(true)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].rain).toBe(true)
  })

  it('draws a still scene again as the rain changes', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.holdScene(true, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    tick()
    renderer.setRain(true)
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.lastCall![0].rain).toBe(true)
  })

  it('goes back to the system when told nothing', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { renderer, scene, render } = await sceneRenderer()
    renderer.holdScene(false, undefined)
    renderer.holdScene(undefined, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].still).toBe(true)
  })

  it('gives a scene the time it is held at, and takes it away again', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    const noon = new Date(2026, 5, 21, 12)
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].time).toBeUndefined()
    renderer.holdScene(undefined, noon)
    tick()
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].time).toBe(noon)
    renderer.holdScene(undefined, undefined)
    tick()
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].time).toBeUndefined()
  })

  it('draws a still scene straight away when the time it is held at changes', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.holdScene(true, new Date(2026, 5, 21, 12))
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    tick()
    const evening = new Date(2026, 5, 21, 20)
    renderer.holdScene(true, evening)
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.lastCall![0].time).toBe(evening)
  })

  it('draws a moving scene straight away when the time it is held at changes, even between frames', async () => {
    const { renderer, scene, render } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    renderer.holdScene(undefined, new Date(2026, 5, 21, 20))
    renderer.draw(1000, 800, 1, [])
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('makes its blurs again from a still scene drawn at a new time', async () => {
    const { renderer, scene, blurs, draws, tick } = await sceneRenderer()
    const lens = lensWithBlur(20)
    renderer.holdScene(true, new Date(2026, 5, 21, 12))
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [lens])
    draws.length = 0
    tick()
    renderer.holdScene(true, new Date(2026, 5, 21, 20))
    renderer.draw(1000, 800, 1, [lens])
    expect(blurs().some((draw) => draw.read('taps') !== 0)).toBe(true)
  })

  /** Draws a frame every `ms` for as long as the renderer asks for them, and says how many that was. */
  function drawUntilStopped(renderer: Renderer, tick: (ms?: number) => void, ms = 17) {
    for (let frames = 1; frames < 1000; frames++) {
      tick(ms)
      if (!renderer.draw(1000, 800, 1, [])) return frames
    }
    throw new Error('It never stopped')
  }

  it('stops the clock of a still scene, and starts it again from there', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    renderer.holdScene(true, new Date(2026, 5, 21, 12))
    drawUntilStopped(renderer, tick)
    const { seconds } = render.mock.lastCall![0]
    expect(seconds).toBeGreaterThan(0)

    renderer.holdScene(true, new Date(2026, 5, 21, 13))
    tick(50)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0]).toMatchObject({ seconds, delta: 0, still: true })

    renderer.holdScene(false, undefined)
    tick(50)
    renderer.draw(1000, 800, 1, [])
    tick(50)
    renderer.draw(1000, 800, 1, [])
    expect(render.mock.lastCall![0].seconds).toBeGreaterThan(seconds)
  })

  it('eases a scene to a stop, and draws nothing more once it is there', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    render.mockClear()

    renderer.holdScene(true, undefined)
    const frames = drawUntilStopped(renderer, tick)
    expect(frames * 17).toBeGreaterThanOrEqual(1500)
    expect(frames * 17).toBeLessThan(1550)

    const steps = render.mock.calls.map(([frame]) => frame.delta)
    expect(steps[0]).toBeCloseTo(0.017, 3)
    expect(steps.every((step, i) => i === 0 || step < steps[i - 1])).toBe(true)
    expect(steps.at(-1)).toBe(0)
    // Moving for as long as it has anywhere to go, and still only when it stops.
    expect(render.mock.calls.map(([frame]) => frame.still).filter(Boolean)).toHaveLength(1)
    expect(render.mock.lastCall![0].still).toBe(true)

    const drawn = render.mock.calls.length
    tick(1000)
    expect(renderer.draw(1000, 800, 1, [])).toBe(false)
    expect(render).toHaveBeenCalledTimes(drawn)
  })

  it('eases a held scene back up to speed', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.holdScene(true, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    render.mockClear()

    renderer.holdScene(false, undefined)
    for (let frame = 0; frame < 95; frame++) {
      tick()
      expect(renderer.draw(1000, 800, 1, [])).toBe(true)
    }
    const steps = render.mock.calls.map(([frame]) => frame.delta)
    expect(steps[1]).toBeLessThan(0.0002)
    expect(steps.every((step, i) => i === 0 || step >= steps[i - 1])).toBe(true)
    expect(steps.at(-1)).toBe(0.017)
    expect(render.mock.calls.some(([frame]) => frame.still)).toBe(false)
  })

  it('turns back without a jump when let go on the way to a stop', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    render.mockClear()

    renderer.holdScene(true, undefined)
    for (let frame = 0; frame < 45; frame++) {
      tick()
      renderer.draw(1000, 800, 1, [])
    }
    renderer.holdScene(false, undefined)
    for (let frame = 0; frame < 45; frame++) {
      tick()
      renderer.draw(1000, 800, 1, [])
    }
    const steps = render.mock.calls.map(([frame]) => frame.delta)
    expect(Math.min(...steps)).toBeGreaterThan(0.007)
    expect(steps.every((step, i) => i === 0 || Math.abs(step - steps[i - 1]) < 0.0005)).toBe(true)
    expect(steps.at(-1)).toBeCloseTo(0.017, 3)
  })

  it("keeps asking for frames between a scene's on a faster display, until it has stopped", async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    render.mockClear()
    renderer.holdScene(true, undefined)
    const frames = drawUntilStopped(renderer, tick, 7)
    // Held to 60 a second on the way down too, for the same second and a half.
    expect(frames * 7).toBeGreaterThanOrEqual(1500)
    expect(render.mock.calls.length).toBeLessThan(100)
    expect(render.mock.lastCall![0].still).toBe(true)
  })

  it('goes straight to a stop and back with prefers-reduced-motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.holdScene(false, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])

    renderer.holdScene(true, undefined)
    tick()
    expect(renderer.draw(1000, 800, 1, [])).toBe(false)
    expect(render.mock.lastCall![0]).toMatchObject({ delta: 0, still: true })

    renderer.holdScene(false, undefined)
    tick()
    expect(renderer.draw(1000, 800, 1, [])).toBe(true)
    expect(render.mock.lastCall![0].delta).toBeCloseTo(0.017)
  })

  it('does not take the pace of a still scene for a slow GPU', async () => {
    const { renderer, scene, render, tick } = await sceneRenderer()
    renderer.holdScene(true, undefined)
    renderer.setImage(picture(2000, 1000), false, scene)
    for (let frame = 0; frame < 200; frame++) {
      renderer.draw(1000, 800, 1, [])
      tick(61_000)
    }
    expect(render).toHaveBeenCalledTimes(200)
    expect(render.mock.lastCall![0]).toMatchObject({ width: 1000, height: 800 })
  })

  it('has no pixels to read without a scene', async () => {
    const { renderer } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000))
    expect(await renderer.readScene()).toBeNull()
  })

  it("reads the pixels of the smallest mip, row by row, leaving out the rows' padding", async () => {
    const { renderer, scene, copies, buffers } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    const pixels = (await renderer.readScene())!
    expect(copies.mock.lastCall![0]).toMatchObject({ mipLevel: 4 })
    expect(copies.mock.lastCall![1]).toMatchObject({ bytesPerRow: 256 })
    expect(copies.mock.lastCall![2]).toEqual([62, 50])
    expect(pixels).toHaveLength(62 * 50 * 4)
    expect(pixels[62 * 4]).toBe(1)
    expect(pixels[62 * 4 * 49]).toBe(49)
    expect(buffers.at(-1)!.destroyed).toBe(true)
  })

  it('reads nothing from a device that has gone', async () => {
    const { renderer, scene, mapping, buffers } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    mapping.mockRejectedValueOnce(new Error('lost'))
    expect(await renderer.readScene()).toBeNull()
    expect(buffers.at(-1)!.destroyed).toBe(true)
  })

  describe('as the viewport is resized', () => {
    /** A scene running in a settled 1000×800 viewport, with `lenses` on it. */
    async function settledScene(lenses: LensDraw[] = []) {
      const made = await sceneRenderer()
      made.renderer.setImage(picture(2000, 1000), false, made.scene)
      made.renderer.draw(1000, 800, 1, lenses)
      made.settle()
      made.renderer.draw(1000, 800, 1, lenses)
      made.tick()
      return made
    }

    it('draws the scene at the new size on every frame, rather than scaling the old one', async () => {
      const { renderer, render, tick } = await settledScene()
      for (const width of [1010, 1020, 1030]) {
        tick()
        renderer.draw(width, 800, 1, [])
        expect(render.mock.lastCall![0]).toMatchObject({ width, height: 800 })
      }
    })

    it('fills the viewport with the scene, neither zoomed nor shifted', async () => {
      const { renderer, draws, images } = await settledScene()
      draws.length = 0
      renderer.draw(1400, 800, 1, [])
      expect(images()[0].read('map', 4)).toEqual(coverMap(1400, 800, 1400, 800).map((v) => Math.fround(v)))
    })

    it('draws a new size at once, however soon after the last frame', async () => {
      const { renderer, render, tick } = await settledScene()
      tick()
      renderer.draw(1000, 800, 1, [])
      const frames = render.mock.calls.length
      tick(2)
      renderer.draw(1010, 800, 1, [])
      expect(render).toHaveBeenCalledTimes(frames + 1)
    })

    it('takes no notice of the time a resize takes, when judging the GPU', async () => {
      const { renderer, render, tick } = await settledScene()
      for (let frame = 0; frame < 200; frame++) {
        tick(40)
        renderer.draw(1000 + frame, 800, 1, [])
      }
      // Slow frames that counted would have lowered its resolution by now.
      expect(render.mock.lastCall![0].width).toBe(1199)
    })

    it('shows the new viewport in its blurs, on the textures they have', async () => {
      const { renderer, tick, textures, draws, blurs } = await settledScene([lensWithBlur(12)])
      const madeSoFar = textures.filter((t) => t.label === 'blur').length
      draws.length = 0
      tick()
      renderer.draw(1100, 800, 1, [lensWithBlur(12)])
      const across = blurs().find((draw) => (draw.read('taps') as number) > 0)!
      expect(across.read('view', 4)).toEqual([0, 0, 1100, 800])
      expect(textures.filter((t) => t.label === 'blur')).toHaveLength(madeSoFar)
    })

    it('keeps glass on the scene, reading each blur straight across', async () => {
      const { renderer, tick, draws } = await settledScene([lensWithBlur(12)])
      draws.length = 0
      tick()
      renderer.draw(1100, 800, 1, [lensWithBlur(12)])
      const lens = draws.find((draw) => draw.pipeline === 'lensMain')!
      const [scaleX, scaleY, offsetX, offsetY] = lens.read('map', 4) as number[]
      expect(scaleX).toBeCloseTo(1 / 1100, 8)
      expect(scaleY).toBeCloseTo(1 / 800, 8)
      expect([offsetX, offsetY]).toEqual([0, 0])
    })

    it('makes its blurs again at the right resolution once it has settled', async () => {
      const { renderer, tick, settle, textures } = await settledScene([lensWithBlur(12)])
      tick()
      renderer.draw(1400, 800, 1, [lensWithBlur(12)])
      const wide = (t: { label?: string; destroyed: boolean }) => t.label === 'blur' && !t.destroyed
      const before = textures.filter(wide)[0].width
      settle()
      renderer.draw(1400, 800, 1, [lensWithBlur(12)])
      expect(textures.filter(wide)).toHaveLength(2)
      expect(textures.filter(wide)[0].width).toBeGreaterThan(before)
    })

    it('still leaves an image to scale until the viewport settles', async () => {
      const { renderer, canvas, textures } = await drawingRenderer()
      vi.spyOn(performance, 'now').mockReturnValue(1000)
      renderer.draw(1000, 800, 1, [lensWithBlur(12)])
      vi.spyOn(performance, 'now').mockReturnValue(2000)
      renderer.draw(1000, 800, 1, [lensWithBlur(12)])
      const blurs = textures.filter((t) => t.label === 'blur').length
      vi.spyOn(performance, 'now').mockReturnValue(2010)
      expect(renderer.draw(1100, 800, 1, [lensWithBlur(12)])).toBe(true)
      expect(canvas.width).toBe(1100)
      expect(textures.filter((t) => t.label === 'blur')).toHaveLength(blurs)
    })
  })

  it('crossfades in over an image, and lets it go', async () => {
    const { renderer, scene, render, textures } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000))
    renderer.setImage(picture(2000, 1000), true, scene)
    renderer.draw(1000, 800, 1, [], 0.5)
    expect(render).toHaveBeenCalledOnce()
    expect(textures.find((t) => t.label === 'image')!.destroyed).toBe(false)
    renderer.draw(1000, 800, 1, [], 1)
    expect(textures.find((t) => t.label === 'image')!.destroyed).toBe(true)
  })

  it('stops and disposes of a scene once an image has crossfaded in over it', async () => {
    const { renderer, scene, render, dispose, tick } = await sceneRenderer()
    renderer.setImage(picture(2000, 1000), false, scene)
    renderer.draw(1000, 800, 1, [])
    renderer.setImage(picture(2000, 1000), true)
    tick()
    renderer.draw(1000, 800, 1, [], 0.5)
    expect(render).toHaveBeenCalledTimes(2)
    expect(dispose).not.toHaveBeenCalled()
    tick()
    expect(renderer.draw(1000, 800, 1, [], 1)).toBe(false)
    expect(render).toHaveBeenCalledTimes(2)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('disposes of the scenes it is drawing when it goes, as one may hold more than the GPU', async () => {
    const { renderer, scene, dispose, tick } = await sceneRenderer()
    const second = { render: vi.fn<(frame: SceneFrame) => void>(), dispose: vi.fn<() => void>() }
    renderer.setImage(null, false, scene)
    renderer.draw(1000, 800, 1, [])
    renderer.setImage(null, true, second)
    tick()
    renderer.draw(1000, 800, 1, [], 0.5)
    renderer.dispose()
    expect(dispose).toHaveBeenCalledOnce()
    expect(second.dispose).toHaveBeenCalledOnce()
  })
})

describe('nextSceneScale', () => {
  it('leaves a scene that is keeping up as it is', () => {
    expect(nextSceneScale(1, [16, 17, 16, 17, 16])).toBe(1)
  })

  it('takes sharpness from a scene that is not', () => {
    expect(nextSceneScale(1, [30, 33, 31, 32, 33])).toBeCloseTo(0.84)
  })

  it('takes no notice of a stall or two', () => {
    expect(nextSceneScale(1, [16, 500, 17, 16, 900])).toBe(1)
  })

  it('stops at half the resolution', () => {
    expect(nextSceneScale(0.52, [40, 40, 40])).toBe(0.5)
    expect(nextSceneScale(0.5, [40, 40, 40])).toBe(0.5)
  })
})

describe('sceneSize', () => {
  it('is the size of the canvas', () => {
    expect(sceneSize(1920, 1080, 1)).toEqual([1920, 1080])
  })

  it('stops at 1440p on anything larger, keeping its shape', () => {
    expect(sceneSize(3840, 2160, 1)).toEqual([2560, 1440])
  })

  it('takes a scale on top of that', () => {
    expect(sceneSize(1920, 1080, 0.5)).toEqual([960, 540])
  })

  it('is never empty', () => {
    expect(sceneSize(1, 1, 0.5)).toEqual([1, 1])
  })
})

describe('fitTexture', () => {
  it('leaves an image that fits as it is', () => {
    const image = picture(4096, 2000)
    expect(fitTexture(image, 4096)).toBe(image)
  })

  it('scales a larger image down to fit, keeping its shape', () => {
    const drawImage = vi.fn<CanvasRenderingContext2D['drawImage']>()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as GPUCanvasContext)
    const image = picture(8000, 3000)

    const fitted = fitTexture(image, 4000) as HTMLCanvasElement
    expect([fitted.width, fitted.height]).toEqual([4000, 1500])
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 4000, 1500)
  })

  it('scales a larger image down to just cover the viewport, keeping its shape', () => {
    const context = { drawImage: () => {}, imageSmoothingQuality: 'low' }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as GPUCanvasContext)

    const fitted = fitTexture(picture(8000, 4000), 16384, [1000, 800]) as HTMLCanvasElement
    expect([fitted.width, fitted.height]).toEqual([1600, 800])
    expect(context.imageSmoothingQuality).toBe('high')
  })

  it('never scales an image up to cover the viewport', () => {
    const image = picture(800, 600)
    expect(fitTexture(image, 16384, [1920, 1080])).toBe(image)
  })
})

describe('createRenderer', () => {
  it('sets up a renderer on a working GPU', async () => {
    fakeGpu()
    const { canvas, context } = fakeCanvas()
    expect(await createRenderer(canvas, options())).not.toBeNull()
    expect(context.configure).toHaveBeenCalledOnce()
  })

  it("asks for the adapter's largest texture, past the default limit", async () => {
    const { adapter } = fakeGpu()
    await createRenderer(fakeCanvas().canvas, options())
    expect(adapter.requestDevice).toHaveBeenCalledWith({
      requiredLimits: { maxTextureDimension2D: 16384 },
      requiredFeatures: [],
    })
  })

  it("asks for the GPU's clock where it has one, to time scenes by", async () => {
    const { adapter } = fakeGpu({ features: new Set(['timestamp-query']) })
    await createRenderer(fakeCanvas().canvas, options())
    expect(adapter.requestDevice).toHaveBeenCalledWith(
      expect.objectContaining({ requiredFeatures: ['timestamp-query'] }),
    )
  })

  it('is null without WebGPU', async () => {
    vi.stubGlobal('navigator', {})
    expect(await createRenderer(fakeCanvas().canvas, options())).toBeNull()
  })

  it('is null without an adapter', async () => {
    fakeGpu().gpu.requestAdapter.mockResolvedValue(null)
    expect(await createRenderer(fakeCanvas().canvas, options())).toBeNull()
  })

  it('is null, rather than rejecting, when asking for an adapter fails', async () => {
    fakeGpu().gpu.requestAdapter.mockRejectedValue(new Error('blocked'))
    expect(await createRenderer(fakeCanvas().canvas, options())).toBeNull()
  })

  it('is null, rather than rejecting, when a device is refused', async () => {
    fakeGpu().adapter.requestDevice.mockRejectedValue(new Error('refused'))
    expect(await createRenderer(fakeCanvas().canvas, options())).toBeNull()
  })

  it('is null, rather than rejecting, when a shader fails, and lets the device go', async () => {
    const { device } = fakeGpu({ createRenderPipelineAsync: () => Promise.reject(new Error('compile')) })
    const { canvas, context } = fakeCanvas()
    expect(await createRenderer(canvas, options())).toBeNull()
    expect(device.destroy).toHaveBeenCalledOnce()
    expect(context.configure).not.toHaveBeenCalled()
  })

  it("is null, and lets the device go, on a canvas it can't draw on", async () => {
    const { device } = fakeGpu()
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    expect(await createRenderer(canvas, options())).toBeNull()
    expect(device.destroy).toHaveBeenCalledOnce()
  })

  it('leaves the canvas to whoever replaced it once given up on', async () => {
    const { device } = fakeGpu()
    const { canvas, context } = fakeCanvas()
    const controller = new AbortController()
    const pending = createRenderer(canvas, options({ signal: controller.signal }))
    controller.abort()

    expect(await pending).toBeNull()
    expect(context.configure).not.toHaveBeenCalled()
    expect(device.destroy).toHaveBeenCalledOnce()
  })

  it('says when the device is lost', async () => {
    const { lose } = fakeGpu()
    const onLost = vi.fn<() => void>()
    await createRenderer(fakeCanvas().canvas, options({ onLost }))

    lose({ reason: 'unknown' })
    await Promise.resolve()
    await Promise.resolve()
    expect(onLost).toHaveBeenCalledOnce()
  })

  it('says nothing when the device was let go of on purpose', async () => {
    const { lose } = fakeGpu()
    const onLost = vi.fn<() => void>()
    await createRenderer(fakeCanvas().canvas, options({ onLost }))

    lose({ reason: 'destroyed' })
    await Promise.resolve()
    await Promise.resolve()
    expect(onLost).not.toHaveBeenCalled()
  })

  it('says when the GPU refuses something, once however often it does', async () => {
    const { refuse, lose } = fakeGpu()
    const onLost = vi.fn<() => void>()
    await createRenderer(fakeCanvas().canvas, options({ onLost }))

    refuse()
    refuse()
    lose({ reason: 'unknown' })
    await Promise.resolve()
    await Promise.resolve()
    expect(onLost).toHaveBeenCalledOnce()
  })

  it('says nothing of a refusal that comes after it was disposed', async () => {
    const { refuse } = fakeGpu()
    const onLost = vi.fn<() => void>()
    const renderer = (await createRenderer(fakeCanvas().canvas, options({ onLost })))!

    renderer.dispose()
    refuse()
    expect(onLost).not.toHaveBeenCalled()
  })

  it('lets the device go when disposed, which takes all made on it', async () => {
    const { device } = fakeGpu()
    const renderer = (await createRenderer(fakeCanvas().canvas, options()))!
    renderer.dispose()
    expect(device.destroy).toHaveBeenCalledOnce()
  })
})

/** Where a CSS px position lands in the image, in uv. */
function uvAt(map: number[], x: number, y: number) {
  return [x * map[0] + map[2], y * map[1] + map[3]]
}

describe('coverMap', () => {
  it('fills a viewport of the same shape exactly', () => {
    const map = coverMap(1000, 500, 2000, 1000)
    expect(uvAt(map, 0, 0)).toEqual([0, 0])
    expect(uvAt(map, 1000, 500)).toEqual([1, 1])
  })

  it('crops the sides of an image wider than the viewport, keeping it centred', () => {
    // Scaled to 1000 tall, so 2000 wide: 500px off each side.
    const map = coverMap(1000, 1000, 2000, 1000)
    expect(uvAt(map, 0, 0)).toEqual([0.25, 0])
    expect(uvAt(map, 500, 500)).toEqual([0.5, 0.5])
    expect(uvAt(map, 1000, 1000)).toEqual([0.75, 1])
  })

  it('crops the top and bottom of an image taller than the viewport', () => {
    const map = coverMap(1000, 500, 1000, 1000)
    expect(uvAt(map, 0, 0)).toEqual([0, 0.25])
    expect(uvAt(map, 1000, 500)).toEqual([1, 0.75])
  })
})
