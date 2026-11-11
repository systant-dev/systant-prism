// A wooded hillside in a breeze, by day and by night, as a scene for a GlassBackdrop.
// See stand.ts for what the forest is made of, panorama.ts for how it is drawn, once,
// and forestShaders.ts for its wind and light. All that is over it is in gpu/sky.
//
// A frame costs one compute dispatch for the wind and a pass of two draws: the sky,
// then the panorama lit over it. By night there is a third, of the stars, and while it
// rains another, of the drops. Two more things run as the light changes: one
// dispatch every second or so for its colour, and one small pass for shadows when
// the sun has moved enough.
//
// Every buffer, texture and pipeline is made here once, and nothing depends on the
// target's size, so a frame allocates nothing on the GPU.
import { OVER } from '../blend'
import type { BackdropScene, SceneFrame } from '../renderer'
import {
  createDome,
  createRain,
  dot,
  type Kept,
  moonWay,
  type Place,
  SKY_UNIFORM,
  sunWay,
  unit,
  type Vec3,
} from '../sky'
import { FOREST_LENS, forestCamera, panoramaCamera, SKY_ONLY } from './camera'
import {
  FOREST_UNIFORM,
  FOREST_UNIFORMS_SIZE,
  forestSource,
  LIGHTS_SIZE,
  lightSource,
  LOOP_SECONDS,
  shadowSource,
  viewSource,
  WIND_GROUP,
  windSource,
} from './forestShaders'
import { shapeTable } from './beam'
import { bakePanorama, PANORAMA_HEIGHT, PANORAMA_MIPS, PANORAMA_WIDTH, viewShare } from './panorama'
import { plantStand } from './stand'

/** The way the wind blows, in radians from +X towards +Z: across the view and a little away. */
const WIND_HEADING = 0.4

/** The cosine of how far the lamp may move before shadows are worked out again: about half a degree. */
const SHADOW_MOVE = Math.cos((0.5 * Math.PI) / 180)

/** How long a step of the wind can be, in seconds: past this a spring would ring. */
const LONGEST_STEP = 1 / 15

/** How high the sun must be, as a sine, before the light comes from where it really is. */
const SUN_SETTLED = 0.3

/** How much higher a settled sun lights the forest from, as a share of the way to it. */
const LAMP_LIFT = 1.1

/** The lowest the moon's light comes from, as a sine: below this it would leave nearly everything in the shadow of the hill. */
const MOON_LOWEST = 0.5

/** The size of the shadows, as a share of the panorama. */
const SHADOW_SCALE = 2

/**
 * How far below the panorama's lowest gap the sky is drawn, in its pixels: past the
 * furthest a part sways (REACH in forestShaders.ts, 11) and the blur of the smallest
 * mip it is read at (16), with room to spare.
 */
const SKY_MARGIN = 64

/** The formats of the target and the shadows. */
const COLOUR_FORMAT: GPUTextureFormat = 'rgba8unorm'
const SHADOW_FORMAT: GPUTextureFormat = 'r8unorm'

/**
 * The way to what lights the forest. The sun's disc is drawn in the middle of the
 * view (daylight.ts), which would light the wood from straight ahead all day, so
 * only a low sun lights it from there: from there it swings out to where the real
 * sun is as it climbs. The moon lights it from where it really is, as its disc is
 * drawn low and ahead, behind the hill, and that would light only the far side of
 * every tree. It crosses from side to side through the night, as the sun does.
 */
export function lampWay(date: Date, place: Place, sun: Vec3, sunHeight: number): Vec3 {
  if (sunHeight <= 0) {
    const [across, height, ahead] = moonWay(date, place)
    return unit([across, Math.max(height, MOON_LOWEST), ahead])
  }
  const real = sunWay(date, place)
  const settled = Math.min(1, sunHeight / SUN_SETTLED)
  // Higher than it really is, as the view faces the sun, and all but the very tops of
  // the trees would otherwise be seen from the side it doesn't reach.
  return unit([
    sun[0] + (real[0] - sun[0]) * settled,
    sun[1] + (real[1] - sun[1]) * settled + settled * LAMP_LIFT,
    sun[2] + (real[2] - sun[2]) * settled,
  ])
}

/** Makes the forest on a device, for forestScene (scene.ts), which loads this module only once it is wanted. */
export async function makeForest(device: GPUDevice, place: Place, now: () => Date, kept: Kept): Promise<BackdropScene> {
  const { keep, filled, pause } = kept
  const stand = await plantStand(pause)
  const { STORAGE, VERTEX, INDEX, UNIFORM, COPY_DST } = GPUBufferUsage

  const lobes = filled('forest lobes', stand.lobes, STORAGE)
  const owners = filled('forest owners', stand.owners, STORAGE)
  const shapes = filled('forest shapes', shapeTable(), STORAGE)
  const blocks = filled('forest blocks', stand.blocks, STORAGE)
  const hullVertices = filled('forest hull', stand.hullVertices, VERTEX)
  const hullIndices = filled('forest hull indices', stand.hullIndices, INDEX)
  const trees = filled('forest trees', stand.trees, STORAGE)
  const branches = filled('forest branches', stand.branches, STORAGE)

  const panorama = await bakePanorama(device, stand, { lobes, owners, blocks, hullVertices, hullIndices }, kept)
  const { albedos, surfaces, depths, parts, heights, behindAlbedos, behindSurfaces, behindParts } = panorama
  // Only the leaves' drawing wanted these.
  for (const buffer of [lobes, blocks, hullVertices, hullIndices]) buffer.destroy()

  const blowing: [number, number] = [Math.cos(WIND_HEADING), Math.sin(WIND_HEADING)]
  // Two to each: a tree's two shapes, and a branch's two values.
  const treeBytes = stand.treeCount * 32
  const treeState = keep(device.createBuffer({ label: 'forest tree state', size: treeBytes, usage: STORAGE }))
  const branchBytes = Math.max(stand.lobeCount, 1) * 16
  const branchState = keep(device.createBuffer({ label: 'forest branch state', size: branchBytes, usage: STORAGE }))
  const motion = keep(device.createBuffer({ label: 'forest motion', size: branchBytes * 2, usage: STORAGE }))
  const lights = keep(device.createBuffer({ label: 'forest lights', size: LIGHTS_SIZE, usage: STORAGE }))
  const uniforms = keep(
    device.createBuffer({ label: 'forest scene', size: FOREST_UNIFORMS_SIZE, usage: UNIFORM | COPY_DST }),
  )
  const uniformData = new Float32Array(FOREST_UNIFORMS_SIZE / 4)
  uniformData.set(blowing, SKY_UNIFORM.wind)

  const { halfWidth, halfHeight } = panoramaCamera()
  const shadowTexture = keep(
    device.createTexture({
      label: 'forest shadows',
      size: [PANORAMA_WIDTH / SHADOW_SCALE, PANORAMA_HEIGHT / SHADOW_SCALE],
      format: SHADOW_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }),
  )
  await pause()

  const windModule = device.createShaderModule({ code: forestSource + windSource })
  const lightModule = device.createShaderModule({ code: forestSource + lightSource })
  const shadowModule = device.createShaderModule({ code: forestSource + shadowSource(halfWidth, halfHeight) })
  const viewModule = device.createShaderModule({ code: forestSource + viewSource })
  const compute = (module: GPUShaderModule, entryPoint: string) =>
    device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint } })

  const [windPipeline, lightPipeline, shadowPipeline, viewPipeline, dome, rainfall] = await Promise.all([
    compute(windModule, 'windMain'),
    compute(lightModule, 'lightMain'),
    device.createRenderPipelineAsync({
      label: 'forest shadows',
      layout: 'auto',
      vertex: { module: shadowModule, entryPoint: 'overVertex' },
      fragment: { module: shadowModule, entryPoint: 'shadowFragment', targets: [{ format: SHADOW_FORMAT }] },
      primitive: { topology: 'triangle-list' },
    }),
    device.createRenderPipelineAsync({
      label: 'forest view',
      layout: 'auto',
      vertex: { module: viewModule, entryPoint: 'overVertex' },
      fragment: {
        module: viewModule,
        entryPoint: 'viewFragment',
        targets: [{ format: COLOUR_FORMAT, blend: { color: OVER, alpha: OVER } }],
      },
      primitive: { topology: 'triangle-list' },
    }),
    createDome(device, {
      kept,
      place,
      now,
      loopSeconds: LOOP_SECONDS,
      lens: FOREST_LENS,
      uniforms,
      uniformData,
      sceneSource: forestSource,
    }),
    createRain(device, { kept, uniforms, sceneSource: forestSource }),
  ])

  const windGroup = device.createBindGroup({
    layout: windPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer: trees } },
      { binding: 2, resource: { buffer: branches } },
      { binding: 3, resource: { buffer: treeState } },
      { binding: 4, resource: { buffer: branchState } },
      { binding: 5, resource: { buffer: motion } },
    ],
  })
  const lightGroup = device.createBindGroup({
    layout: lightPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer: lights } },
    ],
  })
  const smooth = device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' })
  const shadowGroup = device.createBindGroup({
    layout: shadowPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: heights.createView() },
      { binding: 2, resource: depths.createView() },
      { binding: 3, resource: albedos.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
      { binding: 4, resource: smooth },
    ],
  })
  const viewGroup = device.createBindGroup({
    layout: viewPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer: lights } },
      { binding: 2, resource: albedos.createView() },
      { binding: 3, resource: surfaces.createView() },
      { binding: 4, resource: depths.createView() },
      { binding: 5, resource: shadowTexture.createView() },
      { binding: 6, resource: parts.createView() },
      { binding: 7, resource: { buffer: motion } },
      { binding: 8, resource: smooth },
      { binding: 9, resource: behindAlbedos.createView() },
      { binding: 10, resource: behindSurfaces.createView() },
      { binding: 11, resource: behindParts.createView() },
      { binding: 12, resource: { buffer: owners } },
      { binding: 13, resource: { buffer: shapes } },
    ],
  })

  const windGroups = Math.ceil(stand.treeCount / WIND_GROUP)
  const shadowView = shadowTexture.createView()

  let width = 0
  let height = 0
  // The row of the target that the trees could come as high as, and the row below which
  // the forest hides all of the sky, however it sways.
  let treeTop = 0
  let skyBottom = 0

  // Where the shadows were last worked out for, and what needs doing.
  let shadowsFor: Vec3 | null = null
  let shadowsWanted = false
  let lightWanted = false

  function resize(nextWidth: number, nextHeight: number) {
    width = nextWidth
    height = nextHeight
    const aspect = width / height
    const [across, down] = viewShare(aspect)
    // A panorama pixel for each of the target's at the mip it is read at.
    const lod = Math.max(0, Math.min(PANORAMA_MIPS - 1, Math.log2((down * PANORAMA_HEIGHT) / height)))
    uniformData.set([across, down, lod], FOREST_UNIFORM.view)
    // A share of the way down the panorama as a row of the target.
    const row = (share: number) => (0.5 + (share - 0.5) / down) * height
    treeTop = Math.min(height - 1, Math.max(0, Math.floor(row(SKY_ONLY))))
    skyBottom = Math.min(height, Math.max(1, Math.ceil(row((panorama.openTo + SKY_MARGIN) / PANORAMA_HEIGHT))))
    dome.aim(forestCamera(aspect), width, height, skyBottom)
    rainfall.aim(width, height)
  }

  /** Sets the lamp from a moment the sky has just been worked out for. */
  function aimLamp(date: Date) {
    const at = (field: number): Vec3 => [uniformData[field], uniformData[field + 1], uniformData[field + 2]]
    const way = lampWay(date, place, at(SKY_UNIFORM.sun), uniformData[SKY_UNIFORM.sun + 3])
    uniformData.set(way, FOREST_UNIFORM.lamp)
    const { right, up, forward } = panoramaCamera()
    uniformData.set([dot(way, right), dot(way, up), -dot(way, forward)], FOREST_UNIFORM.lampSeen)
    lightWanted = true
    const cosine = shadowsFor ? dot(way, shadowsFor) : -1
    if (cosine < SHADOW_MOVE) {
      shadowsFor = way
      shadowsWanted = true
    }
  }

  function simulate(encoder: GPUCommandEncoder, still: boolean) {
    if (still && !lightWanted) return
    const pass = encoder.beginComputePass({ label: 'forest wind' })
    if (lightWanted) {
      pass.setPipeline(lightPipeline)
      pass.setBindGroup(0, lightGroup)
      pass.dispatchWorkgroups(1)
    }
    if (!still) {
      pass.setPipeline(windPipeline)
      pass.setBindGroup(0, windGroup)
      pass.dispatchWorkgroups(windGroups)
    }
    pass.end()
    lightWanted = false
  }

  function castShadows(encoder: GPUCommandEncoder) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: shadowView, loadOp: 'clear', clearValue: [1, 1, 1, 1], storeOp: 'store' }],
    })
    pass.setPipeline(shadowPipeline)
    pass.setBindGroup(0, shadowGroup)
    pass.draw(3)
    pass.end()
    shadowsWanted = false
  }

  function draw(encoder: GPUCommandEncoder, target: GPUTextureView) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: target, loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }],
    })
    // Below the forest's lowest gap the sky would only be drawn over.
    pass.setScissorRect(0, 0, width, skyBottom)
    dome.draw(pass)
    // Nearly half the screen is only sky, which would otherwise have to look for trees.
    pass.setScissorRect(0, treeTop, width, height - treeTop)
    pass.setPipeline(viewPipeline)
    pass.setBindGroup(0, viewGroup)
    pass.draw(3)
    pass.setScissorRect(0, 0, width, height)
    rainfall.draw(pass, uniformData[SKY_UNIFORM.rain])
    pass.end()
  }

  return {
    render(frame: SceneFrame) {
      const { encoder, target, width: nextWidth, height: nextHeight, delta, still } = frame
      if (nextWidth !== width || nextHeight !== height) resize(nextWidth, nextHeight)

      const rained = uniformData[SKY_UNIFORM.rain]
      const date = dome.advance(frame)
      lightWanted ||= uniformData[SKY_UNIFORM.rain] !== rained
      if (date) aimLamp(date)
      uniformData[FOREST_UNIFORM.delta] = Math.min(delta, LONGEST_STEP)
      device.queue.writeBuffer(uniforms, 0, uniformData)

      const shadows = shadowsWanted
      simulate(encoder, still)
      if (shadows) castShadows(encoder)
      draw(encoder, target)
    },

    dispose() {
      kept.release()
    },
  }
}
