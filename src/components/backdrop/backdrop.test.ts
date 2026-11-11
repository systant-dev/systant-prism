import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames, manualIntersections, manualResizes, placeAt } from '../../../test/dom'
import { createBackdrop, type BackdropController } from './backdrop'
import type { LensDraw, Renderer } from './gpu/renderer'

let frames: ReturnType<typeof manualFrames>
let resizes: ReturnType<typeof manualResizes>
let intersections: ReturnType<typeof manualIntersections>
let renderer: { [K in keyof Renderer]: ReturnType<typeof vi.fn<Renderer[K]>> }
let canvas: HTMLCanvasElement
let backdrop: BackdropController

function glass(left: number, top: number, width = 200, height = 100, parent: HTMLElement = document.body) {
  const el = document.createElement('div')
  el.style.setProperty('--prism-refraction', '20%')
  el.style.setProperty('--prism-refraction-blur', '3px')
  el.style.borderTopLeftRadius = '16px'
  parent.append(el)
  placeAt(el, left, top, width, height)
  return el
}

/** Fires a transition event on `el`, as the browser would for `propertyName` on it (or on its `pseudoElement`). */
function transition(el: Element, type: string, propertyName = 'scale', pseudoElement = '') {
  el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { propertyName, pseudoElement }))
}

/** The lenses of the latest draw. */
function lastLenses(): LensDraw[] {
  return renderer.draw.mock.lastCall![3]
}

beforeEach(() => {
  frames = manualFrames()
  resizes = manualResizes()
  intersections = manualIntersections()
  renderer = {
    prepareScene: vi.fn<Renderer['prepareScene']>(),
    readScene: vi.fn<Renderer['readScene']>(),
    setImage: vi.fn<Renderer['setImage']>(),
    settled: vi.fn<Renderer['settled']>(() => Promise.resolve()),
    holdScene: vi.fn<Renderer['holdScene']>(),
    setRain: vi.fn<Renderer['setRain']>(),
    draw: vi.fn<Renderer['draw']>(),
    setMatte: vi.fn<Renderer['setMatte']>(),
    dispose: vi.fn<Renderer['dispose']>(),
  }
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  placeAt(canvas, 0, 0, 1000, 800)
  backdrop = createBackdrop()
})

afterEach(() => {
  backdrop.detach()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a scene in place of the image', () => {
  it('holds a scene as it is told to, and draws it straight away', () => {
    const noon = new Date(2026, 5, 21, 12)
    backdrop.attach(canvas, renderer)
    renderer.draw.mockClear()
    backdrop.holdScene(true, noon)
    expect(renderer.holdScene).toHaveBeenLastCalledWith(true, noon)
    expect(renderer.draw).toHaveBeenCalledOnce()
  })

  it('tells a renderer how to hold a scene as it arrives', () => {
    const noon = new Date(2026, 5, 21, 12)
    backdrop.holdScene(false, noon)
    expect(renderer.draw).not.toHaveBeenCalled()
    backdrop.attach(canvas, renderer)
    expect(renderer.holdScene).toHaveBeenLastCalledWith(false, noon)
  })

  it('says whether it is raining, and draws that straight away', () => {
    backdrop.attach(canvas, renderer)
    renderer.draw.mockClear()
    backdrop.setRain(true)
    expect(renderer.setRain).toHaveBeenLastCalledWith(true)
    expect(renderer.draw).toHaveBeenCalledOnce()
  })

  it('tells a renderer whether it is raining as it arrives', () => {
    backdrop.setRain(true)
    expect(renderer.draw).not.toHaveBeenCalled()
    backdrop.attach(canvas, renderer)
    expect(renderer.setRain).toHaveBeenLastCalledWith(true)
  })

  it('goes on drawing once a scene is let go of', () => {
    backdrop.attach(canvas, renderer)
    renderer.draw.mockReturnValue(true)
    backdrop.holdScene(false, undefined)
    renderer.draw.mockClear()
    frames.flush()
    expect(renderer.draw).toHaveBeenCalledOnce()
  })

  it('sets the scene up on the renderer', async () => {
    const factory = () => Promise.resolve(scene)
    renderer.prepareScene.mockImplementation((make) => make({} as GPUDevice))
    backdrop.attach(canvas, renderer)
    expect(await backdrop.prepareScene(factory)).toBe(scene)
  })

  it('refuses to set a scene up with no renderer', async () => {
    await expect(backdrop.prepareScene(() => new Promise(() => {}))).rejects.toThrow('No renderer')
  })

  it('chooses the page colours from the pixels of the scene', async () => {
    renderer.readScene.mockResolvedValue(new Uint8ClampedArray(64).fill(40))
    backdrop.attach(canvas, renderer)
    expect((await backdrop.readScene())!.tones).toEqual(['#282828', '#282828', '#282828'])
  })

  it('has no colours to choose from without a scene', async () => {
    renderer.readScene.mockResolvedValue(null)
    backdrop.attach(canvas, renderer)
    expect(await backdrop.readScene()).toBeNull()
  })

  it('hands the renderer the scene with the image', () => {
    const image = {} as HTMLImageElement
    backdrop.attach(canvas, renderer)
    backdrop.setImage(image, undefined, scene)
    expect(renderer.setImage).toHaveBeenCalledWith(image, false, scene)
  })

  it('redraws for as long as the renderer says it has more to draw', () => {
    renderer.draw.mockReturnValue(true)
    backdrop.attach(canvas, renderer)
    backdrop.setImage({} as HTMLImageElement)
    const drawn = renderer.draw.mock.calls.length
    frames.flush()
    frames.flush()
    expect(renderer.draw.mock.calls.length).toBe(drawn + 2)
    renderer.draw.mockReturnValue(false)
    frames.flush()
    const stopped = renderer.draw.mock.calls.length
    frames.flush()
    expect(renderer.draw.mock.calls.length).toBe(stopped)
  })
})

/** A scene that draws nothing. */
const scene = { render: () => {}, dispose: () => {} }

/** Lets a promise that has been settled, and what hangs off it, run. */
async function promisesSettled() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('createBackdrop', () => {
  it('draws nothing until attached', () => {
    backdrop.track(glass(0, 0))
    expect(backdrop.attached).toBe(false)
    expect(frames.pending).toBe(0)
  })

  it('clips glass to an ancestor that only starts clipping after it is tracked', () => {
    const scroller = glass(100, 100, 300, 200)
    Object.defineProperties(scroller, { clientWidth: { value: 300 }, clientHeight: { value: 200 } })
    // Live, as a browser's is: jsdom's is a snapshot.
    const style = { overflowX: 'visible', overflowY: 'visible', getPropertyValue: () => '' }
    const computedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) =>
      el === scroller ? (style as unknown as CSSStyleDeclaration) : computedStyle(el),
    )
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(100, 150, 200, 100, scroller))
    frames.flush()
    expect(lastLenses()[0].clip).toEqual([0, 0, 1000, 800])

    style.overflowY = 'auto'
    backdrop.invalidate()
    frames.flush()
    expect(lastLenses()[0].clip).toEqual([100, 100, 400, 300])
  })

  it('keeps glass in document order as elements move in the document', () => {
    const first = glass(0, 0)
    const second = glass(300, 0)
    backdrop.attach(canvas, renderer)
    backdrop.track(first)
    backdrop.track(second)
    frames.flush()
    expect(lastLenses().map((lens) => lens.x)).toEqual([0, 300])

    document.body.insertBefore(second, first)
    backdrop.invalidate()
    frames.flush()
    expect(lastLenses().map((lens) => lens.x)).toEqual([300, 0])
  })

  it('draws glass in what is lifted over the rest, until it is let go', () => {
    const lifted = glass(0, 0)
    const under = glass(100, 0)
    backdrop.attach(canvas, renderer)
    backdrop.track(lifted)
    backdrop.track(under)
    frames.flush()

    const stop = backdrop.moving(lifted, { lifted: true })
    frames.flush()
    expect(lastLenses().map((lens) => lens.x)).toEqual([100, 0])

    stop()
    frames.flush()
    expect(lastLenses().map((lens) => lens.x)).toEqual([0, 100])
  })

  it("draws each element's glass from its box and CSS", () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(100, 50))
    frames.flush()

    expect(renderer.draw).toHaveBeenCalledWith(
      1000,
      800,
      devicePixelRatio,
      [
        {
          x: 100,
          y: 50,
          width: 200,
          height: 100,
          clip: [0, 0, 1000, 800],
          feather: [0, 0, 0, 0],
          radius: 16,
          squircle: false,
          strength: 20,
          bezel: 16,
          hole: 0,
          soft: 0,
          blur: 3,
          frost: 0,
          opacity: 1,
        },
      ],
      1,
      [],
    )
  })

  describe('glass over the page', () => {
    it('draws it apart from the page, onto its own canvas', () => {
      backdrop.attach(canvas, renderer)
      const card = glass(0, 0)
      const popup = glass(100, 50, 40, 20)
      const target = document.createElement('canvas')
      backdrop.track(card)
      backdrop.trackOverlay(popup, target)
      frames.flush()

      const overlays = renderer.draw.mock.lastCall![5]!
      expect(lastLenses()).toMatchObject([{ x: 0, y: 0, width: 200 }])
      expect(overlays).toMatchObject([{ lens: { x: 100, y: 50, width: 40, height: 20 } }])
      expect(overlays[0].canvas).toBe(target)
    })

    it('ignores what clips and fades the page', () => {
      backdrop.attach(canvas, renderer)
      const scroller = document.createElement('div')
      scroller.style.overflow = 'hidden'
      scroller.style.opacity = '0.5'
      document.body.append(scroller)
      placeAt(scroller, 0, 0, 10, 10)
      const popup = glass(100, 50, 40, 20, scroller)
      backdrop.trackOverlay(popup, document.createElement('canvas'))
      frames.flush()

      expect(renderer.draw.mock.lastCall![5]).toMatchObject([{ lens: { clip: [0, 0, 1000, 800], opacity: 1 } }])
    })

    it('stops when told to', () => {
      backdrop.attach(canvas, renderer)
      const stop = backdrop.trackOverlay(glass(100, 50), document.createElement('canvas'))
      stop()
      backdrop.invalidate()
      frames.flush()
      expect(renderer.draw.mock.lastCall![5]).toEqual([])
    })
  })

  // How each is worked out from its CSS is lens.test.ts's; here, that each reaches the draw.
  it("reads the shape of each element's lens from its CSS", () => {
    backdrop.attach(canvas, renderer)
    const plain = glass(0, 0)
    const shaped = glass(300, 0)
    shaped.style.setProperty('--prism-refraction-width', '30px')
    shaped.style.setProperty('--prism-refraction-hole', '40px')
    shaped.style.setProperty('--prism-refraction-soft', '1.5px')
    shaped.style.setProperty('--prism-refraction-frost', '6px')
    shaped.style.setProperty('corner-top-left-shape', 'squircle')
    backdrop.track(plain)
    backdrop.track(shaped)
    frames.flush()

    const [unset, set] = lastLenses()
    // The band as wide as the 16px corner radius by default.
    expect(unset).toMatchObject({ bezel: 16, hole: 0, soft: 0, frost: 0, squircle: false })
    // A quarter of the 100px shorter side, less half the hole: half of the 10px ring.
    expect(set).toMatchObject({ bezel: 5, hole: 40, soft: 1.5, frost: 6, squircle: true })
  })

  it('draws glass nested in other glass over it, whatever order they were tracked in', () => {
    backdrop.attach(canvas, renderer)
    const outer = glass(0, 0, 400, 300)
    const inner = glass(20, 20, 100, 40, outer)
    backdrop.track(inner)
    backdrop.track(outer)
    frames.flush()

    expect(lastLenses().map((l) => [l.width, l.height])).toEqual([
      [400, 300],
      [100, 40],
    ])
  })

  it('draws at most once per frame', () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(0, 0))
    backdrop.track(glass(300, 0))
    backdrop.invalidate()
    window.dispatchEvent(new Event('scroll'))

    expect(frames.pending).toBe(1)
    frames.flush()
    expect(renderer.draw).toHaveBeenCalledOnce()
    expect(lastLenses()).toHaveLength(2)
  })

  it.each(['scroll', 'resize'])('redraws where elements have moved when the window fires %s', (type) => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 100)
    backdrop.track(el)
    frames.flush()

    placeAt(el, 0, 60, 200, 100)
    window.dispatchEvent(new Event(type))
    frames.flush()

    expect(lastLenses()[0].y).toBe(60)
  })

  it('redraws when an element resizes', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()

    placeAt(el, 0, 0, 300, 100)
    resizes.resize(el, 300, 100)
    frames.flush()

    expect(lastLenses()[0].width).toBe(300)
  })

  it('redraws an element that moves without a scroll or resize', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 100)
    backdrop.track(el)
    frames.flush()
    intersections.intersect(el, 1)
    expect(frames.pending).toBe(0)

    // Content above it grew, say.
    placeAt(el, 0, 140, 200, 100)
    intersections.intersect(el, 0.6)
    expect(frames.pending).toBe(1)
    frames.flush()
    expect(lastLenses()[0].y).toBe(140)
    expect(intersections.observed).toBe(1)
  })

  it('watches each element afresh only once it has moved', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 100)
    backdrop.track(el)
    frames.flush()
    const watchers = intersections.created

    backdrop.invalidate()
    frames.flush()
    expect(intersections.created).toBe(watchers)

    placeAt(el, 0, 60, 200, 100)
    window.dispatchEvent(new Event('scroll'))
    frames.settle()
    expect(intersections.created).toBe(watchers + 1)
    expect(intersections.observed).toBe(1)
  })

  it.each(['scroll', 'resize'])('watches nothing while the window fires %s, then once it stops', (type) => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 100)
    backdrop.track(el)
    frames.flush()
    const watchers = intersections.created

    for (let top = 90; top > 50; top -= 10) {
      placeAt(el, 0, top, 200, 100)
      window.dispatchEvent(new Event(type))
      frames.flush()
      expect(lastLenses()[0].y).toBe(top)
      expect(intersections.observed).toBe(0)
    }
    expect(intersections.created).toBe(watchers)

    // The first frame without one watches it where it came to rest.
    frames.flush()
    expect(intersections.created).toBe(watchers + 1)
    expect(intersections.observed).toBe(1)
    expect(frames.pending).toBe(0)
  })

  it('stops watching an element once untracked or detached', () => {
    backdrop.attach(canvas, renderer)
    const untrack = backdrop.track(glass(0, 0))
    backdrop.track(glass(300, 0))
    frames.flush()
    expect(intersections.observed).toBe(2)

    untrack()
    expect(intersections.observed).toBe(1)
    backdrop.detach()
    expect(intersections.observed).toBe(0)
  })

  it('stays put while nothing changes', () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(0, 0))
    frames.flush()

    window.dispatchEvent(new MouseEvent('pointermove'))
    expect(frames.pending).toBe(0)
  })

  it('redraws every frame while a transform transition runs, then once where it comes to rest', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()
    const before = renderer.draw.mock.calls.length

    transition(el, 'transitionrun')
    frames.flush()
    frames.flush()
    frames.flush()
    expect(renderer.draw.mock.calls.length - before).toBe(3)

    transition(el, 'transitionend')
    expect(frames.settle()).toBe(1)
  })

  it('keeps following through a transition reversed mid-way', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()

    transition(el, 'transitionrun')
    transition(el, 'transitioncancel')
    transition(el, 'transitionrun')
    frames.flush()
    expect(frames.pending).toBe(1)

    transition(el, 'transitionend')
    expect(frames.settle()).toBe(1)
  })

  it.each([
    ['another property', (el: HTMLElement) => transition(el, 'transitionrun', 'background-color')],
    ['a pseudo-element', (el: HTMLElement) => transition(el, 'transitionrun', 'scale', '::after')],
    ['a child', (el: HTMLElement) => transition(el.appendChild(document.createElement('span')), 'transitionrun')],
  ])("doesn't follow transitions of %s", (_, run) => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()

    run(el)
    expect(frames.pending).toBe(0)
  })

  it('stops following an element untracked mid-transition', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    const untrack = backdrop.track(el)
    frames.flush()

    transition(el, 'transitionrun')
    untrack()
    expect(frames.settle()).toBe(1)
    transition(el, 'transitionend')
    expect(frames.pending).toBe(0)
  })

  it('re-measures only the moving element during a transition, still drawing the rest', () => {
    backdrop.attach(canvas, renderer)
    const still = glass(0, 0)
    const moving = glass(300, 0)
    backdrop.track(still)
    backdrop.track(moving)
    frames.flush()
    const measured = () => vi.mocked(still.getBoundingClientRect).mock.calls.length
    const before = measured()

    transition(moving, 'transitionrun')
    frames.flush()
    placeAt(moving, 310, 5, 180, 90)
    frames.flush()

    expect(measured() - before).toBe(1) // The first frame, from the transition's start.
    expect(lastLenses().map(({ x, width }) => [x, width])).toEqual([
      [0, 200],
      [310, 180],
    ])
  })

  it('re-measures everything when something else moves mid-transition', () => {
    backdrop.attach(canvas, renderer)
    const still = glass(0, 0)
    const moving = glass(300, 0)
    backdrop.track(still)
    backdrop.track(moving)
    transition(moving, 'transitionrun')
    frames.flush()

    placeAt(still, 0, -20)
    window.dispatchEvent(new Event('scroll'))
    frames.flush()

    expect(lastLenses()[0].y).toBe(-20)
  })

  it('redraws every frame while something is moving, re-measuring only the glass in it', () => {
    backdrop.attach(canvas, renderer)
    const still = glass(0, 0)
    const holder = document.createElement('div')
    document.body.append(holder)
    const inside = glass(300, 0, 200, 100, holder)
    backdrop.track(still)
    backdrop.track(inside)
    frames.flush()
    const measured = () => vi.mocked(still.getBoundingClientRect).mock.calls.length
    const before = measured()

    const stop = backdrop.moving(holder)
    placeAt(inside, 320, 10)
    frames.flush()
    expect(lastLenses().map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [320, 10],
    ])
    placeAt(inside, 340, 20)
    frames.flush()
    expect(lastLenses()[1].x).toBe(340)
    expect(measured() - before).toBe(0)
    expect(frames.pending).toBe(1)

    stop()
    stop()
    frames.flush()
    expect(measured() - before).toBe(1) // Once more, everything, where it came to rest.
    expect(frames.pending).toBe(0)
  })

  it('keeps redrawing until everything said to move has stopped', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()

    const first = backdrop.moving(el)
    const second = backdrop.moving(el)
    first()
    frames.settle(3)
    expect(frames.pending).toBe(1)
    second()
    frames.flush()
    expect(frames.pending).toBe(0)
  })

  it('stops redrawing if the end of a transition goes unheard', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()

    transition(el, 'transitionrun')
    frames.flush()
    expect(frames.pending).toBe(1)

    // The transition is over, but no transitionend came.
    el.getAnimations = () => []
    expect(frames.settle()).toBe(1)
  })

  it('fades glass by the opacity of the element and every ancestor', () => {
    backdrop.attach(canvas, renderer)
    const outer = document.body.appendChild(document.createElement('div'))
    const inner = outer.appendChild(document.createElement('div'))
    outer.style.opacity = '0.5'
    inner.style.opacity = '0.8'
    const el = glass(0, 0, 200, 100, inner)
    el.style.opacity = '0.5'
    backdrop.track(el)
    frames.flush()

    expect(lastLenses()[0].opacity).toBeCloseTo(0.2)
  })

  it('skips glass that is wholly transparent', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    el.style.opacity = '0'
    backdrop.track(el)
    frames.flush()

    expect(lastLenses()).toEqual([])
  })

  it('redraws glass every frame while an element it is in fades, then once where it comes to rest', () => {
    backdrop.attach(canvas, renderer)
    const box = document.body.appendChild(document.createElement('div'))
    const inside = glass(0, 0, 200, 100, box)
    const outside = glass(300, 0)
    backdrop.track(inside)
    backdrop.track(outside)
    frames.flush()
    // jsdom's computed styles don't follow later changes as a browser's do, so
    // count the re-measures rather than reading the opacity.
    const measured = (el: HTMLElement) => vi.mocked(el.getBoundingClientRect).mock.calls.length
    const before = [measured(inside), measured(outside)]

    transition(box, 'transitionrun', 'opacity')
    frames.flush()
    frames.flush()
    expect([measured(inside) - before[0], measured(outside) - before[1]]).toEqual([2, 0])
    expect(frames.pending).toBe(1)

    transition(box, 'transitionend', 'opacity')
    expect(frames.settle()).toBe(1)
  })

  it('follows glass that mounts inside an element already fading', () => {
    backdrop.attach(canvas, renderer)
    const box = document.body.appendChild(document.createElement('div'))
    transition(box, 'transitionrun', 'opacity')
    expect(frames.pending).toBe(0)

    backdrop.track(glass(0, 0, 200, 100, box))
    frames.flush()
    frames.flush()
    expect(frames.pending).toBe(1)
  })

  it.each([
    ['with no glass inside', () => document.body.appendChild(document.createElement('span')), ''],
    ['of a pseudo-element', (el: HTMLElement) => el, '::after'],
  ])("doesn't follow opacity transitions %s", (_, target, pseudoElement) => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()

    transition(target(el), 'transitionrun', 'opacity', pseudoElement)
    expect(frames.pending).toBe(0)
  })

  it('stops redrawing if the end of a fade goes unheard', () => {
    backdrop.attach(canvas, renderer)
    const box = document.body.appendChild(document.createElement('div'))
    backdrop.track(glass(0, 0, 200, 100, box))
    frames.flush()

    transition(box, 'transitionrun', 'opacity')
    frames.flush()
    expect(frames.pending).toBe(1)

    box.getAnimations = () => []
    expect(frames.settle()).toBe(1)
  })

  it('clips glass to the padding box of a scrolling ancestor', () => {
    backdrop.attach(canvas, renderer)
    const scroller = document.createElement('div')
    // A longhand: jsdom doesn't expand the overflow shorthand into computed style.
    scroller.style.overflowY = 'auto'
    document.body.append(scroller)
    placeAt(scroller, 50, 40, 400, 300)
    Object.defineProperties(scroller, {
      clientLeft: { value: 2 },
      clientTop: { value: 2 },
      clientWidth: { value: 380 },
      clientHeight: { value: 296 },
    })
    backdrop.track(glass(60, 0, 200, 100, scroller))
    frames.flush()

    expect(lastLenses()[0].clip).toEqual([52, 42, 432, 338])
  })

  it('reads an ancestor shared by glass once a draw, giving each the same clip and opacity', () => {
    backdrop.attach(canvas, renderer)
    const scroller = document.createElement('div')
    scroller.style.overflowY = 'auto'
    scroller.style.opacity = '0.5'
    document.body.append(scroller)
    placeAt(scroller, 50, 40, 400, 300)
    Object.defineProperties(scroller, { clientWidth: { value: 400 }, clientHeight: { value: 300 } })
    const inner = scroller.appendChild(document.createElement('div'))
    inner.style.opacity = '0.8'
    const near = glass(60, 0, 200, 100, inner)
    const far = glass(60, 120, 200, 100, scroller)
    backdrop.track(near)
    backdrop.track(far)
    frames.flush()
    const reads = () => vi.mocked(scroller.getBoundingClientRect).mock.calls.length
    const before = reads()
    backdrop.invalidate()
    frames.flush()

    expect(reads() - before).toBe(1)
    const [first, second] = lastLenses()
    expect(first.clip).toEqual(second.clip)
    expect(first.opacity).toBeCloseTo(0.4)
    expect(second.opacity).toBeCloseTo(0.5)
  })

  it('fades glass out where a scrolling ancestor fades its content, as far as it does', () => {
    backdrop.attach(canvas, renderer)
    const outer = document.createElement('div')
    outer.style.overflowY = 'auto'
    const scroller = document.createElement('div')
    scroller.style.overflowY = 'auto'
    scroller.style.setProperty('--prism-scroll-fade', '16px')
    outer.append(scroller)
    document.body.append(outer)
    // The outer clipper sets the right side, the fading scroller the other three.
    placeAt(outer, 0, 0, 400, 800)
    placeAt(scroller, 50, 40, 400, 300)
    Object.defineProperties(outer, { clientWidth: { value: 400 }, clientHeight: { value: 800 } })
    // 6px scrolled down, 100px more below, 30px across to the right.
    Object.defineProperties(scroller, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
      scrollTop: { value: 6 },
      scrollHeight: { value: 406 },
      scrollWidth: { value: 430 },
    })
    backdrop.track(glass(60, 0, 200, 100, scroller))
    frames.flush()

    expect(lastLenses()[0].clip).toEqual([50, 40, 400, 340])
    expect(lastLenses()[0].feather).toEqual([0, 6, 0, 16])
  })

  it('skips elements with no size or scrolled out of view', () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(0, 0, 0, 0))
    backdrop.track(glass(0, -500))
    backdrop.track(glass(0, 900))
    frames.flush()

    expect(lastLenses()).toEqual([])
  })

  it('stops drawing an element once untracked', () => {
    backdrop.attach(canvas, renderer)
    const untrack = backdrop.track(glass(0, 0))
    backdrop.track(glass(300, 0))
    frames.flush()

    untrack()
    expect(frames.pending).toBe(1)
    frames.flush()
    expect(lastLenses().map((lens) => lens.x)).toEqual([300])
  })

  it('draws a new image straight away', () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(0, 0))
    const image = {} as HTMLImageElement

    backdrop.setImage(image)

    expect(renderer.setImage).toHaveBeenCalledWith(image, false, undefined)
    expect(renderer.draw).toHaveBeenCalledOnce()
    expect(frames.pending).toBe(0)
  })

  it("fades each element's bend in when its glass first shows, a frame at a time", () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    el.style.setProperty('--prism-refraction-fade', '400ms')
    backdrop.track(el)

    // Frames 20ms apart: the fade holds through a longer one.
    function frameFor(ms: number) {
      for (let i = 0; i < ms / 20; i++) {
        now += 20
        frames.flush()
      }
    }

    frames.flush()
    expect(lastLenses()[0].strength).toBe(0)
    expect(lastLenses()[0].blur).toBe(3)
    frameFor(200)
    expect(lastLenses()[0].strength).toBeCloseTo(20 * 0.5)
    frameFor(200)
    expect(lastLenses()[0].strength).toBe(20)
    expect(frames.pending).toBe(0)
  })

  it('crossfades a new image in, a frame at a time, until its progress reaches 1', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    frames.flush()
    const measured = () => vi.mocked(el.getBoundingClientRect).mock.calls.length
    let progress = 0
    const image = {} as HTMLImageElement

    backdrop.setImage(image, () => progress)
    expect(renderer.setImage).toHaveBeenCalledWith(image, true, undefined)
    const before = measured()
    progress = 0.4
    frames.flush()
    progress = 1.2
    frames.flush()

    expect(renderer.draw.mock.calls.map((call) => call[4]).slice(-3)).toEqual([0, 0.4, 1])
    // The lenses are reused as they were: nothing moved.
    expect(measured()).toBe(before)
    expect(frames.pending).toBe(0)
  })

  it("holds a scene's crossfade at nothing until the GPU has done its first frame", async () => {
    let settle!: () => void
    renderer.settled.mockReturnValue(new Promise((resolve) => (settle = resolve)))
    backdrop.attach(canvas, renderer)
    const progress = vi.fn<() => number>(() => 0.4)

    backdrop.setImage({} as HTMLImageElement, progress, { render: () => {}, dispose: () => {} })
    frames.flush()
    frames.flush()
    expect(renderer.draw.mock.calls.map((call) => call[4]).slice(-3)).toEqual([0, 0, 0])
    expect(progress).not.toHaveBeenCalled()

    settle()
    await Promise.resolve()
    frames.flush()
    expect(renderer.draw.mock.lastCall![4]).toBe(0.4)
  })

  it('redraws for as long as the renderer wants to make its blurs again', () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(0, 0))
    frames.flush()

    renderer.draw.mockReturnValue(true)
    backdrop.invalidate()
    frames.flush()
    expect(frames.pending).toBe(1)
    frames.flush()
    expect(frames.pending).toBe(1)

    renderer.draw.mockReturnValue(false)
    frames.flush()
    expect(frames.pending).toBe(0)
  })

  it('sorts the glass after what could change its order, not after a scroll', () => {
    backdrop.attach(canvas, renderer)
    backdrop.track(glass(0, 0))
    backdrop.track(glass(100, 0))
    frames.flush()
    const compare = vi.spyOn(Node.prototype, 'compareDocumentPosition')

    window.dispatchEvent(new Event('scroll'))
    frames.flush()
    frames.flush()
    expect(compare).not.toHaveBeenCalled()

    backdrop.invalidate()
    frames.flush()
    expect(compare).toHaveBeenCalled()
  })

  it('reads nothing of the ancestors of glass off the screen', () => {
    backdrop.attach(canvas, renderer)
    const scroller = document.body.appendChild(document.createElement('div'))
    scroller.style.overflow = 'auto'
    placeAt(scroller, 0, 0, 1000, 800)
    const el = glass(0, 5000)
    scroller.append(el)
    backdrop.track(el)
    frames.flush()
    const measured = vi.mocked(scroller.getBoundingClientRect)
    measured.mockClear()

    backdrop.invalidate()
    frames.flush()
    expect(lastLenses()).toEqual([])
    expect(measured).not.toHaveBeenCalled()
  })

  describe('a first image, with nothing to crossfade from', () => {
    it('fades the canvas in, from nothing until its first frame is done', async () => {
      let settle!: () => void
      renderer.settled.mockReturnValue(new Promise((resolve) => (settle = resolve)))
      backdrop.attach(canvas, renderer)
      let progress = 0.25
      backdrop.setImage({} as HTMLImageElement, () => progress, scene)
      expect(canvas.style.opacity).toBe('0')

      settle()
      await promisesSettled()
      frames.flush()
      expect(canvas.style.opacity).toBe('0.25')

      progress = 1
      frames.flush()
      expect(canvas.style.opacity).toBe('')
    })

    it('leaves the canvas alone for an image with no fade', () => {
      backdrop.attach(canvas, renderer)
      backdrop.setImage({} as HTMLImageElement)
      expect(canvas.style.opacity).toBe('')
    })

    it('crossfades the image after that as ever', () => {
      backdrop.attach(canvas, renderer)
      backdrop.setImage({} as HTMLImageElement)
      backdrop.setImage({} as HTMLImageElement, () => 0.5)
      frames.flush()
      expect(canvas.style.opacity).toBe('')
      expect(renderer.draw.mock.lastCall![4]).toBe(0.5)
    })

    it('leaves the canvas showing if the renderer goes part way in', () => {
      backdrop.attach(canvas, renderer)
      backdrop.setImage({} as HTMLImageElement, () => 0.5)
      frames.flush()
      expect(canvas.style.opacity).toBe('0.5')
      backdrop.detach()
      expect(canvas.style.opacity).toBe('')
    })

    it('fades in again on a new renderer, which has nothing to crossfade from either', () => {
      backdrop.attach(canvas, renderer)
      backdrop.setImage({} as HTMLImageElement)
      backdrop.detach()
      backdrop.attach(canvas, renderer)
      backdrop.setImage({} as HTMLImageElement, () => 0.5)
      frames.flush()
      expect(canvas.style.opacity).toBe('0.5')
    })
  })

  describe('telling how a new image gets on', () => {
    const told = () => ({ onReady: vi.fn<() => void>(), onShown: vi.fn<() => void>() })

    it('says a scene is ready once its first frame is done, and shown once it has faded in', async () => {
      let settle!: () => void
      renderer.settled.mockReturnValue(new Promise((resolve) => (settle = resolve)))
      backdrop.attach(canvas, renderer)
      let progress = 0.5
      const arrival = told()
      backdrop.setImage({} as HTMLImageElement, () => progress, scene, arrival)
      frames.flush()
      expect(arrival.onReady).not.toHaveBeenCalled()

      settle()
      await promisesSettled()
      expect(arrival.onReady).toHaveBeenCalledOnce()
      frames.flush()
      expect(arrival.onShown).not.toHaveBeenCalled()

      progress = 1
      frames.flush()
      expect(arrival.onShown).toHaveBeenCalledOnce()
    })

    it('says a scene with no crossfade is shown as soon as it is ready', async () => {
      backdrop.attach(canvas, renderer)
      const arrival = told()
      backdrop.setImage({} as HTMLImageElement, undefined, scene, arrival)
      await promisesSettled()
      expect(arrival.onReady).toHaveBeenCalledOnce()
      expect(arrival.onShown).toHaveBeenCalledOnce()
    })

    it('says nothing of an image that another has replaced', async () => {
      backdrop.attach(canvas, renderer)
      const arrival = told()
      backdrop.setImage({} as HTMLImageElement, () => 1, scene, arrival)
      backdrop.setImage({} as HTMLImageElement, () => 1, scene, told())
      await promisesSettled()
      frames.flush()
      expect(arrival.onReady).not.toHaveBeenCalled()
      expect(arrival.onShown).not.toHaveBeenCalled()
    })

    it('leaves the colours to a scene that comes with no image', async () => {
      backdrop.attach(canvas, renderer)
      backdrop.setImage(null, undefined, scene)
      expect(renderer.setImage).toHaveBeenCalledWith(null, false, scene)
      expect(backdrop.pageImage).toBeNull()
    })

    it('says nothing once the renderer has gone', async () => {
      backdrop.attach(canvas, renderer)
      const arrival = told()
      backdrop.setImage({} as HTMLImageElement, () => 1, scene, arrival)
      backdrop.detach()
      await promisesSettled()
      expect(arrival.onReady).not.toHaveBeenCalled()
    })
  })

  describe('behind a see-through image', () => {
    afterEach(() => {
      canvas.parentElement!.style.backgroundColor = ''
    })

    it("is the backdrop's background colour", () => {
      canvas.parentElement!.style.backgroundColor = 'rgb(51, 102, 153)'
      backdrop.attach(canvas, renderer)
      backdrop.invalidate()
      frames.flush()
      expect(renderer.setMatte).toHaveBeenLastCalledWith(0.2, 0.4, 0.6)
    })

    it('is white where nothing has a colour', () => {
      backdrop.attach(canvas, renderer)
      backdrop.invalidate()
      frames.flush()
      expect(renderer.setMatte).toHaveBeenLastCalledWith(1, 1, 1)
    })

    it("isn't left unknown by the image the backdrop shows until it draws", () => {
      const holder = document.body.appendChild(document.createElement('div'))
      holder.append(canvas)
      holder.style.backgroundImage = 'url("/a.webp")'
      document.body.style.backgroundColor = 'rgb(51, 102, 153)'
      backdrop.attach(canvas, renderer)
      backdrop.invalidate()
      frames.flush()
      document.body.style.backgroundColor = ''
      expect(renderer.setMatte).toHaveBeenLastCalledWith(0.2, 0.4, 0.6)
    })

    it('is passed on before the first draw of a new image', () => {
      backdrop.attach(canvas, renderer)
      backdrop.setImage({} as HTMLImageElement)
      const [matte] = renderer.setMatte.mock.invocationCallOrder
      const [draw] = renderer.draw.mock.invocationCallOrder
      expect(matte).toBeLessThan(draw)
    })
  })

  it('redraws when the device pixel ratio changes, and stops listening once detached', () => {
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', () => ({
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
    backdrop.attach(canvas, renderer)
    frames.flush()
    const before = renderer.draw.mock.calls.length

    for (const listener of [...listeners]) listener()
    frames.flush()
    expect(renderer.draw.mock.calls.length).toBe(before + 1)

    backdrop.detach()
    expect(listeners.size).toBe(0)
  })

  it('redraws as the reader lets motion back, as a scene held still has stopped asking to', () => {
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      addEventListener: (_: string, listener: () => void) => query.includes('motion') && listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
    backdrop.attach(canvas, renderer)
    frames.flush()
    const before = renderer.draw.mock.calls.length

    for (const listener of [...listeners]) listener()
    frames.flush()
    expect(renderer.draw.mock.calls.length).toBe(before + 1)

    backdrop.detach()
    expect(listeners.size).toBe(0)
  })

  it('stops listening once detached', () => {
    backdrop.attach(canvas, renderer)
    const el = glass(0, 0)
    backdrop.track(el)
    backdrop.detach()

    expect(frames.pending).toBe(0)
    expect(resizes.observed).toBe(0)
    window.dispatchEvent(new Event('scroll'))
    backdrop.invalidate()
    expect(frames.pending).toBe(0)
  })

  it('picks up elements tracked before it was attached', () => {
    const el = glass(0, 0)
    backdrop.track(el)
    backdrop.attach(canvas, renderer)
    backdrop.invalidate()
    frames.flush()

    expect(lastLenses()).toHaveLength(1)
    expect(resizes.observed).toBe(2)
  })
})
