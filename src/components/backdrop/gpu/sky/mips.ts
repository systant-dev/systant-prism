// Mips drawn each from the one above it (mipSource), for a texture the GPU can draw into.
import { mipSource } from './sharedShaders'

/** What draws one mip of a texture of this format from the one above it. */
export function createMipPipeline(device: GPUDevice, format: GPUTextureFormat, label: string) {
  const module = device.createShaderModule({ label, code: mipSource })
  return device.createRenderPipelineAsync({
    label,
    layout: 'auto',
    vertex: { module, entryPoint: 'overVertex' },
    fragment: { module, entryPoint: 'mipFragment', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  })
}

/**
 * The rows of the mip below that are made of these rows, from and to, of the one above: each
 * of its texels is the four above it.
 */
export function rowsBelow([top, bottom]: readonly [number, number]): [number, number] {
  return [Math.floor(top / 2), Math.ceil(bottom / 2)]
}

/**
 * What records drawing each of a texture's mips from the one above it, a pass each, with
 * its views and bind groups made once, here. Given the rows of the texture that have
 * changed, from and to, it draws only what is made of them, and keeps the rest of each mip.
 */
export function mipChain(device: GPUDevice, pipeline: GPURenderPipeline, texture: GPUTexture, label?: string) {
  const levels = Array.from({ length: texture.mipLevelCount }, (_, baseMipLevel) =>
    texture.createView({ baseMipLevel, mipLevelCount: 1 }),
  )
  const groups = levels
    .slice(0, -1)
    .map((above) =>
      device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: above }] }),
    )
  return (encoder: GPUCommandEncoder, changed?: readonly [number, number]) => {
    let rows = changed
    for (const [above, group] of groups.entries()) {
      const height = Math.max(1, texture.height >> (above + 1))
      rows &&= rowsBelow(rows)
      const [top, bottom] = rows ? [Math.min(rows[0], height), Math.min(rows[1], height)] : [0, height]
      if (bottom <= top) return
      const pass = encoder.beginRenderPass({
        label,
        colorAttachments: [
          { view: levels[above + 1], loadOp: rows ? 'load' : 'clear', clearValue: [0, 0, 0, 0], storeOp: 'store' },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, group)
      pass.setScissorRect(0, top, Math.max(1, texture.width >> (above + 1)), bottom - top)
      pass.draw(3)
      pass.end()
    }
  }
}
