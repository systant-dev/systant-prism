// Keeps a renderer drawing glass behind every tracked element, each read from its
// computed style. It redraws, at most once a frame, only when an element may have
// moved or changed: a scroll, a resize, a re-render, or the element moving from
// where it was last drawn (watchMove). Pointer effects never touch it.
//
// Some things move an element every frame with nothing to hear: its own transform,
// scale, translate or rotate transition (a button's press), something said to be
// `moving` (a dragged card), an opacity transition over glass (a Fade), a bend still
// fading in (bendShown, src/shared/lens.ts). While any of those runs it redraws every
// frame, re-measuring only the glass concerned, as watching would only catch each move
// a frame late, and draws once more where it came to rest. An end that goes unheard is
// caught by checking the element's animations. Glass `lifted` as it moves is drawn
// over the rest.
//
// Glass fades out with any scroller's fade (src/components/scroll), and with the
// opacity of its element and every ancestor. A new image crossfades in, every frame,
// until the caller's progress reaches 1; for a scene, that waits for its first frame
// to be done on the GPU, which can take a while. With nothing drawn to crossfade from,
// the canvas itself fades in. The canvas is opaque, over the colour behind the
// backdrop, or white.
//
// Glass is drawn in document order, so glass nested in glass (a button on a card) lies
// over it. React tracks children first, and keyed elements move, so the tracked are
// sorted after anything that could change that; a scroll can't. Glass over the page (a
// popup's, in the top layer) goes onto a canvas of its own, unclipped, as its canvas
// fades with it.
import { backgroundBehind, over, parseColor, toCss, type PageImage, type Rgba } from '../../contrast'
import {
  bendShown,
  bezelWidth,
  clamp,
  cornerRadius,
  frostBlur,
  holeRadius,
  isSquircle,
  knowsTransitions,
  readCssNumber,
  reducedMotionQuery,
  refractionStrength,
  runningTransition,
  scrollFade,
  softEdge,
} from '../../shared'
import { watchOpacityFades } from './opacityFades'
import type { BackdropScene, LensDraw, OverlayDraw, Renderer, SceneFactory } from './gpu/renderer'
import { pageImage as pageImageOf, samplePageImage } from './sampler'
import { watchMove } from './watchMove'
import { watchPixelRatio } from './watchPixelRatio'

export interface Backdrop {
  /** Draws glass behind the element until the returned function is called. */
  track(el: HTMLElement): () => void
  /** Redraws on the next frame, re-reading every element's position and CSS. */
  invalidate(): void
  /**
   * Redraws every frame, re-measuring only the glass that is or is inside
   * `el`, until the returned function is called, for an element moved in a
   * way the backdrop can't hear: by hand, or as the ancestor of moving glass.
   * With `lifted`, its glass is drawn over all the rest until then, as it lies
   * over them on the page whatever its place in the document.
   */
  moving(el: Element, options?: { lifted?: boolean }): () => void
}

/** Glass that lies over the page, where a canvas under it can't reach. */
export interface OverlayBackdrop {
  /**
   * Draws glass for `el`, over the page in the top layer, onto `canvas`, a
   * canvas as big as `el`, until the returned function is called.
   */
  trackOverlay(el: HTMLElement, canvas: HTMLCanvasElement): () => void
  /** Redraws on the next frame, re-reading every element's position and CSS. */
  invalidate(): void
}

/** Where a new image has got to. Neither is called if another image comes first, or the renderer goes. */
export interface ImageArrival {
  /** It is on the GPU and drawn, and starts to show. */
  onReady(): void
  /** It is all that shows, any crossfade over. */
  onShown(): void
}

export interface BackdropController extends Backdrop, OverlayBackdrop {
  /** Whether a renderer is drawing. */
  readonly attached: boolean
  /** What the page's colours are chosen from in the image; null until it is set, or if its pixels can't be read. */
  readonly pageImage: PageImage | null
  attach(canvas: HTMLCanvasElement, renderer: Renderer): void
  detach(): void
  /** Sets a scene up on the renderer's device, for `setImage`, unless `signal` gives up on it. */
  prepareScene(factory: SceneFactory, signal?: AbortSignal): Promise<BackdropScene>
  /** What the page's colours are chosen from in the scene as it is now; null without one. */
  readScene(): Promise<PageImage | null>
  /** What the page's colours are chosen from in an image, without drawing it. */
  sampleImage(image: HTMLImageElement): PageImage | null
  /**
   * How a scene is held from now on, on this renderer and any after it: `still` or
   * moving, or as prefers-reduced-motion has it if undefined, and at `time`, or by its
   * own time if undefined. It is drawn at `time` straight away, for `readScene` to
   * read, and eases to a stop or back up to speed from there, which keeps it drawing.
   */
  holdScene(still: boolean | undefined, time: Date | undefined): void
  /** Whether it rains in a scene, on this renderer and any after it. */
  setRain(rain: boolean): void
  /**
   * Draws the new image straight away, so it is on screen before anything
   * shows the canvas. With `progress`, it crossfades in over the old one,
   * redrawn every frame by how far `progress` says it has come, 0–1, until 1,
   * or the canvas fades in by that, if this is the first image it has had.
   * With `scene`, that is drawn in its place, and `image` only says what the
   * page's colours are chosen from, so it can be null, leaving them to be read from
   * the scene; `progress` isn't read until its first frame is done. `arrival` hears
   * how that goes.
   */
  setImage(image: HTMLImageElement | null, progress?: () => number, scene?: BackdropScene, arrival?: ImageArrival): void
}

type Box = [number, number, number, number]

interface Layer {
  el: Element
  /** Live: always the element's current computed style. */
  computed: CSSStyleDeclaration
}

interface Tracked {
  /** Live: always the element's current computed style. */
  computed: CSSStyleDeclaration
  /** The element and each of its ancestors, nearest first: their opacities fade its glass, and they may clip it. */
  layers: Layer[]
  /** The box and viewport it was last drawn in and is watched for moving from; null once it has moved. */
  watched: string | null
  stopWatching: () => void
  /** How many transform-like transitions are running on it. */
  transitions: number
  /** The lens it was last drawn with; null when it wasn't drawn (no size, or clipped out of view). */
  lens: LensDraw | null
  /** Whether its bend was still fading in when last drawn. */
  bending: boolean
  /** Where its glass goes, if it lies over the page rather than on the canvas under it. */
  overlay: HTMLCanvasElement | null
}

/** Transitions that move or resize an element's box without a layout change. */
const MOVING = new Set(['transform', 'scale', 'translate', 'rotate'])

/** Whether a transform-like transition is still running on the element itself; true where that can't be known. */
function stillMoving(el: Element) {
  return !knowsTransitions(el) || runningTransition(el, MOVING) !== undefined
}

const CLEAR: Rgba = { r: 0, g: 0, b: 0, alpha: 0 }
const WHITE: Rgba = { r: 255, g: 255, b: 255, alpha: 1 }

/**
 * The colour behind the image of a backdrop on `el`. Its own background image
 * passes unseen: that is only the image, standing in for the canvas until it draws.
 */
function colorBehindImage(el: Element) {
  const own = parseColor(getComputedStyle(el).backgroundColor || 'transparent') ?? CLEAR
  return over(over(own, el.parentElement ? backgroundBehind(el.parentElement) : CLEAR), WHITE)
}

/** The element and each of its ancestors. */
function layersOf(el: HTMLElement) {
  const layers: Layer[] = []
  for (let a: Element | null = el; a; a = a.parentElement) layers.push({ el: a, computed: getComputedStyle(a) })
  return layers
}

/**
 * What one draw has read of the elements' ancestors, which glass inside the same ones
 * (a grid of cards) shares: nothing moves while a draw measures.
 */
interface Measured {
  /** Each element's opacity on screen. */
  opacities: Map<Element, number>
  /** Each ancestor's clip, relative to the view; null for one that doesn't clip. */
  clippers: Map<Element, Clipper | null>
}

/** A clipping ancestor's padding box, relative to the view, and how far its content fades in from each side. */
interface Clipper {
  sides: Box
  fades: Box
}

/** How opaque the element is on screen: its opacity and every ancestor's, multiplied. */
function opacityOf(layers: Layer[], { opacities }: Measured) {
  // From the nearest ancestor already read, or the root, inwards.
  let i = layers.findIndex(({ el }) => opacities.has(el))
  if (i < 0) i = layers.length
  let opacity = i < layers.length ? opacities.get(layers[i].el)! : 1
  while (i-- > 0) {
    opacity *= readCssNumber(layers[i].computed, 'opacity', 1)
    opacities.set(layers[i].el, opacity)
  }
  return opacity
}

/**
 * Calls `onChange` as the reader's prefers-reduced-motion changes, until the returned
 * function is called: a scene that held still has to be started again, as nothing else will.
 */
function watchReducedMotion(onChange: () => void) {
  const motion = reducedMotionQuery()
  motion?.addEventListener?.('change', onChange)
  return () => motion?.removeEventListener?.('change', onChange)
}

function unwatch(t: Tracked) {
  t.stopWatching()
  t.stopWatching = () => {}
  t.watched = null
}

/** Whether an ancestor among `layers` clips what is inside it, as it may only some of the time (a maximised card's body). */
function clips({ el, computed }: Layer) {
  if (el === document.body || el === document.documentElement) return false
  return computed.overflowX !== 'visible' || computed.overflowY !== 'visible'
}

function clipperOf(layer: Layer, view: DOMRect): Clipper | null {
  if (!clips(layer)) return null
  const c = layer.el as HTMLElement
  const r = c.getBoundingClientRect()
  // The padding box: content scrolls under the border, not over it.
  const left = r.left + c.clientLeft - view.left
  const top = r.top + c.clientTop - view.top
  const fade = scrollFade(c, layer.computed)
  return {
    sides: [left, top, left + c.clientWidth, top + c.clientHeight],
    fades: [fade.left, fade.top, fade.right, fade.bottom],
  }
}

/**
 * The part of the viewport the element's ancestors let through, relative to
 * `view`, and how far in from each of its sides the glass fades: as far as the
 * clipper that sets that side fades its content there, the nearest where two
 * coincide.
 */
function clipBox(layers: Layer[], view: DOMRect, { clippers }: Measured): { clip: Box; feather: Box } {
  const clip: Box = [0, 0, view.width, view.height]
  const feather: Box = [0, 0, 0, 0]
  // Outermost first, so a nearer clipper takes a side it shares; the element itself is layer 0.
  for (let i = layers.length - 1; i > 0; i--) {
    let clipper = clippers.get(layers[i].el)
    if (clipper === undefined) clippers.set(layers[i].el, (clipper = clipperOf(layers[i], view)))
    if (!clipper) continue
    const { sides, fades } = clipper
    for (let s = 0; s < 4; s++) {
      if (s < 2 ? sides[s] >= clip[s] : sides[s] <= clip[s]) {
        clip[s] = sides[s]
        feather[s] = fades[s]
      }
    }
  }
  return { clip, feather }
}

export function createBackdrop(): BackdropController {
  const tracked = new Map<HTMLElement, Tracked>()
  let canvas: HTMLCanvasElement | null = null
  let renderer: Renderer | null = null
  let frame = 0
  // Transform-like transitions running on tracked elements, summed.
  let transitions = 0
  // What has been said to move, each with how many times over.
  const moved = new Map<Element, number>()
  // What of that lies over the rest, each with how many times over.
  const lifted = new Map<Element, number>()
  // Opacity transitions anywhere, as glass inside an element fades with it.
  // Only one with glass inside asks for a draw.
  const fades = watchOpacityFades(
    (el) => {
      if (holdsGlass(el)) schedule()
    },
    // One last draw where it came to rest.
    (el) => {
      if (holdsGlass(el)) invalidate()
    },
  )
  // How far a new image has crossfaded in, while it does.
  let crossfade: (() => number) | null = null
  // Who is waiting to hear how the latest image gets on.
  let arriving: ImageArrival | null = null
  // Whether the canvas has yet to be given an image, and whether its first is fading in.
  let empty = true
  let fromNothing = false
  // What the page's colours are chosen from in the image.
  let pageImage: PageImage | null = null
  // How a scene is held, which a new renderer has to be told.
  let held: [still: boolean | undefined, time: Date | undefined] = [undefined, undefined]
  let raining = false
  // Whether the next draw re-measures every element, not just those in motion.
  let measureAll = true
  // Whether anything since the last draw could have changed the order of the glass.
  let reorder = true
  let stopWatchingPixelRatio = () => {}
  let stopWatchingMotion = () => {}
  // The canvas's box at the last draw; the reused lenses are relative to it.
  let lastView = ''
  // Whether a scroll or resize came since the last draw. While they keep
  // coming, every frame re-measures everything anyway, and watching each
  // element from where it was drawn would make an observer per element per
  // frame; so nothing is watched until a draw after the last of them.
  let scrolled = false
  const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => invalidate())

  // Scrolls and resizes are heard directly; anything else that moves an element
  // (content above it growing, a font or image loading) is caught by watching it
  // from where it was drawn.
  function watch(el: HTMLElement, t: Tracked, r: DOMRect) {
    const root = document.documentElement
    const box = `${r.left} ${r.top} ${r.width} ${r.height} ${root.clientWidth} ${root.clientHeight}`
    if (t.watched === box) return
    t.stopWatching()
    t.watched = box
    t.stopWatching = watchMove(el, r, () => {
      t.watched = null
      invalidate()
    })
  }

  function lens(el: HTMLElement, r: DOMRect, t: Tracked, view: DOMRect, measured: Measured): LensDraw | null {
    const { computed, layers } = t
    const x = r.left - view.left
    const y = r.top - view.top
    // Most of a long list is off screen, so that is ruled out before its ancestors are read.
    if (!r.width || !r.height || x >= view.width || y >= view.height || x + r.width <= 0 || y + r.height <= 0)
      return null
    const { clip, feather } = clipBox(layers, view, measured)
    if (x >= clip[2] || y >= clip[3] || x + r.width <= clip[0] || y + r.height <= clip[1]) return null
    const opacity = opacityOf(layers, measured)
    if (opacity <= 0) return null
    const radius = cornerRadius(computed, r.width, r.height)
    const hole = holeRadius(computed)
    const shown = bendShown(el, computed)
    t.bending = shown < 1
    return {
      x,
      y,
      width: r.width,
      height: r.height,
      clip,
      feather,
      radius,
      squircle: isSquircle(computed),
      strength: refractionStrength(computed, r.width, r.height) * shown,
      bezel: bezelWidth(computed, radius, r.width, r.height, hole),
      hole,
      soft: softEdge(computed),
      blur: readCssNumber(computed, '--prism-refraction-blur', 0),
      frost: frostBlur(computed),
      opacity,
    }
  }

  function sortTracked() {
    const entries = [...tracked].sort(([a], [b]) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    tracked.clear()
    for (const [el, t] of entries) tracked.set(el, t)
  }

  /** Passes the colour behind the image to the renderer, and returns it. */
  function readMatte() {
    const matte = colorBehindImage(canvas!.parentElement!)
    renderer!.setMatte(matte.r / 255, matte.g / 255, matte.b / 255)
    return matte
  }

  function sampleImage(image: HTMLImageElement) {
    return samplePageImage(image, toCss(canvas && renderer ? readMatte() : WHITE))
  }

  function draw() {
    frame = 0
    if (!canvas || !renderer) return
    const view = canvas.getBoundingClientRect()
    const viewKey = `${view.left} ${view.top} ${view.width} ${view.height}`
    const all = measureAll || viewKey !== lastView
    measureAll = false
    lastView = viewKey
    if (reorder) sortTracked()
    reorder = false
    if (all) readMatte()
    const settled = !scrolled
    scrolled = false
    const fading = fades.running()
    const movers = [...moved.keys()]
    const lifting = [...lifted.keys()]
    // Whether any glass is inside a running fade, and so needs the next frame too.
    let fadingGlass = false
    // Whether any bend is still fading in.
    let bending = false
    const lenses: LensDraw[] = []
    const above: LensDraw[] = []
    const overlays: OverlayDraw[] = []
    const measured: Measured = { opacities: new Map(), clippers: new Map() }
    for (const [el, t] of tracked) {
      if (t.transitions && !stillMoving(el)) {
        transitions -= t.transitions
        t.transitions = 0
      }
      const inFade = fading.some((f) => f.contains(el))
      fadingGlass ||= inFade
      const inMove = movers.some((m) => m.contains(el))
      if (all || t.transitions || inFade || inMove || t.bending) {
        const r = el.getBoundingClientRect()
        if (t.transitions || inMove || !settled) unwatch(t)
        else watch(el, t, r)
        t.lens = lens(el, r, t, view, measured)
      }
      if (t.lens && t.overlay) overlays.push({ lens: t.lens, canvas: t.overlay })
      else if (t.lens) (lifting.some((l) => l.contains(el)) ? above : lenses).push(t.lens)
      bending ||= t.lens !== null && t.bending
    }
    lenses.push(...above)
    const mix = crossfade ? clamp(crossfade(), 0, 1) : 1
    const faded = crossfade !== null && mix >= 1
    if (fromNothing) canvas.style.opacity = faded ? '' : String(mix)
    if (faded) {
      crossfade = null
      fromNothing = false
    }
    const unfinished = renderer.draw(view.width, view.height, devicePixelRatio, lenses, mix, overlays)
    if (faded) arrived()
    // Once the scrolling stops, one more draw starts watching again.
    if (!settled) remeasure()
    else if (transitions || moved.size || fadingGlass || bending || crossfade || unfinished) schedule()
  }

  /** Says the latest image is all that shows, once. */
  function arrived() {
    arriving?.onShown()
    arriving = null
  }

  /** Leaves the canvas showing, if its first image is still fading in. */
  function endFadeFromNothing() {
    if (fromNothing) canvas!.style.opacity = ''
    fromNothing = false
  }

  function onScroll() {
    scrolled = true
    remeasure()
  }

  /** Whether `el` is or holds glass. */
  function holdsGlass(el: Element) {
    for (const g of tracked.keys()) if (el.contains(g)) return true
    return false
  }

  /** Draws on the next frame, re-measuring only the elements in motion. */
  function schedule() {
    if (renderer && !frame) frame = requestAnimationFrame(draw)
  }

  /** Draws on the next frame, re-measuring every element. */
  function remeasure() {
    measureAll = true
    schedule()
  }

  /** As `remeasure`, after what may also have changed the elements themselves, or their order. */
  function invalidate() {
    reorder = true
    remeasure()
  }

  function follow(el: HTMLElement, overlay: HTMLCanvasElement | null) {
    const t: Tracked = {
      computed: getComputedStyle(el),
      layers: overlay ? [] : layersOf(el),
      watched: null,
      stopWatching: () => {},
      transitions: 0,
      lens: null,
      bending: false,
      overlay,
    }

    // Only the element's own transitions: not its pseudo-elements', nor ones bubbling up from inside it.
    const moving = (event: TransitionEvent) =>
      event.target === el && !event.pseudoElement && MOVING.has(event.propertyName)
    function onRun(event: TransitionEvent) {
      if (!moving(event)) return
      t.transitions++
      transitions++
      invalidate()
    }
    function onEnd(event: TransitionEvent) {
      if (!moving(event) || !t.transitions) return
      t.transitions--
      transitions--
      // One last draw where it came to rest, which also starts watching it again.
      invalidate()
    }
    el.addEventListener('transitionrun', onRun)
    el.addEventListener('transitionend', onEnd)
    el.addEventListener('transitioncancel', onEnd)

    tracked.set(el, t)
    if (renderer) resizes?.observe(el)
    invalidate()
    return () => {
      el.removeEventListener('transitionrun', onRun)
      el.removeEventListener('transitionend', onEnd)
      el.removeEventListener('transitioncancel', onEnd)
      transitions -= t.transitions
      unwatch(t)
      tracked.delete(el)
      resizes?.unobserve(el)
      invalidate()
    }
  }

  return {
    get attached() {
      return renderer !== null
    },

    get pageImage() {
      return pageImage
    },

    attach(nextCanvas, nextRenderer) {
      canvas = nextCanvas
      renderer = nextRenderer
      renderer.holdScene(...held)
      renderer.setRain(raining)
      measureAll = true
      reorder = true
      resizes?.observe(canvas)
      for (const el of tracked.keys()) resizes?.observe(el)
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
      window.addEventListener('resize', onScroll, { passive: true })
      stopWatchingPixelRatio = watchPixelRatio(invalidate)
      stopWatchingMotion = watchReducedMotion(invalidate)
      fades.start()
    },

    detach() {
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      stopWatchingPixelRatio()
      stopWatchingMotion()
      scrolled = false
      fades.stop()
      crossfade = null
      arriving = null
      endFadeFromNothing()
      empty = true
      pageImage = null
      resizes?.disconnect()
      for (const t of tracked.values()) unwatch(t)
      cancelAnimationFrame(frame)
      frame = 0
      canvas = null
      renderer = null
    },

    prepareScene(factory, signal) {
      return renderer ? renderer.prepareScene(factory, signal) : Promise.reject(new Error('No renderer'))
    },

    async readScene() {
      const pixels = await renderer?.readScene()
      return pixels ? pageImageOf(pixels) : null
    },

    sampleImage,

    holdScene(still, time) {
      held = [still, time]
      if (!renderer) return
      renderer.holdScene(still, time)
      cancelAnimationFrame(frame)
      draw()
    },

    setRain(rain) {
      raining = rain
      if (!renderer) return
      renderer.setRain(rain)
      cancelAnimationFrame(frame)
      draw()
    },

    setImage(image, progress, scene, arrival) {
      renderer?.setImage(image, progress !== undefined, scene)
      // Colours are chosen for the new image from the start of a crossfade, as they end up over it.
      pageImage = image && sampleImage(image)
      let started = !scene
      crossfade = progress ? () => (started ? progress() : 0) : null
      arriving = arrival ?? null
      endFadeFromNothing()
      fromNothing = empty && progress !== undefined
      empty = false
      cancelAnimationFrame(frame)
      measureAll = true
      draw()
      const begin = () => {
        started = true
        if (!arrival || arriving !== arrival) return
        arrival.onReady()
        if (!progress) arrived()
      }
      if (started) begin()
      else void renderer?.settled().then(begin)
    },

    track(el) {
      return follow(el, null)
    },

    trackOverlay(el, target) {
      return follow(el, target)
    },

    invalidate,

    moving(el, options) {
      const counts = options?.lifted ? [moved, lifted] : [moved]
      for (const count of counts) count.set(el, (count.get(el) ?? 0) + 1)
      schedule()
      let stopped = false
      return () => {
        if (stopped) return
        stopped = true
        for (const count of counts) {
          const left = count.get(el)! - 1
          if (left) count.set(el, left)
          else count.delete(el)
        }
        // One last draw where it came to rest, which also starts watching it again.
        invalidate()
      }
    },
  }
}
