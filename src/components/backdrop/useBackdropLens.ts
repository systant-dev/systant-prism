import { useContext, useEffect, type RefObject } from 'react'
import { BackdropContext } from './BackdropContext'

/**
 * Has the nearest GlassBackdrop draw glass behind the element behind `ref`: the
 * backdrop blurred, bent at the element's edges and saturated.
 * --prism-refraction sets its strength as a percentage of the element's shorter
 * side (0% leaves just the blur), and --prism-refraction-blur the blur. The bend
 * fades in over --prism-refraction-fade when the glass first shows. The element
 * supplies its own translucent background.
 *
 * True while it does; false outside a GlassBackdrop, before its image has
 * loaded, or where it can't draw (no WebGPU), where the element has no glass,
 * only that background.
 *
 * @example
 * const lensed = useBackdropLens(ref)
 */
export function useBackdropLens(ref: RefObject<HTMLElement | null>, enabled = true): boolean {
  const backdrop = useContext(BackdropContext)
  const active = enabled && backdrop !== null

  useEffect(() => {
    const el = ref.current
    if (backdrop && enabled && el) return backdrop.track(el)
  }, [backdrop, enabled, ref])

  // CSS can change without a resize or scroll (a style prop, a class), so the
  // backdrop redraws after every render; it reads the CSS once per frame at most.
  useEffect(() => {
    if (enabled && backdrop) backdrop.invalidate()
  })

  return active
}
