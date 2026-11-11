import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from 'react'
import { watchTheme, type PageImage, type ReadablePage } from '../../contrast'
import { fadeStyles } from '../fade'
import { ProgressOverlay } from '../progress'
import { cx, motionStyles, PrismStyles } from '../../shared'
import { createBackdrop, type ImageArrival } from './backdrop'
import { backdropStyles } from './backdrop.styles'
import { BackdropContext, BackdropPaletteContext, OverlayBackdropContext } from './BackdropContext'
import { startCrossfade } from './crossfade'
import { createRenderer, type BackdropScene, type Renderer, type SceneFactory } from './gpu/renderer'
import { PAGE_TEXT, pagePalette, paletteStyle, samePalette } from './pagePalette'
import { createPictureLoader } from './pictureLoader'
import { refractionStyles } from './refraction.styles'
import { useSceneArrival } from './useSceneArrival'

/** The wait before the second try for a new device, in ms, doubling each time after it. */
const RETRY_SHORTEST = 500

/** The longest wait between tries for a new device, in ms. */
const RETRY_LONGEST = 30_000

/** How often the page's colours are chosen afresh from a scene, in ms. */
const SCENE_COLOURS_INTERVAL = 30_000

/** How long a renderer must last, in ms, for the next loss to count as a fresh start. */
const RENDERER_LASTED = 10_000

/** How long a scene can take to run on to the present once its time is let go of, in ms. */
const SCENE_CATCH_UP = 4500

/** How often whether it is night is asked afresh, in ms. */
const NIGHT_CHECK_INTERVAL = 60_000

/** Asks again every so often, as dusk can come with nothing else to re-render the page: no WebGPU, say. */
function everyNightCheck(onChange: () => void) {
  const timer = setInterval(onChange, NIGHT_CHECK_INTERVAL)
  return () => clearInterval(timer)
}

const NO_COLOURS = { palette: null, fades: false }

/** `image`, kept as the same object while it holds the same colours, as a page may give a new one each render. */
function useSameImage(image: PageImage | null) {
  const [kept, setKept] = useState(image)
  const same =
    kept === image ||
    (kept !== null &&
      image !== null &&
      kept.dominant === image.dominant &&
      kept.tones.every((tone, i) => tone === image.tones[i]) &&
      kept.range?.[0] === image.range?.[0] &&
      kept.range?.[1] === image.range?.[1])
  if (same) return kept
  setKept(image)
  return image
}

export interface GlassBackdropProps extends ComponentProps<'div'> {
  /**
   * The image, covering the viewport like `background: url(src) center / cover fixed`.
   * Cross-origin images need CORS headers. Left out, there is none: the page's own
   * background shows until a scene does, or a picture is given.
   */
  src?: string
  /**
   * Something to draw in place of the image, frame after frame, such as
   * `oceanScene` or `forestScene`. The first fades in over the page's own background,
   * and the image is what shows where it can't be drawn, so it should be a picture of
   * it. Everything inside waits for the first, and fades in once it has, and a ring shows
   * while any scene is on its way.
   * The page's colours are chosen from the scene itself, every so often, as it may
   * change. Hold on to the same function from render to render: a new one is a new scene.
   */
  scene?: SceneFactory
  /**
   * A picture of the scene by night, shown in place of `src` while the scene says it
   * is night. As with `src`, that is where it can't be drawn.
   */
  nightSrc?: string
  /**
   * Whether the page waits for a scene, under a ring. Set to false, nothing is hidden
   * and no ring shows: the page and the picture go straight on, and the scene crossfades
   * in under them when it is ready, for a page that shouldn't be kept waiting at all.
   */
  waitForScene?: boolean
  /** What assistive technology is told while the ring shows, in the page's own language. Default `Loading`. */
  loadingLabel?: string
  /**
   * Whether a scene holds still, as a single frame drawn afresh once a minute, or
   * moves. It eases to a stop or back up to speed as this changes, and with
   * prefers-reduced-motion goes straight there. Left out, it goes by that too.
   */
  still?: boolean
  /**
   * The moment a scene shows, in place of the time it goes by itself, for a time of
   * day set by hand. The scene and the page's colours follow it as it changes. Taken
   * away again, the scene runs on to its own time over a few seconds.
   */
  sceneTime?: Date
  /**
   * Whether it rains in a scene. It clouds over and sets in, or clears, over a few
   * seconds, and `oceanScene` and `forestScene` can both do it. A scene that can't, and
   * an image, take no notice of it.
   */
  rain?: boolean
  /**
   * What the page's colours are chosen from in `src`, worked out ahead by
   * `samplePicture` (`@systant/prism/server`) on a server or in a build. The colours
   * then go on as the page first renders in the browser, before anything is drawn, and
   * stay where nothing can be (no WebGPU, or a cross-origin image without CORS), rather
   * than waiting for the picture to be read on the GPU. A scene's own colours still take
   * over once it shows.
   */
  pageImage?: PageImage
  /** The same for `nightSrc`. */
  nightPageImage?: PageImage
  /**
   * Whether it is night in the scene as the page first renders, which only the
   * browser can know by itself. A server that can tell where its reader is
   * (`isNightAt` in `@systant/prism/server`) renders `nightSrc` from the start, rather
   * than the day's picture until the page has hydrated. The scene is asked from then on.
   */
  initialNight?: boolean
}

/**
 * A page background image that glass inside it refracts on the GPU, in every
 * browser with WebGPU. Cards (and elements using useBackdropLens) anywhere inside
 * draw their blur and edge bend from the image, and this is the only way to have
 * glass: outside a GlassBackdrop they are just their tint.
 *
 * Only the image is refracted: other content between it and a card shows
 * through the card unblurred. Without WebGPU, or until the image has loaded, the
 * image is a plain CSS background, with no glass on it, unless a scene is on its way.
 *
 * A new src crossfades in over the old image once it has loaded, glass and
 * all, over a Fade's background duration (--prism-fade-background-duration).
 *
 * Its image sets the colours of the whole page: one text colour, one tint for all
 * its glass and one highlight for selected text (see pagePalette.ts), chosen from
 * the theme's pair, --prism-backdrop-fg and -bg, and its opposite. They change
 * with the image and the theme, not with where a control lies on the image, and
 * fade from one set to the next over the same duration as a new image.
 *
 * A scene can take seconds to make, so a ring shows while one is on its way, and goes
 * last, quickly, once all else has finished. At the start everything inside is hidden:
 * once the scene is on the GPU it fades in over the blank page, and then all that is
 * inside fades in, quickly. From then on the page stays where it is, under the ring,
 * and a new scene crossfades in beneath it over the one before (useSceneArrival.ts).
 * A scene that can't be made, one that takes too long, a GPU that is lost and no WebGPU
 * all leave the page as it would be without one: a page is never kept from its reader
 * by what is only its background.
 */
export function GlassBackdrop({
  src,
  scene,
  nightSrc,
  waitForScene = true,
  loadingLabel,
  still,
  sceneTime,
  rain = false,
  pageImage,
  nightPageImage,
  initialNight = false,
  className,
  style,
  children,
  ...rest
}: GlassBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moment = sceneTime?.getTime()
  const [backdrop] = useState(createBackdrop)
  const [pictures] = useState(createPictureLoader)
  // Whether the canvas is showing the picture, and so cards can draw their glass on it.
  const [drawing, setDrawing] = useState(false)
  // What the page's colours are chosen from in the image the canvas is showing.
  const [sampled, setSampled] = useState<PageImage | null>(null)
  // The page's colours, and whether they replaced others and so fade in over them.
  const [{ palette, fades }, setColours] = useState<{ palette: ReadablePage | null; fades: boolean }>(NO_COLOURS)
  const offered = useMemo(() => palette && { ...palette, foreground: PAGE_TEXT }, [palette])
  // Whether it is night in the scene, which is only known in the browser, by the
  // reader's clock: the server's markup can't say unless it was told, and a page
  // hydrating from it catches up.
  const night = useSyncExternalStore(
    everyNightCheck,
    () => scene?.isNight?.(sceneTime) ?? false,
    () => initialNight,
  )
  const byNight = Boolean(night && nightSrc)
  // None where it has yet to be given one (a DynamicBackground, until its page has hydrated).
  const picture = (byNight ? nightSrc : src) || undefined
  // What the colours are chosen from in the picture, if it was worked out ahead.
  const known = useSameImage((byNight ? nightPageImage : pageImage) ?? null)
  const arrival = useSceneArrival(scene, waitForScene, canvasRef)
  const { waiting, dispatch, failed, landing } = arrival
  // Bumped when there is a new renderer, which needs the image.
  const [renderers, setRenderers] = useState(0)
  // The scene the canvas is showing, whose colours can change.
  const [sceneShown, setSceneShown] = useState<BackdropScene | null>(null)
  // What the canvas is drawing, which something new crossfades from; null when it isn't.
  const drawn = useRef<{ src: string | undefined; scene: SceneFactory | undefined } | null>(null)
  // Whether the scene was last read with its time set from outside.
  const timeWasSet = useRef(false)
  // Whether it was raining when the scene was last read.
  const rainWas = useRef(rain)
  // How many scenes are being made: one given up on may still be as the next begins,
  // and its end is not the end of that one's making.
  const scenesBeingMade = useRef(0)

  const stopDrawing = useEffectEvent(() => {
    drawn.current = null
    setDrawing(false)
    setSampled(null)
    setSceneShown(null)
  })

  // Puts up the picture, or `live`, a scene. However that ends it tells `told`, which
  // outlives whatever asked, as a scene that has gone up can go on crossfading in as
  // the page changes round it. It reads the page as it is by then, not as it was asked.
  const show = useEffectEvent((image: HTMLImageElement | null, live?: BackdropScene, told?: ImageArrival) => {
    const last = drawn.current
    const fade = last ? last.src !== picture || last.scene !== scene : told !== undefined
    try {
      const progress = (fade && startCrossfade(getComputedStyle(canvasRef.current!))) || undefined
      backdrop.setImage(image, progress, live, told)
      drawn.current = { src: picture, scene: live && scene }
      setDrawing(true)
      // A scene that follows another keeps the colours it had until it has been read: the image may be of another time of day.
      // A picture's, worked out ahead, are as good as what was read from it, and change nothing.
      setSampled((colours) => (live ? (colours ?? backdrop.pageImage ?? known) : (known ?? backdrop.pageImage)))
      setSceneShown(live ?? null)
    } catch {
      stopDrawing()
      told?.onShown()
    }
  })

  // The picture may be of use for the colours, but the scene needn't wait to find out.
  const showScene = useEffectEvent((live: BackdropScene) =>
    show(picture ? pictures.loaded(picture) : null, live, landing),
  )

  // The scene's code downloads while a device is got, ahead of it, rather than after.
  useEffect(() => {
    scene?.preload?.()
  }, [scene])

  // A device takes a moment to get, so the CSS background shows until one is
  // ready. A lost device (a GPU reset, say) goes back to it, and a new one is
  // asked for straight away, as nothing brings a lost device back. That may be
  // refused while the GPU restarts, or the new one go the same way, so it is
  // asked for again and again, less and less often, and at once when the page
  // comes back into view. No device at the very start means there is no WebGPU
  // here to wait for, so that is never asked for twice.
  useEffect(() => {
    const canvas = canvasRef.current!
    let renderer: Renderer | null = null
    let starting: AbortController | null = null
    // When `renderer` began, and how many tries since one last lasted.
    let began = 0
    let tries = 0
    let retry: ReturnType<typeof setTimeout> | undefined

    function start() {
      retry = undefined
      const { signal } = (starting = new AbortController())
      // One that throws is as good as none: the page is waiting to hear either way.
      createRenderer(canvas, { signal, onLost })
        .catch(() => null)
        .then((next) => {
          if (signal.aborted) next?.dispose()
          else if (next) {
            renderer = next
            began = performance.now()
            backdrop.attach(canvas, next)
            setRenderers((n) => n + 1)
          } else {
            dispatch({ type: 'gpuFailed' })
            if (tries) tryAgain()
          }
        })
    }

    function tryAgain() {
      const delay = tries && Math.min(RETRY_LONGEST, RETRY_SHORTEST * 2 ** (tries - 1))
      tries++
      if (delay) retry = setTimeout(start, delay)
      else start()
    }

    function stop() {
      clearTimeout(retry)
      retry = undefined
      starting?.abort()
      if (!renderer) return
      backdrop.detach()
      renderer.dispose()
      renderer = null
    }

    function onLost() {
      // One lost in making a scene hasn't lasted, however long that took: it would only go the same way.
      if (renderer && !scenesBeingMade.current && performance.now() - began >= RENDERER_LASTED) tries = 0
      stop()
      stopDrawing()
      dispatch({ type: 'gpuFailed' })
      tryAgain()
    }

    function onVisibilityChange() {
      if (retry === undefined || document.hidden) return
      clearTimeout(retry)
      start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stop()
    }
  }, [backdrop, dispatch])

  // The picture on the canvas. The previous image stays up while the next one loads,
  // then the next one crossfades in over it; the first, or the first on a new device,
  // goes straight on. One that fails, or can't be a texture (cross-origin without
  // CORS), shows as the CSS background. It is only wanted without a scene, or in place
  // of one that can't be made, or under one still on its way if the page is showing by
  // then. So it can change while a scene shows, day to night, with nothing else to do.
  useEffect(() => {
    const wanted = () => !scene || failed || (!drawn.current && !waiting)
    if (!backdrop.attached || !wanted()) return
    const told = failed ? landing : undefined
    const last = drawn.current
    if (last && !last.scene && last.src === picture) {
      told?.onShown()
      return
    }
    // No picture to put up: the page's own background stands in for it, as it does for one that fails.
    if (!picture) {
      if (last && !last.scene) stopDrawing()
      told?.onShown()
      return
    }
    let current = true
    pictures.load(picture).then(
      (image) => {
        if (current && backdrop.attached && wanted()) show(image, undefined, told)
      },
      () => {
        if (!current) return
        stopDrawing()
        told?.onShown()
      },
    )
    return () => {
      current = false
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `renderers` re-runs it to give a new renderer the image
  }, [backdrop, pictures, picture, scene, failed, waiting, landing, renderers])

  // The scene, made as soon as there is a renderer to make it on, and on its own: it
  // needs nothing of the picture, whose load can only be slower, or fail, or change at
  // dusk with the scene half made. It can take seconds, so a scene that follows another,
  // or the image, crossfades in over that, like any new image, once it is running, and
  // the first, with nothing to follow, fades in over the blank page. Being unable to
  // make it hands over to the effect above, which makes no more attempts of its own.
  useEffect(() => {
    if (!scene || failed || !backdrop.attached || drawn.current?.scene === scene) return
    let current = true
    const replaced = new AbortController()
    // The device may have been lost while it was being made.
    const stillWanted = () => current && backdrop.attached
    scenesBeingMade.current++
    backdrop
      .prepareScene(scene, replaced.signal)
      .then(
        (live) => {
          if (stillWanted()) showScene(live)
          else live.dispose()
        },
        () => {
          if (stillWanted()) dispatch({ type: 'failed', scene })
        },
      )
      .finally(() => scenesBeingMade.current--)
    return () => {
      current = false
      replaced.abort()
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `renderers` re-runs it to make it on a new renderer
  }, [backdrop, scene, failed, dispatch, renderers])

  // A scene's picture is loaded alongside it while the page shows, for its colours: it can
  // show with no renderer at all, and may be a dark one, so they can't wait for one as an
  // image's do. While the page waits for the scene it shows nothing, so nothing is loaded:
  // a scene that comes, as most do, needs no picture. One that doesn't stops the wait,
  // and the picture is loaded then.
  useEffect(() => {
    if (!scene || !picture || waiting || drawn.current?.scene === scene) return
    let current = true
    pictures.load(picture).then(
      (image) => {
        if (current && !drawing && !waiting) setSampled(backdrop.sampleImage(image))
      },
      () => {},
    )
    return () => {
      current = false
    }
  }, [backdrop, pictures, scene, picture, drawing, waiting])

  // Ahead of the colours, below, which read what this draws.
  useEffect(() => {
    backdrop.holdScene(still, moment === undefined ? undefined : new Date(moment))
  }, [backdrop, still, moment])

  useEffect(() => {
    backdrop.setRain(rain)
  }, [backdrop, rain])

  // A scene can go from day to night under the page, so its colours are read from
  // what it is showing. A still scene needs asking to draw the time as it is now.
  // A time being set is read as it changes. Let go of, the scene is still only
  // setting off for the present, so it is read again once it should be there, and
  // the same goes for rain setting in or clearing.
  useEffect(() => {
    if (!sceneShown) return
    let current = true
    function read() {
      backdrop.readScene().then((next) => {
        if (current && next) setSampled(next)
      })
    }
    read()
    const timer = setInterval(() => {
      backdrop.invalidate()
      read()
    }, SCENE_COLOURS_INTERVAL)
    const letGo = timeWasSet.current && moment === undefined
    timeWasSet.current = moment !== undefined
    const weatherTurned = rainWas.current !== rain
    rainWas.current = rain
    const caughtUp = letGo || weatherTurned ? setTimeout(read, SCENE_CATCH_UP) : undefined
    return () => {
      current = false
      clearInterval(timer)
      clearTimeout(caughtUp)
    }
  }, [backdrop, sceneShown, moment, rain])

  // Until something is drawn the picture is the CSS background, and its colours are
  // those worked out ahead, if they were.
  const colourSource = drawing ? sampled : known

  // Read from the canvas, so the theme can be set on the backdrop or any ancestor.
  useLayoutEffect(() => {
    const canvas = canvasRef.current!
    const read = () => {
      const next = colourSource && pagePalette(getComputedStyle(canvas), colourSource)
      setColours((shown) =>
        samePalette(shown.palette, next) ? shown : { palette: next, fades: shown.palette !== null && next !== null },
      )
    }
    read()
    return watchTheme(canvas, () => {
      read()
      // The colour behind a see-through image may have changed with the theme.
      backdrop.invalidate()
    })
  }, [backdrop, colourSource])

  const classes = cx(
    'prism-backdrop',
    drawing && 'prism-backdrop--drawing',
    fades && 'prism-backdrop--colours-fade',
    waiting && 'prism-backdrop--waiting',
    arrival.sealed && 'prism-backdrop--sealed',
    arrival.arriving && 'prism-backdrop--arriving',
    className,
  )

  return (
    <BackdropContext value={drawing ? backdrop : null}>
      <OverlayBackdropContext value={drawing ? backdrop : null}>
        <BackdropPaletteContext value={offered}>
          <PrismStyles href="prism-backdrop" css={backdropStyles} />
          {/* Registers the refraction properties' defaults, which the backdrop reads. */}
          <PrismStyles href="prism-refraction" css={refractionStyles} />
          {/* The background fade's timing, which the crossfade reads and the colours take. */}
          <PrismStyles href="prism-fade" css={fadeStyles} />
          <PrismStyles href="prism-motion" css={motionStyles} />
          <div
            className={classes}
            style={{
              ...(drawing || waiting || !picture ? null : { backgroundImage: `url(${JSON.stringify(picture)})` }),
              ...(palette && paletteStyle(palette)),
              ...style,
            }}
            {...rest}
          >
            {children}
            <canvas ref={canvasRef} className="prism-backdrop__canvas" aria-hidden="true" />
            {scene && waitForScene && (
              // Its glass shows the whole of the scene, which would stand out from one still fading in.
              <BackdropPaletteContext value={arrival.unseen ? null : offered}>
                <ProgressOverlay
                  open={arrival.holding}
                  refract={!arrival.blank}
                  aria-label={loadingLabel}
                  className={cx('prism-backdrop__progress', arrival.clear && 'prism-backdrop__progress--clear')}
                />
              </BackdropPaletteContext>
            )}
          </div>
        </BackdropPaletteContext>
      </OverlayBackdropContext>
    </BackdropContext>
  )
}
