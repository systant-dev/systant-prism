import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { buttonStyles } from '../button'
import { Popup } from '../popup'
import { TextFieldPill, useTextField } from '../textField'
import { cx, Glyph, PrismStyles, useControllable, useFocusLeft } from '../../shared'
import { calendarStyles } from './Calendar.styles'
import { CalendarMonth } from './CalendarMonth'
import { clampDay, dayInRange, orderDays, sameRange, startOfDay, type CalendarRange } from './calendarDate'
import { formatRange, parseDate, parseRange, type CalendarDateFormat } from './dateFormat'
import { useBrowserLocale } from './useBrowserLocale'

interface CalendarBaseProps extends Omit<
  ComponentProps<'input'>,
  'children' | 'type' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> {
  /** What the field writes between the two days of a range, and reads there as well. */
  rangeSeparator?: string
  /** The earliest day that can be picked, which can be picked itself. Any day before it, if left out. */
  startDate?: Date
  /** The latest day that can be picked, which can be picked itself. Any day after it, if left out. */
  endDate?: Date
  /** How the field writes and reads a date: a pattern such as `'dd/MM/yyyy'`, or Intl.DateTimeFormat's options. */
  dateFormat?: CalendarDateFormat
  /** A BCP 47 language tag, for the names, the numerals, the order of a date and the first day of the week. */
  locale?: string
  /** Accessible name of the previous month's button. The locale's word for last month, if left out. */
  previousMonthLabel?: string
  /** Accessible name of the next month's button. The locale's word for next month, if left out. */
  nextMonthLabel?: string
  /** Accessible name of the year view's button back a year. The locale's word for last year, if left out. */
  previousYearLabel?: string
  /** Accessible name of the year view's button on a year. The locale's word for next year, if left out. */
  nextYearLabel?: string
  /** Accessible name of the year view's button back ten years. The locale's words for ten years ago, if left out. */
  previousDecadeLabel?: string
  /** Accessible name of the year view's button on ten years. The locale's words for in ten years, if left out. */
  nextDecadeLabel?: string
  /** The text of the button that goes back to today. The locale's word for today, if left out. */
  todayLabel?: string
  /** Accessible name of the clear button. */
  clearLabel?: string
  /** Glass: inside a GlassBackdrop, the image behind the calendar, blurred and bent at the edges. */
  refract?: boolean
  /** Take the page's text colour inside a GlassBackdrop (see Readable text colour in docs/colours.md). */
  readableText?: boolean
  /** Take the page's selection colours inside a GlassBackdrop, and shade them to show and read elsewhere. */
  readableSelection?: boolean
}

/** A calendar for one day. */
export interface CalendarSingleProps extends CalendarBaseProps {
  range?: false
  /** The picked day, or null for none. Leave it out for a calendar that keeps its own, from `defaultValue`. */
  value?: Date | null
  /** The day picked to begin with, while `value` is left out. */
  defaultValue?: Date | null
  /** Called with the first moment of the picked day, in local time, or null as it is cleared. */
  onChange?: (value: Date | null) => void
}

/** A calendar for a run of days. */
export interface CalendarRangeProps extends CalendarBaseProps {
  /** Pick a run of days rather than one: Shift and a press, or a drag. */
  range: true
  /** The picked days, or null for none. Leave it out for a calendar that keeps its own, from `defaultValue`. */
  value?: CalendarRange | null
  /** The days picked to begin with, while `value` is left out. */
  defaultValue?: CalendarRange | null
  /** Called with the first moments of the first and last days, in local time, or null as it is cleared. */
  onChange?: (value: CalendarRange | null) => void
}

export type CalendarProps = CalendarSingleProps | CalendarRangeProps

const MEDIUM_DATE: CalendarDateFormat = { dateStyle: 'medium' }

/** A `value` of either kind as the range it holds, of local days: one day is a range of that day. */
function asRange(value: Date | CalendarRange | null): CalendarRange | null {
  if (!value) return null
  const { start, end } = 'start' in value ? value : { start: value, end: value }
  return orderDays(startOfDay(start), startOfDay(end))
}

function focusCursor(popup: HTMLElement | null) {
  // preventScroll: the panel is fixed, so nothing needs to move to show it.
  popup?.querySelector<HTMLElement>('.prism-calendar__day[tabindex="0"]')?.focus({ preventScroll: true })
}

// A text field for one date, with a month to pick from in a Popup under it: a
// textbox's pill (src/components/textField) with a calendar icon at its end. Its
// props are an <input>'s and go to the input, `ref` included, but for `className`
// and `style`, which go to the pill, as on a Textbox. It has no label of its own:
// give it an aria-label, or put it in a <label> with the text.
//
// A date is a local day: a Date's own time and zone play no part, and days are
// compared and returned as local midnights (calendarDate.ts). Unless told
// otherwise it writes dates and names days in the browser's language, follows that
// language's week, and takes the Gregorian calendar whatever the locale's own.
//
// A date years away is a long way off by the month arrows, so the month's heading
// opens a year to pick a month from, with arrows for the year (CalendarYear.tsx),
// and the field can be typed in. What is typed is held apart from the value and only taken up as the
// focus leaves the field or on Enter (dateFormat.ts reads it): taking it up at each
// key would call `onChange` with a run of wrong dates on the way to the right one.
// While it is typed the open month follows it. Anything that isn't a date the
// calendar can pick gives way to the value again; an emptied field clears it.
//
// It is the date picker combobox of the ARIA authoring practices: a press on the
// field or the icon opens the panel with the focus left on the field, for typing,
// and the down arrow opens it, or goes to it, with the focus on a day. A roving
// tabindex keeps the grid to one Tab stop. The focus can't stay on the field
// throughout, as on a Combobox, since left and right belong to the text there.
//
// A press inside the panel is kept from moving the focus. It closes on picking a
// day, on Escape, on a press elsewhere, and as the focus moves anywhere but the
// pill or the panel. Coming back to the window finds it as it was.
//
// The month mounts on first opening, so a closed calendar pays for no grid, and
// a server renders none, which could only show its own idea of today.
//
// With `range` it picks a run of days, and its value is a CalendarRange. Inside, one
// day is a range of that day, so both ways share all of this, and differ only in
// what a pick does and what `onChange` is given. A press on a day picks that day and
// leaves it the anchor, with the calendar open, so that months can go by before Shift
// and a press on another day picks all those between and closes it. A drag does the
// same from where it began, showing the days as it goes and calling `onChange` once,
// as it lets go (CalendarMonth.tsx). On the keyboard Enter or Space is the press, with
// Shift as well for the second, and Shift with the keys that move the cursor
// extends the range day by day, each step taken up as it is made, for Enter to close
// on. The field writes the two days, and reads them back.
export function Calendar({
  value,
  defaultValue = null,
  onChange,
  range = false,
  rangeSeparator = ' – ',
  startDate,
  endDate,
  dateFormat = MEDIUM_DATE,
  locale,
  previousMonthLabel,
  nextMonthLabel,
  previousYearLabel,
  nextYearLabel,
  previousDecadeLabel,
  nextDecadeLabel,
  todayLabel,
  clearLabel = 'Clear',
  refract = true,
  readableText = true,
  readableSelection = true,
  disabled,
  readOnly,
  className,
  style,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  ref,
  ...rest
}: CalendarProps) {
  const browserLocale = useBrowserLocale()
  const language = locale ?? browserLocale
  const [selected, keep] = useControllable(value === undefined ? undefined : asRange(value), () =>
    asRange(defaultValue),
  )
  // What is typed and not yet taken up, or null for the field to show the value.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // Null until it first opens.
  const [cursor, setCursor] = useState<Date | null>(null)
  const [today, setToday] = useState<Date | null>(null)
  // The day a range extends from.
  const [anchor, setAnchor] = useState<Date | null>(null)
  // Shift and the keys have made a range, for Enter to close on rather than start again.
  const extended = useRef(false)
  const popupRef = useRef<HTMLDivElement>(null)
  // To go to the cursor once it has been rendered, in a panel that is showing.
  const goToCursor = useRef(false)
  const windowLeft = useRef(false)
  const id = useId()
  const panelId = `${id}-panel`
  const titleId = `${id}-title`

  const locked = disabled || readOnly
  const first = startDate ? startOfDay(startDate) : null
  const last = endDate ? startOfDay(endDate) : null

  function typedRange(text: string) {
    const day = range ? null : parseDate(text, dateFormat, language)
    const typed = range ? parseRange(text, dateFormat, language, rangeSeparator) : asRange(day)
    return typed && dayInRange(typed.start, first, last) && dayInRange(typed.end, first, last) ? typed : null
  }

  const field = useTextField(ref, {
    value: draft ?? (selected ? formatRange(selected, dateFormat, language, rangeSeparator) : ''),
    defaultValue: undefined,
    disabled,
    readOnly,
    onChange: (event) => {
      const text = event.target.value
      const typed = typedRange(text)
      setDraft(text)
      if (typed) setCursor(typed.start)
    },
    readableText,
    readableSelection,
  })

  // After the popup's own, which shows it: nothing takes the focus while it is hidden.
  useEffect(() => {
    if (!goToCursor.current) return
    goToCursor.current = false
    focusCursor(popupRef.current)
  })

  useFocusLeft(open, [field.pillRef, popupRef], () => setOpen(false))

  function commit(next: CalendarRange | null) {
    if (sameRange(next, selected)) return
    keep(next)
    // Which of the two `onChange` is goes with `range`, which destructuring can't follow.
    const change = onChange as ((next: Date | CalendarRange | null) => void) | undefined
    change?.(range ? next : (next?.start ?? null))
  }

  /** Takes up what was typed, if anything: a date, or nothing to clear it. */
  function settle() {
    if (draft === null) return
    setDraft(null)
    if (draft.trim() === '') return commit(null)
    const typed = typedRange(draft)
    if (typed) commit(typed)
  }

  function show() {
    const now = startOfDay(new Date())
    const typed = draft === null ? null : typedRange(draft)
    const from = typed ?? selected
    setToday(now)
    setCursor(clampDay(from?.start ?? now, first, last))
    setAnchor(from?.start ?? null)
    extended.current = false
    setOpen(true)
  }

  function close() {
    setOpen(false)
    // Before the panel it may be in closes.
    field.fieldRef.current?.focus({ preventScroll: true })
  }

  function pick(day: Date, shift: boolean, fromKeyboard: boolean) {
    setDraft(null)
    const keysMadeIt = extended.current
    extended.current = false
    if (!range) {
      commit({ start: day, end: day })
      close()
    } else if (keysMadeIt && fromKeyboard && !shift) {
      close()
    } else if (shift && anchor) {
      commit(orderDays(anchor, day))
      close()
    } else {
      commit({ start: day, end: day })
      setAnchor(day)
      setCursor(day)
    }
  }

  /** Takes the range out to `day` from the anchor, or for want of one from the cursor, leaving the calendar open. */
  function extend(day: Date) {
    const from = anchor ?? cursor!
    setDraft(null)
    setAnchor(from)
    commit(orderDays(from, day))
    extended.current = true
  }

  function pickDragged(from: Date, to: Date) {
    setDraft(null)
    setAnchor(from)
    commit(orderDays(from, to))
    close()
  }

  function clear() {
    // Before the button that has it is disabled.
    field.fieldRef.current?.focus({ preventScroll: true })
    setDraft(null)
    setAnchor(null)
    commit(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || locked || event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (open) return focusCursor(popupRef.current)
      goToCursor.current = true
      show()
    } else if (event.key === 'Enter' && (open || draft !== null)) {
      // Not to submit a form with a date that isn't in it yet.
      event.preventDefault()
      settle()
      setOpen(false)
    } else if (event.key === 'Escape' && !open) {
      setDraft(null)
    }
  }

  return (
    <>
      {/* For the button's tokens, which the picked day wears */}
      <PrismStyles href="prism-button" css={buttonStyles} />
      <PrismStyles href="prism-calendar" css={calendarStyles} />
      <TextFieldPill
        field={{
          ...field,
          canClear: !locked && (draft === null ? selected !== null : draft !== ''),
          clear,
        }}
        clearLabel={clearLabel}
        takesFirstPress
        className={cx('prism-calendar', range && 'prism-calendar--range', className)}
        style={style}
        after={
          // Hidden from the accessibility tree and Tab: the down arrow does all it does.
          <button
            type="button"
            className="prism-textbox__icon-button prism-textbox__end-button prism-calendar__toggle"
            tabIndex={-1}
            aria-hidden="true"
            disabled={locked}
            onClick={() => (open ? setOpen(false) : show())}
          >
            <Glyph strokeWidth={1.5}>
              <rect x="1.5" y="2.5" width="11" height="10" rx="2" />
              <path d="M1.5 6h11M4.5 1v3M9.5 1v3" />
            </Glyph>
          </button>
        }
      >
        <input
          className="prism-textbox__input"
          autoComplete="off"
          {...field.fieldProps}
          {...rest}
          type="text"
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={(event) => {
            onClick?.(event)
            if (!locked && !open) show()
          }}
          onFocus={(event) => {
            onFocus?.(event)
            if (!windowLeft.current) event.target.select()
            windowLeft.current = false
          }}
          onBlur={(event) => {
            onBlur?.(event)
            // Only the window has lost the focus if the input is still active.
            windowLeft.current = document.activeElement === event.target
            if (!windowLeft.current) settle()
          }}
          onKeyDown={handleKeyDown}
        />
      </TextFieldPill>
      <Popup
        ref={popupRef}
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        open={open}
        onClose={() => setOpen(false)}
        anchor={field.pillRef}
        refract={refract}
        readableText={readableText}
        className="prism-calendar__panel"
        onMouseDown={(event) => event.preventDefault()}
      >
        {cursor && (
          <CalendarMonth
            open={open}
            range={range}
            cursor={cursor}
            anchor={anchor}
            selected={selected}
            today={today}
            first={first}
            last={last}
            locale={language}
            titleId={titleId}
            previousMonthLabel={previousMonthLabel}
            nextMonthLabel={nextMonthLabel}
            previousYearLabel={previousYearLabel}
            nextYearLabel={nextYearLabel}
            previousDecadeLabel={previousDecadeLabel}
            nextDecadeLabel={nextDecadeLabel}
            todayLabel={todayLabel}
            refract={refract}
            readableText={readableText}
            onMove={(day, focus) => {
              goToCursor.current = focus
              extended.current = false
              setCursor(day)
            }}
            onPick={pick}
            onExtend={extend}
            onDrag={pickDragged}
          />
        )}
      </Popup>
    </>
  )
}
