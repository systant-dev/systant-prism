import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { Popup } from '../popup'
import { ScrollArea } from '../scroll'
import { entryForKey } from '../selector'
import { TextFieldPill, useTextField } from '../textField'
import { Chevron, cx, PrismStyles, Tick, useControllable, useElementSize } from '../../shared'
import { comboboxStyles } from './Combobox.styles'
import { filterItems } from './filterItems'

export interface ComboboxItem<T extends string = string> {
  value: T
  /** What it shows as, and what typing is matched against. */
  label: string
  disabled?: boolean
}

export interface ComboboxProps<T extends string = string> extends Omit<
  ComponentProps<'input'>,
  'children' | 'type' | 'name' | 'value' | 'defaultValue' | 'onChange'
> {
  items: readonly ComboboxItem<T>[]
  /**
   * Whether any number of entries can be ticked, or only one: false to pick one,
   * which takes the place of the one before, closes the list and shows in the field.
   */
  multiple?: boolean
  /**
   * The entries to list for what was typed ('' for nothing), in place of those of
   * `items` whose labels hold it (filterItems.ts). They needn't be in `items`,
   * but a selected value shows in the field only by its entry there.
   */
  match?: (query: string) => readonly ComboboxItem<T>[]
  /**
   * Picking one: called with text typed that no entry was picked for, as Enter
   * is pressed with none active or the focus leaves, for a value the list
   * doesn't hold. The field then shows the label picked again. Left out, the
   * text stays until it is picked from or cleared.
   */
  onCommitText?: (text: string) => void
  /**
   * The selected values: with `multiple` false, one at most. Leave it out for a
   * combobox that keeps its own, from `defaultValue`.
   */
  value?: readonly T[]
  /** The values selected to begin with, while `value` is left out. */
  defaultValue?: readonly T[]
  /**
   * Called with all the selected values, in the order they were picked, as one
   * is ticked, unticked or cleared; with `multiple` false, the one picked, or none.
   */
  onChange?: (value: T[]) => void
  /** What the list says when nothing matches what was typed. */
  noMatchesLabel?: string
  /** Accessible name of the clear button. */
  clearLabel?: string
  /** Glass: inside a GlassBackdrop, the image behind the list, blurred and bent at the edges. */
  refract?: boolean
  /** Take the page's text colour inside a GlassBackdrop (see Readable text colour in docs/colours.md). */
  readableText?: boolean
  /** Take the page's selection colours inside a GlassBackdrop, and shade them to show and read elsewhere. */
  readableSelection?: boolean
}

const STEPS = { back: 'ArrowUp', forward: 'ArrowDown' }

// A text field that narrows a list of entries to tick any number of: a textbox's
// pill (src/components/textField) with a chevron at its end, and a Popup beside
// it, as wide as the pill, holding the list. Its props are an <input>'s and go to
// the input, `ref` included, but for `className` and `style`, which go to the
// pill, as on a Textbox. It has no label of its own: give it an aria-label, or put
// it in a <label> with the text.
//
// Typing opens the list and narrows it to the entries that match (filterItems.ts),
// the first of them active, so Enter ticks the best match. A press on the field or
// the chevron opens it too, and the arrow keys, which then walk the entries. The
// focus never leaves the input: the active entry is its aria-activedescendant, as
// the combobox pattern has it, and a press on the popup is kept from moving the
// focus, which would close it. Home, End and Space are the text's, not the list's.
//
// Ticking an entry leaves the list open, to tick the next, and selects what was
// typed: the list stays narrowed, for neighbouring matches, and typing replaces
// it. It closes on Escape, a press elsewhere or the focus leaving. Coming back to
// the window finds it as it was.
//
// Away from the field its text is the selected labels, in the order of `items`.
// With the focus it holds what is typed, with the labels as its placeholder, and
// what was typed goes with the focus. It is only forgotten as the focus returns,
// as the list is still fading out in the meantime, and would jump.
//
// The clear button clears what was typed or, with nothing typed, the selection.
//
// With `multiple` false it picks one: picking an entry takes the place of the
// one before and closes the list, and picking it again keeps it. The field
// shows the label picked, with the focus too, selected as the focus comes, so
// typing replaces it: until something is typed it lists every entry, and
// opens on the one picked. Escape with the list closed puts the label back over
// what was typed. Text typed that no entry is picked for goes to
// `onCommitText`, where it is given, on Enter or as the focus leaves.
//
// `match` lists entries of its own for what is typed, for a list worked out
// rather than narrowed: pages by their numbers, or what a search finds.
export function Combobox<T extends string = string>({
  items,
  multiple = true,
  match,
  onCommitText,
  value,
  defaultValue = [],
  onChange,
  noMatchesLabel = 'No matches',
  clearLabel = 'Clear',
  refract = true,
  readableText = true,
  readableSelection = true,
  placeholder,
  disabled,
  readOnly,
  className,
  style,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  ref,
  'aria-label': ariaLabel,
  ...rest
}: ComboboxProps<T>) {
  const [selected, keep] = useControllable(value, defaultValue)
  const [query, setQuery] = useState('')
  // Picking one: whether the field holds what was typed, rather than the label picked.
  const [typing, setTyping] = useState(false)
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<T | null>(null)
  // A move of the active entry by key or by typing, for it to be scrolled to.
  const reveal = useRef(false)
  // A pick, for the label it puts in the field to be selected once it is there, so typing replaces it.
  const selectLabel = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const listId = `${id}-list`

  const locked = disabled || readOnly
  const editing = focused && !locked
  // What was typed counts while picking many, or once typed over the label picked.
  const typed = multiple || typing
  // Looked up once, rather than once an entry: a list can be long.
  const chosen = new Set(selected)
  const summary = items
    .filter((item) => chosen.has(item.value))
    .map((item) => item.label)
    .join(', ')
  const matchesOf = (text: string) => (match ? match(text) : filterItems(items, text))
  const matches = matchesOf(typed ? query : '')
  const activeItem = matches.find((item) => item.value === active)
  // An entry's place, for an id that stays as the list narrows: in `items`, or else after them.
  const places = new Map(items.map((item, place) => [item.value, place]))
  for (const item of matches) if (!places.has(item.value)) places.set(item.value, places.size)

  const field = useTextField(ref, {
    value: editing && typed ? query : summary,
    defaultValue: undefined,
    disabled,
    readOnly,
    onChange: (event) => {
      const text = event.target.value
      setQuery(text)
      setTyping(true)
      setOpen(true)
      setActive(text.trim() ? (matchesOf(text).find((item) => !item.disabled)?.value ?? null) : null)
      reveal.current = true
    },
    readableText,
    readableSelection,
  })
  // Kept whether or not it is open, for the popup to open at its full width.
  const pillSize = useElementSize(field.pillRef)

  // After the popup's own, which shows it: nothing scrolls while it is hidden.
  useEffect(() => {
    if (selectLabel.current) {
      selectLabel.current = false
      field.fieldRef.current?.select()
    }
    if (!open || !reveal.current) return
    reveal.current = false
    listRef.current?.querySelector('.prism-combobox__option--active')?.scrollIntoView?.({ block: 'nearest' })
  })

  function commit(next: T[]) {
    keep(next)
    onChange?.(next)
  }

  function toggle(item: ComboboxItem<T>) {
    if (item.disabled) return
    if (!multiple) return pick(item)
    const on = selected.includes(item.value)
    commit(on ? selected.filter((v) => v !== item.value) : [...selected, item.value])
    field.fieldRef.current?.select()
  }

  // Picking one: it takes the place of the one before, and the field shows its label.
  function pick(item: ComboboxItem<T>) {
    if (selected.length !== 1 || selected[0] !== item.value) commit([item.value])
    setQuery('')
    setTyping(false)
    selectLabel.current = true
    close()
  }

  function close() {
    setOpen(false)
    setActive(null)
  }

  // Picking one: whether text was typed that no entry was picked for, which onCommitText takes.
  const textToCommit = () => (!multiple && typing && onCommitText ? query.trim() : '')

  // Hands that text over, and shows the label picked again.
  function commitText() {
    onCommitText!(query.trim())
    setQuery('')
    setTyping(false)
    selectLabel.current = true
    close()
  }

  // Opens the list; picking one, on the entry picked, unless something was typed.
  function show() {
    setOpen(true)
    if (multiple || typing) return
    setActive(selected[0] ?? null)
    reveal.current = true
  }

  function clear() {
    if (editing && typed && query) return field.clear()
    // Before the button that has it is disabled.
    field.fieldRef.current?.focus({ preventScroll: true })
    commit([])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || locked || event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const at = activeItem ? matches.indexOf(activeItem) : -1
      setOpen(true)
      // Picking one, the list opens on the entry picked.
      const picked = !multiple && !open && !typing && matches.find((item) => item.value === selected[0])
      setActive(picked ? picked.value : (entryForKey(matches, at, event.key, STEPS)?.value ?? null))
      reveal.current = true
    } else if (event.key === 'Enter' && (open || textToCommit())) {
      // Not to submit a form while the list has the keyboard.
      event.preventDefault()
      if (open && activeItem) toggle(activeItem)
      else if (textToCommit()) commitText()
    } else if (event.key === 'Escape' && !open) {
      setQuery('')
      setTyping(false)
    }
  }

  return (
    <>
      <PrismStyles href="prism-combobox" css={comboboxStyles} />
      <TextFieldPill
        field={{
          ...field,
          canClear: !locked && ((editing && typed && query !== '') || selected.length > 0),
          clear,
        }}
        clearLabel={clearLabel}
        // Picking one, for the label to stay selected as a press focuses the field.
        takesFirstPress={!multiple}
        className={cx('prism-combobox', className)}
        style={style}
        after={
          // Hidden from the accessibility tree and Tab: the arrow keys do all it does.
          <button
            type="button"
            className={cx(
              'prism-textbox__icon-button',
              'prism-textbox__end-button',
              'prism-combobox__chevron',
              open && 'prism-combobox__chevron--open',
            )}
            tabIndex={-1}
            aria-hidden="true"
            disabled={locked}
            onClick={() => (open ? close() : show())}
          >
            <Chevron point="down" size={12} />
          </button>
        }
      >
        <input
          className="prism-textbox__input prism-combobox__input"
          autoComplete="off"
          aria-label={ariaLabel}
          {...field.fieldProps}
          {...rest}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeItem && `${listId}-${places.get(activeItem.value)}`}
          placeholder={(editing && multiple && summary) || placeholder}
          onClick={(event) => {
            onClick?.(event)
            if (!locked && !open) show()
          }}
          onFocus={(event) => {
            onFocus?.(event)
            // It was never lost if it comes back with the window.
            if (!focused) {
              setQuery('')
              setTyping(false)
              if (!multiple) event.target.select()
            }
            setFocused(true)
          }}
          onBlur={(event) => {
            onBlur?.(event)
            // Only the window has lost the focus if the input is still active.
            if (document.activeElement === event.target) return
            setFocused(false)
            if (textToCommit()) commitText()
            else close()
          }}
          onKeyDown={handleKeyDown}
        />
      </TextFieldPill>
      <Popup
        open={open}
        onClose={close}
        anchor={field.pillRef}
        padding="none"
        refract={refract}
        readableText={readableText}
        style={{ width: pillSize?.width }}
        onMouseDown={(event) => event.preventDefault()}
      >
        {/* tabIndex: a scroller with nothing to focus is otherwise a Tab stop of its own, straight after the field */}
        <ScrollArea className="prism-combobox__list" viewportProps={{ tabIndex: -1 }}>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple}
            aria-label={ariaLabel}
            className="prism-combobox__options"
          >
            {matches.map((item) => {
              const on = chosen.has(item.value)
              return (
                <div
                  key={item.value}
                  id={`${listId}-${places.get(item.value)}`}
                  role="option"
                  aria-selected={on}
                  aria-disabled={item.disabled || undefined}
                  className={cx('prism-combobox__option', item === activeItem && 'prism-combobox__option--active')}
                  // Moves, not enters: an entry that appears under a still pointer gets no pointerenter.
                  onPointerMove={(event) => {
                    if (event.pointerType !== 'touch' && !item.disabled && item !== activeItem) setActive(item.value)
                  }}
                  onClick={() => toggle(item)}
                >
                  {item.label}
                  {on && <Tick className="prism-combobox__tick" />}
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <div role="status" className="prism-combobox__empty">
          {matches.length === 0 && noMatchesLabel}
        </div>
      </Popup>
    </>
  )
}
