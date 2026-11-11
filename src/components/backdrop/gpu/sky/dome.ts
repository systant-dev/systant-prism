// The sky as a scene draws it: everything that goes over its ground, by day and
// by night, kept up with the time. A scene makes one of these, tells it where the
// camera is, asks it every frame to catch up, and has it draw into its own pass,
// wherever it left the target bare. So most of the sky's pixels are shaded only once.
//
// Every buffer, texture and pipeline is made here once, and by day the night sky
// (heavens/) is not touched at all. The Milky Way isn't even made until the first dusk.
// The clouds (clouds.ts) are lit into a small texture of their own ahead of the pass,
// for the sky and the stars to lie behind, and the moon's face (moonFace.ts) is drawn
// into another whenever the moon has moved, for the sky to read until it moves again.
import type { SceneFrame } from '../renderer'
import { createClouds } from './clouds'
import { type Lens, type Place, skyAt, skyClock } from './daylight'
import { createStarfield, HEAVENS, HEAVENS_SIZE } from './heavens'
import type { Kept } from './kept'
import type { Vec3 } from './maths'
import { createMoonFace } from './moonFace'
import { rainFade } from './rain'
import { lightSky } from './skyLight'
import { SKY_UNIFORM, skySource } from './skyShaders'

/** How often to work out where the sun and moon are, in ms: they barely move in that time. */
const SKY_INTERVAL = 1000

/** How fast rain cloud drifts, in widths of its folds a second, and how fast they change shape. */
const CLOUD_DRIFT = 0.012
const CLOUD_TURNING = 0.008

export interface Camera {
  eye: Vec3
  right: Vec3
  up: Vec3
  forward: Vec3
  /** Half the view's width and height, at a distance of 1. */
  halfWidth: number
  halfHeight: number
  /** The nearest depth drawn, in metres. */
  near: number
}

export interface DomeOptions {
  /** What the scene has made, which this goes in with. */
  kept: Kept
  place: Place
  /** What time it is, when the frame doesn't say. */
  now: () => Date
  /** How long the scene's clock runs before it wraps, in seconds. */
  loopSeconds: number
  /** How the view lies, if not as over the ocean, for the sun and moon to be drawn as high on the screen as there. */
  lens?: Lens
  /** The buffer of the scene's uniforms, and their values, whose sky fields it keeps. */
  uniforms: GPUBuffer
  uniformData: Float32Array
  /** The WGSL of the scene's `Scene` struct, its binding and the sky's light. */
  sceneSource: string
  /** The depth of the pass it is drawn in, as reversed depth; a pass without one has all of it drawn. */
  depthFormat?: GPUTextureFormat
  /** How far above an open horizon the sun and moon sink into its haze, in radians; none where the scene hides it. */
  horizonVeil?: number
}

/** The night sky, for a scene to reflect with pipelines of its own (reflectedHeavensSource). */
export interface NightSky {
  /** The night sky's uniforms. */
  readonly heavens: GPUBuffer
  /** The baked Milky Way as it stands: a new view once it is baked. */
  readonly galaxy: GPUTextureView
  /** The clouds as lit this frame (clouds.ts): a new view whenever the target changes size. */
  readonly clouds: GPUTextureView
  /** A sampler to read them with. */
  readonly cloudSampler: GPUSampler
}

export interface Dome {
  /** The night sky, for the scene to reflect. */
  readonly night: NightSky
  /**
   * To be told once, and whenever the target changes size, with how many of its rows from
   * the top the sky can show in, if not all: no cloud is lit below them.
   */
  aim(camera: Camera, width: number, height: number, skyRows?: number): void
  /**
   * Moves the scene's uniforms on to a frame: how hard it is raining, what its clock
   * says, and where the sun and moon are, which it works out every so often, or as often
   * as they are catching up. Gives the moment it worked them out for, if it did. A still
   * scene, which has no frames to catch up over and nothing moving in it, or a time set
   * by hand, which has to keep up with it, has them go to that moment at once.
   */
  advance(frame: SceneFrame): Date | null
  /** Draws it into a pass, and leaves the pass's pipeline and vertex buffer changed. */
  draw(pass: GPURenderPassEncoder): void
}

export async function createDome(
  device: GPUDevice,
  {
    kept,
    place,
    now,
    loopSeconds,
    lens,
    uniforms,
    uniformData,
    sceneSource,
    depthFormat,
    horizonVeil = 0,
  }: DomeOptions,
): Promise<Dome> {
  const heavens = kept.keep(
    device.createBuffer({
      label: 'sky heavens',
      size: HEAVENS_SIZE * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  )
  const heavensData = new Float32Array(HEAVENS_SIZE)
  let heavensChanged = true

  const skyModule = device.createShaderModule({ code: sceneSource + skySource })
  const depthStencil: GPUDepthStencilState | undefined = depthFormat && {
    format: depthFormat,
    depthCompare: 'greater-equal',
    depthWriteEnabled: false,
  }

  const [skyPipeline, starfield, clouds, moonFace] = await Promise.all([
    device.createRenderPipelineAsync({
      label: 'sky',
      layout: 'auto',
      vertex: { module: skyModule, entryPoint: 'skyVertex' },
      fragment: {
        module: skyModule,
        entryPoint: 'skyFragment',
        targets: [{ format: 'rgba8unorm' }],
        constants: { HORIZON_VEIL: horizonVeil },
      },
      primitive: { topology: 'triangle-list' },
      depthStencil,
    }),
    createStarfield(device, {
      kept,
      place,
      lens,
      module: skyModule,
      depthStencil,
      horizonVeil,
      uniforms,
      heavens,
      heavensData,
    }),
    createClouds(device, { kept, sceneSource, uniforms, heavens, heavensData }),
    createMoonFace(device, { kept, module: skyModule, uniforms, uniformData }),
  ])

  const repeating = device.createSampler({
    addressModeU: 'repeat',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
  })
  function skyGroupOf(galaxy: GPUTextureView) {
    return device.createBindGroup({
      layout: skyPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniforms } },
        { binding: 1, resource: { buffer: heavens } },
        { binding: 2, resource: galaxy },
        { binding: 3, resource: repeating },
        { binding: 4, resource: clouds.view },
        { binding: 5, resource: clouds.sampler },
        { binding: 6, resource: moonFace.view },
        { binding: 7, resource: { buffer: moonFace.part } },
      ],
    })
  }
  let skyGroup = skyGroupOf(starfield.galaxy.view)
  // The target's size, as last told.
  let width = 0
  let height = 0

  let skyChecked = -Infinity
  const skyTime = skyClock()
  const rainNow = rainFade()

  function moveHeavens(moment: number, seconds: number, straight: boolean) {
    const shown = skyTime(moment, seconds, straight)
    let date: Date | null = null
    if (Math.abs(shown - skyChecked) >= SKY_INTERVAL) {
      skyChecked = shown
      date = new Date(shown)
      const { sun, sunSize, sunHeight, moon, moonSize, moonlight, moonTilt } = skyAt(date, place, lens)
      uniformData.set([...sun, sunHeight], SKY_UNIFORM.sun)
      uniformData.set([...moon, moonlight], SKY_UNIFORM.moon)
      // Where the sun and moon are among the stars and the clouds, which are seen through the ocean's lens.
      const seen = lens ? skyAt(date, place) : { sun, moon }
      heavensData.set([...seen.moon, moonlight], HEAVENS.moon)
      heavensData.set([...seen.sun, sunHeight], HEAVENS.sun)
      uniformData[SKY_UNIFORM.sunWide] = sunSize[0]
      uniformData[SKY_UNIFORM.sunTall] = sunSize[1]
      uniformData[SKY_UNIFORM.moonWide] = moonSize[0]
      uniformData[SKY_UNIFORM.moonTall] = moonSize[1]
      uniformData[SKY_UNIFORM.moonTilt] = moonTilt
      starfield.turn(date, sunHeight)
      heavensChanged = true
    }
    // Off the scene's clock, which wraps: cloud has nothing to hide a jump behind.
    if (uniformData[SKY_UNIFORM.rain] > 0) {
      const [windX, windZ] = [uniformData[SKY_UNIFORM.wind], uniformData[SKY_UNIFORM.wind + 1]]
      heavensData[HEAVENS.rainCloud] = windX * seconds * CLOUD_DRIFT
      heavensData[HEAVENS.rainCloud + 1] = windZ * seconds * CLOUD_DRIFT
      heavensData[HEAVENS.rainCloud + 2] = seconds * CLOUD_TURNING
      heavensChanged = true
    }
    return date
  }

  const night: NightSky = {
    heavens,
    get galaxy() {
      return starfield.galaxy.view
    },
    get clouds() {
      return clouds.view
    },
    cloudSampler: clouds.sampler,
  }

  return {
    night,

    aim(camera, wide, high, skyRows = high) {
      width = wide
      height = high
      uniformData.set([...camera.right, 1 / camera.halfWidth], SKY_UNIFORM.right)
      uniformData.set([...camera.up, 1 / camera.halfHeight], SKY_UNIFORM.up)
      uniformData.set([...camera.forward, camera.near], SKY_UNIFORM.forward)
      uniformData.set(camera.eye, SKY_UNIFORM.eye)
      starfield.aim(camera, width, height)
      if (clouds.aim(width, height, skyRows)) {
        skyGroup = skyGroupOf(starfield.galaxy.view)
        starfield.see(clouds.view, clouds.sampler)
      }
      heavensChanged = true
      skyChecked = -Infinity
    },

    advance(frame) {
      const { encoder, seconds, delta, still, time, rain } = frame
      const rained = uniformData[SKY_UNIFORM.rain]
      uniformData[SKY_UNIFORM.rain] = rainNow(rain, delta, still)
      uniformData[SKY_UNIFORM.time] = seconds % loopSeconds
      const moment = (time ?? now()).getTime()
      const date = moveHeavens(moment, seconds, still || time !== undefined)
      if (clouds.light(frame, moment)) heavensChanged = true
      if (date || uniformData[SKY_UNIFORM.rain] !== rained) lightSky(uniformData)
      const baked = starfield.prepare(encoder, still)
      if (baked) heavensChanged = true
      if (moonFace.keepUp(encoder, width, height) || baked) skyGroup = skyGroupOf(starfield.galaxy.view)
      if (heavensChanged) device.queue.writeBuffer(heavens, 0, heavensData)
      heavensChanged = false
      return date
    },

    draw(pass) {
      pass.setPipeline(skyPipeline)
      pass.setBindGroup(0, skyGroup)
      pass.draw(3)
      starfield.draw(pass, uniformData[SKY_UNIFORM.rain])
    },
  }
}
