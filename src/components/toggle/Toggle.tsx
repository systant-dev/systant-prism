import { useRef, useState, type ComponentProps } from 'react'
import { useBackdropLens } from '../backdrop'
import { usePress } from '../../effects/press'
import { useRim } from '../../effects/rim'
import { cx, motionStyles, PrismStyles, useControllable, useForwardedRef, useHold } from '../../shared'
import { toggleStyles } from './Toggle.styles'

export interface ToggleProps extends Omit<ComponentProps<'button'>, 'onChange' | 'children'> {
  /** Whether it is on. Leave it out for a toggle that keeps its own state, from `defaultChecked`. */
  checked?: boolean
  /** Whether it starts on, while `checked` is left out. */
  defaultChecked?: boolean
  /** Called with the new state when it is switched by click, tap or keyboard. */
  onChange?: (checked: boolean) => void
  /** Blur what is behind the track and knob and bend it at their edges. */
  refract?: boolean
}

// An on/off switch: a glass capsule, the track, edged with a button's rim, and
// a round, clear glass knob that slides to the far end when it is switched on,
// while a tint fills the track. Pressing it anywhere shrinks it a little and
// sinks the knob into the surface, as a button sinks, through the shared press
// (src/effects/press), and turns the rim's light (the shared rim,
// src/effects/rim) as a button's turns; the knob takes no pointer events, so
// the toggle holds both presses down itself (useHold), from the pointer and
// from the space bar, which switches it as it comes up. See Toggle.styles.ts
// for the track, the rim, the knob and the slide.
//
// It is a button with role="switch" and aria-checked, so a click, a tap, Enter
// or the space bar switches it, and it defaults to type="button", so it never
// submits a form. It has no label of its own: give it an aria-label, or put it
// in a <label> with the text, which switches it when clicked too. With
// `checked` it shows what it is given and asks for changes through
// `onChange`; without, it keeps its own state, starting from `defaultChecked`.
// An onClick that calls preventDefault stops the switch.
export function Toggle({
  checked,
  defaultChecked = false,
  onChange,
  refract = true,
  type = 'button',
  disabled,
  className,
  style,
  onClick,
  onPointerDown,
  onKeyDown,
  onKeyUp,
  onBlur,
  ref,
  ...rest
}: ToggleProps) {
  const innerRef = useForwardedRef(ref)
  const knobRef = useRef<HTMLSpanElement>(null)
  const [on, keep] = useControllable(checked, defaultChecked)
  const { held, hold } = useHold<true>()
  const [spaceHeld, setSpaceHeld] = useState(false)

  useBackdropLens(innerRef, refract)
  useBackdropLens(knobRef, refract)
  const pressed = !disabled && (held !== null || spaceHeld)
  // The track's press is only its className: it has no shadow, and the knob's
  // press element brings the press's stylesheet.
  const trackPress = usePress({ pressed })
  const knobPress = usePress({ pressed, tint: true })
  const rim = useRim({ turns: true })

  return (
    <>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href="prism-toggle" css={toggleStyles} />
      <button
        ref={innerRef}
        type={type}
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={cx('prism-toggle', trackPress.className, className)}
        style={style}
        {...rest}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          keep(!on)
          onChange?.(!on)
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event)
          if (event.button === 0) hold(true)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.key === ' ') setSpaceHeld(true)
        }}
        onKeyUp={(event) => {
          onKeyUp?.(event)
          if (event.key === ' ') setSpaceHeld(false)
        }}
        onBlur={(event) => {
          onBlur?.(event)
          setSpaceHeld(false)
        }}
      >
        <span className="prism-toggle__fill" aria-hidden="true" />
        {/* After the fill and the track's shading, under the knob */}
        {rim.element}
        <span ref={knobRef} className={cx('prism-toggle__knob', knobPress.className)} aria-hidden="true">
          {knobPress.element}
        </span>
      </button>
    </>
  )
}
