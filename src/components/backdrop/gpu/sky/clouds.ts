// The clouds over every scene: their noise, baked once, and a pass each frame that lights
// a band of them into a texture smaller than the target, which the sky, the stars and the
// Milky Way lie behind (cloudShaders.ts).
//
// They drift from left to right, faster the higher they are in the view, as the near
// passes the far. Where they have drifted to goes by a clock that every scene on a device
// shares, so that as one scene gives way to another the clouds stay where they are, as
// the stars do.
import type { SceneFrame } from '../renderer'
import {
  CLOUD_TILES,
  CLOUD_TURN,
  cloudPassSource,
  NOISE_MIPS,
  NOISE_SIZE,
  noiseBakeSource,
  noiseMipSource,
  REGION_TILES,
  REGION_TURN,
  WARP_TILES,
} from './cloudShaders'
import { HEAVENS, heavensBindingSource } from './heavens/heavensShaders'
import type { Kept } from './kept'
import { createMipPipeline, mipChain } from './mips'

/**
 * How many rows the clouds' texture is meant to have, and how many times smaller than the
 * target it may be, each way: a third as high as a 1080p target, and a quarter of a 4K
 * one, so they cost about the same on every screen.
 */
const CLOUD_ROWS = 360
const LEAST_SCALE = 2
const MOST_SCALE = 4

/**
 * How fast the clouds drift, in heights of their base a second (cloudShaders.ts). Across the
 * screen that is faster the higher in the view, by the sine of the height plus the
 * horizon's lift: on a 1080p view of the ocean, about 7 pixels a second along its top and
 * 2 just above the horizon.
 */
export const SPEED = 0.016
/** How fast they turn their shapes over, in tiles of noise a second: about eight minutes to a new shape. */
const TURNING = 0.0005
/**
 * How many mips the clouds' texture has, each half the size of the one above: blurred
 * copies of them, for the ocean to mirror.
 */
const CLOUD_MIPS = 4

/**
 * How many bands of rows the clouds are lit in, one a frame, so that each row is lit every
 * so many frames: they move a small part of a pixel a frame. A band a frame, rather than
 * all of them every few, keeps every frame's cost the same.
 */
export const BANDS = 3

/**
 * How much of each lighting of the clouds is new, the rest being the last ones: about the
 * last nine are seen at once, each looking through the clouds a little differently, which
 * is what keeps their edges from shimmering. They move a pixel or two in that time, at the
 * most, less than a texel of theirs, so nothing is seen to trail behind them.
 */
const FRESH = 0.2

/** How far on through the clouds' steps each lighting starts from the last, as a share of a step. */
const GOLDEN = 0.618034

/**
 * How many lightings a frame held still averages, as it has none before it to blend into:
 * enough that they look the same at rest as while they move.
 */
const STILL_LIGHTINGS = 6

/**
 * How many the first frame at a size averages, which has none before it either, but many
 * to come: enough that the steps each looks through the clouds in don't show as a weave
 * until the next few have been blended in.
 */
const FIRST_LIGHTINGS = 3

/**
 * How many rows past the last that shows sky are lit, for what reads them smoothly there:
 * the sky's cubic spline and its look a mip further down (cloudShaders.ts). The rows lit
 * come to a whole number of that, for the mips below to be made only of rows lit.
 */
const ROWS_PAST = 8

/** The format of the clouds' texture: their light, premultiplied, and how much they hide. */
const FORMAT: GPUTextureFormat = 'rgba16float'

/** Each lighting drawn over the last ones, by as much of it as the blend constant says is new. */
const OVER_THE_LAST: GPUBlendComponent = { srcFactor: 'constant', dstFactor: 'one-minus-constant' }

export interface CloudsOptions {
  kept: Kept
  /** The WGSL of the scene's `Scene` struct, its binding and the sky's light. */
  sceneSource: string
  /** The scene's uniforms, and the night sky's, whose cloud fields this writes. */
  uniforms: GPUBuffer
  heavens: GPUBuffer
  heavensData: Float32Array
}

export interface Clouds {
  /** What the sky reads them from: a new view whenever the target changes size. */
  readonly view: GPUTextureView
  /** A sampler for reading it, clamped to its edges, and between its mips. */
  readonly sampler: GPUSampler
  /**
   * To be told whenever the target changes size, once the sky's lens is in the heavens
   * uniforms, with how many of its rows from the top the sky can show in. Says whether
   * `view` changed.
   */
  aim(width: number, height: number, skyRows: number): boolean
  /**
   * Moves them on to a frame, from a moment of the sky's, and records lighting the next band
   * of them, ahead of the pass that draws the sky. A still frame, or the first at a size,
   * lights all of them. Says whether the heavens uniforms changed.
   */
  light(frame: SceneFrame, moment: number): boolean
}

export interface CloudClock {
  /** The clouds that move it on, if any do. */
  owner: object | null
  seconds: number
}

/**
 * Moves a clock on by a frame of its owner's. Whichever clouds move it first while it has
 * none own it, until they are held still or gone: two scenes crossfading, whose frames
 * needn't come together, would otherwise both move it on.
 */
export function tick(clock: CloudClock, owner: object, { delta, still }: Pick<SceneFrame, 'delta' | 'still'>) {
  if (still) {
    if (clock.owner === owner) clock.owner = null
    return
  }
  clock.owner ??= owner
  if (clock.owner === owner) clock.seconds += delta
}

/**
 * Where the clouds, their regions and the bends in their outlines have drifted to, each in
 * tiles of noise as it is turned (cloudShaders.ts), and how far their shapes have turned
 * over, after this many seconds. Each is wrapped to a tile, which the noise repeats after,
 * so nothing is lost to precision. Drifting the noise left is what carries the clouds right.
 */
export function cloudsAt(seconds: number): [number, number, number, number] {
  const wrap = (tiles: number) => tiles - Math.floor(tiles)
  const drift = -seconds * SPEED * CLOUD_TILES
  return [
    wrap(drift / CLOUD_TURN),
    wrap((drift * REGION_TILES) / REGION_TURN),
    wrap((drift * WARP_TILES) / REGION_TURN),
    wrap(seconds * TURNING),
  ]
}

/**
 * How many of a texture's rows, from the top, the clouds may lie in: those above the
 * horizon, through the sky's lens in the heavens uniforms, and a couple more. Below it the
 * clouds' pass draws nothing anyway.
 */
export function rowsAboveHorizon(heavensData: Float32Array, rows: number) {
  const at = (field: number) => heavensData[HEAVENS.lens + field]
  const [rightY, upY, upScale, forwardY] = [at(1), at(5), at(7), at(9)]
  // A lens that leans, or looks straight up or down, has no one row for the horizon.
  if (Math.abs(rightY) > 1e-6 || upY <= 0) return rows
  // Clip space's height there, where the way through the lens is level.
  const horizon = (-forwardY * upScale) / upY
  return Math.max(0, Math.min(rows, Math.ceil(((1 - horizon) / 2) * rows) + 2))
}

/** The rows, from and to, of a band of so many rows lit, each band starting on an even row. */
export function bandRows(rows: number, band: number): [number, number] {
  const edge = (at: number) => Math.min(rows, Math.round((rows * at) / BANDS / 2) * 2)
  return [edge(band), edge(band + 1)]
}

/**
 * The clock every scene on a device moves its clouds by. It starts from the sky's moment,
 * so that a page shows different clouds each time it opens, but the same for the same
 * moment.
 */
const clocks = new WeakMap<GPUDevice, CloudClock>()

/**
 * The clock of a device, begun at `moment`, in ms, by whichever clouds ask first. Asked
 * for as they are first lit, not as they are made: two scenes made before either was
 * lit would otherwise each find none, and begin one of its own.
 */
export function sharedClock(device: GPUDevice, moment: number): CloudClock {
  let clock = clocks.get(device)
  if (!clock) clocks.set(device, (clock = { owner: null, seconds: moment / 1000 }))
  return clock
}

export async function createClouds(
  device: GPUDevice,
  { kept, sceneSource, uniforms, heavens, heavensData }: CloudsOptions,
): Promise<Clouds> {
  const noise = kept.keep(
    device.createTexture({
      label: 'sky cloud noise',
      size: [NOISE_SIZE, NOISE_SIZE, NOISE_SIZE],
      dimension: '3d',
      format: 'rgba8unorm',
      mipLevelCount: NOISE_MIPS,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    }),
  )
  const passModule = device.createShaderModule({
    label: 'sky clouds',
    code: sceneSource + heavensBindingSource + cloudPassSource,
  })
  const [bake, mips, pass, blur] = await Promise.all([
    device.createComputePipelineAsync({
      label: 'sky cloud noise',
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: noiseBakeSource }), entryPoint: 'bakeMain' },
    }),
    device.createComputePipelineAsync({
      label: 'sky cloud noise mips',
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: noiseMipSource }), entryPoint: 'mipMain' },
    }),
    device.createRenderPipelineAsync({
      label: 'sky clouds',
      layout: 'auto',
      vertex: { module: passModule, entryPoint: 'overVertex' },
      fragment: {
        module: passModule,
        entryPoint: 'cloudFragment',
        targets: [{ format: FORMAT, blend: { color: OVER_THE_LAST, alpha: OVER_THE_LAST } }],
      },
      primitive: { topology: 'triangle-list' },
    }),
    createMipPipeline(device, FORMAT, 'sky cloud mips'),
  ])

  // The noise, once: its finest level, then each mip from the one above.
  const level = (mip: number) => noise.createView({ baseMipLevel: mip, mipLevelCount: 1 })
  const baking = device.createCommandEncoder({ label: 'sky cloud noise' })
  const compute = baking.beginComputePass()
  compute.setPipeline(bake)
  compute.setBindGroup(
    0,
    device.createBindGroup({ layout: bake.getBindGroupLayout(0), entries: [{ binding: 0, resource: level(0) }] }),
  )
  compute.dispatchWorkgroups(NOISE_SIZE / 4, NOISE_SIZE / 4, NOISE_SIZE / 4)
  compute.setPipeline(mips)
  for (let mip = 1; mip < NOISE_MIPS; mip++) {
    compute.setBindGroup(
      0,
      device.createBindGroup({
        layout: mips.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: level(mip - 1) },
          { binding: 1, resource: level(mip) },
        ],
      }),
    )
    const groups = Math.max(1, (NOISE_SIZE >> mip) / 4)
    compute.dispatchWorkgroups(groups, groups, groups)
  }
  compute.end()
  device.queue.submit([baking.finish()])

  const passGroup = device.createBindGroup({
    layout: pass.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer: heavens } },
      { binding: 2, resource: noise.createView() },
      {
        binding: 3,
        resource: device.createSampler({
          addressModeU: 'repeat',
          addressModeV: 'repeat',
          addressModeW: 'repeat',
          minFilter: 'linear',
          magFilter: 'linear',
          mipmapFilter: 'linear',
        }),
      },
    ],
  })
  const sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' })

  // Made afresh at each size, and kept as whichever it is now, with a view of its finest
  // mip to light them into, and what draws each mip below from the one above.
  let texture: GPUTexture | null = null
  let finest: GPUTextureView | null = null
  let blurred: (encoder: GPUCommandEncoder, changed?: readonly [number, number]) => void = () => {}
  let view = kept
    .keep(
      device.createTexture({
        label: 'sky clouds unaimed',
        size: [1, 1],
        format: FORMAT,
        usage: GPUTextureUsage.TEXTURE_BINDING,
      }),
    )
    .createView()
  // These clouds, as the owner of the clock, which they let go of when they go.
  const self = {}
  let clock: CloudClock | null = null
  kept.keep({
    destroy: () => {
      texture?.destroy()
      if (clock?.owner === self) clock.owner = null
    },
  })
  // How many rows from the top are lit, whether there is a last lighting of them to blend
  // into, and how many bands there have been.
  let rows = 0
  let fresh = true
  let lightings = 0

  return {
    get view() {
      return view
    },
    sampler,

    aim(width, height, skyRows) {
      const scale = Math.min(MOST_SCALE, Math.max(LEAST_SCALE, Math.round(height / CLOUD_ROWS)))
      const size = [Math.max(1, Math.ceil(width / scale)), Math.max(1, Math.ceil(height / scale))]
      const shown = Math.ceil((Math.ceil(skyRows / scale) + ROWS_PAST) / ROWS_PAST) * ROWS_PAST
      const lit = Math.min(shown, rowsAboveHorizon(heavensData, size[1]))
      fresh ||= lit !== rows
      rows = lit
      if (texture && texture.width === size[0] && texture.height === size[1]) return false
      texture?.destroy()
      const made = device.createTexture({
        label: 'sky clouds',
        size,
        format: FORMAT,
        mipLevelCount: Math.min(CLOUD_MIPS, Math.floor(Math.log2(Math.min(size[0], size[1]))) + 1),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      })
      texture = made
      view = made.createView()
      finest = made.createView({ baseMipLevel: 0, mipLevelCount: 1 })
      blurred = mipChain(device, blur, made, 'sky cloud mips')
      fresh = true
      return true
    },

    light(frame, moment) {
      clock ??= sharedClock(device, moment)
      tick(clock, self, frame)
      const before = heavensData.slice(HEAVENS.clouds, HEAVENS.clouds + 8)
      heavensData.set(cloudsAt(clock.seconds), HEAVENS.clouds)
      // A frame held still may be the last, and has to show them as they are, with nothing
      // of before in them, so it lights all of them, several times over, from the same steps
      // every time. The first at a size, with nothing before it, lights all of them once.
      const whole = frame.still || fresh
      const [top, bottom] = whole ? [0, rows] : bandRows(rows, lightings % BANDS)
      if (texture && finest && bottom > top) {
        heavensData.set(
          frame.still
            ? [0, STILL_LIGHTINGS]
            : [(Math.floor(lightings / BANDS) * GOLDEN) % 1, fresh ? FIRST_LIGHTINGS : 1],
          HEAVENS.cloudSteps,
        )
        const share = whole ? 1 : FRESH
        const lit = frame.encoder.beginRenderPass({
          label: 'sky clouds',
          colorAttachments: [{ view: finest, loadOp: 'load', storeOp: 'store' }],
        })
        lit.setPipeline(pass)
        lit.setBindGroup(0, passGroup)
        lit.setBlendConstant([share, share, share, share])
        lit.setScissorRect(0, top, texture.width, bottom - top)
        lit.draw(3)
        lit.end()
        // A band changes only the part of each mip that is made of it.
        blurred(frame.encoder, whole ? undefined : [top, bottom])
        lightings++
        fresh = false
      }
      return before.some((value, i) => value !== heavensData[HEAVENS.clouds + i])
    },
  }
}
