import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DISC_FLATTEST, DISC_ROUND_BY, HORIZON_HALF_FOV, HORIZON_PITCH, type Lens, LONG_LENS, skyAt } from './daylight'
import { keeper } from './kept'
import { cross, dot, saturate, unit, type Vec3 } from './maths'
import { createMoonFace, moonFacePart, sizeFor } from './moonFace'
import { SKY_UNIFORM, SKY_UNIFORMS_SIZE } from './skyLight'
import { MOON_EDGE, MOON_RADIUS, VEILED_EDGE } from './skyShaders'

const LONDON = { latitude: 51.5, longitude: -0.1 }
const OCEAN: Lens = { pitch: HORIZON_PITCH, halfFov: HORIZON_HALF_FOV }
const [WIDTH, HEIGHT] = [1920, 1080]

/** A January day and night, by the hour, UTC: the moon comes up at dusk and is gone by dawn. */
const at = (hour: number) => new Date(Date.UTC(2026, 0, 15 + Math.floor(hour / 24), hour % 24))
const MIDNIGHT = at(24)
const NOON = at(12)

/** The fields of a scene's uniforms that the moon's face goes by, for a camera through `lens` at a moment. */
function sceneAt(date: Date, lens: Lens = OCEAN, aspect = WIDTH / HEIGHT) {
  const scene = new Float32Array(SKY_UNIFORMS_SIZE / 4)
  const halfHeight = Math.tan(lens.halfFov)
  scene.set([1, 0, 0, 1 / (halfHeight * aspect)], SKY_UNIFORM.right)
  scene.set([0, Math.cos(lens.pitch), Math.sin(lens.pitch), 1 / halfHeight], SKY_UNIFORM.up)
  scene.set([0, -Math.sin(lens.pitch), Math.cos(lens.pitch), 0.1], SKY_UNIFORM.forward)
  const { moon, moonSize, moonlight, moonTilt } = skyAt(date, LONDON, lens)
  scene.set([...moon, moonlight], SKY_UNIFORM.moon)
  scene[SKY_UNIFORM.moonWide] = moonSize[0]
  scene[SKY_UNIFORM.moonTall] = moonSize[1]
  scene[SKY_UNIFORM.moonTilt] = moonTilt
  return scene
}

/** How far from the middle of the moon's disc a pixel of the target looks, in discs: onDisc in skyShaders.ts. */
function fromMoon(scene: Float32Array, x: number, y: number) {
  const field = (start: number): Vec3 => [scene[start], scene[start + 1], scene[start + 2]]
  const [right, up, forward, moon] = [SKY_UNIFORM.right, SKY_UNIFORM.up, SKY_UNIFORM.forward, SKY_UNIFORM.moon].map(
    field,
  )
  const ndc = [((x + 0.5) / WIDTH) * 2 - 1, 1 - ((y + 0.5) / HEIGHT) * 2]
  const way = unit(
    forward.map(
      (ahead, axis) =>
        ahead + (right[axis] * ndc[0]) / scene[SKY_UNIFORM.right + 3] + (up[axis] * ndc[1]) / scene[SKY_UNIFORM.up + 3],
    ),
  )
  const side = unit(cross([0, 1, 0], moon))
  const rise = cross(moon, side)
  const flattened = DISC_FLATTEST + (1 - DISC_FLATTEST) * saturate(moon[1] / DISC_ROUND_BY)
  const away = way.map((value, axis) => value - moon[axis])
  return Math.hypot(
    dot(away, side) / (MOON_RADIUS * scene[SKY_UNIFORM.moonWide]),
    dot(away, rise) / flattened / (MOON_RADIUS * scene[SKY_UNIFORM.moonTall]),
  )
}

describe('moonFacePart', () => {
  it('holds every pixel the disc and its blurred edge can reach, and little more', () => {
    for (const lens of [OCEAN, LONG_LENS]) {
      // From as it rises, low and flattened, to as it sets.
      for (const hour of [17, 18, 21, 24, 27, 30, 31]) {
        const scene = sceneAt(at(hour), lens)
        expect(scene[SKY_UNIFORM.moon + 3]).toBeGreaterThan(0)
        const [left, top, wide, high] = moonFacePart(scene, WIDTH, HEIGHT)!
        // Every pixel for a long way round it: none the disc reaches is outside.
        let [first, last, highest, lowest] = [Infinity, -Infinity, Infinity, -Infinity]
        for (let y = Math.max(0, top - 80); y < Math.min(HEIGHT, top + high + 80); y++) {
          for (let x = Math.max(0, left - 80); x < Math.min(WIDTH, left + wide + 80); x++) {
            if (fromMoon(scene, x, y) >= 1 + MOON_EDGE + VEILED_EDGE) continue
            first = Math.min(first, x)
            last = Math.max(last, x)
            highest = Math.min(highest, y)
            lowest = Math.max(lowest, y)
          }
        }
        expect(first).toBeGreaterThanOrEqual(left)
        expect(last).toBeLessThan(left + wide)
        expect(highest).toBeGreaterThanOrEqual(top)
        expect(lowest).toBeLessThan(top + high)
        // And it is no bigger than that by more than a few pixels on each side: the most
        // where the air flattens the disc, which it takes no account of.
        expect(first - left).toBeLessThanOrEqual(14)
        expect(left + wide - 1 - last).toBeLessThanOrEqual(14)
        expect(highest - top).toBeLessThanOrEqual(14)
        expect(top + high - 1 - lowest).toBeLessThanOrEqual(14)
      }
    }
  })

  it('stops at the edge of the target', () => {
    // At its highest it is just inside the top of the view: all of it is in a higher
    // one, and one a little less high cuts it off.
    const scene = sceneAt(MIDNIGHT)
    scene[SKY_UNIFORM.up + 3] *= 0.8
    const whole = moonFacePart(scene, WIDTH, HEIGHT)!
    expect(whole[1]).toBeGreaterThan(0)
    scene[SKY_UNIFORM.up + 3] *= 1.4
    const [left, top, wide, high] = moonFacePart(scene, WIDTH, HEIGHT)!
    expect(top).toBe(0)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + wide).toBeLessThanOrEqual(WIDTH)
    expect(high).toBeLessThan(whole[3])
    // And one much less high has none of it.
    scene[SKY_UNIFORM.up + 3] *= 2
    expect(moonFacePart(scene, WIDTH, HEIGHT)).toBeNull()
  })

  it('is nothing by day, or with the moon out of view or behind the camera', () => {
    expect(moonFacePart(sceneAt(NOON), WIDTH, HEIGHT)).toBeNull()
    const away = sceneAt(MIDNIGHT)
    away.set([0, 0, -1], SKY_UNIFORM.forward)
    expect(moonFacePart(away, WIDTH, HEIGHT)).toBeNull()
    const aside = sceneAt(MIDNIGHT)
    aside.set([Math.cos(1.2), 0, -Math.sin(1.2)], SKY_UNIFORM.right)
    aside.set([Math.sin(1.2), 0, Math.cos(1.2)], SKY_UNIFORM.forward)
    aside.set([0, 1, 0], SKY_UNIFORM.up)
    expect(moonFacePart(aside, WIDTH, HEIGHT)).toBeNull()
  })
})

describe('sizeFor', () => {
  it('rounds up to a size that a disc a little bigger still fits, and gives up on one too big', () => {
    expect(sizeFor(1)).toBe(32)
    expect(sizeFor(160)).toBe(160)
    expect(sizeFor(161)).toBe(192)
    expect(sizeFor(1024)).toBe(1024)
    expect(sizeFor(1025)).toBe(0)
  })
})

describe('createMoonFace', () => {
  beforeAll(() => {
    vi.stubGlobal('GPUBufferUsage', { UNIFORM: 64, COPY_DST: 8 })
    vi.stubGlobal('GPUTextureUsage', { TEXTURE_BINDING: 4, RENDER_ATTACHMENT: 16 })
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  /** A device that only keeps count: the passes recorded, what was written, and the textures made. */
  async function made(scene: Float32Array) {
    const passes: number[][] = []
    const written: number[][] = []
    const textures: { width: number; height: number; destroyed: boolean }[] = []
    const device = {
      createRenderPipelineAsync: async () => ({ getBindGroupLayout: () => ({}) }),
      createBuffer: () => ({ destroy() {} }),
      createBindGroup: () => ({}),
      createTexture({ size: [width, height] }: { size: [number, number] }) {
        const texture = {
          width,
          height,
          destroyed: false,
          createView: () => ({ of: texture }),
          destroy: () => void (texture.destroyed = true),
        }
        textures.push(texture)
        return texture
      },
      queue: { writeBuffer: (_buffer: unknown, _at: number, data: Float32Array) => void written.push([...data]) },
    } as unknown as GPUDevice
    const encoder = {
      beginRenderPass: () => ({
        setPipeline() {},
        setBindGroup() {},
        setScissorRect: (...rect: number[]) => void passes.push(rect),
        draw() {},
        end() {},
      }),
    } as unknown as GPUCommandEncoder
    const face = await createMoonFace(device, {
      kept: keeper(device),
      module: {} as GPUShaderModule,
      uniforms: {} as GPUBuffer,
      uniformData: scene,
    })
    return { face, encoder, passes, written, textures }
  }

  it('is drawn once, and again only when the moon has moved', async () => {
    const scene = sceneAt(MIDNIGHT)
    const { face, encoder, passes, written } = await made(scene)
    const undrawn = face.view
    expect(face.keepUp(encoder, WIDTH, HEIGHT)).toBe(true)
    expect(face.view).not.toBe(undrawn)
    const [left, top, wide, high] = moonFacePart(scene, WIDTH, HEIGHT)!
    expect(passes).toEqual([[0, 0, wide, high]])
    // The shader is told which part it covers, and how big a pixel of the target is.
    expect(written.at(-1)!.slice(0, 4)).toEqual([left, top, wide, high])
    expect(written.at(-1)![4]).toBeCloseTo(2 / WIDTH)
    expect(written.at(-1)![5]).toBeCloseTo(2 / HEIGHT)

    // Rain, the clock and the light all change without it.
    scene[SKY_UNIFORM.rain] = 1
    scene[SKY_UNIFORM.time] = 9
    scene[SKY_UNIFORM.moon + 3] = 0.5
    expect(face.keepUp(encoder, WIDTH, HEIGHT)).toBe(false)
    expect(passes).toHaveLength(1)

    scene.set(sceneAt(at(25)))
    expect(face.keepUp(encoder, WIDTH, HEIGHT)).toBe(false)
    expect(passes).toHaveLength(2)
    scene[SKY_UNIFORM.moonTilt] += 0.01
    face.keepUp(encoder, WIDTH, HEIGHT)
    expect(passes).toHaveLength(3)
  })

  it('is made again at the size a target of another size needs', async () => {
    const scene = sceneAt(MIDNIGHT)
    const { face, encoder, passes, textures } = await made(scene)
    face.keepUp(encoder, WIDTH, HEIGHT)
    const small = textures.at(-1)!
    const view = face.view
    expect(face.keepUp(encoder, WIDTH * 2, HEIGHT * 2)).toBe(true)
    expect(face.view).not.toBe(view)
    expect(small.destroyed).toBe(true)
    expect(textures.at(-1)!.width).toBeGreaterThan(small.width)
    expect(passes).toHaveLength(2)
    expect(textures.at(-1)!.width).toBeGreaterThanOrEqual(passes[1][2])
  })

  it('covers nothing by day, and the sky is still told how big a pixel is', async () => {
    const scene = sceneAt(NOON)
    const { face, encoder, passes, written, textures } = await made(scene)
    expect(face.keepUp(encoder, WIDTH, HEIGHT)).toBe(false)
    expect(passes).toHaveLength(0)
    // Only the one the sky is bound to until there is a face to read.
    expect(textures).toHaveLength(1)
    expect(written).toHaveLength(1)
    expect(written[0].slice(0, 4)).toEqual([0, 0, 0, 0])
    expect(written[0][4]).toBeCloseTo(2 / WIDTH)
    face.keepUp(encoder, WIDTH, HEIGHT)
    expect(written).toHaveLength(1)

    // Night falls and it is drawn; day comes and it covers nothing again.
    scene.set(sceneAt(MIDNIGHT))
    expect(face.keepUp(encoder, WIDTH, HEIGHT)).toBe(true)
    expect(passes).toHaveLength(1)
    scene.set(sceneAt(NOON))
    face.keepUp(encoder, WIDTH, HEIGHT)
    expect(passes).toHaveLength(1)
    expect(written.at(-1)!.slice(0, 4)).toEqual([0, 0, 0, 0])
  })
})
