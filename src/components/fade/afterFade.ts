import { readCssTime, runningTransition } from '../../shared'

/** A computed `transition-duration`, in ms: the longest listed, or 0 where there is none to read. */
export function transitionMs(computed: CSSStyleDeclaration) {
  return Math.max(0, ...computed.transitionDuration.split(',').map(readCssTime))
}

/** When the last transition listed ends, in ms: its delay and duration, the longest of any. */
function transitionEndMs(computed: CSSStyleDeclaration) {
  // A shorter list of delays repeats, as CSS repeats it.
  const delays = (computed.transitionDelay ?? '').split(',').map(readCssTime)
  return Math.max(
    0,
    ...computed.transitionDuration.split(',').map((duration, i) => readCssTime(duration) + delays[i % delays.length]),
  )
}

/** Allowed past the transition's end before its end is taken as unheard. */
const GRACE_MS = 50

const OPACITY = new Set(['opacity'])

/**
 * Calls `done` once the opacity transition on `el` has ended, at most once,
 * unless the returned function is called first. With no transition to wait
 * for (a duration of 0) it calls `done` straight away.
 *
 * Where the transition can be found (the Web Animations API), it is waited
 * for to its end, cut short or not. It starts with the next frame, which can
 * come well after the style change that set it off: the frame after a page of
 * components mounts, say. Timed from now, a quick fade would be called over
 * before it had been seen. Where it can't be found, its end is listened for,
 * and should that go unheard (no transition ran: the opacity didn't change, or
 * the element isn't rendered), `done` is called anyway once its delay and
 * duration have passed.
 */
export function afterFade(el: HTMLElement, done: () => void): () => void {
  const computed = getComputedStyle(el)
  if (transitionMs(computed) <= 0) {
    done()
    return () => {}
  }

  const fade = runningTransition(el, OPACITY)
  if (fade) {
    let waiting = true
    const ended = () => {
      if (!waiting) return
      waiting = false
      done()
    }
    fade.finished.then(ended, ended)
    return () => {
      waiting = false
    }
  }

  function onEnd(event: TransitionEvent) {
    // Only the element's own: transitions inside it bubble up too.
    if (event.target === el && event.propertyName === 'opacity') finish()
  }
  function stop() {
    clearTimeout(timer)
    el.removeEventListener('transitionend', onEnd)
  }
  function finish() {
    stop()
    done()
  }

  el.addEventListener('transitionend', onEnd)
  const timer = setTimeout(finish, transitionEndMs(computed) + GRACE_MS)
  return stop
}
