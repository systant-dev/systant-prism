// The moon's face as the sky last drew it: how bright its surface is at each pixel of the
// part of the target its disc falls in, in a texture of its own for the sky to read
// (moonDisc in skyShaders.ts). The surface is most of what a pixel of the moon costs,
// some fifty reads of noise, and it is the same from one frame to the next until the
// moon moves, which it does about once a second (dome.ts). So it is drawn then, and
// only read in between.
//
// What the sky reads is what it would have worked out itself: the texture holds 32-bit
// floats, and both work the surface out from where the pixel is on the target (moonAt).

import type { Kept } from './kept'
import { cross, dot, unit, type Vec3 } from './maths'
import { SKY_UNIFORM } from './skyLight'
import { MOON_EDGE, MOON_RADIUS, VEILED_EDGE } from './skyShaders'

/** A part of a target, in pixels: its left and top, then its width and height. */
export type Part = [number, number, number, number]

/** How bright the surface is: one float, as the shader works it out. */
const FORMAT: GPUTextureFormat = 'r32float'

/**
 * How many pixels its texture's width and height are a multiple of, so that a disc a
 * pixel wider as it climbs needs no new one, and the most either is. A moon that would
 * need more, which no view of a scene's comes near, is worked out afresh every frame.
 */
const SIZE_STEP = 32
const MOST_SIZE = 1024

/**
 * How the part of the target the disc falls in is found: from this many ways round a
 * circle about the moon, this much wider than its disc and blurred edge, so that the
 * straight lines between them lie outside it, with this many pixels to spare on each side.
 */
const AROUND = 32
const WIDER = 1.05
const SPARE = 2

/** Every field of the scene's uniforms that the face as drawn goes by: the camera, and the moon's place, size and turn. */
const DRAWN_FROM = [
  ...[0, 1, 2, 3].map((at) => SKY_UNIFORM.right + at),
  ...[0, 1, 2, 3].map((at) => SKY_UNIFORM.up + at),
  ...[0, 1, 2].map((at) => SKY_UNIFORM.forward + at),
  ...[0, 1, 2].map((at) => SKY_UNIFORM.moon + at),
  SKY_UNIFORM.moonWide,
  SKY_UNIFORM.moonTall,
  SKY_UNIFORM.moonTilt,
]

/**
 * The part of a target so wide and high that the moon's disc can fall in, blurred edge
 * and all, by the scene's uniforms: null if the moon isn't out, if none of it is in
 * view, or if it is too close to behind the camera to have a place on the screen.
 */
export function moonFacePart(scene: Float32Array, width: number, height: number): Part | null {
  if (!(scene[SKY_UNIFORM.moon + 3] > 0)) return null
  const at = (field: number): Vec3 => [scene[field], scene[field + 1], scene[field + 2]]
  const [right, up, forward, moon] = [SKY_UNIFORM.right, SKY_UNIFORM.up, SKY_UNIFORM.forward, SKY_UNIFORM.moon].map(at)
  // How far the furthest of its blurred edge is from the way to its middle, to the side
  // and up, which is how onDisc measures a way. Close to the horizon the disc is
  // flattened, which only brings its edge in.
  const reach = MOON_RADIUS * (1 + MOON_EDGE + VEILED_EDGE) * WIDER
  const [wide, tall] = [reach * scene[SKY_UNIFORM.moonWide], reach * scene[SKY_UNIFORM.moonTall]]
  if (!(Math.hypot(wide, tall) < 1)) return null
  const side = unit(cross([0, 1, 0], moon))
  const rise = cross(moon, side)

  let [left, top, far, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < AROUND; i++) {
    const turn = (i / AROUND) * 2 * Math.PI
    const [across, upward] = [Math.cos(turn) * wide, Math.sin(turn) * tall]
    const along = Math.sqrt(1 - across * across - upward * upward)
    const way = moon.map((value, axis) => value * along + side[axis] * across + rise[axis] * upward)
    // Not in front, or a moon straight overhead, which has no side: no place on the screen.
    const depth = dot(way, forward)
    if (!(depth > 0.05)) return null
    const x = (0.5 + (0.5 * dot(way, right) * scene[SKY_UNIFORM.right + 3]) / depth) * width
    const y = (0.5 - (0.5 * dot(way, up) * scene[SKY_UNIFORM.up + 3]) / depth) * height
    left = Math.min(left, x)
    far = Math.max(far, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  const x = Math.max(0, Math.floor(left) - SPARE)
  const y = Math.max(0, Math.floor(top) - SPARE)
  const across = Math.min(width, Math.ceil(far) + SPARE) - x
  const down = Math.min(height, Math.ceil(bottom) + SPARE) - y
  return across > 0 && down > 0 ? [x, y, across, down] : null
}

/** How many pixels across a texture is to hold this many, or 0 if that is too many. */
export function sizeFor(pixels: number) {
  const size = Math.ceil(pixels / SIZE_STEP) * SIZE_STEP
  return size > MOST_SIZE ? 0 : size
}

export interface MoonFaceOptions {
  kept: Kept
  /** The sky's shader module, with skySource in it. */
  module: GPUShaderModule
  /** The scene's uniforms, and their values, which it is drawn from. */
  uniforms: GPUBuffer
  uniformData: Float32Array
}

export interface MoonFace {
  /** What the sky reads it from: a new view whenever it changes size. */
  readonly view: GPUTextureView
  /** Which part of the target it covers, for the sky's shader: none until it is drawn. */
  readonly part: GPUBuffer
  /**
   * Records drawing it again, ahead of the pass that draws the sky, if the moon is out and
   * anything it was drawn from has changed, on a target so wide and high. To be called
   * every frame, once the scene's values are that frame's. Says whether `view` changed.
   */
  keepUp(encoder: GPUCommandEncoder, width: number, height: number): boolean
}

export async function createMoonFace(
  device: GPUDevice,
  { kept, module, uniforms, uniformData }: MoonFaceOptions,
): Promise<MoonFace> {
  const pipeline = await device.createRenderPipelineAsync({
    label: 'sky moon face',
    layout: 'auto',
    vertex: { module, entryPoint: 'overVertex' },
    fragment: { module, entryPoint: 'moonFaceFragment', targets: [{ format: FORMAT }] },
    primitive: { topology: 'triangle-list' },
  })
  // MoonFacePart in skyShaders.ts: the part covered, none as yet, then the size of a pixel.
  const part = kept.keep(
    device.createBuffer({
      label: 'sky moon face part',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  )
  const partData = new Float32Array(8)
  const group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 7, resource: { buffer: part } },
    ],
  })

  // Made at the first dusk, and again whenever the disc needs another size of it.
  let texture: GPUTexture | null = null
  let view = kept
    .keep(
      device.createTexture({
        label: 'sky moon face undrawn',
        size: [1, 1],
        format: FORMAT,
        usage: GPUTextureUsage.TEXTURE_BINDING,
      }),
    )
    .createView()
  kept.keep({ destroy: () => texture?.destroy() })
  // What it was last drawn from, and for a target of what size: none while it covers nothing.
  let drawnFrom: number[] | null = null
  let sizedFor = [0, 0]

  /** Tells the shader which part is covered, none without one, and how big a pixel of the target is. */
  function cover(covered: Part | null, width: number, height: number) {
    partData.set(covered ?? [0, 0, 0, 0])
    partData.set([2 / width, 2 / height], 4)
    device.queue.writeBuffer(part, 0, partData)
    sizedFor = [width, height]
  }

  return {
    get view() {
      return view
    },
    part,

    keepUp(encoder, width, height) {
      const covered = moonFacePart(uniformData, width, height)
      const [across, down] = covered ? [sizeFor(covered[2]), sizeFor(covered[3])] : [0, 0]
      if (!covered || !across || !down) {
        // It covers nothing again: by day it isn't read, and a moon that is out and
        // can't be drawn here is left to the sky, which goes by the size of a pixel.
        if (drawnFrom || sizedFor[0] !== width || sizedFor[1] !== height) cover(null, width, height)
        drawnFrom = null
        return false
      }
      const from = [...DRAWN_FROM.map((field) => uniformData[field]), width, height]
      const last = drawnFrom
      if (last && from.every((value, at) => value === last[at])) return false
      drawnFrom = from

      const resized = !texture || texture.width !== across || texture.height !== down
      if (resized) {
        texture?.destroy()
        texture = device.createTexture({
          label: 'sky moon face',
          size: [across, down],
          format: FORMAT,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })
        view = texture.createView()
      }
      cover(covered, width, height)

      const pass = encoder.beginRenderPass({
        label: 'sky moon face',
        colorAttachments: [{ view, loadOp: 'clear', clearValue: [0, 0, 0, 0], storeOp: 'store' }],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, group)
      pass.setScissorRect(0, 0, covered[2], covered[3])
      pass.draw(3)
      pass.end()
      return resized
    },
  }
}
