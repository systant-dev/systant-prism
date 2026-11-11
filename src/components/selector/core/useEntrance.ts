import { useEffect, useState, type RefObject } from 'react'
import { runningTransition, useHydrated } from '../../../shared'

/** Where a selector's glass pill is in its entrance as the page first loads. */
export type Entrance = 'waiting' | 'appearing' | null

// Whether the page has settled since it loaded, after which a selector shows
// its pill straight away.
let settled = false

/** How long after the page starts loading a selector mounting counts as loading with it, in ms. */
const LOAD_WINDOW = 3000
/** Frames in a row no longer than STEADY_FRAME that count as the page having settled. */
const STEADY_FRAMES = 3
const STEADY_FRAME = 34
/** The longest the pill waits, in ms, however unsettled the page. */
const LONGEST_WAIT = 1500

const OPACITY = new Set(['opacity'])

// A page loaded by navigating to it, and only just: not one that has been up a while.
function pageLoading() {
  if (settled) return false
  const [navigation] = performance.getEntriesByType?.('navigation') ?? []
  return navigation !== undefined && performance.now() < LOAD_WINDOW
}

/**
 * Holds a selector's glass pill back as the page first loads, then fades it in.
 *
 * As a page loads, the first frames with glass on them can take hundreds of
 * ms: filters rasterised, shaders compiled, images decoded, a web font swapped
 * in. Inside a GlassBackdrop the pill has no glass until the backdrop's image
 * has loaded, so it would show, stall and turn to glass in front of the reader.
 * Instead, a selector mounting while the page loads waits with its glass pill hidden ('waiting') until the page
 * has settled: frames coming steadily, the fonts loaded, and any GlassBackdrop
 * around it drawing. It waits LONGEST_WAIT at most. Then the pill fades in
 * ('appearing'), on the timing its stylesheet gives that phase, and the
 * entrance is over (null) when that fade ends.
 *
 * Once one selector has seen the page settle, any mounting after shows its
 * pill straight away, as one does mounting into a page that loaded a while ago.
 * A selector with nothing selected as it mounts has no pill to hold back, and
 * one hydrating has none either: the server's HTML has shown it already.
 */
export function useEntrance(
  listRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  shown: boolean,
): Entrance {
  const hydrating = !useHydrated()
  const [entrance, setEntrance] = useState<Entrance>(() => (shown && !hydrating && pageLoading() ? 'waiting' : null))

  useEffect(() => {
    const list = listRef.current
    if (entrance !== 'waiting' || !list) return
    if (typeof requestAnimationFrame === 'undefined') {
      // oxlint-disable-next-line react/set-state-in-effect -- no frames to wait for
      setEntrance('appearing')
      return
    }
    let first: number | null = null
    let last: number | null = null
    let steady = 0
    let frame = requestAnimationFrame(function check(now) {
      first ??= now
      steady = last !== null && now - last <= STEADY_FRAME ? steady + 1 : 0
      last = now
      const backdrop = list.closest('.prism-backdrop')
      const ready =
        steady >= STEADY_FRAMES &&
        document.fonts?.status !== 'loading' &&
        (!backdrop || backdrop.classList.contains('prism-backdrop--drawing'))
      if (ready || now - first > LONGEST_WAIT) {
        settled = true
        setEntrance('appearing')
        return
      }
      frame = requestAnimationFrame(check)
    })
    return () => cancelAnimationFrame(frame)
  }, [entrance, listRef])

  // Over when the pill's fade ends, found as useLanding finds its glide.
  useEffect(() => {
    if (entrance !== 'appearing') return
    const pill = pillRef.current
    const fade = pill && runningTransition(pill, OPACITY)
    if (!fade) {
      setEntrance(null)
      return
    }
    let waiting = true
    const over = () => {
      if (waiting) setEntrance(null)
    }
    fade.finished.then(over, over)
    return () => {
      waiting = false
    }
  }, [entrance, pillRef])

  return entrance
}
