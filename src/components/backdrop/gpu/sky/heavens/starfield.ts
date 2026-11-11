// The night sky as a scene's dome draws it, the same over every scene: the stars, where
// they really are and as many as a dark site shows, and the Milky Way, with what lies
// beyond it that the eye can see, all turning with the real sky for the time and place.
// Each night the view of it faces where the Milky Way is best seen low down (facing.ts).
// Every scene sees it through the ocean's lens, whatever its own, so that each star and
// the Milky Way are drawn in the same place on the screen as one scene gives way to
// another, as the sun and moon are (daylight.ts).
//
// Only what the view needs is drawn, and it costs next to nothing. A star is a tiny
// quad, made once, from an instance buffer that holds only those stars that can ever
// pass low in the sky from this latitude, which a view that looks low can take in. They
// are in order of right ascension, so that only the slice of them in the view now is
// drawn. The Milky Way is baked once (galaxy.ts). By day neither is touched at all.
//
// How the stars come out goes by the depth of the real sun: the brightest first, at
// the end of civil twilight, and the faintest with the full dark of the end of
// astronomical twilight, with the Milky Way and the glows beyond it after nearly all
// of them. Dawn is the same the other way.
import type { Camera } from '../dome'
import { HORIZON_HALF_FOV, HORIZON_PITCH, type Lens, type Place } from '../daylight'
import type { Kept } from '../kept'
import { OPAQUE_ALPHA } from '../../blend'
import { heavensAt, milkyWayOut, starsInReach, starsOut, viewSlice } from './celestial'
import { facingPlanner } from './facing'
import { createGalaxy, type Galaxy, STRIPS } from './galaxy'
import { HEAVENS } from './heavensShaders'
import { crowdingMap, PACKED_ATTRIBUTES, PACKED_STRIDE, packStars, starAscensions, starFieldInSteps } from './stars'

/** How many strips of the Milky Way to bake a frame when it has to show at once. */
const HURRIED_STRIPS = 4

export interface StarfieldOptions {
  kept: Kept
  place: Place
  /** The lens the scene's camera is, if not the ocean's: the sky is still seen through the ocean's. */
  lens?: Lens
  /** The scene's shader module, with heavensSource in it. */
  module: GPUShaderModule
  /** The depth of the pass it is drawn in, if it has one. */
  depthStencil?: GPUDepthStencilState
  /** How far above an open horizon the sun and moon sink into its haze, which the stars fade into too. */
  horizonVeil?: number
  /** The scene's uniforms, and the heavens uniforms and their values, which it writes its part of. */
  uniforms: GPUBuffer
  heavens: GPUBuffer
  heavensData: Float32Array
}

export interface Starfield {
  /** The baked Milky Way, for the sky to look up. */
  readonly galaxy: Galaxy
  /** To be told once, and whenever the target changes size. */
  aim(camera: Camera, width: number, height: number): void
  /** Turns the sky to a moment, with the real sun at this height, as a sine. */
  turn(date: Date, sunHeight: number): void
  /** Bakes what it needs to before it is drawn. Says whether the galaxy's view has changed. */
  prepare(encoder: GPUCommandEncoder, still: boolean): boolean
  /** Has the stars lie behind the clouds in this texture, read with this sampler. */
  see(clouds: GPUTextureView, sampler: GPUSampler): void
  /** Draws the stars, if any are out, and leaves the pass's pipeline and vertex buffer changed. */
  draw(pass: GPURenderPassEncoder, rain: number): void
}

/**
 * The camera the night sky is seen through for a scene's: the ocean's lens, as much wider
 * and taller as the scene's camera is than its own lens, so that the sun and moon,
 * which are put on the screen the same way (daylight.ts), stay where they are among
 * the stars. For a scene over the ocean, its own camera.
 */
export function skyCamera(camera: Camera, lens?: Lens): Camera {
  if (!lens) return camera
  const scale = Math.tan(HORIZON_HALF_FOV) / Math.tan(lens.halfFov)
  return {
    ...camera,
    up: [0, Math.cos(HORIZON_PITCH), Math.sin(HORIZON_PITCH)],
    forward: [0, -Math.sin(HORIZON_PITCH), Math.cos(HORIZON_PITCH)],
    halfWidth: camera.halfWidth * scale,
    halfHeight: camera.halfHeight * scale,
  }
}

export async function createStarfield(
  device: GPUDevice,
  { kept, place, lens, module, depthStencil, horizonVeil = 0, uniforms, heavens, heavensData }: StarfieldOptions,
): Promise<Starfield> {
  // A step at a time, with the page painting between, and before the first: the scene
  // that makes this has been busy until now, and the map of the Milky Way is ~30 ms itself.
  await kept.pause()
  const crowding = crowdingMap()
  const making = starFieldInSteps(place, 0, crowding)
  let step
  do {
    await kept.pause()
    step = making.next()
  } while (!step.done)
  const field = step.value
  const stars = kept.filled('sky stars', packStars(field), GPUBufferUsage.VERTEX)
  const ascensions = starAscensions(field)
  // Which way the view of the sky faces, night by night.
  // Judged across the middle of a view as wide as one of 16:9 through the sky's lens.
  const facing = facingPlanner(place, crowding, 0.8 * Math.atan((Math.tan(HORIZON_HALF_FOV) * 16) / 9))
  // The stars in view now, as the first of each run and how many, and how far the view reaches either side.
  let runs: [number, number][] = []
  let side = 1

  const [galaxy, pipeline] = await Promise.all([
    createGalaxy(device, kept),
    device.createRenderPipelineAsync({
      label: 'sky stars',
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'starVertex',
        constants: { HORIZON_VEIL: horizonVeil },
        buffers: [{ arrayStride: PACKED_STRIDE, stepMode: 'instance', attributes: PACKED_ATTRIBUTES }],
      },
      fragment: {
        module,
        entryPoint: 'starFragment',
        targets: [
          {
            format: 'rgba8unorm',
            blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: OPAQUE_ALPHA },
          },
        ],
      },
      primitive: { topology: 'triangle-strip' },
      depthStencil,
    }),
  ])
  let group: GPUBindGroup | null = null
  const out = () => heavensData[HEAVENS.pixel + 2]
  const inView = () => {
    const [middle, reach] = viewSlice(heavensData, side)
    runs = starsInReach(ascensions, middle, reach)
  }

  return {
    galaxy,

    aim(camera, width, height) {
      heavensData[HEAVENS.pixel] = 2 / width
      heavensData[HEAVENS.pixel + 1] = 2 / height
      heavensData[HEAVENS.pixel + 3] = height / 1080
      const sky = skyCamera(camera, lens)
      heavensData.set([...sky.right, 1 / sky.halfWidth], HEAVENS.lens)
      heavensData.set([...sky.up, 1 / sky.halfHeight], HEAVENS.lens + 4)
      heavensData.set([...sky.forward, 0], HEAVENS.lens + 8)
      // A little past the edge of the view, for the stars' own glow.
      side = Math.atan(sky.halfWidth) + 0.02
      inView()
    },

    turn(date, sunHeight) {
      heavensData.set(heavensAt(date, place, facing(date)))
      heavensData[HEAVENS.pixel + 2] = starsOut(sunHeight)
      heavensData[HEAVENS.night] = galaxy.baked ? milkyWayOut(out()) : 0
      inView()
    },

    prepare(encoder, still) {
      if (out() <= 0 || galaxy.baked) return false
      // A strip a frame while it is too light to see, a few if it has to show now,
      // and all of it for a scene held still, which may draw no more frames.
      const done = galaxy.bake(encoder, still ? STRIPS : milkyWayOut(out()) > 0 ? HURRIED_STRIPS : 1)
      if (done) heavensData[HEAVENS.night] = milkyWayOut(out())
      return done
    },

    see(clouds, sampler) {
      group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniforms } },
          { binding: 1, resource: { buffer: heavens } },
          { binding: 4, resource: clouds },
          { binding: 5, resource: sampler },
        ],
      })
    },

    draw(pass, rain) {
      if (out() <= 0 || rain >= 1 || !group) return
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, group)
      pass.setVertexBuffer(0, stars)
      for (const [first, count] of runs) pass.draw(4, count, 0, first)
    },
  }
}
