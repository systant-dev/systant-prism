import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames, manualResizes, placeAt } from '../../../test/dom'
import type { PageImage } from '../../contrast'
import { createBackdrop, type BackdropController } from './backdrop'
import type { Renderer } from './gpu/renderer'
import { samplePageImage } from './sampler'

// jsdom has no 2D canvas to read an image's pixels from, so the reading is a stand-in.
vi.mock('./sampler', () => ({ samplePageImage: vi.fn<typeof samplePageImage>() }))

const FIRST: PageImage = { tones: ['#111111', '#222222', '#333333'], dominant: '#c86428' }
const SECOND: PageImage = { tones: ['#aaaaaa', '#bbbbbb', '#cccccc'], dominant: null }
const image = {} as HTMLImageElement

let backdrop: BackdropController

beforeEach(() => {
  manualFrames()
  manualResizes()
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  placeAt(canvas, 0, 0, 1000, 800)
  backdrop = createBackdrop()
  backdrop.attach(canvas, {
    prepareScene: vi.fn<Renderer['prepareScene']>(),
    readScene: vi.fn<Renderer['readScene']>(),
    setImage: vi.fn<Renderer['setImage']>(),
    settled: vi.fn<Renderer['settled']>(() => Promise.resolve()),
    holdScene: vi.fn<Renderer['holdScene']>(),
    setRain: vi.fn<Renderer['setRain']>(),
    draw: vi.fn<Renderer['draw']>(),
    setMatte: vi.fn<Renderer['setMatte']>(),
    dispose: vi.fn<Renderer['dispose']>(),
  })
})

afterEach(() => {
  backdrop.detach()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('pageImage', () => {
  it('is unknown until there is an image', () => {
    expect(backdrop.pageImage).toBeNull()
  })

  it('is read as the image is set, and again for the next', () => {
    vi.mocked(samplePageImage).mockReturnValue(FIRST)
    backdrop.setImage(image)
    expect(backdrop.pageImage).toBe(FIRST)

    vi.mocked(samplePageImage).mockReturnValue(SECOND)
    backdrop.setImage(image, () => 0)
    // From the start of a crossfade, as that is what the page ends up over.
    expect(backdrop.pageImage).toBe(SECOND)
  })

  it('is null where the pixels cannot be read', () => {
    vi.mocked(samplePageImage).mockReturnValue(null)
    backdrop.setImage(image)
    expect(backdrop.pageImage).toBeNull()
  })

  it('is forgotten once detached', () => {
    vi.mocked(samplePageImage).mockReturnValue(FIRST)
    backdrop.setImage(image)
    backdrop.detach()
    expect(backdrop.pageImage).toBeNull()
  })
})
