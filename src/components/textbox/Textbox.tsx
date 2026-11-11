import { useRef, type ComponentProps } from 'react'
import { TextFieldPill, useTextField } from '../textField'

/** The input types whose value is the text they show. */
export type TextboxType = 'text' | 'search' | 'email' | 'url' | 'tel' | 'password'

export interface TextboxProps extends Omit<ComponentProps<'input'>, 'children' | 'type'> {
  /** What it holds. A number is `inputMode="numeric"`, as type="number" reads as empty while it holds anything else. */
  type?: TextboxType
  /** Accessible name of the clear button. */
  clearLabel?: string
  /** Take the page's text colour inside a GlassBackdrop (see Readable text colour in docs/colours.md). */
  readableText?: boolean
  /** Take the page's selection colours inside a GlassBackdrop, and shade them to show and read elsewhere. */
  readableSelection?: boolean
}

// A text input in a pill, with a short separator and a clear button at the end
// of the line (TextFieldPill). It is flat at rest, a plain ring and nothing else,
// and with the focus anywhere inside it the ring fades into a toggle's edge, the
// shared rim (src/effects/rim) over a groove's shading. See textField.styles.ts
// for the edge, and useTextField for clearing.
//
// Its props are an <input>'s and go to the input, `ref` included, but for
// `className` and `style`, which go to the pill, so a size or a custom property
// reaches all of it. With `value` it shows what it is given; without, it keeps
// its own value, as an input does. It has no label of its own: give it an
// aria-label, or put it in a <label> with the text.
//
// A clear button with nothing to clear is disabled, as is one on an input that
// can't be edited.
//
// Taking the focus selects all its text, to type over or copy. A press on the
// input would put the caret down over that selection, so the pill takes that
// press too. Only with the input already focused does a press go through, so a
// second click places the caret. Coming back to the window hands the focus back
// without it having been lost to the page, so that leaves the selection as it
// was: selecting then could lose an edit to a paste.
//
// Its text and selection colours are the page's inside a GlassBackdrop (see
// textField.styles.ts), judged by the resting tint: the focused one is a little
// thicker, which only draws the field in towards the tint.
export function Textbox({
  clearLabel = 'Clear',
  readableText = true,
  readableSelection = true,
  value,
  defaultValue,
  disabled,
  readOnly,
  className,
  style,
  onChange,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextboxProps) {
  const field = useTextField(ref, {
    value,
    defaultValue,
    disabled,
    readOnly,
    onChange,
    readableText,
    readableSelection,
  })
  const windowLeft = useRef(false)

  return (
    <TextFieldPill field={field} clearLabel={clearLabel} takesFirstPress className={className} style={style}>
      <input
        className="prism-textbox__input"
        {...field.fieldProps}
        {...rest}
        onFocus={(event) => {
          onFocus?.(event)
          if (!windowLeft.current) event.target.select()
          windowLeft.current = false
        }}
        onBlur={(event) => {
          onBlur?.(event)
          // Only the window has lost the focus if the input is still active.
          windowLeft.current = document.activeElement === event.target
        }}
      />
    </TextFieldPill>
  )
}
