import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useRim } from '../../effects/rim'
import { cx, motionStyles, PrismStyles } from '../../shared'
import { textFieldStyles } from './textField.styles'
import { TextFieldClear } from './TextFieldClear'

export interface TextFieldPillProps {
  /** What useTextField returned. */
  field: {
    fieldRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
    pillRef: RefObject<HTMLSpanElement | null>
    colorStyle: CSSProperties
    disabled: boolean | undefined
    canClear: boolean
    clear(): void
  }
  /** Accessible name of the clear button. */
  clearLabel: string
  /** Take a press on the field from the browser until it is focused, for it to keep what it selects on focus. */
  takesFirstPress?: boolean
  /** What else lies in the pill, after the clear button. */
  after?: ReactNode
  className?: string
  style?: CSSProperties
  /** The field. */
  children: ReactNode
}

/**
 * The pill round a Textbox's or a Textarea's field: the field, the separator, the
 * clear button and the shared rim (src/effects/rim). See textField.styles.ts.
 *
 * A press anywhere else in it focuses the field in place of the browser and leaves
 * it there rather than taking the focus away, so the edge doesn't flicker as the
 * clear button is clicked. That doesn't scroll: the press may be on a textarea's
 * scrollbar, and focusing would pull it back to the caret.
 */
export function TextFieldPill({
  field: { fieldRef, pillRef, colorStyle, disabled, canClear, clear },
  clearLabel,
  takesFirstPress = false,
  after,
  className,
  style,
  children,
}: TextFieldPillProps) {
  const rim = useRim()

  return (
    <>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href="prism-text-field" css={textFieldStyles} />
      <span
        ref={pillRef}
        className={cx('prism-textbox', disabled && 'prism-textbox--disabled', className)}
        style={{ ...colorStyle, ...style }}
        onMouseDown={(event) => {
          const input = fieldRef.current!
          if (event.target === input && !(takesFirstPress && document.activeElement !== input)) return
          event.preventDefault()
          input.focus({ preventScroll: true })
        }}
      >
        {children}
        <TextFieldClear label={clearLabel} disabled={!canClear} onClick={clear} />
        {after}
        {rim.element}
      </span>
    </>
  )
}
