import type { ComponentProps } from 'react'
import { useBackdropLens, useGlassText } from '../backdrop'
import { useGlare } from '../../effects/glare'
import { usePress } from '../../effects/press'
import { useRim } from '../../effects/rim'
import { cornerStyles, cssVars, cx, PrismStyles, useForwardedRef } from '../../shared'
import { buttonStyles } from './styles/Button.styles'

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ComponentProps<'button'> {
  /** 'secondary' is clearer glass, for an action beside the main one. */
  variant?: ButtonVariant
  /** Blur what is behind the button. */
  blur?: boolean
  /** A soft glare that follows the pointer across the button while it hovers. */
  glare?: boolean
  /** Take the page's text colour inside a GlassBackdrop, and stay readable (WCAG AA) on an opaque background. */
  readableText?: boolean
}

// A smoky glass button with the same corners as a Card. It blurs what is behind
// it without bending it, on the GPU inside a GlassBackdrop, through the same
// lens as a card at zero strength.
// Only the glare (src/effects/glare) follows the pointer: a light across the
// glass while the pointer is over it, repainting only its own element, and off
// while the button is disabled. Nothing about the pointer touches the rim. It
// defaults to type="button", so it never submits a form unless asked to. A
// secondary button is the same glass, clearer (see styles/secondary.styles.ts).
// Inside a GlassBackdrop its label and tint are the page's, as a card's are (see
// ../card/Card.tsx), so it takes its smoke from the page: on a pale page it is
// pale glass. Elsewhere its label keeps --prism-button-fg.
export function Button({
  variant = 'primary',
  type = 'button',
  blur = true,
  glare = true,
  readableText = true,
  className,
  style,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const innerRef = useForwardedRef(ref)
  useBackdropLens(innerRef, blur)
  const pointerGlare = useGlare(innerRef, glare && !rest.disabled)
  const press = usePress()
  const rim = useRim({ turns: true })
  const textColor = useGlassText(innerRef, { property: '--prism-button-fg' }, readableText)

  const classes = cx('prism-button', `prism-button--${variant}`, press.className, pointerGlare.className, className)

  // The drop shadows (the press's), the state tint and the rim (the shared rim,
  // src/effects/rim) are drawn by spans of their own, so hovering and pressing
  // fade the shadows and the tint and turn the rim's shading without repainting
  // any of them (see styles/Button.styles.ts).
  return (
    <>
      <PrismStyles href="prism-corners" css={cornerStyles} />
      <PrismStyles href="prism-button" css={buttonStyles} />
      <button
        ref={innerRef}
        type={type}
        className={classes}
        style={{
          ...(textColor && cssVars({ '--_prism-button-fg': textColor })),
          ...style,
        }}
        {...rest}
      >
        {children}
        {/* After the label, so none becomes its :first-child; z-index sets the painting order. */}
        {press.element}
        <span className="prism-button__tint" aria-hidden="true" />
        {pointerGlare.element}
        {rim.element}
      </button>
    </>
  )
}
