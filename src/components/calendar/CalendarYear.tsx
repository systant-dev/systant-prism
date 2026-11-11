import { useId, useMemo, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Popup, type PopupAlign } from '../popup'
import { useRim } from '../../effects/rim'
import { Chevron } from '../../shared'
import { CalendarArrow } from './CalendarArrow'
import {
  addMonths,
  clampMonth,
  DECADE,
  makeDay,
  monthForKey,
  monthInRange,
  sameDay,
  startOfMonth,
  YEAR,
} from './calendarDate'
import { dateFormatter, fieldText } from './dateFormat'

/** The button names a calendar takes for moving by years, for each of which the locale has words. */
export interface CalendarYearLabels {
  previousYearLabel: string | undefined
  nextYearLabel: string | undefined
  previousDecadeLabel: string | undefined
  nextDecadeLabel: string | undefined
}

export interface CalendarYearProps extends CalendarYearLabels {
  open: boolean
  onClose: () => void
  /** The month's heading, which it opens from. */
  anchor: RefObject<HTMLElement | null>
  /** How it lines up along the heading. */
  align: PopupAlign
  ref: RefObject<HTMLDivElement | null>
  /** The first of the month with the keyboard. The year it lies in is the year shown. */
  cursor: Date
  /** A day in the month the calendar is showing. */
  shown: Date
  /** Today, as it was when the calendar opened. */
  today: Date | null
  /** The earliest day that can be picked. */
  first: Date | null
  /** The latest day that can be picked. */
  last: Date | null
  locale: string
  refract: boolean
  readableText: boolean
  /** Called as the cursor moves. `focus`: the move was a key on the grid, which the focus follows. */
  onMove: (month: Date, focus: boolean) => void
  onPick: (month: Date) => void
}

const BACK_TWICE = 'M7.5 2.5L3 7l4.5 4.5M11.5 2.5L7 7l4.5 4.5'
const ON_TWICE = 'M2.5 2.5L7 7l-4.5 4.5M6.5 2.5L11 7l-4.5 4.5'

const ROWS = [0, 3, 6, 9]
const COLUMNS = [0, 1, 2]

function formatters(locale: string) {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  return {
    year: dateFormatter(locale, { year: 'numeric' }),
    month: dateFormatter(locale, { month: 'short' }),
    monthName: dateFormatter(locale, { month: 'long', year: 'numeric' }),
    previousYear: relative.format(-1, 'year'),
    nextYear: relative.format(1, 'year'),
    previousDecade: relative.format(-10, 'year'),
    nextDecade: relative.format(10, 'year'),
  }
}

// A year in a Popup of its own over the calendar (see CalendarMonth.tsx): the twelve
// months, three to a row, under the year and the arrows that change it, by one or by
// ten, so that a date a long way off is a few presses away. The cursor is a month,
// as CalendarMonth's is a day, and the year shown is always the one it lies in, so
// the keyboard walks out of one year and into the next. Like the days', the grid is
// one Tab stop.
//
// The month the calendar is showing is marked as picked, and this month as today is.
//
// The arrows stop at the first and last years that hold a day to pick, ten at a time
// landing on them rather than short of them, and by aria-disabled, as a calendar's
// do. Months with no day to pick are disabled.
export function CalendarYear({
  open,
  onClose,
  anchor,
  align,
  ref,
  cursor,
  shown,
  today,
  first,
  last,
  locale,
  refract,
  readableText,
  previousYearLabel,
  nextYearLabel,
  previousDecadeLabel,
  nextDecadeLabel,
  onMove,
  onPick,
}: CalendarYearProps) {
  const text = useMemo(() => formatters(locale), [locale])
  const titleId = `${useId()}-year`
  const rim = useRim()
  const year = cursor.getFullYear()
  const hasEarlier = !first || year > first.getFullYear()
  const hasLater = !last || year < last.getFullYear()
  const shownMonth = startOfMonth(shown)
  const thisMonth = today && startOfMonth(today)

  function step(count: number) {
    onMove(clampMonth(addMonths(cursor, count), first, last), false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const next = monthForKey(cursor, event.key, {
      shift: event.shiftKey,
      rtl: getComputedStyle(event.currentTarget).direction === 'rtl',
    })
    if (!next) return
    event.preventDefault()
    onMove(clampMonth(next, first, last), true)
  }

  function arrow(label: string, enabled: boolean, count: number, icon: ReactNode) {
    return (
      <button
        type="button"
        className="prism-calendar__nav"
        aria-label={label}
        aria-disabled={!enabled}
        onClick={() => enabled && step(count)}
      >
        {icon}
      </button>
    )
  }

  return (
    <Popup
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      open={open}
      onClose={onClose}
      anchor={anchor}
      align={align}
      refract={refract}
      readableText={readableText}
      className="prism-calendar__year"
    >
      <div className="prism-calendar__header">
        {arrow(previousDecadeLabel ?? text.previousDecade, hasEarlier, -DECADE, <CalendarArrow d={BACK_TWICE} />)}
        {arrow(previousYearLabel ?? text.previousYear, hasEarlier, -YEAR, <Chevron point="left" />)}
        <div id={titleId} className="prism-calendar__title" aria-live="polite">
          {fieldText(text.year, cursor, 'year')}
        </div>
        {arrow(nextYearLabel ?? text.nextYear, hasLater, YEAR, <Chevron />)}
        {arrow(nextDecadeLabel ?? text.nextDecade, hasLater, DECADE, <CalendarArrow d={ON_TWICE} />)}
      </div>
      <table role="grid" aria-labelledby={titleId} className="prism-calendar__grid" onKeyDown={handleKeyDown}>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row}>
              {COLUMNS.map((column) => {
                const month = makeDay(year, row + column, 1)
                const showing = sameDay(month, shownMonth)
                return (
                  <td key={column} role="gridcell" aria-selected={showing}>
                    <button
                      type="button"
                      className="prism-calendar__month"
                      tabIndex={sameDay(month, cursor) ? 0 : -1}
                      disabled={!monthInRange(month, first, last)}
                      aria-label={text.monthName.format(month)}
                      aria-current={sameDay(month, thisMonth) ? 'date' : undefined}
                      onClick={() => onPick(month)}
                    >
                      {text.month.format(month)}
                      {showing && rim.element}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Popup>
  )
}
