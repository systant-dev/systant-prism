import { useEffect, type ReactNode, type RefObject } from 'react'
import { lightStyles, motionStyles, PrismStyles, trackLight } from '../../shared'
import { edgeLightStyles } from './edgeLight.styles'

export interface EdgeLight {
  /** Add to the element's className. */
  className: string | undefined
  /** Render inside the element, after its children: the stylesheets and the ring. */
  element: ReactNode
}

/**
 * Lights the edge of the element behind `ref` from the pointer, the way a card's
 * border is lit: the stretch of edge nearest the pointer brightens, even before
 * the pointer is over it. --prism-edge-light-color, --prism-edge-light-intensity
 * (0–1), --prism-edge-light-size (the light's radius) and
 * --prism-edge-light-width (the ring's width) tune it. The ring is an element of
 * its own, so the host's ::before and ::after stay free. While `following` is
 * false the ring stays lit as it was, not following the pointer: for a host
 * fading out, say.
 *
 * @example
 * const edge = useEdgeLight(ref)
 * <div ref={ref} className={edge.className}>
 *   …
 *   {edge.element}
 * </div>
 */
export function useEdgeLight(ref: RefObject<HTMLElement | null>, enabled = true, following = enabled): EdgeLight {
  // The light shows nowhere on the edge beyond its own radius, so it reaches no
  // further: a pointer further off never restyles or repaints the ring.
  useEffect(() => {
    if (enabled && following && ref.current) return trackLight(ref.current, '--prism-edge-light-size')
  }, [enabled, following, ref])

  return {
    className: enabled ? 'prism-edge-light' : undefined,
    element: enabled && (
      <>
        <PrismStyles href="prism-motion" css={motionStyles} />
        <PrismStyles href="prism-light" css={lightStyles} />
        <PrismStyles href="prism-edge-light" css={edgeLightStyles} />
        <span className="prism-edge-light__ring" aria-hidden="true" />
      </>
    ),
  }
}
