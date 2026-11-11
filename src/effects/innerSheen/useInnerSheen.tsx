import { useEffect, type ReactNode, type RefObject } from 'react'
import { glideAfterPointer, motionStyles, PrismStyles } from '../../shared'
import { innerSheenStyles } from './innerSheen.styles'

/** How quickly the sheen closes on the pointer: about 95% of the way in 3× this. */
const GLIDE_MS = 45

/**
 * Which ends of an axis to light, as '0'/'1' for the start and end, for a
 * pointer at `offset` along a box of `size`. Within half a pixel of the centre
 * counts as the centre, so it can be hit on boxes of any size, and lights both.
 */
function halves(offset: number, size: number): ['0' | '1', '0' | '1'] {
  const fromCentre = offset - size / 2
  return [fromCentre <= 0.5 ? '1' : '0', fromCentre >= -0.5 ? '1' : '0']
}

export interface InnerSheen {
  /** Add to the element's className. */
  className: string | undefined
  /** Render inside the element: the stylesheet. */
  element: ReactNode
}

/**
 * Gives the element behind `ref` a soft sheen along the inside of its border
 * while the pointer hovers it: on the left or right edge, whichever half the
 * pointer is in, and on the top or bottom edge likewise. On a centre line both
 * of that axis's edges light. Along each lit edge it is brightest level with the
 * pointer. --prism-inner-sheen-color, --prism-inner-sheen-intensity (0–1),
 * --prism-inner-sheen-size (how far along the edge it reaches) and
 * --prism-inner-sheen-width (how far in from the edge) tune it. The sheen follows
 * the element's border-radius and corner-shape, and uses its ::after.
 *
 * @example
 * const sheen = useInnerSheen(ref)
 * <div ref={ref} className={sheen.className}>
 *   …
 *   {sheen.element}
 * </div>
 */
export function useInnerSheen(ref: RefObject<HTMLElement | null>, enabled = true): InnerSheen {
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return

    let lit = ''

    // The sheen is positioned against the padding box, so the host's border is
    // taken off. The lit edges follow the pointer itself rather than the glide,
    // and are written only when they change.
    return glideAfterPointer(
      el,
      { glideMs: GLIDE_MS },
      (pointer) => {
        // Every read before any write, so none forces a style recalculation.
        const rect = el.getBoundingClientRect()
        const at = { x: pointer.x - rect.left - el.clientLeft, y: pointer.y - rect.top - el.clientTop }
        const [left, right] = halves(pointer.x - rect.left, rect.width)
        const [top, bottom] = halves(pointer.y - rect.top, rect.height)
        const next = `${left}${right}${top}${bottom}`
        if (next !== lit) {
          lit = next
          el.style.setProperty('--prism-inner-sheen-left', left)
          el.style.setProperty('--prism-inner-sheen-right', right)
          el.style.setProperty('--prism-inner-sheen-top', top)
          el.style.setProperty('--prism-inner-sheen-bottom', bottom)
        }
        return at
      },
      (at) => {
        el.style.setProperty('--prism-inner-sheen-x', `${at.x}px`)
        el.style.setProperty('--prism-inner-sheen-y', `${at.y}px`)
      },
    )
  }, [enabled, ref])

  return {
    className: enabled ? 'prism-inner-sheen' : undefined,
    element: enabled && (
      <>
        <PrismStyles href="prism-motion" css={motionStyles} />
        <PrismStyles href="prism-inner-sheen" css={innerSheenStyles} />
      </>
    ),
  }
}
