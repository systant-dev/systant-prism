import { useEffect, useLayoutEffect, useMemo, useReducer, useState, type RefObject } from 'react'
import { readCssTime, useHydrated, whenFramesStop } from '../../shared'
import type { ImageArrival } from './backdrop'
import type { SceneFactory } from './gpu/renderer'

/**
 * The longest the page waits for a scene to be up on the GPU, in ms. It is only the
 * background: past this the page goes on without it, and the scene comes in under the
 * page if it ever does. Once it is up there is no more to go wrong, and all its fade
 * needs is frames, however slowly they come.
 */
const LONGEST_WAIT = 10_000

/**
 * How long the page waits, once its scene is up, for a frame to fade it in by, in ms,
 * while the browser says the page is on show. A page in the background has no frames,
 * misses nothing by it, and sees the fade when it comes back. But a browser can draw
 * none for a page it says is visible (whenFramesStop), and that page would otherwise
 * keep what is inside hidden, from assistive technology and find in page as well, for
 * as long as that lasts. Past this it goes on, and the scene fades in under it once
 * frames come, as one that comes too late does.
 */
const LONGEST_WITHOUT_FRAMES = 1000

/**
 * How far a scene has come: on its way; up on the GPU and fading in over what was there;
 * the page fading in over that; or all there, with nothing left to do. It only ever
 * moves on, so a scene that turns up after the page has stopped waiting asks nothing of it.
 */
type Stage = 'coming' | 'fading' | 'page' | 'there'

interface State {
  /** The scene last heard of, which `stage` and `failed` are about. */
  scene: SceneFactory | undefined
  stage: Stage
  /** Whether it can't be made, so the picture stands in for it. */
  failed: boolean
  /** Whether this is still the first wait: nothing has shown yet. */
  first: boolean
  /** Whether the GPU has let the page down, after which it is no longer worth waiting for. */
  gpuFailed: boolean
}

export type ArrivalAction =
  { type: 'ready' | 'failed' | 'landed'; scene: SceneFactory } | { type: 'pageIn' | 'noScene' | 'gpuFailed' }

function about(state: State, scene: SceneFactory): State {
  return state.scene === scene ? state : { ...state, scene, stage: 'coming', failed: false }
}

function arrive(state: State, action: ArrivalAction): State {
  switch (action.type) {
    case 'ready': {
      const now = about(state, action.scene)
      return now.stage === 'coming' ? { ...now, stage: 'fading' } : now
    }
    case 'failed':
      return { ...about(state, action.scene), failed: true }
    case 'landed': {
      const now = about(state, action.scene)
      if (now.stage === 'page' || now.stage === 'there') return now
      return { ...now, stage: now.first ? 'page' : 'there', first: false }
    }
    case 'pageIn':
      return state.stage === 'page' ? { ...state, stage: 'there' } : state
    case 'noScene':
      return state.scene === undefined && !state.first
        ? state
        : { ...state, scene: undefined, stage: 'coming', failed: false, first: false }
    case 'gpuFailed':
      return { ...state, gpuFailed: true, failed: false, first: false }
  }
}

/**
 * The page's wait for a scene, from the ring coming up to the ring going, which it does
 * last, once all else has finished. Only the first wait hides the page: everything inside
 * is held back, on a blank background, until the scene has faded in, and then fades in
 * itself. After that the page stays on show, under the ring, while a new scene comes.
 */
export function useSceneArrival(
  scene: SceneFactory | undefined,
  wait: boolean,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const [state, dispatch] = useReducer(arrive, {
    scene: undefined,
    stage: 'coming',
    failed: false,
    first: scene !== undefined && wait,
    gpuFailed: false,
  })
  // Only in the browser: the server's markup is all there is for whoever runs no script.
  const hydrated = useHydrated()
  // Once what is inside has mounted, after which it can be taken out of reach.
  const [mounted, setMounted] = useState(false)

  const stage = state.scene === scene ? state.stage : 'coming'
  // The dialog couldn't go any sooner anyway: it would find what had the focus still
  // hidden, and be unable to give it back.
  const holding = hydrated && wait && scene !== undefined && !state.gpuFailed && stage !== 'there'
  // The first scene fades in from the page's own background, with nothing there before it.
  const blank = (state.first || stage === 'page') && holding
  const waiting = blank && stage !== 'page'

  // What the page's children and a dialog do as they mount, a child's autoFocus and the
  // dialog taking note of it, they can't do in something visibility has hidden. Parents'
  // layout effects run last, so this is after all of that, and before anything is painted.
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- only ever once, and before the first paint
    setMounted(true)
  }, [])

  // A scene that comes back is a new one, and comes to a page that is on show by then.
  useEffect(() => {
    if (!scene) dispatch({ type: 'noScene' })
  }, [scene])

  useEffect(() => {
    if (!holding || stage !== 'coming') return
    const timer = setTimeout(() => dispatch({ type: 'landed', scene: scene! }), LONGEST_WAIT)
    return () => clearTimeout(timer)
  }, [holding, stage, scene])

  useEffect(() => {
    if (!holding || stage !== 'fading') return
    return whenFramesStop(LONGEST_WITHOUT_FRAMES, () => dispatch({ type: 'landed', scene: scene! }))
  }, [holding, stage, scene])

  // The page's fade in is on its children, in place of their own transitions, so it
  // stays no longer than it takes.
  useEffect(() => {
    if (stage !== 'page') return
    const duration = getComputedStyle(canvasRef.current!).getPropertyValue('--prism-backdrop-page-in-duration')
    const timer = setTimeout(() => dispatch({ type: 'pageIn' }), readCssTime(duration))
    return () => clearTimeout(timer)
  }, [stage, canvasRef])

  const landing = useMemo<ImageArrival | undefined>(
    () =>
      scene && {
        onReady: () => dispatch({ type: 'ready', scene }),
        onShown: () => dispatch({ type: 'landed', scene }),
      },
    [scene],
  )

  return {
    dispatch,
    /** Tells the backdrop how to report on the scene as it goes up, or on what stands in for it. */
    landing,
    /** Whether the scene can't be made, so that the picture stands in for it. */
    failed: state.scene === scene && state.failed,
    /** Whether the ring shows. */
    holding,
    /** Whether the ring is on the page's own blank background, with no picture and no glass. */
    blank,
    /** Whether what is inside is hidden. */
    waiting,
    /** Whether it is out of reach as well, which can only be once it has all mounted. */
    sealed: waiting && mounted,
    /** Whether it is fading in. */
    arriving: stage === 'page',
    /** Whether nothing has shown yet, so that the picture's colours mean nothing. */
    unseen: blank && stage === 'coming',
    /** Whether the ring is to have no dim, its glass aside: there is none to have, or it is lifting. */
    clear: blank || stage !== 'coming',
  }
}
