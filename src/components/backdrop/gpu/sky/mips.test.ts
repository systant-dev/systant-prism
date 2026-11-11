import { describe, expect, it } from 'vitest'
import { mipChain, rowsBelow } from './mips'

describe('rowsBelow', () => {
  it('finds every row of the mip below that is made of the rows above', () => {
    expect(rowsBelow([0, 8])).toEqual([0, 4])
    // A row below is made of two above: one of them changing is enough.
    expect(rowsBelow([3, 5])).toEqual([1, 3])
    expect(rowsBelow([4, 5])).toEqual([2, 3])
    expect(rowsBelow([0, 0])).toEqual([0, 0])
  })
})

describe('mipChain', () => {
  interface Pass {
    view: number
    loadOp: string
    scissor: number[]
  }

  function chain(width: number, height: number, mipLevelCount: number) {
    const passes: Pass[] = []
    const texture = {
      width,
      height,
      mipLevelCount,
      createView: ({ baseMipLevel }: { baseMipLevel: number }) => baseMipLevel,
    } as unknown as GPUTexture
    const device = { createBindGroup: () => ({}) } as unknown as GPUDevice
    const pipeline = { getBindGroupLayout: () => ({}) } as unknown as GPURenderPipeline
    const encoder = {
      beginRenderPass({ colorAttachments: [attachment] }: { colorAttachments: { view: number; loadOp: string }[] }) {
        const pass: Pass = { view: attachment.view, loadOp: attachment.loadOp, scissor: [] }
        passes.push(pass)
        return {
          setPipeline() {},
          setBindGroup() {},
          setScissorRect: (...rect: number[]) => (pass.scissor = rect),
          draw() {},
          end() {},
        }
      },
    } as unknown as GPUCommandEncoder
    return { passes, draw: mipChain(device, pipeline, texture), encoder }
  }

  it('draws the whole of every mip, over nothing, when told of no rows', () => {
    const { passes, draw, encoder } = chain(640, 360, 4)
    draw(encoder)
    expect(passes).toEqual([
      { view: 1, loadOp: 'clear', scissor: [0, 0, 320, 180] },
      { view: 2, loadOp: 'clear', scissor: [0, 0, 160, 90] },
      { view: 3, loadOp: 'clear', scissor: [0, 0, 80, 45] },
    ])
  })

  it('draws only what is made of the rows that changed, and keeps the rest', () => {
    const { passes, draw, encoder } = chain(640, 360, 4)
    draw(encoder, [42, 86])
    expect(passes).toEqual([
      { view: 1, loadOp: 'load', scissor: [0, 21, 320, 22] },
      { view: 2, loadOp: 'load', scissor: [0, 10, 160, 12] },
      { view: 3, loadOp: 'load', scissor: [0, 5, 80, 6] },
    ])
  })

  it('draws no mip that none of the rows reach', () => {
    const { passes, draw, encoder } = chain(640, 360, 4)
    draw(encoder, [360, 360])
    expect(passes).toEqual([])
  })
})
