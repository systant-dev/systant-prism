import { knowsTransitions, runningTransition } from '../../shared'

const OPACITY = new Set(['opacity'])

export interface OpacityFades {
  /** The elements an opacity transition runs on now; one whose end went unheard is dropped. */
  running(): Element[]
  /** Starts listening, page-wide. */
  start(): void
  /** Stops listening and forgets every fade. */
  stop(): void
}

/** The element an event is an opacity transition of, or null: not a pseudo-element's, nor any other property's. */
function opacityTarget(event: TransitionEvent) {
  const target = event.target
  return event.propertyName === 'opacity' && !event.pseudoElement && target instanceof Element ? target : null
}

/**
 * Follows opacity transitions anywhere on the page, by the element they run
 * on, as glass inside an element fades with it. Every one is noted, as the
 * glass inside may not be tracked yet (content mounting as it fades in);
 * `onRun` hears each that starts and `onEnd` each element whose last one ends.
 */
export function watchOpacityFades(onRun: (el: Element) => void, onEnd: (el: Element) => void): OpacityFades {
  const fades = new Map<Element, number>()

  function onFadeRun(event: TransitionEvent) {
    const target = opacityTarget(event)
    if (!target) return
    fades.set(target, (fades.get(target) ?? 0) + 1)
    onRun(target)
  }

  function onFadeEnd(event: TransitionEvent) {
    const target = opacityTarget(event)
    const running = target && fades.get(target)
    if (!running) return
    if (running > 1) fades.set(target, running - 1)
    else fades.delete(target)
    onEnd(target)
  }

  return {
    running() {
      // Where it can't be known whether one is still running, it is taken to be.
      for (const el of fades.keys()) if (knowsTransitions(el) && !runningTransition(el, OPACITY)) fades.delete(el)
      return [...fades.keys()]
    },
    start() {
      window.addEventListener('transitionrun', onFadeRun, { capture: true })
      window.addEventListener('transitionend', onFadeEnd, { capture: true })
      window.addEventListener('transitioncancel', onFadeEnd, { capture: true })
    },
    stop() {
      window.removeEventListener('transitionrun', onFadeRun, { capture: true })
      window.removeEventListener('transitionend', onFadeEnd, { capture: true })
      window.removeEventListener('transitioncancel', onFadeEnd, { capture: true })
      fades.clear()
    },
  }
}
