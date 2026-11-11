import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { glideAfterPointer, localPoint, motionStyles, PrismStyles } from '../../shared'
import { glareStyles } from './glare.styles'

/** How quickly the glare closes on the pointer: about 95% of the way in 3× this. */
const GLIDE_MS = 70

export interface Glare {
  /** Add to the element's className. */
  className: string | undefined
  /** Render inside the element, after its children: the stylesheet and the light. */
  element: ReactNode
}

/**
 * Gives the element behind `ref` a soft glare that follows the pointer across
 * its surface while it hovers, gliding smoothly rather than jumping. It fades in
 * on hover and out on leave. --prism-glare-color, --prism-glare-intensity (0–1)
 * and --prism-glare-size (the light's radius) tune it. The light is an element
 * of its own, so the host's ::before and ::after stay free.
 *
 * @example
 * const glare = useGlare(ref)
 * <div ref={ref} className={glare.className}>
 *   …
 *   {glare.element}
 * </div>
 */
export function useGlare(ref: RefObject<HTMLElement | null>, enabled = true): Glare {
  const lightRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    const light = lightRef.current
    if (!enabled || !el || !light) return

    // A touch has no hover, so it never shows the glare and isn't followed.
    // The glare is drawn relative to the light, which fills the host's padding
    // box, in the host's own CSS pixels.
    return glideAfterPointer(
      el,
      { glideMs: GLIDE_MS, touch: false },
      (pointer) => localPoint(el, el.getBoundingClientRect(), pointer.x, pointer.y),
      (at) => {
        light.style.setProperty('--prism-glare-x', `${at.x}px`)
        light.style.setProperty('--prism-glare-y', `${at.y}px`)
      },
    )
  }, [enabled, ref])

  return {
    className: enabled ? 'prism-glare' : undefined,
    element: enabled && (
      <>
        <PrismStyles href="prism-motion" css={motionStyles} />
        <PrismStyles href="prism-glare" css={glareStyles} />
        <span ref={lightRef} className="prism-glare__light" aria-hidden="true" />
      </>
    ),
  }
}
