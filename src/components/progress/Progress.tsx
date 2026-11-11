import type { ComponentProps } from 'react'
import { useBackdropLens, useGlassText } from '../backdrop'
import { motionStyles, PrismStyles, useForwardedRef } from '../../shared'
import { progressStyles } from './Progress.styles'
import { Ring } from './Ring'

export interface ProgressProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Bend what is behind the ring, as thick glass does. */
  refract?: boolean
  /** Take the page's text colour inside a GlassBackdrop, and stay readable (WCAG AA) on an opaque background. */
  readableFill?: boolean
}

// A loading indicator: a hoop of clear glass with a soft patch of colour, an
// eighth of the way round and faded at its ends and edges, travelling round
// inside it. See Progress.styles.ts for the glass, the fill and the spin, which
// runs on the compositor, so nothing on the page can make it stutter and it
// costs the GlassBackdrop nothing.
//
// Its fill follows the page's glass, dark or light, as a card's text does
// (useGlassText): inside a GlassBackdrop it is the page's text colour, set as
// --_prism-progress-fill, which the styles prefer. Turn that off with
// `readableFill={false}` to give it a colour of its own, through
// --prism-progress-fill.
//
// It says what it is as an indeterminate progressbar, with no aria-valuenow,
// named "Loading" unless it is given a name of its own. Put aria-busy on what is
// loading, as that isn't this component's to reach.
export function Progress({
  refract = true,
  readableFill = true,
  'aria-label': ariaLabel = 'Loading',
  className,
  style,
  ref,
  ...rest
}: ProgressProps) {
  const innerRef = useForwardedRef(ref)
  useBackdropLens(innerRef, refract)
  const fill = useGlassText(
    innerRef,
    { property: '--prism-progress-fill', opacityProperty: '--prism-progress-fill-opacity' },
    readableFill,
  )

  return (
    <>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href="prism-progress" css={progressStyles} />
      <Ring ref={innerRef} aria-label={ariaLabel} fill={fill} className={className} style={style} {...rest} />
    </>
  )
}
