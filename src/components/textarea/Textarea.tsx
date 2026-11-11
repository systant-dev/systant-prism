import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { cx, PrismStyles } from '../../shared'
import { scrollbarStyles, watchScrollbars, type Scrollbars } from '../scroll'
import { TextFieldPill, useTextField } from '../textField'
import { textareaStyles } from './Textarea.styles'
import { useResizeHandle } from './useResizeHandle'

export interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'children'> {
  /** Accessible name of the clear button. */
  clearLabel?: string
  /** Accessible name of the resize handle. */
  resizeLabel?: string
  /** Take the page's text colour inside a GlassBackdrop (see Readable text colour in docs/colours.md). */
  readableText?: boolean
  /** Take the page's selection colours inside a GlassBackdrop, and shade them to show and read elsewhere. */
  readableSelection?: boolean
}

// A Textbox of several lines: the same flat pill, edge, selection, separator and
// clear button (TextFieldPill and textField.styles.ts), with its corners rounded
// less, the clear button on the first line, a scrollbar below it, and a handle in
// the corner at the end of the bottom edge that resizes it (useResizeHandle), by
// dragging or with the arrow keys. A read-only textarea resizes, as it may hold
// more than shows, and a disabled one doesn't.
//
// Its props are a <textarea>'s and go to the textarea, `ref` included, but for
// `className` and `style`, which go to the pill. `rows` sets its height until it
// is resized, and a resize wins over a width or height in `style`. It has no
// label of its own: give it an aria-label, or put it in a <label> with the text.
//
// Unlike a textbox, taking the focus doesn't select its text: a press puts the
// caret where it lands, as text this long is edited more often than replaced, and
// a keystroke would wipe all of it. A press on the handle takes no focus at all.
export function Textarea({
  clearLabel = 'Clear',
  resizeLabel = 'Resize',
  readableText = true,
  readableSelection = true,
  rows = 5,
  value,
  defaultValue,
  disabled,
  readOnly,
  className,
  style,
  onChange,
  ref,
  ...rest
}: TextareaProps) {
  const field = useTextField(ref, {
    value,
    defaultValue,
    disabled,
    readOnly,
    onChange,
    readableText,
    readableSelection,
  })
  const { fieldRef, pillRef, text } = field
  const barRef = useRef<HTMLSpanElement>(null)
  const scrollbars = useRef<Scrollbars>(null)
  const resize = useResizeHandle(pillRef)

  useLayoutEffect(() => {
    const pill = pillRef.current!
    const watched = watchScrollbars(fieldRef.current!, { y: barRef.current! }, (native) =>
      pill.toggleAttribute('data-native-scrollbars', native),
    )
    scrollbars.current = watched
    return watched.stop
  }, [fieldRef, pillRef])

  useLayoutEffect(() => {
    scrollbars.current?.refresh()
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- an edit changes how far it scrolls, and resizes nothing to report that
  }, [text])

  return (
    <>
      <PrismStyles href="prism-scrollbar" css={scrollbarStyles} />
      <PrismStyles href="prism-textarea" css={textareaStyles} />
      <TextFieldPill
        field={field}
        clearLabel={clearLabel}
        className={cx('prism-textarea', className)}
        style={{ ...style, ...resize.style }}
        after={
          <>
            {/* Hidden from the accessibility tree and Tab: the field scrolls */}
            <span className="prism-textarea__rail" aria-hidden="true">
              <span ref={barRef} className="prism-textarea__bar prism-scrollbar" tabIndex={-1}>
                <span className="prism-textarea__extent" />
              </span>
            </span>
            <button
              type="button"
              className="prism-textbox__icon-button prism-textarea__resize"
              aria-label={resizeLabel}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
              disabled={disabled}
              {...resize.handlers}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M9 1L1 9M9 5.5L5.5 9" />
              </svg>
            </button>
          </>
        }
      >
        <textarea className="prism-textbox__input prism-scrollbar" rows={rows} {...field.fieldProps} {...rest} />
      </TextFieldPill>
    </>
  )
}
