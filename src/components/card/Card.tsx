import type { ComponentProps } from 'react'
import { useBackdropLens, useGlassText } from '../backdrop'
import { useEdgeLight } from '../../effects/edgeLight'
import { useInnerSheen } from '../../effects/innerSheen'
import { cornerStyles, cssVars, cx, PrismStyles, useForwardedRef } from '../../shared'
import { cardStyles } from './Card.styles'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends ComponentProps<'div'> {
  padding?: CardPadding
  /** Light the border from the pointer position. */
  highlight?: boolean
  /** A sheen inside the edges nearest the pointer while it hovers the card. */
  innerSheen?: boolean
  /** Blur what is behind the card and bend it at the edges. */
  refract?: boolean
  /** Take the page's text colour inside a GlassBackdrop, and stay readable (WCAG AA) on an opaque background. */
  readableText?: boolean
}

// Cards are glass: a translucent surface that bends what is behind it at the
// edges, drawn on the GPU by the GlassBackdrop it is in. Outside one it is just
// its tint.
//
// Inside a GlassBackdrop its text is the page's one text colour, and its tint
// the page's one tint (useGlassText and pagePalette, src/components/backdrop).
// The text colour is set as --_prism-card-fg, which the styles prefer.
export function Card({
  padding = 'md',
  highlight = true,
  innerSheen = true,
  refract = true,
  readableText = true,
  className,
  style,
  children,
  ref,
  ...rest
}: CardProps) {
  const innerRef = useForwardedRef(ref)
  const edge = useEdgeLight(innerRef, highlight)
  const sheen = useInnerSheen(innerRef, innerSheen)
  useBackdropLens(innerRef, refract)
  const textColor = useGlassText(innerRef, { property: '--prism-card-fg' }, readableText)

  const classes = cx('prism-card', `prism-card--pad-${padding}`, edge.className, sheen.className, className)

  return (
    <>
      <PrismStyles href="prism-corners" css={cornerStyles} />
      <PrismStyles href="prism-card" css={cardStyles} />
      <div
        ref={innerRef}
        className={classes}
        style={{
          ...(textColor && cssVars({ '--_prism-card-fg': textColor })),
          ...style,
        }}
        {...rest}
      >
        {children}
        {/* After the content, so none of these becomes its :first-child */}
        <span className="prism-card__streaks" aria-hidden="true" />
        {sheen.element}
        {edge.element}
      </div>
    </>
  )
}
