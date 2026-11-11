import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { PopupAlign } from '../popup'
import { useRim } from '../../effects/rim'
import { Chevron, cx, useFocusLeft } from '../../shared'
import { CalendarArrow } from './CalendarArrow'
import {
  addMonths,
  clampDay,
  clampMonth,
  dayForKey,
  dayInRange,
  makeDay,
  monthWeeks,
  orderDays,
  sameDay,
  type CalendarRange,
} from './calendarDate'
import { CalendarYear, type CalendarYearLabels } from './CalendarYear'
import { dateFormatter, fieldText } from './dateFormat'
import { weekStart } from './weekStart'

export interface CalendarMonthProps extends CalendarYearLabels {
  /** Whether the calendar is showing: the year view goes with it. */
  open: boolean
  /** Whether it picks a run of days, which a drag or Shift can make. */
  range: boolean
  /** The day with the keyboard. The month it lies in is the month shown. */
  cursor: Date
  /** The day a range extends from. */
  anchor: Date | null
  /** The picked days. */
  selected: CalendarRange | null
  /** Today, as it was when the calendar opened. */
  today: Date | null
  /** The earliest day that can be picked. */
  first: Date | null
  /** The latest day that can be picked. */
  last: Date | null
  locale: string
  /** Names the panel and the grid. */
  titleId: string
  previousMonthLabel: string | undefined
  nextMonthLabel: string | undefined
  todayLabel: string | undefined
  refract: boolean
  readableText: boolean
  /** Called as the cursor moves. `focus`: the move was a key on the grid, which the focus follows. */
  onMove: (day: Date, focus: boolean) => void
  /** Called as a day is pressed. `shift`: Shift was held. `fromKeyboard`: it was Enter or Space. */
  onPick: (day: Date, shift: boolean, fromKeyboard: boolean) => void
  /** Called as Shift and a key take the range out to `day`. */
  onExtend: (day: Date) => void
  /** Called as a drag lets go, from the day it began on or extended from to the day it ended on. */
  onDrag: (from: Date, to: Date) => void
}

/** How long a drag has to rest on a month's arrow for it to turn, in ms, so one only passing over it doesn't. */
const DRAG_PAGE_DELAY = 500
/** How long it then takes for each month after, in ms, for the months to be read as they go by. */
const DRAG_PAGE_REPEAT = 700

/** A drag across the days, while it lasts: `moved`, it has left the day it began on. */
interface Drag {
  from: Date
  to: Date
  moved: boolean
}

function dayOf(el: HTMLElement) {
  return new Date(Number(el.dataset.day))
}

/** The most letters a column's heading can hold. */
const HEADING_LENGTH = 4

// A column's heading. Some locales' short names are whole words (Arabic's), and
// would run together in a column this narrow, so those have their narrow ones.
function weekdayHeading(locale: string) {
  const short = dateFormatter(locale, { weekday: 'short' })
  const week = Array.from({ length: 7 }, (_, at) => makeDay(2026, 0, at + 1))
  const fits = week.every((day) => short.format(day).length <= HEADING_LENGTH)
  return fits ? short : dateFormatter(locale, { weekday: 'narrow' })
}

function formatters(locale: string) {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const today = relative.format(0, 'day')
  return {
    title: dateFormatter(locale, { month: 'long', year: 'numeric' }),
    weekday: weekdayHeading(locale),
    weekdayName: dateFormatter(locale, { weekday: 'long' }),
    day: dateFormatter(locale, { day: 'numeric' }),
    dayName: dateFormatter(locale, { dateStyle: 'full' }),
    previous: relative.format(-1, 'month'),
    next: relative.format(1, 'month'),
    // Set apart on a button of its own, so it starts as a sentence does.
    today: today.charAt(0).toLocaleUpperCase(locale) + today.slice(1),
    weekStart: weekStart(locale),
  }
}

// A month: a heading between two arrows, over a grid of six weeks (see
// Calendar.tsx). Every cell is a button, though only the cursor's is a Tab stop.
//
// The arrows go by aria-disabled rather than disabled at the first and last months
// that hold a day to pick: a disabled button drops the focus, which would close
// the calendar on someone paging along it from the keyboard.
//
// The heading is a button that opens the year (CalendarYear.tsx), a Popup inside the
// calendar's, so it counts as inside it, Escape closes it first, and its glass hides
// the days under it. It goes as a press lands elsewhere, or the focus moves anywhere
// but it or the heading. Picking a month shows that month, on the same day of it or
// the nearest that can be picked, with the calendar left open for the day. A press
// leaves the focus on the field, as any press here does; from the keyboard the focus
// goes to the months, and from there to the day.
//
// The year lines up with the heading, which hugs its text, so it keeps its place
// beside the month's name whichever month that is (see Calendar.styles.ts): its left
// edge does, or in text that runs right to left its right, as the heading is read
// from there.
//
// Under the grid, and clear of the year, which ends short of it, a button brings the
// cursor back to today, from either view. It moves what is shown and picks nothing,
// and stops, by aria-disabled like the arrows, where today can't be picked.
//
// With `range`, a drag begins on any press on a day, on from the anchor if Shift is
// held. Listeners on the document follow it wherever the pointer goes, past the
// edges of the grid, and read the day under it from the point, as a touch stays with
// what it first pressed. It shows the days as it goes, kept between the limits. If
// it never leaves its day the press is a click like any other, which does the rest.
// Resting on a month's arrow it turns the month, and goes on turning them until it
// leaves, for a range longer than the days showing. The two end days wear the picked
// day's edge, with a band behind the days between.
export function CalendarMonth({
  open,
  range,
  cursor,
  anchor,
  selected,
  today,
  first,
  last,
  locale,
  titleId,
  previousMonthLabel,
  nextMonthLabel,
  todayLabel,
  previousYearLabel,
  nextYearLabel,
  previousDecadeLabel,
  nextDecadeLabel,
  refract,
  readableText,
  onMove,
  onPick,
  onExtend,
  onDrag,
}: CalendarMonthProps) {
  const text = useMemo(() => formatters(locale), [locale])
  const headingRef = useRef<HTMLButtonElement>(null)
  const yearRef = useRef<HTMLDivElement>(null)
  const [picking, setPicking] = useState(false)
  // Null until the year first opens.
  const [monthCursor, setMonthCursor] = useState<Date | null>(null)
  const [yearAlign, setYearAlign] = useState<PopupAlign>('start')
  const rim = useRim()
  // To go to the month's cursor once it has been rendered, in a year that is showing.
  const goToMonth = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragging = drag !== null
  const pageTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // The way the arrow a drag is resting on turns the month, or 0 for none.
  const pagingBy = useRef(0)
  if (picking && !open) setPicking(false)
  if (drag && !open) setDrag(null)
  const shown = drag ? orderDays(drag.from, drag.to) : selected
  const weeks = monthWeeks(cursor, text.weekStart)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const hasPrevious = !first || makeDay(year, month, 0) >= first
  const hasNext = !last || makeDay(year, month + 1, 1) <= last
  const hasToday = today !== null && dayInRange(today, first, last)

  // After the popup's own, which shows it: nothing takes the focus while it is hidden.
  useEffect(() => {
    if (!goToMonth.current) return
    goToMonth.current = false
    yearRef.current?.querySelector<HTMLElement>('.prism-calendar__month[tabindex="0"]')?.focus({ preventScroll: true })
  })

  useFocusLeft(picking, [yearRef, headingRef], () => setPicking(false))

  const turnPage = useEffectEvent(() => {
    const by = pagingBy.current
    if (by < 0 ? !hasPrevious : !hasNext) return
    page(by)
    pageTimer.current = setTimeout(turnPage, DRAG_PAGE_REPEAT)
  })

  const followDrag = useEffectEvent((event: PointerEvent) => {
    const under = document.elementFromPoint?.(event.clientX, event.clientY)
    const by = Number(under?.closest<HTMLElement>('[data-page]')?.dataset.page ?? 0)
    if (by !== pagingBy.current) {
      clearTimeout(pageTimer.current)
      pagingBy.current = by
      if (by) pageTimer.current = setTimeout(turnPage, DRAG_PAGE_DELAY)
    }
    const el = under?.closest<HTMLElement>('[data-day]')
    if (!drag || !el) return
    const to = clampDay(dayOf(el), first, last)
    if (!sameDay(to, drag.to)) setDrag({ ...drag, to, moved: true })
  })

  const endDrag = useEffectEvent(() => {
    if (drag?.moved) onDrag(drag.from, drag.to)
    setDrag(null)
  })

  const cancelDrag = useEffectEvent(() => setDrag(null))

  useEffect(() => {
    if (!dragging) return
    document.addEventListener('pointermove', followDrag)
    document.addEventListener('pointerup', endDrag)
    document.addEventListener('pointercancel', cancelDrag)
    return () => {
      document.removeEventListener('pointermove', followDrag)
      document.removeEventListener('pointerup', endDrag)
      document.removeEventListener('pointercancel', cancelDrag)
      clearTimeout(pageTimer.current)
      pagingBy.current = 0
    }
  }, [dragging])

  function startDrag(event: ReactPointerEvent<HTMLTableElement>) {
    if (!range || event.button !== 0) return
    const el = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-day]')
    if (!el || el.disabled) return
    const day = dayOf(el)
    setDrag({ from: event.shiftKey && anchor ? anchor : day, to: day, moved: false })
  }

  function closeYear() {
    // Before the month that has it goes, or the focus would fall out of the calendar.
    if (yearRef.current?.contains(document.activeElement)) headingRef.current?.focus({ preventScroll: true })
    setPicking(false)
  }

  function toggleYear(event: MouseEvent<HTMLButtonElement>) {
    if (picking) return closeYear()
    // A press doesn't move the focus, so the heading only has it from the keyboard.
    goToMonth.current = document.activeElement === event.currentTarget
    setYearAlign(getComputedStyle(event.currentTarget).direction === 'rtl' ? 'end' : 'start')
    setMonthCursor(clampMonth(cursor, first, last))
    setPicking(true)
  }

  function pickMonth(picked: Date) {
    const fromKeyboard = !!yearRef.current?.contains(document.activeElement)
    const months = (picked.getFullYear() - year) * 12 + picked.getMonth() - month
    setPicking(false)
    onMove(clampDay(addMonths(cursor, months), first, last), fromKeyboard)
  }

  function goToToday() {
    if (!hasToday) return
    closeYear()
    onMove(today, false)
  }

  function page(count: number) {
    onMove(clampDay(addMonths(cursor, count), first, last), false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const next = dayForKey(cursor, event.key, {
      shift: event.shiftKey,
      rtl: getComputedStyle(event.currentTarget).direction === 'rtl',
      weekStart: text.weekStart,
    })
    if (!next) return
    event.preventDefault()
    const day = clampDay(next, first, last)
    onMove(day, true)
    if (range && event.shiftKey) onExtend(day)
  }

  return (
    <>
      <div className="prism-calendar__header">
        <button
          type="button"
          className="prism-calendar__nav"
          aria-label={previousMonthLabel ?? text.previous}
          aria-disabled={!hasPrevious}
          data-page={-1}
          onClick={() => hasPrevious && page(-1)}
        >
          <Chevron point="left" />
        </button>
        <button
          ref={headingRef}
          type="button"
          className={cx('prism-calendar__heading', picking && 'prism-calendar__heading--open')}
          aria-haspopup="dialog"
          aria-expanded={picking}
          onClick={toggleYear}
        >
          <span id={titleId} className="prism-calendar__title" aria-live="polite">
            {text.title.format(cursor)}
          </span>
          <CalendarArrow d="M3.5 5.5L7 9l3.5-3.5" />
        </button>
        {monthCursor && (
          <CalendarYear
            open={picking}
            onClose={closeYear}
            anchor={headingRef}
            align={yearAlign}
            ref={yearRef}
            cursor={monthCursor}
            shown={cursor}
            today={today}
            first={first}
            last={last}
            locale={locale}
            refract={refract}
            readableText={readableText}
            previousYearLabel={previousYearLabel}
            nextYearLabel={nextYearLabel}
            previousDecadeLabel={previousDecadeLabel}
            nextDecadeLabel={nextDecadeLabel}
            onMove={(next, focus) => {
              goToMonth.current = focus
              setMonthCursor(next)
            }}
            onPick={pickMonth}
          />
        )}
        <button
          type="button"
          className="prism-calendar__nav"
          aria-label={nextMonthLabel ?? text.next}
          aria-disabled={!hasNext}
          data-page={1}
          onClick={() => hasNext && page(1)}
        >
          <Chevron />
        </button>
      </div>
      <table
        role="grid"
        aria-labelledby={titleId}
        aria-multiselectable={range || undefined}
        className={cx('prism-calendar__grid', range && 'prism-calendar__grid--range')}
        onKeyDown={handleKeyDown}
        onPointerDown={startDrag}
      >
        <thead>
          <tr>
            {weeks[0].map((day) => (
              <th key={day.getDay()} scope="col" abbr={text.weekdayName.format(day)}>
                {text.weekday.format(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].getTime()}>
              {week.map((day) => {
                const pickable = dayInRange(day, first, last)
                const inside = shown !== null && dayInRange(day, shown.start, shown.end)
                const starts = inside && sameDay(day, shown.start)
                const ends = inside && sameDay(day, shown.end)
                const edge = starts || ends
                return (
                  <td
                    key={day.getTime()}
                    role="gridcell"
                    aria-selected={inside}
                    className={cx(
                      inside && !(starts && ends) && 'prism-calendar__cell--band',
                      inside && starts && !ends && 'prism-calendar__cell--band-start',
                      inside && ends && !starts && 'prism-calendar__cell--band-end',
                    )}
                  >
                    <button
                      type="button"
                      className={cx(
                        'prism-calendar__day',
                        day.getMonth() !== month && 'prism-calendar__day--outside',
                        edge && 'prism-calendar__day--edge',
                      )}
                      data-day={day.getTime()}
                      tabIndex={day.getTime() === cursor.getTime() ? 0 : -1}
                      disabled={!pickable}
                      aria-label={text.dayName.format(day)}
                      aria-current={sameDay(day, today) ? 'date' : undefined}
                      onClick={(event) => onPick(day, event.shiftKey, event.detail === 0)}
                    >
                      {fieldText(text.day, day, 'day')}
                      {edge && rim.element}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="prism-calendar__footer">
        <button type="button" className="prism-calendar__today" aria-disabled={!hasToday} onClick={goToToday}>
          {todayLabel ?? text.today}
        </button>
      </div>
    </>
  )
}
