import type { ComponentProps } from 'react'
import { cssVars, cx } from '../../shared'

export interface RingProps extends ComponentProps<'div'> {
  /** The fill to take in place of its own (useGlassText), or null to leave it be. */
  fill: string | null
}

/**
 * The ring of a Progress and of a ProgressOverlay: an indeterminate progressbar, with the
 * patch of colour that travels round it and the hole through it (Progress.styles.ts).
 * Anything else, its glass say, goes after them.
 */
export function Ring({ fill, className, style, children, ...rest }: RingProps) {
  return (
    <div
      role="progressbar"
      className={cx('prism-progress', className)}
      style={{
        ...(fill && cssVars({ '--_prism-progress-fill': fill })),
        ...style,
      }}
      {...rest}
    >
      <span className="prism-progress__spin" aria-hidden="true" />
      <span className="prism-progress__hole" aria-hidden="true" />
      {children}
    </div>
  )
}
