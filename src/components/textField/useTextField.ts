import { useEffect, useRef, useState, type ChangeEventHandler, type ComponentProps, type Ref } from 'react'
import { cssVars, useForwardedRef } from '../../shared'
import { useGlassSelection, useGlassText } from '../backdrop'

export interface TextFieldOptions<T> {
  value: ComponentProps<'input'>['value']
  defaultValue: ComponentProps<'input'>['defaultValue']
  disabled: boolean | undefined
  readOnly: boolean | undefined
  onChange: ChangeEventHandler<T> | undefined
  /** Take the page's text colour inside a GlassBackdrop, and stay readable on an opaque background elsewhere. */
  readableText: boolean
  /** Take the page's selection colours inside a GlassBackdrop, and shade them to show and read elsewhere. */
  readableSelection: boolean
}

const TEXT = { property: '--prism-textbox-fg' }
const SELECTION = { textProperty: '--prism-textbox-selection-fg', accentProperty: '--prism-textbox-selection' }

/**
 * What Textbox and Textarea share round their field: the props to give it, what
 * TextFieldPill needs, and the text, which is `value` or, without one, what the
 * field last changed to or a reset of its form put there. A value written
 * straight to the element through a ref isn't noticed.
 *
 * Clearing is an edit like any other: `onChange` is called, with a real event,
 * whether or not the value is the parent's, the focus is left on the field, as
 * the button that had it is disabled by then, and the browser can undo it.
 */
export function useTextField<T extends HTMLInputElement | HTMLTextAreaElement>(
  ref: Ref<T> | undefined,
  { value, defaultValue, disabled, readOnly, onChange, readableText, readableSelection }: TextFieldOptions<T>,
) {
  const fieldRef = useForwardedRef(ref)
  const pillRef = useRef<HTMLSpanElement>(null)
  const textColor = useGlassText(pillRef, TEXT, readableText)
  const selection = useGlassSelection(pillRef, SELECTION, readableSelection)
  const [ownValue, setOwnValue] = useState(String(defaultValue ?? ''))
  const text = String(value ?? ownValue)

  useEffect(() => {
    const field = fieldRef.current!
    const doc = field.ownerDocument
    let timer: ReturnType<typeof setTimeout>
    // Text may be there before this is: typed ahead of hydration, say.
    setOwnValue(field.value)
    // Asked at each reset, as the field can change forms. The event comes before
    // the reset, so the value is read after it.
    const follow = (event: Event) => {
      if (event.target !== field.form) return
      clearTimeout(timer)
      timer = setTimeout(() => setOwnValue(field.value))
    }
    doc.addEventListener('reset', follow, true)
    return () => {
      clearTimeout(timer)
      doc.removeEventListener('reset', follow, true)
    }
  }, [fieldRef])

  const clear = () => {
    const field = fieldRef.current!
    field.focus({ preventScroll: true })
    field.select()
    // Through the browser, as a deletion of the user's own: a value set from a
    // script can't be undone, and this may be a long text cleared by mistake.
    if (field.ownerDocument.execCommand?.('delete')) return
    // The prototype's setter, not the one React wraps the field's value in, so
    // React takes the event for an edit and calls onChange.
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')!.set!.call(field, '')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const changed: ChangeEventHandler<T> = (event) => {
    onChange?.(event)
    setOwnValue(event.target.value)
  }

  return {
    fieldRef,
    pillRef,
    colorStyle: cssVars({
      ...(textColor && { '--_prism-textbox-fg': textColor }),
      ...(selection && {
        '--_prism-textbox-selection-bg': selection.background,
        '--_prism-textbox-selection-fg': selection.color,
      }),
    }),
    text,
    disabled,
    canClear: text !== '' && !disabled && !readOnly,
    clear,
    fieldProps: {
      ref: fieldRef,
      value,
      defaultValue,
      disabled,
      readOnly,
      // None for a `value` with nothing to change it, which React warns about only if it finds none.
      onChange: value == null || onChange ? changed : undefined,
    },
  }
}
