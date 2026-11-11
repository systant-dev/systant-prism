import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useContext, useLayoutEffect, type CSSProperties } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { manualFrames, manualResizes, placeAt, stubDialogs } from '../../../test/dom'
import { Card } from '../card'
import { BackdropPaletteContext } from './BackdropContext'
import { startCrossfade } from './crossfade'
import { GlassBackdrop, type GlassBackdropProps } from './GlassBackdrop'
import { createRenderer, loadImage, type BackdropScene, type Renderer, type SceneFactory } from './gpu/renderer'
import { PAGE_TEXT } from './pagePalette'
import { pageImage, samplePageImage } from './sampler'

// jsdom has no WebGPU; the renderer's drawing is checked in the browser.
const renderer = vi.hoisted(() => ({
  prepareScene: vi.fn<Renderer['prepareScene']>(),
  readScene: vi.fn<Renderer['readScene']>(),
  setImage: vi.fn<Renderer['setImage']>(),
  settled: vi.fn<Renderer['settled']>(),
  holdScene: vi.fn<Renderer['holdScene']>(),
  setRain: vi.fn<Renderer['setRain']>(),
  setMatte: vi.fn<Renderer['setMatte']>(),
  draw: vi.fn<Renderer['draw']>(),
  dispose: vi.fn<Renderer['dispose']>(),
}))
vi.mock('./gpu/renderer', () => ({
  createRenderer: vi.fn<typeof createRenderer>(() => Promise.resolve(renderer)),
  loadImage: vi.fn<typeof loadImage>(),
}))
// jsdom has no 2D canvas to read an image's pixels from.
vi.mock('./sampler', () => ({
  samplePageImage: vi.fn<typeof samplePageImage>(() => null),
  pageImage: vi.fn<typeof pageImage>(() => ({ tones: ['#101010', '#101010', '#101010'], dominant: null })),
}))
// jsdom has no Web Animations to time a crossfade with.
vi.mock('./crossfade', () => ({ startCrossfade: vi.fn<typeof startCrossfade>(() => null) }))

function image(name: string) {
  return { name } as unknown as HTMLImageElement
}

/** A loadImage result the test settles itself. */
function pendingImage() {
  let settle!: { resolve: (image: HTMLImageElement) => void; reject: (error: Error) => void }
  const promise = new Promise<HTMLImageElement>((resolve, reject) => (settle = { resolve, reject }))
  return { promise, ...settle }
}

function backdrop() {
  return screen.getByTestId('backdrop')
}

function drawing() {
  return backdrop().classList.contains('prism-backdrop--drawing')
}

function createRendererCalls() {
  return vi.mocked(createRenderer).mock.calls.length
}

/** A renderer says it is no more use. */
function lost() {
  act(() => {
    vi.mocked(createRenderer).mock.lastCall![1].onLost()
  })
}

function canvas() {
  return backdrop().querySelector('canvas')!
}

/** Gives the canvas the viewport's box, as a browser lays it out. */
function layOutCanvas() {
  placeAt(canvas(), 0, 0, 1000, 800)
}

/** The device goes, as in a GPU reset, while the next one is held back by `next`. */
function loseDevice(next: Promise<Renderer | null> = new Promise(() => {})) {
  vi.mocked(createRenderer).mockReturnValueOnce(next)
  act(() => {
    vi.mocked(createRenderer).mock.lastCall![1].onLost()
  })
}

/** Lets the renderer and loadImage's promises settle and React apply what follows. */
async function loaded() {
  await act(async () => {})
  await act(async () => {})
}

/** Moves a test's fake timers on, and lets what they start settle. */
async function pass(ms: number) {
  vi.advanceTimersByTime(ms)
  await loaded()
}

let frames: ReturnType<typeof manualFrames>

beforeEach(() => {
  frames = manualFrames()
  manualResizes()
  vi.mocked(createRenderer).mockReset()
  vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(renderer))
  vi.mocked(loadImage).mockImplementation((src) => Promise.resolve(image(src)))
  for (const fn of Object.values(renderer)) fn.mockReset()
  renderer.settled.mockResolvedValue()
  stubDialogs()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GlassBackdrop with a scene', () => {
  const scene = () => ({ render: vi.fn<BackdropScene['render']>(), dispose: vi.fn<BackdropScene['dispose']>() })
  const factory: SceneFactory = () => Promise.resolve(scene())

  it('draws the scene in place of the image once it is ready', async () => {
    const live = scene()
    renderer.prepareScene.mockResolvedValue(live)
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
    expect(renderer.prepareScene).toHaveBeenCalledWith(factory, expect.any(AbortSignal))
    expect(renderer.setImage).toHaveBeenCalledWith(null, false, live)
    await waitFor(() => expect(screen.getByTestId('backdrop').style.backgroundImage).toBe(''))
  })

  it('gives up on making a scene once another is wanted', async () => {
    renderer.prepareScene.mockReturnValue(new Promise(() => {}))
    const other: SceneFactory = () => Promise.resolve(scene())
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
    const wanted = renderer.prepareScene.mock.lastCall![1]!
    expect(wanted.aborted).toBe(false)
    rerender(<GlassBackdrop src="/a.webp" scene={other} />)
    expect(wanted.aborted).toBe(true)
  })

  it('shows nothing until the first is ready, not even its picture', async () => {
    renderer.prepareScene.mockReturnValue(new Promise(() => {}))
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
    expect(renderer.setImage).not.toHaveBeenCalled()
    expect(backdrop().style.backgroundImage).toBe('')
    expect(drawing()).toBe(false)
  })

  it('fades the first scene in with nothing before it', async () => {
    const live = scene()
    let ready!: (made: BackdropScene) => void
    renderer.prepareScene.mockReturnValue(new Promise((resolve) => (ready = resolve)))
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())

    vi.mocked(startCrossfade).mockReturnValueOnce(() => 0.5)
    await act(async () => ready(live))
    expect(renderer.setImage).toHaveBeenCalledOnce()
    expect(renderer.setImage).toHaveBeenCalledWith(null, true, live)
  })

  it("starts on the scene's code before it has a device to make it on", () => {
    vi.mocked(createRenderer).mockReturnValue(new Promise(() => {}))
    const preload = vi.fn<() => void>()
    render(<GlassBackdrop src="/a.webp" scene={Object.assign(factory.bind(null), { preload })} />)
    expect(preload).toHaveBeenCalledOnce()
  })

  it('downloads no picture while the page waits for a scene that comes', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
    await loaded()
    expect(loadImage).not.toHaveBeenCalled()
  })

  it('downloads the picture once the scene cannot be made', async () => {
    let fail!: (error: Error) => void
    renderer.prepareScene.mockReturnValue(new Promise((_, reject) => (fail = reject)))
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
    expect(loadImage).not.toHaveBeenCalled()
    await act(async () => fail(new Error('no')))
    await waitFor(() => expect(loadImage).toHaveBeenCalledWith('/a.webp'))
  })

  it('draws the image in its place if the scene cannot be made', async () => {
    renderer.prepareScene.mockRejectedValue(new Error('no'))
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
    expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), false, undefined)
  })

  it('crossfades from an image to a scene', async () => {
    const live = scene()
    renderer.prepareScene.mockResolvedValue(live)
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
    vi.mocked(startCrossfade).mockReturnValueOnce(() => 0.5)
    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" scene={factory} />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalledTimes(2))
    expect(renderer.setImage.mock.lastCall![2]).toBe(live)
  })

  it('crossfades to a new scene with the same image', async () => {
    renderer.prepareScene.mockImplementation(() => Promise.resolve(scene()))
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('backdrop').style.backgroundImage).toBe(''))
    const progress = () => 0.5
    vi.mocked(startCrossfade).mockReturnValueOnce(progress)
    rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={() => Promise.resolve(scene())} />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalledTimes(2))
    expect(startCrossfade).toHaveBeenCalled()
  })

  it('reads the page colours from the scene, and again as time goes on', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    renderer.prepareScene.mockResolvedValue(scene())
    renderer.readScene.mockResolvedValue(new Uint8ClampedArray(4))
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.readScene).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByTestId('backdrop').style.backgroundImage).toBe(''))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(renderer.readScene).toHaveBeenCalledTimes(2)
  })

  it('reads the colours of a new scene once it is showing, not from its image', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    renderer.readScene.mockResolvedValue(new Uint8ClampedArray(4))
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.readScene).toHaveBeenCalledOnce())

    let ready!: (live: BackdropScene) => void
    renderer.prepareScene.mockReturnValue(new Promise((resolve) => (ready = resolve)))
    const next: SceneFactory = () => Promise.resolve(scene())
    rerender(<GlassBackdrop src="/b.webp" scene={next} />)
    await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalledTimes(2))
    expect(renderer.readScene).toHaveBeenCalledOnce()

    await act(async () => ready(scene()))
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(renderer.readScene).toHaveBeenCalledTimes(2))
    expect(renderer.setImage.mock.invocationCallOrder[1]).toBeLessThan(renderer.readScene.mock.invocationCallOrder[1])
  })

  describe('the page waiting for it', () => {
    const waiting = () => backdrop().classList.contains('prism-backdrop--waiting')
    const arriving = () => backdrop().classList.contains('prism-backdrop--arriving')
    const ring = () => document.querySelector('dialog')!
    const clear = () => ring().classList.contains('prism-backdrop__progress--clear')

    /** A scene the test finishes making itself. */
    function pendingScene() {
      let ready!: (made: BackdropScene) => void
      let fail!: (error: Error) => void
      renderer.prepareScene.mockReturnValue(
        new Promise((resolve, reject) => {
          ready = resolve
          fail = reject
        }),
      )
      return { ready: (made: BackdropScene) => ready(made), fail: (error: Error) => fail(error) }
    }

    /** Renders a backdrop whose first scene has come, and whose ring has gone. */
    async function afterFirstScene() {
      renderer.prepareScene.mockImplementation(() => Promise.resolve(scene()))
      const view = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await waitFor(() => expect(ring().open).toBe(false))
      return view
    }

    const nextScene = () => (
      <GlassBackdrop data-testid="backdrop" src="/a.webp" scene={() => Promise.resolve(scene())} />
    )

    /** A crossfade the test finishes itself, as the renderer's first frame is by `settle`. */
    function pendingFade() {
      let settle!: () => void
      renderer.settled.mockReturnValue(new Promise((resolve) => (settle = resolve)))
      const fade = { progress: 0.5, settle: () => settle() }
      vi.mocked(startCrossfade).mockReturnValueOnce(() => fade.progress)
      return fade
    }

    it('goes from the ring, to the scene fading in, to the page fading in, and only then ends the ring', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const making = pendingScene()
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await loaded()
      expect(renderer.prepareScene).toHaveBeenCalled()
      expect(waiting()).toBe(true)
      expect(ring().open).toBe(true)

      const fade = pendingFade()
      await act(async () => making.ready(scene()))
      await act(async () => fade.settle())
      expect(ring().open).toBe(true)
      expect(waiting()).toBe(true)

      fade.progress = 1
      act(() => frames.flush())
      expect(waiting()).toBe(false)
      expect(arriving()).toBe(true)
      // Last of all, which is also what lets focus go back to the page.
      expect(ring().open).toBe(true)

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      expect(arriving()).toBe(false)
      expect(ring().open).toBe(false)
    })

    it('gives focus back only after the page can take it', async () => {
      renderer.prepareScene.mockImplementation(() => Promise.resolve(scene()))
      const hiddenAsItClosed: boolean[] = []
      vi.mocked(HTMLDialogElement.prototype.close).mockImplementation(function (this: HTMLDialogElement) {
        hiddenAsItClosed.push(waiting())
        this.open = false
      })
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await waitFor(() => expect(ring().open).toBe(false))
      expect(hiddenAsItClosed).toEqual([false])
    })

    it('leaves the page on show under the ring as a new scene comes in, and hides it only at the start', async () => {
      const { rerender } = await afterFirstScene()

      const making = pendingScene()
      rerender(nextScene())
      expect(ring().open).toBe(true)
      expect(waiting()).toBe(false)

      const fade = pendingFade()
      await act(async () => making.ready(scene()))
      await act(async () => fade.settle())
      expect(waiting()).toBe(false)
      expect(ring().open).toBe(true)

      fade.progress = 1
      act(() => frames.flush())
      expect(ring().open).toBe(false)
      expect(arriving()).toBe(false)
    })

    it('stops waiting if the scene still running is wanted back', async () => {
      const { rerender } = await afterFirstScene()
      pendingScene()
      rerender(nextScene())
      expect(ring().open).toBe(true)
      rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      expect(ring().open).toBe(false)
    })

    it('waits for a scene that comes back after an image', async () => {
      const { rerender } = await afterFirstScene()
      rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await waitFor(() => expect(renderer.setImage).toHaveBeenCalledTimes(2))
      pendingScene()
      rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      expect(ring().open).toBe(true)
    })

    it('keeps waiting as the picture changes while the scene crossfades in', async () => {
      let dark = false
      const turning: SceneFactory = Object.assign((() => Promise.resolve(scene())) as SceneFactory, {
        isNight: () => dark,
      })
      const making = pendingScene()
      const { rerender } = render(
        <GlassBackdrop data-testid="backdrop" src="/a.webp" nightSrc="/n.webp" scene={turning} />,
      )
      await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
      const fade = pendingFade()
      await act(async () => making.ready(scene()))
      await act(async () => fade.settle())

      dark = true
      rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" nightSrc="/n.webp" scene={turning} />)
      expect(waiting()).toBe(true)
      fade.progress = 1
      act(() => frames.flush())
      expect(waiting()).toBe(false)
    })

    describe('with nothing showing yet', () => {
      it('never dims the first scene or the blank page, even as the ring goes', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        expect(clear()).toBe(true)

        const fade = pendingFade()
        await act(async () => making.ready(scene()))
        await act(async () => fade.settle())
        expect(clear()).toBe(true)

        fade.progress = 1
        act(() => frames.flush())
        expect(clear()).toBe(true)

        await act(async () => {
          vi.advanceTimersByTime(1000)
        })
        expect(ring().open).toBe(false)
        expect(clear()).toBe(true)
      })

      it('dims what was showing until a scene that follows it starts to fade in', async () => {
        renderer.prepareScene.mockImplementation(() => Promise.resolve(scene()))
        const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(ring().open).toBe(false))
        const making = pendingScene()
        rerender(nextScene())
        await act(async () => {})
        expect(clear()).toBe(false)

        const fade = pendingFade()
        await act(async () => making.ready(scene()))
        await act(async () => fade.settle())
        expect(clear()).toBe(true)
      })

      it('dims an image that a scene follows', async () => {
        const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
        await waitFor(() => expect(drawing()).toBe(true))
        pendingScene()
        rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        expect(ring().open).toBe(true)
        expect(clear()).toBe(false)
      })

      it('gives the ring no colours or glass from a picture nobody can see', async () => {
        vi.mocked(samplePageImage).mockReturnValue(pageImage(new Uint8ClampedArray(4)))
        pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
        await loaded()
        expect(samplePageImage).not.toHaveBeenCalled()
        const bar = screen.getByRole('progressbar', { hidden: true })
        expect(bar.style.getPropertyValue('--_prism-progress-fill')).toBe('')
        expect(bar.querySelector('canvas')).toBeNull()
      })

      it("gives the ring the page's colours once the scene starts to show, but still no glass", async () => {
        renderer.readScene.mockResolvedValue(new Uint8ClampedArray(4))
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        const fade = pendingFade()
        await act(async () => making.ready(scene()))
        await act(async () => fade.settle())
        const bar = screen.getByRole('progressbar', { hidden: true })
        expect(bar.style.getPropertyValue('--_prism-progress-fill')).toBe(PAGE_TEXT)
        expect(bar.querySelector('canvas')).toBeNull()
      })

      it('shows the picture where there is no WebGPU', async () => {
        vi.mocked(createRenderer).mockResolvedValue(null)
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(backdrop().style.backgroundImage).toBe('url("/a.webp")'))
      })

      it('shows the picture if the device goes while the scene is made', async () => {
        pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
        loseDevice()
        expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')
      })

      it('does not try again and again to make a scene that cannot be made', async () => {
        renderer.prepareScene.mockRejectedValue(new Error('no'))
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(waiting()).toBe(false))
        await waitFor(() => expect(ring().open).toBe(false))
        await loaded()
        expect(renderer.prepareScene).toHaveBeenCalledOnce()
      })

      it('draws the picture if the scene cannot be made', async () => {
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
        const fade = pendingFade()
        await act(async () => making.fail(new Error('no')))
        expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), true, undefined)
        await act(async () => fade.settle())
        fade.progress = 1
        act(() => frames.flush())
        expect(waiting()).toBe(false)
      })
    })

    it('stops waiting for a scene that cannot be made', async () => {
      const making = pendingScene()
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
      await act(async () => making.fail(new Error('no')))
      await waitFor(() => expect(waiting()).toBe(false))
    })

    describe('its picture', () => {
      it('is loaded once, for all that want it', async () => {
        renderer.prepareScene.mockRejectedValue(new Error('no'))
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
        expect(loadImage).toHaveBeenCalledOnce()
      })

      it('holds no scene up: one that is ready goes up with the picture still on its way', async () => {
        const live = scene()
        vi.mocked(loadImage).mockReturnValue(new Promise(() => {}))
        renderer.prepareScene.mockResolvedValue(live)
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(renderer.setImage).toHaveBeenCalledWith(null, false, live))
      })

      it('costs no scene by failing to load', async () => {
        const live = scene()
        vi.mocked(loadImage).mockRejectedValue(new Error('no'))
        renderer.prepareScene.mockResolvedValue(live)
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(renderer.setImage).toHaveBeenCalledWith(null, false, live))
        await waitFor(() => expect(ring().open).toBe(false))
      })

      it('is what stops the wait if the scene fails as well', async () => {
        vi.mocked(loadImage).mockRejectedValue(new Error('no'))
        renderer.prepareScene.mockRejectedValue(new Error('no'))
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(waiting()).toBe(false))
        await waitFor(() => expect(ring().open).toBe(false))
      })

      it('can change at dusk with a scene half made, which carries on', async () => {
        let dark = false
        const turning: SceneFactory = Object.assign(factory.bind(null), { isNight: () => dark })
        const page = () => <GlassBackdrop src="/a.webp" nightSrc="/n.webp" scene={turning} />
        pendingScene()
        const { rerender } = render(page())
        await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
        const wanted = renderer.prepareScene.mock.lastCall![1]!
        dark = true
        rerender(page())
        await loaded()
        expect(wanted.aborted).toBe(false)
        expect(renderer.prepareScene).toHaveBeenCalledOnce()
      })
    })

    describe('for no longer than it should', () => {
      it('goes on without a scene that never comes, which comes in under the page if it does', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        expect(waiting()).toBe(true)

        await pass(9999)
        expect(waiting()).toBe(true)
        await pass(1)
        expect(waiting()).toBe(false)
        expect(arriving()).toBe(true)
        expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), false, undefined)

        await pass(1000)
        expect(ring().open).toBe(false)

        const live = scene()
        await act(async () => making.ready(live))
        expect(renderer.setImage).toHaveBeenLastCalledWith(image('/a.webp'), false, live)
        expect(ring().open).toBe(false)
        await pass(1000)
        expect(ring().open).toBe(false)
      })

      it('sees out the fade of a scene that is up on the GPU in a page in the background, however long until it has frames', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        const fade = pendingFade()
        await act(async () => making.ready(scene()))
        await act(async () => fade.settle())

        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
        await pass(60_000)
        expect(waiting()).toBe(true)
        hidden.mockReturnValue(false)
        document.dispatchEvent(new Event('visibilitychange'))
        fade.progress = 1
        act(() => frames.flush())
        expect(waiting()).toBe(false)
      })

      it('sees out a fade that frames come for, however slowly', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        const fade = pendingFade()
        await act(async () => making.ready(scene()))
        await act(async () => fade.settle())

        for (let i = 0; i < 20; i++) {
          await pass(900)
          act(() => frames.flush())
        }
        expect(waiting()).toBe(true)
        fade.progress = 1
        act(() => frames.flush())
        expect(waiting()).toBe(false)
      })

      it('goes on without the fade where the page is said to be on show but drawn no frames, and the scene fades in under it once they come', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        const fade = pendingFade()
        const live = scene()
        await act(async () => making.ready(live))
        await act(async () => fade.settle())

        await pass(999)
        expect(waiting()).toBe(true)
        await pass(1)
        expect(waiting()).toBe(false)
        expect(arriving()).toBe(true)
        await pass(1000)
        expect(ring().open).toBe(false)

        // The frames come at last, and the scene's own fade plays out under the page.
        act(() => frames.flush())
        expect(renderer.draw.mock.lastCall![4]).toBe(0.5)
        fade.progress = 1
        act(() => frames.settle())
        expect(renderer.setImage).toHaveBeenCalledOnce()
        expect(renderer.setImage).toHaveBeenCalledWith(null, true, live)
        expect(waiting()).toBe(false)
        expect(ring().open).toBe(false)
      })

      it('goes on without a scene whose first frame never finishes', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await loaded()
        pendingFade()
        await act(async () => making.ready(scene()))
        await pass(10_000)
        expect(waiting()).toBe(false)
      })

      it('goes on without a new scene as well, and waits for the next all the same', async () => {
        const { rerender } = await afterFirstScene()
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        pendingScene()
        rerender(nextScene())
        await loaded()
        expect(ring().open).toBe(true)
        await pass(10_000)
        expect(ring().open).toBe(false)
        rerender(nextScene())
        expect(ring().open).toBe(true)
      })

      it('stops waiting if asking for a renderer throws', async () => {
        vi.mocked(createRenderer).mockRejectedValue(new Error('no'))
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
        await waitFor(() => expect(ring().open).toBe(false))
        expect(waiting()).toBe(false)
        expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')
      })
    })

    it('hides nothing that was on show before the scene came', async () => {
      vi.mocked(loadImage).mockRejectedValue(new Error('404'))
      const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      pendingScene()
      rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      expect(ring().open).toBe(true)
      expect(waiting()).toBe(false)
      expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')
    })

    it('does not hide a page fading in again for a new scene', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderer.prepareScene.mockImplementation(() => Promise.resolve(scene()))
      const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await loaded()
      expect(arriving()).toBe(true)
      pendingScene()
      rerender(nextScene())
      expect(waiting()).toBe(false)
      expect(ring().open).toBe(true)
    })

    it('does not bring the ring back for a scene that could not be made as its picture changes', async () => {
      let dark = false
      const turning: SceneFactory = Object.assign(factory.bind(null), { isNight: () => dark })
      const page = () => <GlassBackdrop data-testid="backdrop" src="/a.webp" nightSrc="/n.webp" scene={turning} />
      renderer.prepareScene.mockRejectedValue(new Error('no'))
      const { rerender } = render(page())
      await waitFor(() => expect(ring().open).toBe(false))

      dark = true
      rerender(page())
      await waitFor(() => expect(renderer.setImage).toHaveBeenLastCalledWith(image('/n.webp'), false, undefined))
      expect(ring().open).toBe(false)
      expect(renderer.prepareScene).toHaveBeenCalledOnce()
    })

    it('ends for a scene that fails with its picture already up', async () => {
      const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await waitFor(() => expect(drawing()).toBe(true))
      renderer.prepareScene.mockRejectedValue(new Error('no'))
      rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await waitFor(() => expect(ring().open).toBe(false))
      expect(renderer.setImage).toHaveBeenCalledOnce()
    })

    it('lets what is inside take the focus as it mounts, and only then puts it out of reach', async () => {
      pendingScene()
      const sealed = () => backdrop().classList.contains('prism-backdrop--sealed')
      const asItMounted: boolean[] = []
      function Child() {
        useLayoutEffect(() => {
          asItMounted.push(sealed())
        }, [])
        return null
      }
      render(
        <GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory}>
          <Child />
        </GlassBackdrop>,
      )
      expect(asItMounted).toEqual([false])
      expect(sealed()).toBe(true)
    })

    it('says what it is waiting for in the words it is given', () => {
      pendingScene()
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} loadingLabel="Chargement" />)
      expect(ring().getAttribute('aria-label')).toBe('Chargement')
    })

    describe('unless told not to', () => {
      it('hides nothing and shows no ring, with the picture going straight on', async () => {
        pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} waitForScene={false} />)
        expect(waiting()).toBe(false)
        expect(document.querySelector('dialog')).toBeNull()
        await waitFor(() => expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), false, undefined))
      })

      it('crossfades the scene in under the page', async () => {
        const live = scene()
        const making = pendingScene()
        render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} waitForScene={false} />)
        await waitFor(() => expect(drawing()).toBe(true))
        vi.mocked(startCrossfade).mockReturnValueOnce(() => 0.5)
        await act(async () => making.ready(live))
        expect(renderer.setImage).toHaveBeenLastCalledWith(image('/a.webp'), true, live)
      })
    })

    it('does not wait where there is no WebGPU', async () => {
      vi.mocked(createRenderer).mockResolvedValue(null)
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await waitFor(() => expect(waiting()).toBe(false))
      expect(ring().open).toBe(false)
    })

    it('stops waiting for a device lost while the scene is made, and does not wait again', async () => {
      pendingScene()
      const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
      expect(waiting()).toBe(true)
      lost()
      expect(waiting()).toBe(false)
      rerender(nextScene())
      expect(waiting()).toBe(false)
    })

    it('has nothing to wait for without a scene', async () => {
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await waitFor(() => expect(drawing()).toBe(true))
      expect(waiting()).toBe(false)
      expect(document.querySelector('dialog')).toBeNull()
    })

    it("leaves the page showing in the server's markup, for whoever runs no script", () => {
      const markup = renderToString(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      expect(markup).toContain('<div class="prism-backdrop"')
    })
  })

  describe('at night', () => {
    const atNight = (isNight: boolean) =>
      Object.assign(
        vi.fn<SceneFactory>(() => Promise.resolve(scene())),
        { isNight: () => isNight },
      )

    it('shows the night picture while it is night in the scene', async () => {
      renderer.prepareScene.mockRejectedValue(new Error('no'))
      render(<GlassBackdrop data-testid="backdrop" src="/day.webp" nightSrc="/night.webp" scene={atNight(true)} />)
      await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
      expect(renderer.setImage).toHaveBeenCalledWith(image('/night.webp'), false, undefined)
      expect(loadImage).toHaveBeenCalledWith('/night.webp')
      expect(loadImage).not.toHaveBeenCalledWith('/day.webp')
    })

    it('shows the day picture while it is day in the scene', async () => {
      renderer.prepareScene.mockRejectedValue(new Error('no'))
      render(<GlassBackdrop data-testid="backdrop" src="/day.webp" nightSrc="/night.webp" scene={atNight(false)} />)
      await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
      expect(renderer.setImage).toHaveBeenCalledWith(image('/day.webp'), false, undefined)
    })

    it('shows the day picture with no night picture to show', async () => {
      renderer.prepareScene.mockRejectedValue(new Error('no'))
      render(<GlassBackdrop data-testid="backdrop" src="/day.webp" scene={atNight(true)} />)
      await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
      expect(renderer.setImage).toHaveBeenCalledWith(image('/day.webp'), false, undefined)
    })

    it('turns to the night picture at dusk where nothing can be drawn', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      vi.mocked(createRenderer).mockResolvedValue(null)
      let dark = false
      const turning = Object.assign(factory.bind(null), { isNight: () => dark })
      render(<GlassBackdrop data-testid="backdrop" src="/day.webp" nightSrc="/night.webp" scene={turning} />)
      await loaded()
      expect(backdrop().style.backgroundImage).toBe('url("/day.webp")')
      dark = true
      await pass(60_000)
      expect(backdrop().style.backgroundImage).toBe('url("/night.webp")')
    })

    it('asks about the time it is set to', async () => {
      renderer.prepareScene.mockReturnValue(new Promise(() => {}))
      const isNight = vi.fn<NonNullable<SceneFactory['isNight']>>(() => false)
      const midnight = new Date(2026, 5, 21, 0)
      render(
        <GlassBackdrop src="/day.webp" scene={Object.assign(factory.bind(null), { isNight })} sceneTime={midnight} />,
      )
      await waitFor(() => expect(isNight).toHaveBeenCalledWith(midnight))
    })

    it("renders the day picture in a server's markup, which can't know", () => {
      const markup = renderToString(<GlassBackdrop src="/day.webp" nightSrc="/night.webp" scene={atNight(true)} />)
      expect(markup).toContain('/day.webp')
      expect(markup).not.toContain('/night.webp')
    })

    it("renders the night picture in a server's markup when told it is night", () => {
      const markup = renderToString(
        <GlassBackdrop src="/day.webp" nightSrc="/night.webp" scene={atNight(true)} initialNight />,
      )
      expect(markup).toContain('/night.webp')
      expect(markup).not.toContain('/day.webp')
    })

    it('hydrates from the night picture, then asks the scene', async () => {
      vi.mocked(createRenderer).mockResolvedValue(null)
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      const page = (sky: SceneFactory) => (
        <GlassBackdrop data-testid="backdrop" src="/day.webp" nightSrc="/night.webp" scene={sky} initialNight />
      )
      const container = document.createElement('div')
      container.innerHTML = renderToString(page(atNight(true)))
      document.body.append(container)
      const root = await act(async () => hydrateRoot(container, page(atNight(false))))
      onTestFinished(() => {
        act(() => root.unmount())
        container.remove()
      })
      await loaded()
      expect(errors).not.toHaveBeenCalled()
      expect(backdrop().style.backgroundImage).toBe('url("/day.webp")')
    })

    it('chooses the colours from the picture until the scene is ready, if the page is not waiting for it', async () => {
      renderer.prepareScene.mockReturnValue(new Promise(() => {}))
      render(<GlassBackdrop src="/day.webp" nightSrc="/night.webp" scene={atNight(true)} waitForScene={false} />)
      await waitFor(() => expect(samplePageImage).toHaveBeenCalled())
      expect(vi.mocked(samplePageImage).mock.lastCall![0]).toEqual(image('/night.webp'))
    })

    it('chooses the colours from the picture where nothing can be drawn', async () => {
      vi.mocked(createRenderer).mockResolvedValue(null)
      render(<GlassBackdrop src="/day.webp" nightSrc="/night.webp" scene={atNight(true)} />)
      await waitFor(() => expect(samplePageImage).toHaveBeenCalled())
      expect(vi.mocked(samplePageImage).mock.lastCall![0]).toEqual(image('/night.webp'))
    })

    it('leaves a scene running as the time passes from day into night', async () => {
      renderer.prepareScene.mockImplementation(() => Promise.resolve(scene()))
      const isNight = (time?: Date) => time!.getHours() > 20
      const lit = Object.assign(factory.bind(null), { isNight })
      const at = (hours: number) => (
        <GlassBackdrop src="/day.webp" nightSrc="/night.webp" scene={lit} sceneTime={new Date(2026, 5, 21, hours)} />
      )
      const { rerender } = render(at(12))
      await waitFor(() => expect(renderer.setImage).toHaveBeenCalledOnce())
      rerender(at(22))
      await act(async () => {})
      expect(renderer.prepareScene).toHaveBeenCalledOnce()
      expect(renderer.setImage).toHaveBeenCalledOnce()
    })
  })

  it('leaves how a scene is held to it, unless told', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    render(<GlassBackdrop src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.holdScene).toHaveBeenCalled())
    expect(renderer.holdScene).toHaveBeenLastCalledWith(undefined, undefined)
  })

  it('holds a scene still and at a time, and lets it go', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    const noon = new Date(2026, 5, 21, 12)
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} still sceneTime={noon} />)
    await waitFor(() => expect(renderer.holdScene).toHaveBeenLastCalledWith(true, noon))
    rerender(<GlassBackdrop src="/a.webp" scene={factory} still={false} />)
    expect(renderer.holdScene).toHaveBeenLastCalledWith(false, undefined)
  })

  it('tells a scene whether it is raining', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.setRain).toHaveBeenLastCalledWith(false))
    rerender(<GlassBackdrop src="/a.webp" scene={factory} rain />)
    expect(renderer.setRain).toHaveBeenLastCalledWith(true)
  })

  it('reads the colours again as rain sets in, and again once it has', async () => {
    vi.useFakeTimers()
    try {
      renderer.prepareScene.mockResolvedValue(scene())
      const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} />)
      await vi.waitFor(() => expect(renderer.readScene).toHaveBeenCalled())
      renderer.readScene.mockClear()
      rerender(<GlassBackdrop src="/a.webp" scene={factory} rain />)
      expect(renderer.readScene).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(5000)
      expect(renderer.readScene).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('takes no notice of the same time as a new Date', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    const at = () => new Date(2026, 5, 21, 12)
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} sceneTime={at()} />)
    await waitFor(() => expect(renderer.holdScene).toHaveBeenCalled())
    renderer.holdScene.mockClear()
    rerender(<GlassBackdrop src="/a.webp" scene={factory} sceneTime={at()} />)
    expect(renderer.holdScene).not.toHaveBeenCalled()
  })

  it('reads the colours as the time changes, once it is drawn', async () => {
    renderer.prepareScene.mockResolvedValue(scene())
    renderer.readScene.mockResolvedValue(new Uint8ClampedArray(4))
    const noon = new Date(2026, 5, 21, 12)
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} sceneTime={noon} />)
    await waitFor(() => expect(renderer.readScene).toHaveBeenCalledOnce())
    renderer.draw.mockClear()
    rerender(<GlassBackdrop src="/a.webp" scene={factory} sceneTime={new Date(2026, 5, 21, 20)} />)
    expect(renderer.readScene).toHaveBeenCalledTimes(2)
    expect(renderer.draw.mock.invocationCallOrder[0]).toBeLessThan(renderer.readScene.mock.invocationCallOrder[1])
  })

  it('reads the colours again once a scene has run on from a time let go of', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    renderer.prepareScene.mockResolvedValue(scene())
    renderer.readScene.mockResolvedValue(new Uint8ClampedArray(4))
    const { rerender } = render(<GlassBackdrop src="/a.webp" scene={factory} sceneTime={new Date(2026, 5, 21, 12)} />)
    await vi.waitFor(() => expect(renderer.readScene).toHaveBeenCalledOnce())
    rerender(<GlassBackdrop src="/a.webp" scene={factory} />)
    expect(renderer.readScene).toHaveBeenCalledTimes(2)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(renderer.readScene).toHaveBeenCalledTimes(3)
  })

  it('leaves the colours of an image alone', async () => {
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalled())
    expect(renderer.readScene).not.toHaveBeenCalled()
  })

  it('disposes of a scene that is ready too late to be wanted', async () => {
    const live = scene()
    let ready: (made: BackdropScene) => void = () => {}
    renderer.prepareScene.mockReturnValue(new Promise((resolve) => (ready = resolve)))
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
    await waitFor(() => expect(renderer.prepareScene).toHaveBeenCalled())
    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" />)
    await waitFor(() => expect(renderer.setImage).toHaveBeenCalledOnce())
    ready(live)
    await waitFor(() => expect(live.dispose).toHaveBeenCalled())
    expect(renderer.setImage).toHaveBeenCalledOnce()
  })
})

describe('GlassBackdrop', () => {
  it('shows the image as a CSS background until the canvas is drawing it', async () => {
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    expect(drawing()).toBe(false)
    expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')

    await loaded()
    expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), false, undefined)
    expect(drawing()).toBe(true)
    expect(backdrop().style.backgroundImage).toBe('')
  })

  it('has no picture where it is given none, and puts one up once it is', async () => {
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" />)
    await loaded()
    expect(backdrop().style.backgroundImage).toBe('')
    expect(loadImage).not.toHaveBeenCalled()
    expect(renderer.setImage).not.toHaveBeenCalled()
    expect(drawing()).toBe(false)

    rerender(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')
    await loaded()
    expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), false, undefined)
    expect(drawing()).toBe(true)

    // Taken away again, the canvas has nothing of it left to show.
    rerender(<GlassBackdrop data-testid="backdrop" />)
    await loaded()
    expect(drawing()).toBe(false)
    expect(backdrop().style.backgroundImage).toBe('')
  })

  it('draws a scene given no picture, and takes its colours from the scene', async () => {
    const live = { render: vi.fn<BackdropScene['render']>(), dispose: vi.fn<BackdropScene['dispose']>() }
    renderer.prepareScene.mockResolvedValue(live)
    const factory: SceneFactory = () => Promise.resolve(live)
    render(<GlassBackdrop data-testid="backdrop" scene={factory} waitForScene={false} />)
    await loaded()
    expect(loadImage).not.toHaveBeenCalled()
    expect(renderer.setImage).toHaveBeenCalledWith(null, expect.anything(), live)
    expect(drawing()).toBe(true)
  })

  it('renders its children, and passes props and style through', () => {
    render(
      <GlassBackdrop data-testid="backdrop" src="/a.webp" className="page" style={{ padding: 16 }}>
        <p>Hello</p>
      </GlassBackdrop>,
    )
    expect(backdrop().querySelector('p')!.textContent).toBe('Hello')
    expect(backdrop().classList.contains('page')).toBe(true)
    expect(backdrop().style.padding).toBe('16px')
  })

  it('has cards inside draw their glass on it', async () => {
    render(
      <GlassBackdrop data-testid="backdrop" src="/a.webp">
        <Card data-testid="card" />
      </GlassBackdrop>,
    )
    const card = screen.getByTestId('card')

    await loaded()
    layOutCanvas()
    placeAt(card, 10, 20, 200, 100)
    frames.settle()
    expect(renderer.draw.mock.lastCall![3]).toMatchObject([{ x: 10, y: 20, width: 200, height: 100 }])
  })

  describe("the page's colours", () => {
    const theme = {
      '--prism-backdrop-fg': '#111318',
      '--prism-backdrop-bg': '#f3f4f6',
      '--prism-backdrop-alt-fg': '#eceef2',
      '--prism-backdrop-alt-bg': '#24272e',
    } as CSSProperties
    const PALE = { tones: ['#c0b0a0', '#d0c0b0', '#e0d0c0'], dominant: '#9d6437' } as const
    const NIGHT = { tones: ['#07081c', '#0c0e24', '#161b39'], dominant: '#132552' } as const

    function Offered() {
      const palette = useContext(BackdropPaletteContext)
      return <p data-testid="offered">{palette?.foreground}</p>
    }
    const offered = () => screen.getByTestId('offered').textContent
    const pageText = () => backdrop().style.getPropertyValue('--_prism-page-fg')
    const fading = () => backdrop().classList.contains('prism-backdrop--colours-fade')

    function page(src: string) {
      return (
        <div style={theme}>
          <GlassBackdrop data-testid="backdrop" src={src}>
            <Offered />
          </GlassBackdrop>
        </div>
      )
    }

    it('offers them only once its image is drawing', async () => {
      vi.mocked(samplePageImage).mockReturnValue(PALE)
      render(page('/a.webp'))
      expect(offered()).toBe('')

      await loaded()
      expect(offered()).toBe(PAGE_TEXT)
      expect(pageText()).toBe('#111318')
    })

    it('tints everything inside it, through the tuning properties', async () => {
      vi.mocked(samplePageImage).mockReturnValue(NIGHT)
      render(page('/a.webp'))
      await loaded()
      expect(backdrop().style.getPropertyValue('--_prism-page-bg')).toBe('#24272e')
      expect(backdrop().style.getPropertyValue('--prism-card-bg')).toBe('var(--_prism-page-bg)')
      expect(backdrop().style.getPropertyValue('--prism-textbox-bg')).toBe('var(--_prism-page-bg)')
      expect(backdrop().style.getPropertyValue('--prism-button-bg')).toBe('var(--_prism-page-bg)')
    })

    it('changes them with the image', async () => {
      vi.mocked(samplePageImage).mockReturnValue(PALE)
      const { rerender } = render(page('/a.webp'))
      await loaded()

      vi.mocked(samplePageImage).mockReturnValue(NIGHT)
      rerender(page('/b.webp'))
      await loaded()
      expect(pageText()).toBe('#eceef2')
    })

    it('fades from one set of colours to the next, but not in from none', async () => {
      vi.mocked(samplePageImage).mockReturnValue(PALE)
      const { rerender } = render(page('/a.webp'))
      await loaded()
      expect(pageText()).toBe('#111318')
      expect(fading()).toBe(false)

      vi.mocked(samplePageImage).mockReturnValue(NIGHT)
      rerender(page('/b.webp'))
      await loaded()
      expect(pageText()).toBe('#eceef2')
      expect(fading()).toBe(true)
    })

    it('stops fading once the colours are lost, so the next ones go straight on', async () => {
      vi.mocked(samplePageImage).mockReturnValue(PALE)
      const { rerender } = render(page('/a.webp'))
      await loaded()
      vi.mocked(samplePageImage).mockReturnValue(NIGHT)
      rerender(page('/b.webp'))
      await loaded()
      expect(fading()).toBe(true)

      vi.mocked(samplePageImage).mockReturnValue(null)
      rerender(page('/c.webp'))
      await loaded()
      expect(pageText()).toBe('')
      expect(fading()).toBe(false)

      vi.mocked(samplePageImage).mockReturnValue(PALE)
      rerender(page('/d.webp'))
      await loaded()
      expect(pageText()).toBe('#111318')
      expect(fading()).toBe(false)
    })

    it("has none where the image can't be read, and leaves the tints be", async () => {
      vi.mocked(samplePageImage).mockReturnValue(null)
      render(page('/a.webp'))
      await loaded()
      expect(offered()).toBe('')
      expect(backdrop().style.getPropertyValue('--prism-card-bg')).toBe('')
    })

    it("lets a page's own style win", async () => {
      vi.mocked(samplePageImage).mockReturnValue(PALE)
      render(
        <div style={theme}>
          <GlassBackdrop data-testid="backdrop" src="/a.webp" style={{ ['--prism-card-bg' as string]: '#123456' }} />
        </div>,
      )
      await loaded()
      expect(backdrop().style.getPropertyValue('--prism-card-bg')).toBe('#123456')
    })

    describe('worked out ahead', () => {
      function ahead(props: Partial<GlassBackdropProps> = {}) {
        return (
          <div style={theme}>
            <GlassBackdrop data-testid="backdrop" src="/a.webp" pageImage={PALE} {...props}>
              <Offered />
            </GlassBackdrop>
          </div>
        )
      }

      it('puts them on before anything is drawn', () => {
        vi.mocked(createRenderer).mockReturnValue(new Promise(() => {}))
        render(ahead())
        expect(drawing()).toBe(false)
        expect(pageText()).toBe('#111318')
        expect(offered()).toBe(PAGE_TEXT)
        expect(fading()).toBe(false)
      })

      it('keeps them where nothing can be drawn', async () => {
        vi.mocked(createRenderer).mockResolvedValue(null)
        render(ahead())
        await loaded()
        expect(pageText()).toBe('#111318')
      })

      it('keeps them once the picture is drawn, over what is read from it', async () => {
        vi.mocked(samplePageImage).mockReturnValue(NIGHT)
        render(ahead())
        await loaded()
        expect(drawing()).toBe(true)
        expect(pageText()).toBe('#111318')
        expect(fading()).toBe(false)
      })

      it("keeps them for a picture that can't be read, such as one cross-origin without CORS", async () => {
        vi.mocked(samplePageImage).mockReturnValue(null)
        render(ahead())
        await loaded()
        expect(drawing()).toBe(true)
        expect(pageText()).toBe('#111318')
      })

      it('changes them with the picture', async () => {
        const { rerender } = render(ahead())
        await loaded()
        rerender(ahead({ src: '/b.webp', pageImage: NIGHT }))
        await loaded()
        expect(pageText()).toBe('#eceef2')
        expect(fading()).toBe(true)
      })

      it('takes no notice of a new object holding the same colours', () => {
        vi.mocked(createRenderer).mockReturnValue(new Promise(() => {}))
        const { rerender } = render(ahead())
        const style = backdrop().getAttribute('style')
        rerender(ahead({ pageImage: { tones: [...PALE.tones], dominant: PALE.dominant } }))
        expect(backdrop().getAttribute('style')).toBe(style)
      })

      it('takes a new range as new colours, and thickens the glass for one too wide', () => {
        vi.mocked(createRenderer).mockReturnValue(new Promise(() => {}))
        const { rerender } = render(ahead())
        const glass = () => Number(backdrop().style.getPropertyValue('--_prism-page-glass'))
        expect(glass()).toBe(0.3)
        rerender(ahead({ pageImage: { ...PALE, range: ['#07222e', '#e6dfc8'] } }))
        expect(glass()).toBeGreaterThan(0.3)
      })

      it("takes the night picture's while it is night in the scene", () => {
        vi.mocked(createRenderer).mockReturnValue(new Promise(() => {}))
        const night = Object.assign(() => new Promise<BackdropScene>(() => {}), { isNight: () => true })
        render(ahead({ nightSrc: '/n.webp', nightPageImage: NIGHT, scene: night, waitForScene: false }))
        expect(pageText()).toBe('#eceef2')
      })

      it("gives way to a scene's own once it has been read", async () => {
        const live = { render: vi.fn<BackdropScene['render']>(), dispose: vi.fn<BackdropScene['dispose']>() }
        renderer.prepareScene.mockResolvedValue(live)
        // Read as dark (the sampler's stand-in above), so the page turns to the opposite pair.
        renderer.readScene.mockResolvedValue(new Uint8ClampedArray(4))
        render(ahead({ scene: () => Promise.resolve(live), waitForScene: false }))
        expect(pageText()).toBe('#111318')
        await waitFor(() => expect(pageText()).toBe('#eceef2'))
        expect(fading()).toBe(true)
      })
    })
  })

  it('leaves cards with refract={false} out', async () => {
    render(
      <GlassBackdrop data-testid="backdrop" src="/a.webp">
        <Card data-testid="card" refract={false} />
      </GlassBackdrop>,
    )
    await loaded()
    layOutCanvas()
    placeAt(screen.getByTestId('card'), 10, 20, 200, 100)
    window.dispatchEvent(new Event('resize'))
    frames.settle()
    expect(renderer.draw.mock.lastCall![3]).toEqual([])
  })

  it('stays a CSS background, with no glass, where WebGPU is unavailable', async () => {
    vi.mocked(createRenderer).mockResolvedValue(null)
    render(
      <GlassBackdrop data-testid="backdrop" src="/a.webp">
        <Card data-testid="card" />
      </GlassBackdrop>,
    )
    await loaded()

    expect(loadImage).not.toHaveBeenCalled()
    expect(drawing()).toBe(false)
    expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')
  })

  it('stays a CSS background when the image fails to load', async () => {
    vi.mocked(loadImage).mockRejectedValue(new Error('404'))
    render(<GlassBackdrop data-testid="backdrop" src="/missing.webp" />)
    await loaded()

    expect(drawing()).toBe(false)
    expect(backdrop().style.backgroundImage).toBe('url("/missing.webp")')
  })

  it("stays a CSS background when the image can't be a texture", async () => {
    renderer.setImage.mockImplementation(() => {
      throw new DOMException('Tainted', 'SecurityError')
    })
    render(<GlassBackdrop data-testid="backdrop" src="https://elsewhere.example/a.webp" />)
    await loaded()

    expect(drawing()).toBe(false)
  })

  it('keeps drawing the previous image while the next one loads', async () => {
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    const next = pendingImage()
    vi.mocked(loadImage).mockReturnValue(next.promise)

    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" />)
    await loaded()
    expect(drawing()).toBe(true)
    expect(renderer.setImage).toHaveBeenCalledOnce()

    next.resolve(image('/b.webp'))
    await loaded()
    expect(renderer.setImage).toHaveBeenLastCalledWith(image('/b.webp'), false, undefined)
  })

  it('crossfades a new image in over the old one, but puts the first straight on', async () => {
    const progress = () => 0.5
    vi.mocked(startCrossfade).mockReturnValue(progress)
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" />)
    await loaded()

    expect(renderer.setImage.mock.calls).toEqual([
      [image('/a.webp'), false, undefined],
      [image('/b.webp'), true, undefined],
    ])
  })

  it('ignores an image that arrives after its src was replaced', async () => {
    const first = pendingImage()
    vi.mocked(loadImage).mockReturnValueOnce(first.promise)
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" />)
    await loaded()

    first.resolve(image('/a.webp'))
    await loaded()
    expect(renderer.setImage.mock.calls).toEqual([[image('/b.webp'), false, undefined]])
  })

  it('waits for a renderer before loading the image', async () => {
    let ready!: (next: Renderer | null) => void
    vi.mocked(createRenderer).mockReturnValueOnce(new Promise((resolve) => (ready = resolve)))
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    expect(loadImage).not.toHaveBeenCalled()
    expect(drawing()).toBe(false)

    ready(renderer)
    await loaded()
    expect(renderer.setImage).toHaveBeenCalledWith(image('/a.webp'), false, undefined)
    expect(drawing()).toBe(true)
  })

  it('has one renderer under StrictMode, letting go of the one its first mount asked for', async () => {
    const asked: ((next: Renderer | null) => void)[] = []
    vi.mocked(createRenderer).mockImplementation(() => new Promise((resolve) => asked.push(resolve)))
    render(
      <StrictMode>
        <GlassBackdrop data-testid="backdrop" src="/a.webp" />
      </StrictMode>,
    )
    expect(asked).toHaveLength(2)
    const [[, first], [, second]] = vi.mocked(createRenderer).mock.calls
    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)

    const given = { ...renderer, dispose: vi.fn<Renderer['dispose']>() }
    asked[0](given)
    asked[1](renderer)
    await loaded()
    expect(given.dispose).toHaveBeenCalledOnce()
    expect(renderer.dispose).not.toHaveBeenCalled()
    expect(drawing()).toBe(true)
  })

  it('lets go of a renderer that arrives after it unmounted', async () => {
    let ready!: (next: Renderer | null) => void
    vi.mocked(createRenderer).mockReturnValueOnce(new Promise((resolve) => (ready = resolve)))
    const { unmount } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    unmount()

    ready(renderer)
    await loaded()
    expect(vi.mocked(createRenderer).mock.lastCall![1].signal.aborted).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce()
    expect(loadImage).not.toHaveBeenCalled()
  })

  it('goes back to a CSS background when the device is lost, and asks for a new one', async () => {
    render(
      <GlassBackdrop data-testid="backdrop" src="/a.webp">
        <Card data-testid="card" />
      </GlassBackdrop>,
    )
    await loaded()

    loseDevice()
    expect(drawing()).toBe(false)
    expect(backdrop().style.backgroundImage).toBe('url("/a.webp")')
    expect(renderer.dispose).toHaveBeenCalledOnce()
    expect(createRenderer).toHaveBeenCalledTimes(2)
  })

  it('stays a CSS background when no new device can be had', async () => {
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    loseDevice(Promise.resolve(null))
    await loaded()

    expect(drawing()).toBe(false)
    expect(renderer.setImage).toHaveBeenCalledOnce()
  })

  describe('without a new device', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    })

    it('keeps asking, less and less often', async () => {
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(null))
      lost()
      await loaded()
      expect(createRendererCalls()).toBe(2)

      await pass(499)
      expect(createRendererCalls()).toBe(2)
      await pass(1)
      expect(createRendererCalls()).toBe(3)
      await pass(999)
      expect(createRendererCalls()).toBe(3)
      await pass(1)
      expect(createRendererCalls()).toBe(4)
    })

    it('never leaves it longer than the longest wait', async () => {
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(null))
      lost()
      await loaded()
      for (let i = 0; i < 12; i++) await pass(30_000)

      const before = createRendererCalls()
      await pass(29_999)
      expect(createRendererCalls()).toBe(before)
      await pass(1)
      expect(createRendererCalls()).toBe(before + 1)
    })

    it('draws again as soon as one is to be had', async () => {
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(null))
      lost()
      await loaded()
      expect(drawing()).toBe(false)

      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(renderer))
      await pass(500)
      await loaded()
      expect(drawing()).toBe(true)
    })

    it('waits before replacing a renderer that went as soon as it came', async () => {
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      lost()
      await loaded()
      expect(createRendererCalls()).toBe(2)

      lost()
      await loaded()
      expect(createRendererCalls()).toBe(2)
      await pass(500)
      expect(createRendererCalls()).toBe(3)
    })

    it('replaces one that lasted straight away', async () => {
      let now = 0
      vi.spyOn(performance, 'now').mockImplementation(() => now)
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      lost()
      await loaded()

      now += 10_000
      lost()
      expect(createRendererCalls()).toBe(3)
    })

    it('waits before replacing one lost in making a scene, though a scene given up on has ended since', async () => {
      let now = 0
      vi.spyOn(performance, 'now').mockImplementation(() => now)
      let giveUp!: (error: Error) => void
      const givenUpOn = new Promise<BackdropScene>((_, reject) => (giveUp = reject))
      renderer.prepareScene.mockReturnValueOnce(givenUpOn).mockReturnValue(new Promise(() => {}))
      const factory: SceneFactory = () => new Promise(() => {})
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" scene={factory} />)
      await loaded()
      expect(renderer.prepareScene).toHaveBeenCalledOnce()

      // Its device goes, and the scene is begun again on the next.
      lost()
      await loaded()
      expect(createRendererCalls()).toBe(2)
      expect(renderer.prepareScene).toHaveBeenCalledTimes(2)
      // The first, given up on, ends only now, with the second still being made.
      await act(async () => giveUp(new Error('Given up on')))

      // However long it lasted, a device lost in making a scene would only go the same way.
      now += 10_000
      lost()
      await loaded()
      expect(createRendererCalls()).toBe(2)
      await pass(500)
      expect(createRendererCalls()).toBe(3)
    })

    it('asks at once when the page comes back into view', async () => {
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(null))
      lost()
      await loaded()

      document.dispatchEvent(new Event('visibilitychange'))
      expect(createRendererCalls()).toBe(2)
      hidden.mockReturnValue(false)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(createRendererCalls()).toBe(3)
    })

    it('asks only once where there never was one', async () => {
      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(null))
      render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      await pass(60_000)
      expect(createRendererCalls()).toBe(1)
    })

    it('stops asking once unmounted', async () => {
      const { unmount } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
      await loaded()
      vi.mocked(createRenderer).mockImplementation(() => Promise.resolve(null))
      lost()
      await loaded()
      unmount()

      await pass(60_000)
      expect(createRendererCalls()).toBe(2)
    })
  })

  it('stays on the CSS background when src changes while the device is lost', async () => {
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    loseDevice()

    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" />)
    await loaded()
    expect(drawing()).toBe(false)
    expect(backdrop().style.backgroundImage).toBe('url("/b.webp")')
    expect(renderer.setImage).toHaveBeenCalledOnce()
  })

  it('ignores an image that arrives after the device was lost', async () => {
    const first = pendingImage()
    vi.mocked(loadImage).mockReturnValueOnce(first.promise)
    render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    loseDevice()

    first.resolve(image('/a.webp'))
    await loaded()
    expect(drawing()).toBe(false)
    expect(renderer.setImage).not.toHaveBeenCalled()
  })

  it('draws again on a new renderer once there is a new device', async () => {
    let ready!: (next: Renderer | null) => void
    const { rerender } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    loseDevice(new Promise((resolve) => (ready = resolve)))
    rerender(<GlassBackdrop data-testid="backdrop" src="/b.webp" />)
    await loaded()

    ready(renderer)
    await loaded()
    expect(createRenderer).toHaveBeenCalledTimes(2)
    expect(renderer.setImage).toHaveBeenLastCalledWith(image('/b.webp'), false, undefined)
    expect(drawing()).toBe(true)
  })

  it('releases the renderer on unmount', async () => {
    const { unmount } = render(<GlassBackdrop data-testid="backdrop" src="/a.webp" />)
    await loaded()
    unmount()

    expect(renderer.dispose).toHaveBeenCalledOnce()
    window.dispatchEvent(new Event('scroll'))
    expect(frames.pending).toBe(0)
  })
})
