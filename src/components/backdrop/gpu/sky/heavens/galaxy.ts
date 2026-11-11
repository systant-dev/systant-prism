// The Milky Way, baked once on the GPU into a texture of its brightness across the
// galaxy's own longitude and latitude, for the sky to look up as the sky turns.
//
// It is the brightness alone, its square root in a byte, at twice the sharpness four
// bytes of colour had, in less memory: the eye sees the Milky Way all but grey by
// night, and the sky's shader warms it towards the bulge by where it is. It reaches
// 60° either side of the galaxy's plane, past which there is nothing to see. It
// isn't made until the first dusk, and then in strips, a frame each, while it is still
// too light for it to show: about 10 ms of a mid-range GPU's time in all, so under a
// millisecond a frame. If it has to show at once, a few strips a frame. With the last
// strip go its mips, a pass each, for it to blur into the haze over an open horizon.
import type { Kept } from '../kept'
import { createMipPipeline, mipChain } from '../mips'
import { GALAXY_MIPS, GALAXY_SIZE, galaxySource } from './heavensShaders'

/** How many strips it is baked in. */
export const STRIPS = 16

export interface Galaxy {
  /** What the sky looks up: a pixel of nothing until all of it is baked. */
  readonly view: GPUTextureView
  /** Whether all of it is baked. */
  readonly baked: boolean
  /** Bakes as many more strips as asked. Says whether that finished it. */
  bake(encoder: GPUCommandEncoder, strips: number): boolean
}

export async function createGalaxy(device: GPUDevice, kept: Kept): Promise<Galaxy> {
  const module = device.createShaderModule({ label: 'sky galaxy', code: galaxySource })

  const [pipeline, mipPipeline] = await Promise.all([
    device.createRenderPipelineAsync({
      label: 'sky galaxy',
      layout: 'auto',
      vertex: { module, entryPoint: 'overVertex' },
      fragment: { module, entryPoint: 'galaxyFragment', targets: [{ format: 'r8unorm' }] },
      primitive: { topology: 'triangle-list' },
    }),
    createMipPipeline(device, 'r8unorm', 'sky galaxy mips'),
  ])

  const texture = (size: number[], label: string, usage: GPUTextureUsageFlags, mipLevelCount = 1) =>
    kept.keep(
      device.createTexture({
        label,
        size,
        format: 'r8unorm',
        mipLevelCount,
        usage: usage | GPUTextureUsage.TEXTURE_BINDING,
      }),
    )
  let view = texture([1, 1], 'sky galaxy unbaked', 0).createView()

  let baking: GPUTexture | null = null
  let strip = 0

  return {
    get view() {
      return view
    },

    get baked() {
      return strip === STRIPS
    },

    bake(encoder, strips) {
      if (strip === STRIPS) return false
      baking ??= texture(GALAXY_SIZE, 'sky galaxy', GPUTextureUsage.RENDER_ATTACHMENT, GALAXY_MIPS)
      const [width, height] = GALAXY_SIZE
      const rows = height / STRIPS
      const last = Math.min(STRIPS, strip + Math.max(1, strips))
      const pass = encoder.beginRenderPass({
        label: 'sky galaxy',
        colorAttachments: [
          { view: baking.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'load', storeOp: 'store' },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setScissorRect(0, strip * rows, width, (last - strip) * rows)
      pass.draw(3)
      pass.end()
      strip = last
      if (strip < STRIPS) return false
      mipChain(device, mipPipeline, baking, 'sky galaxy mips')(encoder)
      view = baking.createView()
      return true
    },
  }
}
