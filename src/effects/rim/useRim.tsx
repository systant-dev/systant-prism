import type { ReactNode } from 'react'
import { motionStyles, PrismStyles } from '../../shared'
import { rimStyles } from './rim.styles'

export interface RimOptions {
  /**
   * Turn its light round while its host is pressed, as a button's does. The
   * host must be a press (src/effects/press), for the timing.
   */
  turns?: boolean
}

export interface Rim {
  /** Render inside the element, after its content: the stylesheet and the rim. */
  element: ReactNode
}

/**
 * Edges an element with the button's rim: a ring --prism-button-rim-width wide,
 * lit by where it lies. Off a card it is raised, shaded on the diagonal from
 * above left by the --prism-button-rim-* tokens; on a card (or a popup), and
 * always on a toggle or a textbox, it is soft, with no dark, from the
 * --prism-toggle-rim-* tokens. The element must be positioned, and the rim takes
 * its corners. With `turns`, its light turns round while the element is pressed.
 *
 * @example
 * const rim = useRim({ turns: true })
 * const press = usePress()
 * <button className={press.className}>
 *   …
 *   {press.element}
 *   {rim.element}
 * </button>
 */
export function useRim({ turns = false }: RimOptions = {}): Rim {
  return {
    element: (
      <>
        <PrismStyles href="prism-motion" css={motionStyles} />
        <PrismStyles href="prism-rim" css={rimStyles} />
        <span className={turns ? 'prism-rim prism-rim--turns' : 'prism-rim'} aria-hidden="true" />
      </>
    ),
  }
}
