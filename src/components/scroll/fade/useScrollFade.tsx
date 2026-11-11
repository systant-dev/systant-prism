import { useContext, type ReactNode, type RefObject } from 'react'
import { BackdropContext } from '../../backdrop'
import { PrismStyles, SIDES, type Edges } from '../../../shared'
import { scrollFadeStyles } from './scrollFade.styles'
import { useScrollEdges } from './useScrollEdges'

export interface ScrollFade {
  /** Add to the scroller's className. */
  className: string | undefined
  /** Render anywhere: the stylesheet. */
  element: ReactNode
}

/** Writes how far each edge of `el` fades, for .prism-scroll-fade's mask. */
function writeFade(el: HTMLElement, fade: Edges) {
  for (const side of SIDES) el.style.setProperty(`--prism-scroll-fade-${side}`, `${fade[side]}px`)
}

/**
 * Fades the content of the scroller behind `ref` out over the last
 * --prism-scroll-fade-size (32px) before each edge it is cut off at, so it
 * dissolves into what is behind rather than ending in a hard line. An edge with
 * nothing beyond it doesn't fade, and one with only a little fades only that
 * far. Inside a GlassBackdrop, glass drawn behind the content fades with it.
 *
 * @example
 * const fade = useScrollFade(ref)
 * <div ref={ref} className={fade.className} style={{ overflow: 'auto' }}>
 *   …
 *   {fade.element}
 * </div>
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>, enabled = true): ScrollFade {
  const backdrop = useContext(BackdropContext)

  useScrollEdges(
    ref,
    (fade) => {
      if (ref.current) writeFade(ref.current, fade)
      // The backdrop measures the fade itself as it draws, but only redraws
      // unprompted on a scroll or resize, not on content growing past an edge.
      backdrop?.invalidate()
    },
    enabled,
  )

  return {
    className: enabled ? 'prism-scroll-fade' : undefined,
    element: enabled && <PrismStyles href="prism-scroll-fade" css={scrollFadeStyles} />,
  }
}
