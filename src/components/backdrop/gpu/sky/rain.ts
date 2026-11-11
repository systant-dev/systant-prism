// Rain falling through the view of any scene, in front of what the scene has drawn.
//
// There is nothing to step and nothing kept from frame to frame: each drop is worked
// out from its number and the clock, in the vertex shader, as a thin quad between where
// it was and where it is now, as a camera's shutter sees it. So rain costs a few
// thousand quads a frame, and a scene with no rain in it pays nothing at all.
//
// Drops are laid out by the view, not by the world, so that the same rain falls across
// a wide lens or a long one: each falls through the frame at a depth of its own, the
// near ones sweeping across it as long, fast and few-pixels-wide streaks, the far ones
// as a fine, slow haze of them. A drop thinner than a pixel is a pixel, and fainter by
// as much. What colour they are goes by the sky, as a drop is a small lens that shows
// it: they show pale against dark trees or ocean and all but vanish against the sky, which
// is how rain really looks.

import { OPAQUE_ALPHA, OVER } from '../blend'
import type { Kept } from './kept'
import { hashSource } from './sharedShaders'

/** How long rain takes to set in or to clear, in seconds. */
const RAIN_ARRIVES = 4

/** How many drops fall through the view at once, in full rain. */
const DROPS = 7000

/** How many floats the rain's own uniforms take. */
const RAIN_UNIFORMS = 4

/** Vertices to a drop's quad. */
const DROP_QUAD = 4

/**
 * How hard it is raining, 0–1, as it eases to whether it should be. It starts out as
 * it should be, as there is nothing to see of a scene that is only just there, and a
 * still scene has no frames to ease over.
 */
export function rainFade() {
  let eased: number | null = null
  return (rain: boolean, delta: number, still: boolean) => {
    const wanted = rain ? 1 : 0
    if (eased === null || still) eased = wanted
    const step = delta / RAIN_ARRIVES
    eased = eased < wanted ? Math.min(wanted, eased + step) : Math.max(wanted, eased - step)
    return eased
  }
}

export interface RainOptions {
  /** What the scene has made, which this goes in with. */
  kept: Kept
  /** The buffer of the scene's uniforms. */
  uniforms: GPUBuffer
  /** The WGSL of the scene's `Scene` struct, its binding and the sky's light. */
  sceneSource: string
  /** The depth of the pass it is drawn in, as reversed depth, for what drops fall behind. */
  depthFormat?: GPUTextureFormat
  /**
   * How far the wind blows a drop over for each metre it falls: the scene's wind over
   * RAIN_FALL. A light breeze's, 0.3, if left out.
   */
  slant?: number
}

/** How fast drops fall, in metres a second. */
export const RAIN_FALL = 8.5

export interface Rain {
  /** To be told once, and whenever the target changes size. */
  aim(width: number, height: number): void
  /** Draws it into a pass, for rain `amount` hard, leaving the pass's pipeline changed. */
  draw(pass: GPURenderPassEncoder, amount: number): void
}

const rainSource = /* wgsl */ `
struct Rainfall {
  // The size of a pixel, in clip space, and of the target, in pixels high.
  pixel: vec2f,
  height: f32,
  amount: f32,
}

@group(0) @binding(1) var<uniform> rainfall: Rainfall;

// How fast drops fall, in metres a second, and how far the wind blows them over for
// each metre they fall.
const FALL = ${RAIN_FALL};
override SLANT: f32 = 0.3;
// How long a drop is left on the frame by the shutter, in seconds.
const SHUTTER = 0.015;
// How wide a drop looks, in metres, a little wider than it is for being a blur.
const DROP_WIDE = 0.003;
// How near and far they are, as widths of the view: the same on a wide lens or a long
// one. A near one is a streak across the frame, a far one a speck.
const NEAREST = 1.5;
const FURTHEST = 34.0;
// How much of the frame is left past its edges to fall from and to.
const OVER_THE_TOP = 0.14;
const OVER_THE_SIDES = 0.3;
// How strong a drop thick enough to fill its pixels is.
const STRENGTH = 0.3;
// How bright they are for what they show of the sky, and how much that varies.
const BRIGHTNESS = 1.18;

${hashSource}

struct Streak {
  @builtin(position) position: vec4f,
  // Across it, -1–1, and along it, 0–1.
  @location(0) at: vec2f,
  @location(1) strength: f32,
  @location(2) radiance: vec3f,
}

@vertex
fn streakVertex(@builtin(vertex_index) corner: u32, @builtin(instance_index) drop: u32) -> Streak {
  let halfWide = 1.0 / scene.right.w;
  let halfHigh = 1.0 / scene.up.w;
  let depth = pow(FURTHEST / NEAREST, pow(scattered(drop * 4u), 0.7)) * NEAREST / (2.0 * halfHigh);
  let speed = FALL * (0.8 + 0.4 * scattered(drop * 4u + 1u));
  let fall = normalize(vec3f(scene.wind.x * SLANT, -1.0, scene.wind.y * SLANT));

  // Falling from just over the top of the frame to just under the bottom.
  let drops = -dot(fall, scene.up.xyz);
  let way = 2.0 * (1.0 + OVER_THE_TOP) * halfHigh * depth / drops;
  let cycles = scene.eyeTime.w * speed / way + scattered(drop * 4u + 2u);
  let cycle = floor(cycles);
  let side = scattered(drop * 4u + 3u + u32(cycle) * 8u) * 2.0 - 1.0;
  let top = scene.eyeTime.xyz + scene.forward.xyz * depth
    + scene.right.xyz * side * (1.0 + OVER_THE_SIDES) * halfWide * depth
    + scene.up.xyz * (1.0 + OVER_THE_TOP) * halfHigh * depth;
  let tail = top + fall * (cycles - cycle) * way;
  let smear = speed * SHUTTER;
  let from_ = clipOf(tail - fall * smear);
  let to = clipOf(tail);

  let along = f32(corner & 1u);
  let across = f32(corner >> 1u) * 2.0 - 1.0;
  let inPixels = (to.xy / to.w - from_.xy / from_.w) / rainfall.pixel;
  let sideways = vec2f(-inPixels.y, inPixels.x) / max(length(inPixels), 1e-4);

  // A thin one is as wide as a pixel, and fainter by as much.
  let perMetre = rainfall.height / (2.0 * halfHigh * depth);
  let wide = DROP_WIDE * perMetre;
  let pixels = max(wide, 1.0);
  var clip = mix(from_, to, along);
  clip = vec4f(clip.xy + sideways * rainfall.pixel * across * pixels * 0.75 * clip.w, clip.zw);

  let lit = 0.8 + 0.4 * scattered(drop * 4u + 3u);
  let radiance = scene.lowSky.rgb * BRIGHTNESS * lit;
  return Streak(clip, vec2f(across, along), STRENGTH * saturate(wide) * (0.35 + 0.65 * rainfall.amount), radiance);
}

@fragment
fn streakFragment(streak: Streak) -> @location(0) vec4f {
  let across = 1.0 - streak.at.x * streak.at.x;
  // Thin at the tail, where the shutter opened, and at the head, where it closed.
  let along = sin(streak.at.y * PI);
  let alpha = streak.strength * across * along;
  return vec4f(display(streak.radiance, streak.position.xy) * alpha, alpha);
}
`

export async function createRain(
  device: GPUDevice,
  { kept, uniforms, sceneSource, depthFormat, slant = 0.3 }: RainOptions,
): Promise<Rain> {
  const buffer = kept.keep(
    device.createBuffer({
      label: 'rain',
      size: RAIN_UNIFORMS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  )
  const data = new Float32Array(RAIN_UNIFORMS)
  const module = device.createShaderModule({ code: sceneSource + rainSource })
  const pipeline = await device.createRenderPipelineAsync({
    label: 'rain',
    layout: 'auto',
    vertex: { module, entryPoint: 'streakVertex', constants: { SLANT: slant } },
    fragment: {
      module,
      entryPoint: 'streakFragment',
      targets: [
        {
          format: 'rgba8unorm',
          blend: { color: OVER, alpha: OPAQUE_ALPHA },
        },
      ],
    },
    primitive: { topology: 'triangle-strip' },
    depthStencil: depthFormat && { format: depthFormat, depthCompare: 'greater', depthWriteEnabled: false },
  })
  const group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer } },
    ],
  })

  return {
    aim(width, height) {
      data.set([2 / width, 2 / height, height], 0)
    },

    draw(pass, amount) {
      if (amount <= 0) return
      data[3] = amount
      device.queue.writeBuffer(buffer, 0, data)
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, group)
      pass.draw(DROP_QUAD, Math.ceil(DROPS * amount))
    },
  }
}
