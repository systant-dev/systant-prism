// The ocean under an open sky, by day and by night, as a scene for a GlassBackdrop.
// See spectrum.ts for the waves, fftShaders.ts for the simulation, cdlod.ts for the
// mesh and surfaceShaders.ts for how it is lit. All that is over it is in gpu/sky.
//
// A frame costs, in order: three compute dispatches for all six cascades' FFTs,
// seven more for the mips of their slopes, and two draws, the ocean from near to far
// and then the sky wherever it left bare, so most of the pixels are shaded only once.
// By night there is one more draw, of the stars; the ocean mirrors the Milky Way as it
// shades the water. While it rains there are two more
// dispatches and a mip chain, for the rings, and two more draws (rainShaders.ts).
//
// Every buffer, texture and pipeline is made here once. Only what depends on the
// target's size (the depth buffer and the tiles in view) is made again when that
// changes, so a frame allocates nothing on the GPU.
import type { BackdropScene, SceneFrame } from '../renderer'
import { OPAQUE_ALPHA, OVER } from '../blend'
import { createDome, createRain, type Kept, type Place, RAIN_FALL, reflectedHeavensSource } from '../sky'
import { footprintInView, oceanCamera } from './camera'
import { selectTiles, TILE_QUADS, TILE_STRIDE, tileIndices, tileInstances } from './cdlod'
import { FFT_PARAMS_SIZE, fftSource, FOAM_FIRST, KEPT_CASCADES, KEPT_ROWS, mipSource } from './fftShaders'
import {
  dropSource,
  LANDED_DROPS,
  LANDED_GROUP,
  LANDED_SIZE,
  landedSource,
  RIPPLE_GROUP,
  RIPPLE_MIPS,
  RIPPLE_SAMPLES,
  rippleSource,
  splashCount,
  SPLASH_QUADS,
  splashSource,
} from './rainShaders'
import { SCENE_UNIFORM, SCENE_UNIFORMS_SIZE, sceneSource } from './sceneShaders'
import {
  BAND_SAMPLES,
  CASCADE_SAMPLES,
  CASCADE_SIZES,
  cascadeBand,
  cascadeSpectrumInSteps,
  CASCADES,
  KEPT_WAVES,
  keptSpectrum,
  LOOP_SECONDS,
  type Ocean,
  oceanStatistics,
  SLOPE_ENTRIES,
  SPECTRUM_STRIDE,
} from './spectrum'
import { surfaceSource } from './surfaceShaders'

/** A breeze: moderate wind waves, with a long swell running across it. */
const OCEAN: Ocean = {
  wind: 8.5,
  fetch: 160_000,
  heading: -2.1,
  swell: { height: 0.9, period: 11.5, heading: -1.25, spread: 0.11 },
}

/** How far the waves' tops are drawn in towards their crests: 1 is the physics, more folds them over. */
const CHOPPINESS = 0.92

/** The longest the waves are worked out for before the page is let paint, in ms: well inside a 50 ms long task. */
const SPECTRUM_SLICE = 12

/** How long foam takes to fade to about a third, in seconds. */
const FOAM_FADE = 2.2

/**
 * How long the squeeze that breaks foam up is averaged over, in seconds (fftShaders.ts):
 * long enough for waves under about half a metre, which pass in less, to average away.
 */
const LACE_SETTLE = 0.3

/**
 * How long before a frame held still, with none before it, the waves are run from, in
 * seconds, and how far apart the moments are: long enough for all but the last of the
 * foam to have gone, and close enough that a crest moves under a texel between them
 * and leaves its foam in an unbroken trail. A hundred moments, once.
 */
const STILL_HISTORY = 5
const STILL_STEP = 0.05

/**
 * How far above the horizon the sun and moon sink into the haze over the ocean, in
 * radians: about two thirds of the moon's height, so that one half set fades and blurs
 * into the water rather than being cut off by it.
 */
const HORIZON_VEIL = 0.024

/** How many mips the cascades' slopes have, down to 2×2. */
const SLOPE_MIPS = Math.log2(CASCADE_SAMPLES)

/** The formats of the target's depth, and of the slopes. */
const DEPTH_FORMAT: GPUTextureFormat = 'depth32float'
const FIELD_FORMAT: GPUTextureFormat = 'rgba16float'

/**
 * Foam by cascade: how fast it forms as the surface folds, and how near to folding.
 * Only waves of a few metres to a few tens of metres make whitecaps: the peak of the
 * spectrum is too gentle to break, and short ripples fold all the time, in a lace
 * over the whole ocean, without breaking at all.
 */
const FOAM: [number, number][] = [
  [0, 0],
  [5, 0.8],
  [5, 0.72],
  [0, 0],
  [0, 0],
  [0, 0],
]

/** The scene's uniforms that never change, by what they are. */
function constantUniforms(ocean: Ocean) {
  const uniforms = new Float32Array(SCENE_UNIFORMS_SIZE / 4)
  uniforms.set([Math.cos(ocean.heading), Math.sin(ocean.heading)], SCENE_UNIFORM.wind)
  CASCADE_SIZES.forEach((size, i) => {
    const [, high] = cascadeBand(i)
    const shortest = Number.isFinite(high) ? (2 * Math.PI) / high : (size * 2) / CASCADE_SAMPLES
    uniforms.set([size, 1 / size, shortest * 1.5], SCENE_UNIFORM.cascades + i * 4)
  })
  const { slopeVariances } = oceanStatistics(ocean)
  for (let i = 0; i < SLOPE_ENTRIES; i++)
    uniforms.set(slopeVariances.subarray(i * 2, i * 2 + 2), SCENE_UNIFORM.unresolved + i * 4)
  return uniforms
}

/** Makes the ocean on a device, for oceanScene (scene.ts), which loads this module only once it is wanted. */
export async function makeOcean(device: GPUDevice, place: Place, now: () => Date, kept: Kept): Promise<BackdropScene> {
  const { keep, filled, pause } = kept

  // One module for each source, however many of its entry points are pipelines.
  const modules = new Map<string, GPUShaderModule>()
  function compute(code: string, entryPoint: string) {
    let module = modules.get(code)
    if (!module) modules.set(code, (module = device.createShaderModule({ code })))
    return device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint } })
  }

  // The waves, once.
  const spectrum = keep(
    device.createBuffer({
      label: 'ocean spectrum',
      size: KEPT_WAVES * SPECTRUM_STRIDE * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
  )
  // A row at a time, letting the page paint whenever it has waited long enough: the last
  // cascade alone is tens of ms of work, and the others are a few each.
  let since = performance.now()
  for (let i = 0, at = 0; i < CASCADES; i++) {
    const making = cascadeSpectrumInSteps(OCEAN, i)
    let step = making.next()
    while (!step.done) {
      if (performance.now() - since > SPECTRUM_SLICE) {
        await pause()
        since = performance.now()
      }
      step = making.next()
    }
    const waves = keptSpectrum(step.value, i)
    device.queue.writeBuffer(spectrum, at, waves)
    at += waves.byteLength
  }

  const twiddleData = new Float32Array(CASCADE_SAMPLES)
  for (let i = 0; i < CASCADE_SAMPLES / 2; i++) {
    const turn = (2 * Math.PI * i) / CASCADE_SAMPLES
    twiddleData.set([Math.cos(turn), Math.sin(turn)], i * 2)
  }
  const twiddles = filled('ocean twiddles', twiddleData, GPUBufferUsage.STORAGE)

  // Two vec4fs per sample.
  const rows = keep(
    device.createBuffer({
      label: 'ocean rows',
      size: KEPT_ROWS * CASCADE_SAMPLES * 32,
      usage: GPUBufferUsage.STORAGE,
    }),
  )
  const fftParams = keep(
    device.createBuffer({
      label: 'ocean fft params',
      size: FFT_PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  )
  const params = new Float32Array(FFT_PARAMS_SIZE / 4)
  params.set([0, 1, CHOPPINESS, 0])
  CASCADE_SIZES.forEach((size, i) => params.set([(2 * Math.PI) / size, ...FOAM[i], 0], 4 + i * 4))

  const fieldUsage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
  const fieldSize = [CASCADE_SAMPLES, CASCADE_SAMPLES, CASCADES]
  const displacement = keep(
    device.createTexture({ label: 'ocean displacement', size: fieldSize, format: FIELD_FORMAT, usage: fieldUsage }),
  )
  const slopes = keep(
    device.createTexture({
      label: 'ocean slopes',
      size: fieldSize,
      format: FIELD_FORMAT,
      mipLevelCount: SLOPE_MIPS,
      usage: fieldUsage | GPUTextureUsage.COPY_SRC,
    }),
  )
  // What foam builds on: the last frame's, of the cascades that make any, and of the one
  // whose squeeze breaks it up.
  const foamSize = [CASCADE_SAMPLES, CASCADE_SAMPLES, KEPT_CASCADES]
  const lastFoam = keep(
    device.createTexture({
      label: 'ocean last foam',
      size: foamSize,
      format: FIELD_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    }),
  )

  // What rain does to the water is made only once it first rains (rainOn). Until then the
  // surface, which reads it only while it rains, is given a pixel of nothing in its place.
  const dry = keep(
    device.createTexture({
      label: 'ocean ripples, none yet',
      size: [1, 1, 1],
      format: FIELD_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING,
    }),
  )

  const uniforms = keep(
    device.createBuffer({
      label: 'ocean scene',
      size: SCENE_UNIFORMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  )
  const uniformData = constantUniforms(OCEAN)

  const indices = filled('ocean indices', tileIndices(), GPUBufferUsage.INDEX)

  // The night sky, in a group of its own, for the ocean to reflect.
  const nightSource = reflectedHeavensSource(1)
  const surfaceModule = device.createShaderModule({ code: sceneSource + nightSource + surfaceSource })
  const splashModule = device.createShaderModule({ code: sceneSource + dropSource + splashSource })

  const [
    rowsPipeline,
    lastRowsPipeline,
    columnsPipeline,
    mipPipeline,
    landedPipeline,
    ripplePipeline,
    surfacePipeline,
    splashPipeline,
    dome,
    rainfall,
  ] = await Promise.all([
    compute(fftSource, 'rowsMain'),
    compute(fftSource, 'lastRowsMain'),
    compute(fftSource, 'columnsMain'),
    compute(mipSource, 'mipMain'),
    compute(sceneSource + dropSource + landedSource, 'landedMain'),
    compute(sceneSource + dropSource + rippleSource, 'rippleMain'),
    device.createRenderPipelineAsync({
      label: 'ocean surface',
      layout: 'auto',
      vertex: {
        module: surfaceModule,
        entryPoint: 'surfaceVertex',
        // The Milky Way is looked up here too, and fades into the horizon's haze as it does there.
        constants: { HORIZON_VEIL },
        buffers: [
          {
            arrayStride: TILE_STRIDE * 4,
            stepMode: 'instance',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: {
        module: surfaceModule,
        entryPoint: 'surfaceFragment',
        constants: { HORIZON_VEIL },
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
      // The depth is reversed, as a float holds far more precision near 0: it
      // has to tell 25 cm from 160 km.
      depthStencil: { format: DEPTH_FORMAT, depthCompare: 'greater', depthWriteEnabled: true },
    }),
    device.createRenderPipelineAsync({
      label: 'ocean splashes',
      layout: 'auto',
      vertex: { module: splashModule, entryPoint: 'splashVertex' },
      fragment: {
        module: splashModule,
        entryPoint: 'splashFragment',
        targets: [
          {
            format: 'rgba8unorm',
            blend: { color: OVER, alpha: OPAQUE_ALPHA },
          },
        ],
      },
      primitive: { topology: 'triangle-strip' },
      depthStencil: { format: DEPTH_FORMAT, depthCompare: 'greater', depthWriteEnabled: false },
    }),
    createDome(device, {
      kept,
      place,
      now,
      loopSeconds: LOOP_SECONDS,
      uniforms,
      uniformData,
      sceneSource,
      depthFormat: DEPTH_FORMAT,
      horizonVeil: HORIZON_VEIL,
    }),
    // Rain is blown over as far as this wind blows it while it falls.
    createRain(device, { kept, uniforms, sceneSource, depthFormat: DEPTH_FORMAT, slant: OCEAN.wind / RAIN_FALL }),
  ])

  const waves = device.createSampler({
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
    maxAnisotropy: 16,
  })
  const rowsGroups = [rowsPipeline, lastRowsPipeline].map((pipeline) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: fftParams } },
        { binding: 1, resource: { buffer: twiddles } },
        { binding: 2, resource: { buffer: spectrum } },
        { binding: 3, resource: { buffer: rows } },
      ],
    }),
  )
  const columnsGroup = device.createBindGroup({
    layout: columnsPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: fftParams } },
      { binding: 1, resource: { buffer: twiddles } },
      { binding: 3, resource: { buffer: rows } },
    ],
  })

  const mipLevel = (texture: GPUTexture, level: number) =>
    texture.createView({ dimension: '2d-array', baseMipLevel: level, mipLevelCount: 1 })

  /** A mip of `texture` from the one above it, one group per level. */
  function mipGroups(texture: GPUTexture, levels: number) {
    return Array.from({ length: levels - 1 }, (_, i) =>
      device.createBindGroup({
        layout: mipPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: mipLevel(texture, i) },
          { binding: 1, resource: mipLevel(texture, i + 1) },
        ],
      }),
    )
  }

  /** Writes each mip of `texture`, `layers` deep, from the one above it. */
  function dispatchMips(pass: GPUComputePassEncoder, groups: GPUBindGroup[], size: number, layers: number) {
    pass.setPipeline(mipPipeline)
    groups.forEach((group, i) => {
      pass.setBindGroup(0, group)
      pass.dispatchWorkgroups(Math.ceil((size >> (i + 1)) / 8), Math.ceil((size >> (i + 1)) / 8), layers)
    })
  }

  const fieldGroup = device.createBindGroup({
    layout: columnsPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: displacement.createView({ dimension: '2d-array' }) },
      { binding: 1, resource: mipLevel(slopes, 0) },
      { binding: 2, resource: lastFoam.createView({ dimension: '2d-array' }) },
    ],
  })
  const slopeMips = mipGroups(slopes, SLOPE_MIPS)
  const surfaceGroupOf = (ripples: GPUTexture) =>
    device.createBindGroup({
      layout: surfacePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniforms } },
        { binding: 1, resource: displacement.createView({ dimension: '2d-array' }) },
        { binding: 2, resource: slopes.createView({ dimension: '2d-array' }) },
        { binding: 3, resource: waves },
        { binding: 4, resource: ripples.createView({ dimension: '2d-array' }) },
      ],
    })
  let surfaceGroup = surfaceGroupOf(dry)
  // The night sky for the surface, made again once the Milky Way is baked.
  const repeating = device.createSampler({
    addressModeU: 'repeat',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
  })
  let surfaceNight: GPUBindGroup | null = null
  let nightFor: GPUTextureView | null = null
  let cloudsFor: GPUTextureView | null = null
  function nightForSurface() {
    const { heavens, galaxy, clouds, cloudSampler } = dome.night
    if (nightFor !== galaxy || cloudsFor !== clouds || !surfaceNight) {
      nightFor = galaxy
      cloudsFor = clouds
      surfaceNight = device.createBindGroup({
        layout: surfacePipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: heavens } },
          { binding: 1, resource: galaxy },
          { binding: 2, resource: repeating },
          { binding: 3, resource: clouds },
          { binding: 4, resource: cloudSampler },
        ],
      })
    }
    return surfaceNight
  }
  /** The ripples rain makes on the water and the drops that make them, made the first time it rains. */
  let rainy: { landedGroup: GPUBindGroup; rippleGroup: GPUBindGroup; rippleMips: GPUBindGroup[] } | null = null
  function rainOn() {
    if (rainy) return rainy
    const ripples = keep(
      device.createTexture({
        label: 'ocean ripples',
        size: [RIPPLE_SAMPLES, RIPPLE_SAMPLES, 1],
        format: FIELD_FORMAT,
        mipLevelCount: RIPPLE_MIPS,
        usage: fieldUsage,
      }),
    )
    const landed = keep(
      device.createBuffer({ label: 'ocean drops', size: LANDED_DROPS * LANDED_SIZE, usage: GPUBufferUsage.STORAGE }),
    )
    surfaceGroup = surfaceGroupOf(ripples)
    rainy = {
      landedGroup: device.createBindGroup({
        layout: landedPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniforms } },
          { binding: 1, resource: { buffer: landed } },
        ],
      }),
      rippleGroup: device.createBindGroup({
        layout: ripplePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 1, resource: mipLevel(ripples, 0) },
          { binding: 2, resource: { buffer: landed } },
        ],
      }),
      rippleMips: mipGroups(ripples, RIPPLE_MIPS),
    }
    return rainy
  }
  const splashGroup = device.createBindGroup({
    layout: splashPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: displacement.createView({ dimension: '2d-array' }) },
      { binding: 2, resource: waves },
    ],
  })
  // All that depends on the target's size; see above.
  let width = 0
  let height = 0
  let depthTexture: GPUTexture | null = null
  let depthView: GPUTextureView | null = null
  let instances: GPUBuffer | null = null
  let tileCount = 0
  let tilesFor = 0

  function resize(nextWidth: number, nextHeight: number) {
    width = nextWidth
    height = nextHeight
    depthTexture?.destroy()

    depthTexture = device.createTexture({
      label: 'ocean depth',
      size: [width, height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    depthView = depthTexture.createView()

    const camera = oceanCamera(width / height)
    // The shape of the view is all they go by, and it often stays the same.
    if (width / height !== tilesFor) {
      tilesFor = width / height
      const tiles = tileInstances(selectTiles(footprintInView(camera)))
      tileCount = tiles.length / TILE_STRIDE
      if (!instances || instances.size < tiles.byteLength) {
        instances?.destroy()
        instances = device.createBuffer({
          label: 'ocean tiles',
          // With room to spare, so that a viewport being resized needs no more.
          size: Math.max(tiles.byteLength * 1.25, TILE_STRIDE * 4),
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
      }
      device.queue.writeBuffer(instances, 0, tiles)
    }

    uniformData[SCENE_UNIFORM.pixels] = height
    dome.aim(camera, width, height)
    rainfall.aim(width, height)
  }

  function drawOcean(encoder: GPUCommandEncoder, target: GPUTextureView) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: target, loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }],
      depthStencilAttachment: { view: depthView!, depthLoadOp: 'clear', depthClearValue: 0, depthStoreOp: 'discard' },
    })
    pass.setPipeline(surfacePipeline)
    pass.setBindGroup(0, surfaceGroup)
    pass.setBindGroup(1, nightForSurface())
    pass.setVertexBuffer(0, instances)
    pass.setIndexBuffer(indices, 'uint16')
    pass.drawIndexed(TILE_QUADS * TILE_QUADS * 6, tileCount)
    dome.draw(pass)
    const rain = uniformData[SCENE_UNIFORM.rain]
    if (rain > 0) {
      pass.setPipeline(splashPipeline)
      pass.setBindGroup(0, splashGroup)
      pass.draw(SPLASH_QUADS, splashCount(rain))
    }
    rainfall.draw(pass, rain)
    pass.end()
  }

  /** Records working the waves out for the moment in the FFT's uniforms: their heights, their slopes, and the foam and squeeze that build on the last moment's. */
  function simulate(pass: GPUComputePassEncoder) {
    pass.setPipeline(rowsPipeline)
    pass.setBindGroup(0, rowsGroups[0])
    pass.dispatchWorkgroups(BAND_SAMPLES, 1, CASCADES - 1)
    pass.setPipeline(lastRowsPipeline)
    pass.setBindGroup(0, rowsGroups[1])
    pass.dispatchWorkgroups(CASCADE_SAMPLES)
    pass.setPipeline(columnsPipeline)
    pass.setBindGroup(0, columnsGroup)
    pass.setBindGroup(1, fieldGroup)
    pass.dispatchWorkgroups(CASCADE_SAMPLES, 1, CASCADES)
  }

  /** Records keeping this moment's foam and squeeze for the next to build on. */
  function keepFoam(encoder: GPUCommandEncoder) {
    encoder.copyTextureToTexture({ texture: slopes, origin: [0, 0, FOAM_FIRST] }, { texture: lastFoam }, foamSize)
  }

  // Whether the waves have been worked out for any moment yet.
  let begun = false

  /**
   * Works the waves out for the moments leading up to `seconds`, so that a frame held
   * still with none before it has the foam those moments left and the squeeze averaged
   * over them, as a frame of the moving ocean has: without them it has only the foam
   * forming at that instant, and its whitecaps are bare lines. Each moment is sent on
   * its own, as the uniforms it goes by are written between them.
   */
  function runUpTo(seconds: number) {
    params[1] = Math.exp(-STILL_STEP / FOAM_FADE)
    params[3] = Math.exp(-STILL_STEP / LACE_SETTLE)
    for (let step = Math.round(STILL_HISTORY / STILL_STEP); step > 0; step--) {
      const then = seconds - step * STILL_STEP
      params[0] = ((then % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS
      device.queue.writeBuffer(fftParams, 0, params)
      const encoder = device.createCommandEncoder({ label: 'ocean before a still frame' })
      const pass = encoder.beginComputePass({ label: 'ocean before a still frame' })
      simulate(pass)
      pass.end()
      keepFoam(encoder)
      device.queue.submit([encoder.finish()])
    }
  }

  return {
    render(frame: SceneFrame) {
      const { encoder, target, width: nextWidth, height: nextHeight, seconds, delta, still } = frame
      if (nextWidth !== width || nextHeight !== height) resize(nextWidth, nextHeight)

      dome.advance(frame)
      const raining = uniformData[SCENE_UNIFORM.rain]
      if (still && !begun) runUpTo(seconds)
      begun = true
      params[0] = seconds % LOOP_SECONDS
      params[1] = Math.exp(-delta / FOAM_FADE)
      params[3] = Math.exp(-delta / LACE_SETTLE)
      device.queue.writeBuffer(fftParams, 0, params)
      device.queue.writeBuffer(uniforms, 0, uniformData)

      const pass = encoder.beginComputePass({ label: 'ocean simulation' })
      simulate(pass)
      dispatchMips(pass, slopeMips, CASCADE_SAMPLES, CASCADES)
      if (raining > 0) {
        const { landedGroup, rippleGroup, rippleMips } = rainOn()
        pass.setPipeline(landedPipeline)
        pass.setBindGroup(0, landedGroup)
        pass.dispatchWorkgroups(LANDED_DROPS / LANDED_GROUP)
        pass.setPipeline(ripplePipeline)
        pass.setBindGroup(0, rippleGroup)
        pass.dispatchWorkgroups(RIPPLE_SAMPLES / RIPPLE_GROUP, RIPPLE_SAMPLES / RIPPLE_GROUP)
        dispatchMips(pass, rippleMips, RIPPLE_SAMPLES, 1)
      }
      pass.end()
      keepFoam(encoder)

      drawOcean(encoder, target)
    },

    dispose() {
      depthTexture?.destroy()
      instances?.destroy()
      kept.release()
    },
  }
}
