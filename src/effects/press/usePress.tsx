import type { ReactNode } from 'react'
import { motionStyles, PrismStyles } from '../../shared'
import { pressStyles } from './press.styles'

export interface PressOptions {
  /** Press it whatever its own :active state, for an element pressed through another. */
  pressed?: boolean
  /** Darken the glass while pressed, with a layer of --prism-press-tint. */
  tint?: boolean
}

export interface Press {
  /** Add to the element's className. */
  className: string
  /** Render inside the element, after its children: the stylesheet, the shadow and the tint. */
  element: ReactNode
}

/**
 * Makes an element sink into the surface while pressed: it shrinks to
 * --prism-press-scale and its drop shadow (--prism-press-rest-shadow) gives
 * way to a closer one (--prism-press-pressed-shadow) with a soft halo all the
 * way round; with `tint`, its glass darkens too. It is pressed while :active,
 * unless disabled, or while `pressed`. Sinking in takes --prism-press-duration
 * and settling back --prism-release-duration, both easing out.
 *
 * A host with transitions of its own lists `pressTransition` among them, so
 * its shrink keeps the press's timing.
 *
 * @example
 * const press = usePress()
 * <button className={press.className}>
 *   …
 *   {press.element}
 * </button>
 */
export function usePress({ pressed = false, tint = false }: PressOptions = {}): Press {
  return {
    className: pressed ? 'prism-press prism-press--pressed' : 'prism-press',
    element: (
      <>
        <PrismStyles href="prism-motion" css={motionStyles} />
        <PrismStyles href="prism-press" css={pressStyles} />
        <span className="prism-press__shadow" aria-hidden="true" />
        {tint && <span className="prism-press__tint" aria-hidden="true" />}
      </>
    ),
  }
}
