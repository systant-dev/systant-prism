import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef, useState } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes, placeAt } from '../../../test/dom'
import { Calendar, type CalendarRangeProps, type CalendarSingleProps } from './Calendar'
import type { CalendarRange } from './calendarDate'

// jsdom keeps a popover it hasn't shown as display: none, where nothing can take the focus.
document.head.appendChild(document.createElement('style')).textContent = '[popover] { display: block !important; }'

// A Wednesday.
const TODAY = new Date(2026, 10, 4, 15, 30)
const ENGLISH = 'en-GB'

function input() {
  return screen.getByRole<HTMLInputElement>('combobox')
}

function pill() {
  return input().parentElement!
}

function toggle() {
  return pill().querySelector<HTMLButtonElement>('.prism-calendar__toggle')!
}

function clearButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Clear' })
}

function panel() {
  return document.getElementById(input().getAttribute('aria-controls')!)!
}

function grid() {
  return within(panel()).getByRole('grid', { hidden: true })
}

function title() {
  return panel().querySelector('.prism-calendar__title')!.textContent
}

function days() {
  return [...panel().querySelectorAll<HTMLButtonElement>('.prism-calendar__day')]
}

/** A day's accessible name, without the commas that vary between versions of a browser's locale data. */
function label(el: Element | null | undefined) {
  return el?.getAttribute('aria-label')?.replaceAll(',', '')
}

function day(name: string) {
  return days().find((el) => label(el) === name)!
}

function headings() {
  return [...panel().querySelectorAll('th')].map((el) => el.textContent)
}

function cursor() {
  return days().find((el) => el.tabIndex === 0)
}

function isOpen() {
  return input().getAttribute('aria-expanded') === 'true'
}

function arrow(name: string) {
  return within(panel()).getByRole<HTMLButtonElement>('button', { name, hidden: true })
}

function type(text: string) {
  fireEvent.change(input(), { target: { value: text } })
}

function open() {
  fireEvent.click(input())
}

/** Leaves the field, as moving to something else on the page does. */
function leave() {
  input().focus()
  act(() => input().blur())
}

function Host(props: Partial<CalendarSingleProps>) {
  return <Calendar aria-label="Date" locale={ENGLISH} {...props} />
}

beforeEach(() => {
  manualResizes()
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  vi.useFakeTimers({ now: TODAY, toFake: ['Date'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Calendar', () => {
  describe('as a combobox over a dialog', () => {
    it('ties the field to its panel, which the month names', () => {
      render(<Host />)
      open()

      expect(input().getAttribute('aria-haspopup')).toBe('dialog')
      expect(panel().getAttribute('role')).toBe('dialog')
      const heading = document.getElementById(panel().getAttribute('aria-labelledby')!)
      expect(heading?.textContent).toBe('November 2026')
      expect(grid().getAttribute('aria-labelledby')).toBe(heading?.id)
    })

    it('renders no month until it first opens', () => {
      render(<Host />)
      expect(days()).toHaveLength(0)
      open()
      expect(days()).toHaveLength(42)
    })

    it('opens from a press on the field, without moving the focus', () => {
      render(<Host />)
      input().focus()
      open()

      expect(isOpen()).toBe(true)
      expect(document.activeElement).toBe(input())
    })

    it('opens and closes from its icon, which only the pointer can reach', () => {
      render(<Host />)
      expect(toggle().tabIndex).toBe(-1)
      expect(toggle().getAttribute('aria-hidden')).toBe('true')

      fireEvent.click(toggle())
      expect(isOpen()).toBe(true)

      fireEvent.click(toggle())
      expect(isOpen()).toBe(false)
    })

    it('stays closed as the focus arrives', () => {
      render(<Host />)
      act(() => input().focus())
      expect(isOpen()).toBe(false)
    })

    it('closes on Escape', () => {
      render(<Host />)
      open()

      fireEvent.keyDown(input(), { key: 'Escape' })
      expect(isOpen()).toBe(false)
    })

    it('closes on a press elsewhere', () => {
      render(<Host />)
      open()

      fireEvent.pointerDown(document.body)
      expect(isOpen()).toBe(false)
    })

    it('closes as the focus moves elsewhere on the page', () => {
      render(
        <>
          <Host />
          <button>After</button>
        </>,
      )
      open()

      act(() => screen.getByRole('button', { name: 'After' }).focus())
      expect(isOpen()).toBe(false)
    })

    it('stays open as the focus moves into the panel', () => {
      render(<Host />)
      input().focus()
      open()

      act(() => arrow('next month').focus())
      expect(isOpen()).toBe(true)
    })

    it('stays open as the window loses the focus', () => {
      render(<Host />)
      input().focus()
      open()

      // The input stays active, as it does when the window is left.
      fireEvent.blur(input())
      expect(isOpen()).toBe(true)
    })

    it('keeps a press inside the panel from moving the focus', () => {
      render(<Host />)
      open()
      // false: the default, moving the focus, was prevented.
      expect(fireEvent.mouseDown(days()[10])).toBe(false)
    })

    it('never submits a form from a button of its own', () => {
      render(<Host />)
      open()
      const buttons = [...pill().querySelectorAll('button'), ...panel().querySelectorAll('button')]
      expect(buttons.every((button) => button.type === 'button')).toBe(true)
    })

    it('gives its props to the input, but className and style to the pill', () => {
      render(<Host id="when" placeholder="Pick" className="mine" style={{ marginLeft: 8 }} />)

      expect(input().id).toBe('when')
      expect(input().placeholder).toBe('Pick')
      expect(pill().classList.contains('mine')).toBe(true)
      expect(pill().style.marginLeft).toBe('8px')
    })

    it('forwards the input to a ref object', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Host ref={ref} />)
      expect(ref.current).toBe(input())
    })

    it('is named by a <label>', () => {
      render(
        <label>
          When <Calendar locale={ENGLISH} />
        </label>,
      )
      expect(screen.getByRole('combobox', { name: 'When' })).toBe(input())
    })

    it("calls the input's own handlers", () => {
      const onClick = vi.fn<() => void>()
      const onFocus = vi.fn<() => void>()
      const onBlur = vi.fn<() => void>()
      const onKeyDown = vi.fn<() => void>()
      render(<Host onClick={onClick} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} />)

      leave()
      open()
      fireEvent.keyDown(input(), { key: 'a' })
      expect(onClick).toHaveBeenCalledOnce()
      expect(onFocus).toHaveBeenCalledOnce()
      expect(onBlur).toHaveBeenCalledOnce()
      expect(onKeyDown).toHaveBeenCalledOnce()
    })

    it('leaves a key to a handler that takes it', () => {
      render(<Host onKeyDown={(event) => event.preventDefault()} />)

      fireEvent.keyDown(input(), { key: 'ArrowDown' })
      expect(isOpen()).toBe(false)
    })
  })

  describe('the month', () => {
    it('opens on the picked day', () => {
      render(<Host defaultValue={new Date(2024, 1, 29)} />)
      open()

      expect(title()).toBe('February 2024')
      expect(label(cursor())).toBe('Thursday 29 February 2024')
    })

    it('opens on today with nothing picked', () => {
      render(<Host />)
      open()

      expect(title()).toBe('November 2026')
      expect(label(cursor())).toBe('Wednesday 4 November 2026')
    })

    it('opens on the date typed, over the one picked', () => {
      render(<Host defaultValue={new Date(2024, 1, 29)} dateFormat="dd/MM/yyyy" />)

      type('03/05/2025')
      open()
      expect(title()).toBe('May 2025')
    })

    it('marks today and the picked day for a screen reader', () => {
      render(<Host defaultValue={new Date(2026, 10, 20)} />)
      open()

      expect(day('Wednesday 4 November 2026').getAttribute('aria-current')).toBe('date')
      expect(days().filter((el) => el.getAttribute('aria-current'))).toHaveLength(1)
      expect(day('Friday 20 November 2026').parentElement?.getAttribute('aria-selected')).toBe('true')
      expect(panel().querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
    })

    it('goes back to the picked day on opening again, wherever it was left', () => {
      render(<Host defaultValue={new Date(2026, 10, 20)} />)
      open()
      fireEvent.click(arrow('next month'))
      expect(title()).toBe('December 2026')

      fireEvent.click(toggle())
      fireEvent.click(toggle())
      expect(title()).toBe('November 2026')
    })

    it('pages by month with its arrows, keeping the focus and panel where they are', () => {
      render(<Host />)
      input().focus()
      open()

      fireEvent.click(arrow('next month'))
      expect(title()).toBe('December 2026')
      fireEvent.click(arrow('last month'))
      fireEvent.click(arrow('last month'))
      expect(title()).toBe('October 2026')

      expect(isOpen()).toBe(true)
      expect(document.activeElement).toBe(input())
    })

    it('lets the month change be heard', () => {
      render(<Host />)
      open()
      expect(panel().querySelector('.prism-calendar__title')?.getAttribute('aria-live')).toBe('polite')
    })

    it('takes other names for its arrows', () => {
      render(<Host previousMonthLabel="Earlier" nextMonthLabel="Later" />)
      open()
      expect(arrow('Earlier')).toBeTruthy()
      expect(arrow('Later')).toBeTruthy()
    })

    it('dims the days from the months either side, which can still be picked', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host onChange={onChange} />)
      open()

      const october = day('Saturday 31 October 2026')
      expect(october.classList.contains('prism-calendar__day--outside')).toBe(true)
      expect(day('Wednesday 4 November 2026').classList.contains('prism-calendar__day--outside')).toBe(false)

      fireEvent.click(october)
      expect(onChange).toHaveBeenCalledExactlyOnceWith(new Date(2026, 9, 31))
    })
  })

  describe('picking', () => {
    it('picks a day, closes and shows it, keeping a value of its own', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host onChange={onChange} />)
      open()

      fireEvent.click(day('Monday 16 November 2026'))
      expect(onChange).toHaveBeenCalledExactlyOnceWith(new Date(2026, 10, 16))
      expect(isOpen()).toBe(false)
      expect(input().value).toBe('16 Nov 2026')
    })

    it('hands the focus back to the field, from a day in the panel', () => {
      render(<Host />)
      open()
      act(() => cursor()!.focus())

      fireEvent.click(cursor()!)
      expect(document.activeElement).toBe(input())
    })

    it('shows value as given', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host value={new Date(2026, 10, 20)} onChange={onChange} />)
      open()

      fireEvent.click(day('Monday 16 November 2026'))
      expect(onChange).toHaveBeenCalledOnce()
      expect(input().value).toBe('20 Nov 2026')
    })

    it('follows a value held by its parent', () => {
      function Parent() {
        const [value, setValue] = useState<Date | null>(new Date(2026, 10, 20))
        return <Host value={value} onChange={setValue} />
      }
      render(<Parent />)
      open()

      fireEvent.click(day('Monday 16 November 2026'))
      expect(input().value).toBe('16 Nov 2026')
    })

    it('shows nothing for a value of null, rather than taking it for one of its own', () => {
      render(<Host value={null} defaultValue={new Date(2026, 10, 20)} />)
      expect(input().value).toBe('')
    })

    it('says nothing on picking the day already picked', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host defaultValue={new Date(2026, 10, 20, 9)} onChange={onChange} />)
      open()

      fireEvent.click(day('Friday 20 November 2026'))
      expect(onChange).not.toHaveBeenCalled()
      expect(isOpen()).toBe(false)
    })

    it('goes by the day alone, whatever the time of the value', () => {
      render(<Host defaultValue={new Date(2026, 10, 20, 23, 59)} />)
      open()
      expect(day('Friday 20 November 2026').parentElement?.getAttribute('aria-selected')).toBe('true')
    })

    it('clears the value, leaving the focus on the field', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host defaultValue={new Date(2026, 10, 20)} onChange={onChange} />)

      fireEvent.click(clearButton())
      expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
      expect(input().value).toBe('')
      expect(clearButton().disabled).toBe(true)
      expect(document.activeElement).toBe(input())
    })

    it('disables the clear button with nothing to clear', () => {
      render(<Host />)
      expect(clearButton().disabled).toBe(true)

      type('1')
      expect(clearButton().disabled).toBe(false)

      type('')
      expect(clearButton().disabled).toBe(true)
    })

    it('clears what was typed along with the value', () => {
      render(<Host defaultValue={new Date(2026, 10, 20)} />)

      type('tomorrow')
      fireEvent.click(clearButton())
      expect(input().value).toBe('')
    })
  })

  describe('startDate and endDate', () => {
    const startDate = new Date(2026, 10, 10)
    const endDate = new Date(2026, 11, 20)

    it('disables the days outside them, and neither end', () => {
      render(<Host startDate={startDate} endDate={endDate} defaultValue={new Date(2026, 10, 15)} />)
      open()

      expect(day('Monday 9 November 2026').disabled).toBe(true)
      expect(day('Tuesday 10 November 2026').disabled).toBe(false)

      fireEvent.click(arrow('next month'))
      expect(day('Sunday 20 December 2026').disabled).toBe(false)
      expect(day('Monday 21 December 2026').disabled).toBe(true)
    })

    it('needs only one of them', () => {
      render(<Host startDate={startDate} />)
      open()
      expect(day('Monday 9 November 2026').disabled).toBe(true)
      expect(day('Monday 30 November 2026').disabled).toBe(false)
    })

    it('has no effect on any day left out', () => {
      render(<Host />)
      open()
      expect(days().every((el) => !el.disabled)).toBe(true)
    })

    it('goes by the day alone, whatever their time', () => {
      render(<Host startDate={new Date(2026, 10, 10, 18)} endDate={new Date(2026, 10, 20, 6)} />)
      open()
      fireEvent.click(day('Tuesday 10 November 2026'))
      expect(input().value).toBe('10 Nov 2026')

      open()
      fireEvent.click(day('Friday 20 November 2026'))
      expect(input().value).toBe('20 Nov 2026')
    })

    it('opens on the nearest day that can be picked, if today is outside them', () => {
      render(<Host startDate={new Date(2027, 2, 15)} />)
      open()
      expect(title()).toBe('March 2027')
      expect(label(cursor())).toBe('Monday 15 March 2027')
    })

    it('stops its arrows at the months at either end, without dropping the focus', () => {
      render(<Host startDate={startDate} endDate={endDate} />)
      open()

      const previous = arrow('last month')
      expect(previous.getAttribute('aria-disabled')).toBe('true')
      // A disabled button would drop the focus.
      expect(previous.disabled).toBe(false)
      fireEvent.click(previous)
      expect(title()).toBe('November 2026')

      fireEvent.click(arrow('next month'))
      expect(title()).toBe('December 2026')
      expect(arrow('next month').getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(arrow('next month'))
      expect(title()).toBe('December 2026')
    })

    it('pages to a month with only a few days to pick, landing on one', () => {
      render(<Host defaultValue={new Date(2026, 10, 25)} endDate={new Date(2026, 11, 3)} />)
      open()

      fireEvent.click(arrow('next month'))
      expect(title()).toBe('December 2026')
      expect(label(cursor())).toBe('Thursday 3 December 2026')
    })

    it('keeps the keyboard between them', () => {
      render(<Host startDate={new Date(2026, 10, 3)} endDate={new Date(2026, 10, 5)} />)
      fireEvent.keyDown(input(), { key: 'ArrowDown' })

      fireEvent.keyDown(cursor()!, { key: 'ArrowUp' })
      expect(label(cursor())).toBe('Tuesday 3 November 2026')
      fireEvent.keyDown(cursor()!, { key: 'PageDown' })
      expect(label(cursor())).toBe('Thursday 5 November 2026')
    })

    it('turns down a typed date outside them', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host startDate={startDate} defaultValue={startDate} dateFormat="dd/MM/yyyy" onChange={onChange} />)

      type('09/11/2026')
      leave()
      expect(onChange).not.toHaveBeenCalled()
      expect(input().value).toBe('10/11/2026')
    })

    it('still shows a value outside them, and survives a start after the end', () => {
      render(<Host value={new Date(2020, 0, 1)} startDate={endDate} endDate={startDate} onChange={() => {}} />)
      expect(input().value).toBe('1 Jan 2020')

      open()
      expect(days().every((el) => el.disabled)).toBe(true)
    })
  })

  describe('the keyboard', () => {
    function openOnGrid() {
      input().focus()
      fireEvent.keyDown(input(), { key: 'ArrowDown' })
    }

    it('keeps the grid to one Tab stop', () => {
      render(<Host />)
      open()
      expect(days().filter((el) => el.tabIndex === 0)).toHaveLength(1)
    })

    it('opens with the focus on a day from the down arrow, without the page scrolling', () => {
      render(<Host defaultValue={new Date(2026, 10, 20)} />)
      input().focus()
      const focus = vi.spyOn(HTMLElement.prototype, 'focus')

      expect(fireEvent.keyDown(input(), { key: 'ArrowDown' })).toBe(false)
      expect(isOpen()).toBe(true)
      expect(label(document.activeElement)).toBe('Friday 20 November 2026')
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('goes to the grid from the down arrow once it is open', () => {
      render(<Host />)
      input().focus()
      open()

      fireEvent.keyDown(input(), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(cursor())
    })

    it('leaves the other arrows to the text', () => {
      render(<Host />)
      expect(fireEvent.keyDown(input(), { key: 'ArrowLeft' })).toBe(true)
      expect(fireEvent.keyDown(input(), { key: 'ArrowUp' })).toBe(true)
      expect(isOpen()).toBe(false)
    })

    it('walks the days with the focus, and the month follows', () => {
      render(<Host defaultValue={new Date(2026, 10, 30)} />)
      openOnGrid()

      expect(fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })).toBe(false)
      expect(label(document.activeElement)).toBe('Tuesday 1 December 2026')
      expect(title()).toBe('December 2026')
    })

    it('swaps left and right in text that runs right to left', () => {
      render(
        <div dir="rtl" style={{ direction: 'rtl' }}>
          <Host defaultValue={new Date(2026, 10, 18)} />
        </div>,
      )
      openOnGrid()

      fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
      expect(label(document.activeElement)).toBe('Thursday 19 November 2026')
    })

    it('goes by the week of the locale for Home and End', () => {
      render(<Host locale="en-US" defaultValue={new Date(2026, 10, 18)} />)
      openOnGrid()

      fireEvent.keyDown(document.activeElement!, { key: 'Home' })
      expect(label(document.activeElement)).toBe('Sunday November 15 2026')
      fireEvent.keyDown(document.activeElement!, { key: 'End' })
      expect(label(document.activeElement)).toBe('Saturday November 21 2026')
    })

    it('pages by a month, or with Shift by a year', () => {
      render(<Host defaultValue={new Date(2026, 0, 31)} />)
      openOnGrid()

      fireEvent.keyDown(document.activeElement!, { key: 'PageDown' })
      expect(label(document.activeElement)).toBe('Saturday 28 February 2026')

      fireEvent.keyDown(document.activeElement!, { key: 'PageDown', shiftKey: true })
      expect(title()).toBe('February 2027')
    })

    it('picks the day with the focus, as any button, and returns to the field', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host onChange={onChange} />)
      openOnGrid()

      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
      fireEvent.click(document.activeElement!)
      expect(onChange).toHaveBeenCalledExactlyOnceWith(new Date(2026, 10, 5))
      expect(document.activeElement).toBe(input())
    })

    it('returns to the field from Escape in the grid', () => {
      render(<Host />)
      openOnGrid()

      fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      expect(isOpen()).toBe(false)
      expect(document.activeElement).toBe(input())
    })

    it('leaves a key on the grid it has no use for', () => {
      render(<Host />)
      openOnGrid()
      expect(fireEvent.keyDown(document.activeElement!, { key: 'a' })).toBe(true)
    })

    it('leaves the keys to an input method part way through a composition', () => {
      render(<Host />)
      expect(fireEvent.keyDown(input(), { key: 'ArrowDown', isComposing: true })).toBe(true)
      expect(isOpen()).toBe(false)
    })
  })

  describe('typing', () => {
    const format = { dateFormat: 'dd/MM/yyyy' }

    it('takes up a date as the field loses the focus', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} onChange={onChange} />)

      type('16/11/2026')
      expect(onChange).not.toHaveBeenCalled()

      leave()
      expect(onChange).toHaveBeenCalledExactlyOnceWith(new Date(2026, 10, 16))
    })

    it('rewrites what was typed as the format writes it', () => {
      render(<Host {...format} />)

      type('1-2-26')
      leave()
      expect(input().value).toBe('01/02/2026')
    })

    it('takes up a date on Enter, and keeps it from a form', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} onChange={onChange} />)

      type('16/11/2026')
      expect(fireEvent.keyDown(input(), { key: 'Enter' })).toBe(false)
      expect(onChange).toHaveBeenCalledExactlyOnceWith(new Date(2026, 10, 16))
      expect(input().value).toBe('16/11/2026')
    })

    it('leaves Enter to a form with nothing typed and the panel closed', () => {
      render(<Host {...format} />)
      expect(fireEvent.keyDown(input(), { key: 'Enter' })).toBe(true)
    })

    it('closes on Enter while open', () => {
      render(<Host {...format} />)
      open()

      expect(fireEvent.keyDown(input(), { key: 'Enter' })).toBe(false)
      expect(isOpen()).toBe(false)
    })

    it('moves the open month along as a date is typed, without taking it up', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} onChange={onChange} />)
      open()

      type('16/03/2025')
      expect(title()).toBe('March 2025')
      expect(onChange).not.toHaveBeenCalled()
    })

    it('stays on the month through what is not yet a date', () => {
      render(<Host {...format} />)
      open()

      type('16/1')
      expect(title()).toBe('November 2026')
    })

    it('goes back to the value from what is not a date', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} onChange={onChange} />)

      type('soon')
      leave()
      expect(onChange).not.toHaveBeenCalled()
      expect(input().value).toBe('20/11/2026')
    })

    it('clears the value from an emptied field', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} onChange={onChange} />)

      type('')
      leave()
      expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
      expect(input().value).toBe('')
    })

    it('says nothing if the date typed is the one already picked', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} onChange={onChange} />)

      type('20/11/26')
      leave()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('says nothing on leaving a field with nothing typed', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} onChange={onChange} />)

      leave()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('forgets what was typed on Escape with the panel closed', () => {
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} />)

      type('soon')
      fireEvent.keyDown(input(), { key: 'Escape' })
      expect(input().value).toBe('20/11/2026')
    })

    it('keeps what is typed as the window loses the focus', () => {
      render(<Host {...format} />)
      input().focus()
      type('16/11')

      // The input stays active, as it does when the window is left.
      fireEvent.blur(input())
      expect(input().value).toBe('16/11')
    })

    it('selects its text on taking the focus, to type over', () => {
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} />)

      act(() => input().focus())
      expect([input().selectionStart, input().selectionEnd]).toEqual([0, 10])
    })

    it('keeps its selection as it comes back with the window', () => {
      render(<Host {...format} defaultValue={new Date(2026, 10, 20)} />)
      act(() => input().focus())

      fireEvent.blur(input())
      input().setSelectionRange(3, 3)
      fireEvent.focus(input())
      expect(input().selectionStart).toBe(3)
    })
  })

  describe('locale', () => {
    it('follows the language of the browser', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')
      render(<Calendar aria-label="Date" defaultValue={new Date(2026, 10, 4)} />)
      open()

      expect(input().value).toBe('04.11.2026')
      expect(title()).toBe('November 2026')
      expect(headings()).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    })

    it('starts the week as the language of the browser does', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
      render(<Calendar aria-label="Date" />)
      open()
      expect(headings()[0]).toBe('Sun')
    })

    it('follows the language of the browser as it changes', () => {
      const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB')
      render(<Calendar aria-label="Date" defaultValue={new Date(2026, 10, 4)} />)
      expect(input().value).toBe('4 Nov 2026')

      language.mockReturnValue('en-US')
      act(() => {
        window.dispatchEvent(new Event('languagechange'))
      })
      expect(input().value).toBe('Nov 4, 2026')
    })

    it('takes a locale of its own over the browser', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
      render(<Calendar aria-label="Date" locale="fr-FR" defaultValue={new Date(2026, 10, 4)} />)
      open()

      expect(input().value).toBe('4 nov. 2026')
      expect(title()).toBe('novembre 2026')
      expect(headings()[0]).toBe('lun.')
      expect(arrow('le mois prochain')).toBeTruthy()
    })

    it("names each day's column in full for a screen reader", () => {
      render(<Host />)
      open()
      expect(panel().querySelector('th')?.getAttribute('abbr')).toBe('Monday')
      expect(panel().querySelector('th')?.getAttribute('scope')).toBe('col')
    })

    it.each(['ar-EG', 'he-IL'])(
      'keeps the headings of %s, whose short names are whole words, from running together',
      (locale) => {
        render(<Host locale={locale} />)
        open()

        expect(headings().every((heading) => heading.length <= 4)).toBe(true)
        expect(panel().querySelector('th')?.getAttribute('abbr')?.length).toBeGreaterThan(4)
      },
    )

    it('keeps short names where they fit', () => {
      render(<Host locale="fr-FR" />)
      open()
      expect(headings()[0]).toBe('lun.')
    })

    it("shows a locale's numerals, without what it writes round a lone day", () => {
      render(<Host locale="ar-EG" />)
      open()
      expect(cursor()?.textContent).toBe('٤')
      cleanup()

      render(<Host locale="ja-JP" />)
      open()
      expect(cursor()?.textContent).toBe('4')
    })

    it('stays on the Gregorian calendar in a locale with another', () => {
      render(<Host locale="th-TH" dateFormat="yyyy" defaultValue={new Date(2026, 10, 4)} />)
      open()

      expect(input().value).toBe('2026')
      expect(title()).toContain('2026')
    })

    it('hydrates what a server wrote, then goes over to the language of the browser', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const tree = <Calendar aria-label="Date" defaultValue={new Date(2026, 10, 4)} />
      const container = document.body.appendChild(document.createElement('div'))
      container.innerHTML = renderToString(tree)
      expect(container.querySelector('input')?.value).toBe('Nov 4, 2026')

      let root: Root
      act(() => {
        root = hydrateRoot(container, tree)
      })
      expect(error).not.toHaveBeenCalled()
      expect(container.querySelector('input')?.value).toBe('04.11.2026')
      act(() => root.unmount())
      container.remove()
    })
  })

  describe('dateFormat', () => {
    it('defaults to the medium date of the locale', () => {
      render(<Host defaultValue={new Date(2026, 10, 4)} />)
      expect(input().value).toBe('4 Nov 2026')
    })

    it('takes a pattern', () => {
      render(<Host dateFormat="EEE, dd/MM/yyyy" defaultValue={new Date(2026, 10, 4)} />)
      expect(input().value).toBe('Wed, 04/11/2026')
    })

    it("takes Intl's options", () => {
      render(<Host dateFormat={{ dateStyle: 'full' }} defaultValue={new Date(2026, 10, 4)} />)
      expect(input().value.replace(',', '')).toBe('Wednesday 4 November 2026')
    })

    it('changes the field as it changes', () => {
      const { rerender } = render(<Host dateFormat="dd/MM/yyyy" defaultValue={new Date(2026, 10, 4)} />)
      rerender(<Host dateFormat="yyyy-MM-dd" defaultValue={new Date(2026, 10, 4)} />)
      expect(input().value).toBe('2026-11-04')
    })
  })

  describe('the year view', () => {
    function heading() {
      return panel().querySelector<HTMLButtonElement>('.prism-calendar__heading')!
    }

    function year() {
      return panel().querySelector<HTMLElement>('.prism-calendar__year')!
    }

    function yearTitle() {
      return year().querySelector('.prism-calendar__title')!.textContent
    }

    function months() {
      return [...year().querySelectorAll<HTMLButtonElement>('.prism-calendar__month')]
    }

    function month(name: string) {
      return months().find((el) => el.getAttribute('aria-label') === name)!
    }

    function monthCursor() {
      return months().find((el) => el.tabIndex === 0)
    }

    function isPicking() {
      return heading().getAttribute('aria-expanded') === 'true'
    }

    function yearArrow(name: string) {
      return within(year()).getByRole<HTMLButtonElement>('button', { name, hidden: true })
    }

    /** Opens the calendar and then the year by the pointer, which leaves the focus on the field. */
    function openYear() {
      input().focus()
      open()
      fireEvent.click(heading())
    }

    /** Opens the calendar and then the year from the keyboard, with the focus on the heading. */
    function openYearByKey() {
      open()
      act(() => heading().focus())
      fireEvent.click(heading())
    }

    it('opens from the heading, which says that it does', () => {
      render(<Host />)
      open()
      expect(heading().getAttribute('aria-haspopup')).toBe('dialog')
      expect(isPicking()).toBe(false)

      fireEvent.click(heading())
      expect(isPicking()).toBe(true)
      expect(heading().classList.contains('prism-calendar__heading--open')).toBe(true)
    })

    it('closes from the heading', () => {
      render(<Host />)
      openYear()

      fireEvent.click(heading())
      expect(isPicking()).toBe(false)
    })

    it('renders no year until it first opens', () => {
      render(<Host />)
      open()
      expect(year()).toBeNull()
    })

    it('is a dialog inside the calendar, named by its year, as is its grid', () => {
      render(<Host />)
      openYear()

      expect(panel().contains(year())).toBe(true)
      expect(year().getAttribute('role')).toBe('dialog')
      const titleId = year().getAttribute('aria-labelledby')!
      expect(document.getElementById(titleId)?.textContent).toBe('2026')
      expect(within(year()).getByRole('grid', { hidden: true }).getAttribute('aria-labelledby')).toBe(titleId)
    })

    it('lays out the twelve months, three to a row', () => {
      render(<Host />)
      openYear()

      expect(months().map((el) => el.textContent)).toEqual([
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sept',
        'Oct',
        'Nov',
        'Dec',
      ])
      expect([...year().querySelectorAll('tr')].map((row) => row.children.length)).toEqual([3, 3, 3, 3])
    })

    it('opens on the year showing, marking the month showing and this month', () => {
      render(<Host defaultValue={new Date(2026, 2, 15)} />)
      openYear()

      expect(yearTitle()).toBe('2026')
      expect(month('March 2026').parentElement?.getAttribute('aria-selected')).toBe('true')
      expect(year().querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
      expect(month('November 2026').getAttribute('aria-current')).toBe('date')
      expect(months().filter((el) => el.getAttribute('aria-current'))).toHaveLength(1)
      expect(monthCursor()).toBe(month('March 2026'))
    })

    it('changes the year by one or ten with its arrows, leaving the month showing alone', () => {
      render(<Host />)
      openYear()

      fireEvent.click(yearArrow('next year'))
      expect(yearTitle()).toBe('2027')
      fireEvent.click(yearArrow('last year'))
      fireEvent.click(yearArrow('last year'))
      expect(yearTitle()).toBe('2025')
      fireEvent.click(yearArrow('10 years ago'))
      expect(yearTitle()).toBe('2015')
      fireEvent.click(yearArrow('in 10 years'))
      fireEvent.click(yearArrow('in 10 years'))
      expect(yearTitle()).toBe('2035')

      expect(isPicking()).toBe(true)
      expect(title()).toBe('November 2026')
    })

    it('only marks the month showing in its own year', () => {
      render(<Host />)
      openYear()

      fireEvent.click(yearArrow('next year'))
      expect(year().querySelectorAll('[aria-selected="true"]')).toHaveLength(0)
      expect(months().some((el) => el.getAttribute('aria-current'))).toBe(false)
    })

    it('shows the month picked, leaving the calendar open and the value alone', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host defaultValue={new Date(2026, 10, 20)} onChange={onChange} />)
      openYear()

      fireEvent.click(yearArrow('10 years ago'))
      fireEvent.click(month('March 2016'))

      expect(title()).toBe('March 2016')
      expect(label(cursor())).toBe('Sunday 20 March 2016')
      expect(isPicking()).toBe(false)
      expect(isOpen()).toBe(true)
      expect(onChange).not.toHaveBeenCalled()
      expect(input().value).toBe('20 Nov 2026')
    })

    it('lands on the last day of a shorter month', () => {
      render(<Host defaultValue={new Date(2026, 0, 31)} />)
      openYear()

      fireEvent.click(month('February 2026'))
      expect(label(cursor())).toBe('Saturday 28 February 2026')
    })

    it('goes back to the month showing on opening again, wherever it was left', () => {
      render(<Host />)
      openYear()
      fireEvent.click(yearArrow('in 10 years'))

      fireEvent.click(heading())
      fireEvent.click(heading())
      expect(yearTitle()).toBe('2026')
    })

    it('goes on the first Escape, and the calendar on the second', () => {
      render(<Host />)
      openYear()

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(isPicking()).toBe(false)
      expect(isOpen()).toBe(true)

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(isOpen()).toBe(false)
    })

    it('goes on a press in the calendar, which stays', () => {
      render(<Host />)
      openYear()

      fireEvent.pointerDown(days()[10])
      expect(isPicking()).toBe(false)
      expect(isOpen()).toBe(true)
    })

    it('stays on a press inside it, or on the heading, which toggles it', () => {
      render(<Host />)
      openYear()

      fireEvent.pointerDown(months()[0])
      fireEvent.pointerDown(heading())
      expect(isPicking()).toBe(true)
      expect(isOpen()).toBe(true)
    })

    it('hands the focus to the heading on a press in the calendar, rather than lose it', () => {
      render(<Host />)
      openYearByKey()
      expect(year().contains(document.activeElement)).toBe(true)

      fireEvent.pointerDown(days()[10])
      expect(document.activeElement).toBe(heading())
      expect(isPicking()).toBe(false)
    })

    it('leaves the focus on the field on a press in the calendar, if that is where it is', () => {
      render(<Host />)
      openYear()

      fireEvent.pointerDown(days()[10])
      expect(document.activeElement).toBe(input())
    })

    describe('its place', () => {
      function place(direction: 'ltr' | 'rtl') {
        render(
          <div dir={direction} style={{ direction }}>
            <Host />
          </div>,
        )
        vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000)
        vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800)
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100)
        open()
        placeAt(heading(), 300, 100, 120, 36)
        fireEvent.click(heading())
      }

      it('lines its left edge up with the heading, which hugs the name of the month', () => {
        place('ltr')
        expect(year().style.left).toBe('300px')
      })

      it('lines its right edge up with the heading in text that runs right to left', () => {
        place('rtl')
        expect(year().style.left).toBe('220px')
      })
    })

    it('goes with the calendar on a press elsewhere', () => {
      render(<Host />)
      openYear()

      fireEvent.pointerDown(document.body)
      expect(isPicking()).toBe(false)
      expect(isOpen()).toBe(false)
    })

    it('stays shut as the calendar opens again', () => {
      render(<Host />)
      openYear()
      fireEvent.pointerDown(document.body)

      open()
      expect(isOpen()).toBe(true)
      expect(isPicking()).toBe(false)
    })

    it('keeps a press inside it from moving the focus, so the field keeps it', () => {
      render(<Host />)
      openYear()

      expect(fireEvent.mouseDown(months()[3])).toBe(false)
      fireEvent.click(months()[3])
      expect(document.activeElement).toBe(input())
    })

    it('goes as the focus moves to the rest of the calendar', () => {
      render(<Host />)
      openYear()

      act(() => arrow('next month').focus())
      expect(isPicking()).toBe(false)
      expect(isOpen()).toBe(true)
    })

    it('stays as the focus moves inside it or back to the heading', () => {
      render(<Host />)
      openYear()

      act(() => yearArrow('next year').focus())
      act(() => heading().focus())
      expect(isPicking()).toBe(true)
    })

    it('goes as the down arrow takes the focus from the field to a day', () => {
      render(<Host />)
      openYear()

      fireEvent.keyDown(input(), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(cursor())
      expect(isPicking()).toBe(false)
    })

    it('goes as the field takes up what was typed', () => {
      render(<Host />)
      openYear()

      fireEvent.keyDown(input(), { key: 'Enter' })
      expect(isOpen()).toBe(false)
      expect(isPicking()).toBe(false)
    })

    describe('from the keyboard', () => {
      it('takes the focus to the month showing, without the page scrolling', () => {
        render(<Host />)
        open()
        act(() => heading().focus())
        const focus = vi.spyOn(HTMLElement.prototype, 'focus')

        fireEvent.click(heading())
        expect(document.activeElement).toBe(month('November 2026'))
        expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      })

      it('keeps the grid to one Tab stop', () => {
        render(<Host />)
        openYearByKey()
        expect(months().filter((el) => el.tabIndex === 0)).toHaveLength(1)
      })

      it('walks the months with the focus, three to a row, into the next year', () => {
        render(<Host />)
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
        expect(document.activeElement).toBe(month('December 2026'))
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
        expect(document.activeElement).toBe(month('September 2026'))
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
        expect(yearTitle()).toBe('2027')
        expect(document.activeElement).toBe(month('January 2027'))
      })

      it('swaps left and right in text that runs right to left', () => {
        render(
          <div dir="rtl" style={{ direction: 'rtl' }}>
            <Host />
          </div>,
        )
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
        expect(document.activeElement).toBe(month('December 2026'))
      })

      it('goes to either end of the year with Home and End', () => {
        render(<Host />)
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'Home' })
        expect(document.activeElement).toBe(month('January 2026'))
        fireEvent.keyDown(document.activeElement!, { key: 'End' })
        expect(document.activeElement).toBe(month('December 2026'))
      })

      it('pages by a year, or with Shift by ten', () => {
        render(<Host />)
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'PageUp' })
        expect(document.activeElement).toBe(month('November 2025'))
        fireEvent.keyDown(document.activeElement!, { key: 'PageDown', shiftKey: true })
        expect(document.activeElement).toBe(month('November 2035'))
      })

      it('takes the keys it uses from the page, and leaves it the rest', () => {
        render(<Host />)
        openYearByKey()

        expect(fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })).toBe(false)
        expect(fireEvent.keyDown(document.activeElement!, { key: 'a' })).toBe(true)
      })

      it('leaves the days to their own keys', () => {
        render(<Host />)
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
        expect(title()).toBe('November 2026')
      })

      it('goes on to the day from the month picked', () => {
        render(<Host defaultValue={new Date(2026, 10, 20)} />)
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
        fireEvent.click(document.activeElement!)
        expect(title()).toBe('October 2026')
        expect(document.activeElement).toBe(cursor())
        expect(label(document.activeElement)).toBe('Tuesday 20 October 2026')
      })

      it('goes back to the heading on Escape, with the calendar still open', () => {
        render(<Host />)
        openYearByKey()

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(document.activeElement).toBe(heading())
        expect(isPicking()).toBe(false)
        expect(isOpen()).toBe(true)
      })
    })

    describe('with startDate and endDate', () => {
      const startDate = new Date(2024, 2, 31)
      const endDate = new Date(2026, 10, 1)

      it('disables the months with no day to pick, but not those with one', () => {
        render(<Host startDate={startDate} endDate={endDate} />)
        openYear()

        expect(month('November 2026').disabled).toBe(false)
        expect(month('December 2026').disabled).toBe(true)

        fireEvent.click(yearArrow('10 years ago'))
        expect(month('February 2024').disabled).toBe(true)
        expect(month('March 2024').disabled).toBe(false)
      })

      it('lands ten years at a time on a limit, rather than stopping short of it', () => {
        render(<Host startDate={startDate} endDate={endDate} />)
        openYear()

        fireEvent.click(yearArrow('10 years ago'))
        expect(yearTitle()).toBe('2024')
        expect(monthCursor()).toBe(month('March 2024'))
      })

      it('stops its arrows at the years at either end, without dropping the focus', () => {
        render(<Host startDate={startDate} endDate={endDate} />)
        openYear()

        const next = yearArrow('next year')
        expect(next.getAttribute('aria-disabled')).toBe('true')
        expect(next.disabled).toBe(false)
        expect(yearArrow('in 10 years').getAttribute('aria-disabled')).toBe('true')
        fireEvent.click(next)
        fireEvent.click(yearArrow('in 10 years'))
        expect(yearTitle()).toBe('2026')

        fireEvent.click(yearArrow('last year'))
        expect(yearArrow('last year').getAttribute('aria-disabled')).toBe('false')
        fireEvent.click(yearArrow('last year'))
        expect(yearArrow('last year').getAttribute('aria-disabled')).toBe('true')
        expect(yearArrow('10 years ago').getAttribute('aria-disabled')).toBe('true')
      })

      it('keeps the keyboard on the months with a day to pick', () => {
        render(<Host startDate={startDate} endDate={endDate} />)
        openYearByKey()

        fireEvent.keyDown(document.activeElement!, { key: 'PageDown' })
        expect(document.activeElement).toBe(month('November 2026'))
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
        expect(document.activeElement).toBe(month('November 2026'))
        fireEvent.keyDown(document.activeElement!, { key: 'PageUp', shiftKey: true })
        expect(document.activeElement).toBe(month('March 2024'))
      })

      it('lands on a day that can be picked, in a month with only a few', () => {
        render(<Host defaultValue={new Date(2026, 4, 15)} startDate={startDate} endDate={endDate} />)
        openYear()

        fireEvent.click(month('November 2026'))
        expect(title()).toBe('November 2026')
        expect(label(cursor())).toBe('Sunday 1 November 2026')
      })

      it('needs only one of them', () => {
        render(<Host endDate={endDate} />)
        openYear()

        expect(yearArrow('next year').getAttribute('aria-disabled')).toBe('true')
        expect(yearArrow('last year').getAttribute('aria-disabled')).toBe('false')
      })
    })

    describe('locale', () => {
      it("writes its months in the locale, with the arrows' names", () => {
        render(<Host locale="fr-FR" />)
        openYear()

        expect(months()[0].textContent).toBe('janv.')
        expect(month('novembre 2026')).toBeTruthy()
        expect(yearArrow('l’année prochaine')).toBeTruthy()
      })

      it('takes other names for its arrows', () => {
        render(
          <Host previousYearLabel="Back" nextYearLabel="On" previousDecadeLabel="Way back" nextDecadeLabel="Way on" />,
        )
        openYear()

        expect(yearArrow('Back')).toBeTruthy()
        expect(yearArrow('On')).toBeTruthy()
        expect(yearArrow('Way back')).toBeTruthy()
        expect(yearArrow('Way on')).toBeTruthy()
      })

      it("writes the year in the locale's numerals, without what it writes round a lone year", () => {
        render(<Host locale="ar-EG" />)
        openYear()
        expect(yearTitle()).toBe('٢٠٢٦')
        cleanup()

        render(<Host locale="ja-JP" />)
        openYear()
        expect(yearTitle()).toBe('2026')
      })

      it('stays on the Gregorian calendar in a locale with another', () => {
        render(<Host locale="th-TH" />)
        openYear()
        expect(yearTitle()).toBe('2026')
      })
    })
  })

  describe('the Today button', () => {
    function todayButton() {
      return within(panel()).getByRole<HTMLButtonElement>('button', { name: 'Today', hidden: true })
    }

    function heading() {
      return panel().querySelector<HTMLButtonElement>('.prism-calendar__heading')!
    }

    function pickingYear() {
      return heading().getAttribute('aria-expanded') === 'true'
    }

    it("goes to today's month, on today, from anywhere", () => {
      render(<Host defaultValue={new Date(1985, 2, 5)} />)
      open()
      expect(title()).toBe('March 1985')

      fireEvent.click(todayButton())
      expect(title()).toBe('November 2026')
      expect(label(cursor())).toBe('Wednesday 4 November 2026')
    })

    it('picks nothing, and leaves the calendar open', () => {
      const onChange = vi.fn<(value: Date | null) => void>()
      render(<Host defaultValue={new Date(1985, 2, 5)} onChange={onChange} />)
      open()

      fireEvent.click(todayButton())
      expect(onChange).not.toHaveBeenCalled()
      expect(input().value).toBe('5 Mar 1985')
      expect(isOpen()).toBe(true)
    })

    it('leaves the day picked marked, for when its month comes round again', () => {
      render(<Host defaultValue={new Date(1985, 2, 5)} />)
      open()

      fireEvent.click(todayButton())
      expect(panel().querySelectorAll('[aria-selected="true"]')).toHaveLength(0)
      expect(day('Wednesday 4 November 2026').getAttribute('aria-current')).toBe('date')
    })

    it('leaves what was typed alone', () => {
      render(<Host dateFormat="dd/MM/yyyy" />)
      open()
      type('01/02/2003')

      fireEvent.click(todayButton())
      expect(input().value).toBe('01/02/2003')
    })

    it('comes after the grid in the Tab order, and never submits a form', () => {
      render(<Host />)
      open()

      expect(grid().compareDocumentPosition(todayButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(todayButton().type).toBe('button')
    })

    it('keeps the focus on itself from the keyboard, as the arrows do', () => {
      render(<Host defaultValue={new Date(1985, 2, 5)} />)
      open()
      act(() => todayButton().focus())

      fireEvent.click(todayButton())
      expect(document.activeElement).toBe(todayButton())
    })

    it('closes the year view on the way', () => {
      render(<Host defaultValue={new Date(1985, 2, 5)} />)
      open()
      fireEvent.click(heading())

      fireEvent.pointerDown(todayButton())
      fireEvent.click(todayButton())
      expect(pickingYear()).toBe(false)
      expect(title()).toBe('November 2026')
      expect(isOpen()).toBe(true)
    })

    it('closes the year view when pressed with no pointer, as a screen reader does', () => {
      render(<Host defaultValue={new Date(1985, 2, 5)} />)
      open()
      fireEvent.click(heading())

      fireEvent.click(todayButton())
      expect(pickingYear()).toBe(false)
      expect(title()).toBe('November 2026')
    })

    it('stops, keeping the focus, where today is before the start', () => {
      render(<Host startDate={new Date(2027, 0, 1)} />)
      open()

      expect(todayButton().getAttribute('aria-disabled')).toBe('true')
      expect(todayButton().disabled).toBe(false)
      fireEvent.click(todayButton())
      expect(title()).toBe('January 2027')
    })

    it('stops where today is after the end', () => {
      render(<Host endDate={new Date(2026, 0, 1)} />)
      open()

      fireEvent.click(todayButton())
      expect(todayButton().getAttribute('aria-disabled')).toBe('true')
      expect(title()).toBe('January 2026')
    })

    it('goes where today is on either limit', () => {
      render(<Host startDate={TODAY} endDate={TODAY} />)
      open()
      expect(todayButton().getAttribute('aria-disabled')).toBe('false')
    })

    it("is in the locale's word, starting as a sentence does", () => {
      render(<Host locale="de-DE" />)
      open()
      expect(within(panel()).getByRole('button', { name: 'Heute', hidden: true })).toBeTruthy()
    })

    it('takes another word', () => {
      render(<Host todayLabel="Now" />)
      open()
      expect(within(panel()).getByRole('button', { name: 'Now', hidden: true })).toBeTruthy()
    })

    it('keeps today up to date from one opening to the next', () => {
      render(<Host />)
      open()
      fireEvent.pointerDown(document.body)

      vi.setSystemTime(new Date(2026, 11, 25, 9))
      open()
      fireEvent.click(arrow('last month'))
      fireEvent.click(todayButton())
      expect(label(cursor())).toBe('Friday 25 December 2026')
    })
  })

  describe("the picked day's edge", () => {
    function rims() {
      return [...panel().querySelectorAll('.prism-rim')].filter((el) => el.parentElement !== panel())
    }

    it("has a button's rim, on the picked day alone", () => {
      render(<Host defaultValue={new Date(2026, 10, 20)} />)
      open()

      expect(rims().map((el) => el.parentElement)).toEqual([day('Friday 20 November 2026')])
    })

    it('has none with nothing picked', () => {
      render(<Host />)
      open()
      expect(rims()).toHaveLength(0)
    })

    it('moves with the value', () => {
      const { rerender } = render(<Host value={new Date(2026, 10, 20)} onChange={() => {}} />)
      open()

      rerender(<Host value={new Date(2026, 10, 21)} onChange={() => {}} />)
      expect(rims().map((el) => el.parentElement)).toEqual([day('Saturday 21 November 2026')])
    })

    it('hides its rim from a screen reader, leaving the name of the day', () => {
      render(<Host defaultValue={new Date(2026, 10, 20)} />)
      open()

      expect(rims()[0].getAttribute('aria-hidden')).toBe('true')
      expect(day('Friday 20 November 2026').textContent).toBe('20')
    })

    it('marks the month showing the same way in the year view', () => {
      render(<Host />)
      open()
      fireEvent.click(panel().querySelector('.prism-calendar__heading')!)

      const year = panel().querySelector('.prism-calendar__year')!
      const marked = [...year.querySelectorAll('.prism-calendar__month .prism-rim')]
      expect(marked.map((el) => el.parentElement?.getAttribute('aria-label'))).toEqual(['November 2026'])
    })
  })

  describe('with range', () => {
    const nov = (date: number) => new Date(2026, 10, date)
    const dec = (date: number) => new Date(2026, 11, date)

    /** The element the page says lies under the pointer, as jsdom has no layout to ask. */
    let under: Element | null = null

    function RangeHost(props: Partial<CalendarRangeProps>) {
      return <Calendar aria-label="Dates" locale={ENGLISH} range {...props} />
    }

    function novDay(date: number) {
      return days().find((el) => {
        return el.textContent === String(date) && !el.classList.contains('prism-calendar__day--outside')
      })!
    }

    function pointerEvent(target: EventTarget, name: string, init: MouseEventInit = {}) {
      act(() => {
        target.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, ...init }))
      })
    }

    function dragOver(...els: Element[]) {
      for (const el of els) {
        under = el
        pointerEvent(document, 'pointermove')
      }
    }

    function drag(from: Element, ...over: Element[]) {
      pointerEvent(from, 'pointerdown')
      dragOver(...over)
      pointerEvent(document, 'pointerup')
    }

    function selectedLabels() {
      return [...panel().querySelectorAll('[aria-selected="true"] > .prism-calendar__day')].map(label)
    }

    function edges() {
      return [...panel().querySelectorAll('.prism-calendar__day--edge')].map((el) => el.textContent)
    }

    beforeEach(() => {
      under = null
      Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => under })
    })

    afterEach(() => {
      Reflect.deleteProperty(document, 'elementFromPoint')
    })

    describe('the field', () => {
      it('writes both days', () => {
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(8) }} />)
        expect(input().value).toBe('4 Nov 2026 – 8 Nov 2026')
      })

      it('marks its pill, for the room two days take, and only with range', () => {
        render(<RangeHost />)
        expect(pill().classList.contains('prism-calendar--range')).toBe(true)
        cleanup()

        render(<Host />)
        expect(pill().classList.contains('prism-calendar--range')).toBe(false)
      })

      it('writes one day for a range of one day', () => {
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(4) }} />)
        expect(input().value).toBe('4 Nov 2026')
      })

      it('takes its dateFormat and another separator', () => {
        render(
          <RangeHost dateFormat="dd/MM/yyyy" rangeSeparator=" to " defaultValue={{ start: nov(4), end: nov(8) }} />,
        )
        expect(input().value).toBe('04/11/2026 to 08/11/2026')
      })

      it('shows nothing for null', () => {
        render(<RangeHost value={null} defaultValue={{ start: nov(4), end: nov(8) }} />)
        expect(input().value).toBe('')
      })

      it('puts a value given backwards the right way round, and goes by the day alone', () => {
        render(<RangeHost defaultValue={{ start: new Date(2026, 10, 8, 22), end: new Date(2026, 10, 4, 3) }} />)
        expect(input().value).toBe('4 Nov 2026 – 8 Nov 2026')
      })
    })

    describe('a press', () => {
      it('picks that day as a range, leaving the calendar open for the other end', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        fireEvent.click(novDay(10))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(10), end: nov(10) })
        expect(isOpen()).toBe(true)
        expect(input().value).toBe('10 Nov 2026')
      })

      it('starts again from a new day, over a range already picked', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(8) }} onChange={onChange} />)
        open()

        fireEvent.click(novDay(20))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(20), end: nov(20) })
      })
    })

    describe('Shift and a press', () => {
      it('picks all the days from the anchor, and closes', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        fireEvent.click(novDay(10))

        fireEvent.click(novDay(14), { shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(10), end: nov(14) })
        expect(isOpen()).toBe(false)
        expect(input().value).toBe('10 Nov 2026 – 14 Nov 2026')
      })

      it('hands the focus back to the field', () => {
        render(<RangeHost />)
        input().focus()
        open()
        fireEvent.click(novDay(10))

        fireEvent.click(novDay(14), { shiftKey: true })
        expect(document.activeElement).toBe(input())
      })

      it('goes backwards from the anchor as well', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        fireEvent.click(novDay(14))

        fireEvent.click(novDay(10), { shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(10), end: nov(14) })
      })

      it('keeps its anchor while the months go by', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        fireEvent.click(novDay(20))
        fireEvent.click(arrow('next month'))

        fireEvent.click(day('Sunday 20 December 2026'), { shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(20), end: dec(20) })
      })

      it('keeps its anchor through the year view', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        fireEvent.click(novDay(20))

        fireEvent.click(panel().querySelector('.prism-calendar__heading')!)
        fireEvent.click(within(panel()).getByRole('button', { name: 'next year', hidden: true }))
        fireEvent.click(within(panel()).getByRole('button', { name: 'February 2027', hidden: true }))

        fireEvent.click(day('Monday 1 February 2027'), { shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(20), end: new Date(2027, 1, 1) })
      })

      it('extends from the start of a range on opening again', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(8) }} onChange={onChange} />)
        open()

        fireEvent.click(novDay(12), { shiftKey: true })
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(4), end: nov(12) })
      })

      it('is a plain press with nothing to extend from', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        fireEvent.click(novDay(12), { shiftKey: true })
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(12), end: nov(12) })
        expect(isOpen()).toBe(true)
      })

      it('has nothing to extend from once cleared', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(8) }} onChange={onChange} />)
        open()
        fireEvent.click(clearButton())

        fireEvent.click(novDay(12), { shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(12), end: nov(12) })
      })
    })

    describe('a drag', () => {
      it('picks the days it crosses as it lets go, once, and closes', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        drag(novDay(10), novDay(11), novDay(12), novDay(13))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(10), end: nov(13) })
        expect(isOpen()).toBe(false)
        expect(input().value).toBe('10 Nov 2026 – 13 Nov 2026')
      })

      it('shows the days as it goes, without calling onChange', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        pointerEvent(novDay(10), 'pointerdown')
        dragOver(novDay(12))
        expect(edges()).toEqual(['10', '12'])
        expect(selectedLabels()).toHaveLength(3)
        expect(onChange).not.toHaveBeenCalled()
      })

      it('shrinks again as it comes back', () => {
        render(<RangeHost />)
        open()

        pointerEvent(novDay(10), 'pointerdown')
        dragOver(novDay(14), novDay(11))
        expect(edges()).toEqual(['10', '11'])
      })

      it('goes backwards as well', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        drag(novDay(13), novDay(10))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(10), end: nov(13) })
      })

      it('runs into the days of the months either side', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        drag(novDay(28), day('Tuesday 1 December 2026'))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(28), end: dec(1) })
      })

      it('stays on the last day it crossed, off the grid', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        drag(novDay(10), novDay(12), document.body)
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(10), end: nov(12) })
      })

      it('stops at the limits', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost endDate={nov(12)} onChange={onChange} />)
        open()

        drag(novDay(10), novDay(20))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(10), end: nov(12) })
      })

      it("can't begin on a day that can't be picked", () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost endDate={nov(12)} onChange={onChange} />)
        open()

        drag(novDay(20), novDay(10))
        expect(onChange).not.toHaveBeenCalled()
      })

      it('leaves a press that stays on its day to be a click', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        drag(novDay(10), novDay(10))
        expect(onChange).not.toHaveBeenCalled()
        expect(isOpen()).toBe(true)
      })

      it('counts as a press if it comes back to where it began', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        drag(novDay(10), novDay(12), novDay(10))
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(10), end: nov(10) })
      })

      it('runs from the anchor with Shift held', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        fireEvent.click(novDay(5))

        pointerEvent(novDay(10), 'pointerdown', { shiftKey: true })
        dragOver(novDay(12))
        pointerEvent(document, 'pointerup')
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(5), end: nov(12) })
      })

      it('only follows the main button', () => {
        render(<RangeHost />)
        open()

        pointerEvent(novDay(10), 'pointerdown', { button: 2 })
        dragOver(novDay(12))
        expect(edges()).toEqual([])
      })

      it('drops the drag if the browser takes the pointer away', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        pointerEvent(novDay(10), 'pointerdown')
        dragOver(novDay(12))
        pointerEvent(document, 'pointercancel')
        pointerEvent(document, 'pointerup')
        expect(onChange).not.toHaveBeenCalled()
        expect(edges()).toEqual([])
      })

      it('drops the drag on Escape, which closes the calendar', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()

        pointerEvent(novDay(10), 'pointerdown')
        dragOver(novDay(12))
        fireEvent.keyDown(document, { key: 'Escape' })
        pointerEvent(document, 'pointerup')
        expect(onChange).not.toHaveBeenCalled()
      })

      it('stops listening once it is over', () => {
        const remove = vi.spyOn(document, 'removeEventListener')
        render(<RangeHost />)
        open()

        drag(novDay(10), novDay(12))
        const removed = remove.mock.calls.map(([name]) => name)
        expect(removed).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']))
      })

      it('leaves the value alone until it lets go', () => {
        render(<RangeHost defaultValue={{ start: nov(1), end: nov(2) }} />)
        open()

        pointerEvent(novDay(10), 'pointerdown')
        dragOver(novDay(12))
        expect(input().value).toBe('1 Nov 2026 – 2 Nov 2026')
      })
    })

    describe('a drag resting on an arrow', () => {
      const DELAY = 500
      const REPEAT = 700

      function wait(ms: number) {
        act(() => {
          vi.advanceTimersByTime(ms)
        })
      }

      function janDay(date: number) {
        return day(`${new Date(2027, 0, date).toLocaleDateString('en-GB', { weekday: 'long' })} ${date} January 2027`)
      }

      beforeEach(() => {
        vi.useFakeTimers({ now: TODAY, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      })

      it('turns the month after a moment, and not before', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')

        dragOver(arrow('next month'))
        wait(DELAY - 1)
        expect(title()).toBe('November 2026')

        wait(1)
        expect(title()).toBe('December 2026')
      })

      it('goes on turning them until it leaves', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')
        dragOver(arrow('next month'))

        wait(DELAY)
        wait(REPEAT)
        expect(title()).toBe('January 2027')

        dragOver(document.body)
        wait(REPEAT * 3)
        expect(title()).toBe('January 2027')
      })

      it('goes back with the other arrow', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')

        dragOver(arrow('last month'))
        wait(DELAY)
        expect(title()).toBe('October 2026')
      })

      it('turns nothing if it only passes over', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')

        dragOver(arrow('next month'))
        wait(DELAY - 1)
        dragOver(novDay(12))
        wait(DELAY * 2)
        expect(title()).toBe('November 2026')
      })

      it('starts its wait again on coming back', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')

        dragOver(arrow('next month'))
        wait(DELAY - 1)
        dragOver(novDay(12), arrow('next month'))
        wait(DELAY - 1)
        expect(title()).toBe('November 2026')
      })

      it('turns as it passes from one arrow to the other, by the new one', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')

        dragOver(arrow('next month'))
        wait(DELAY - 1)
        dragOver(arrow('last month'))
        wait(DELAY)
        expect(title()).toBe('October 2026')
      })

      it('goes on from where it began into the month it turned to, and picks across them, once', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        pointerEvent(novDay(20), 'pointerdown')
        dragOver(novDay(21), arrow('next month'))
        wait(DELAY)
        wait(REPEAT)

        dragOver(janDay(5))
        expect(onChange).not.toHaveBeenCalled()
        pointerEvent(document, 'pointerup')
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(20), end: new Date(2027, 0, 5) })
        expect(isOpen()).toBe(false)
      })

      it('shows the range running on through the months it turned to', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(20), 'pointerdown')
        dragOver(arrow('next month'))
        wait(DELAY)

        dragOver(day('Sunday 20 December 2026'))
        expect(selectedLabels()).toHaveLength(21)
        expect(selectedLabels().at(-1)).toBe('Sunday 20 December 2026')
        expect(selectedLabels()[0]).toBe('Monday 30 November 2026')
      })

      it('ends on the last day it crossed if it lets go on the arrow', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        open()
        pointerEvent(novDay(20), 'pointerdown')
        dragOver(novDay(22), arrow('next month'))
        wait(DELAY)

        pointerEvent(document, 'pointerup')
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: nov(20), end: nov(22) })
      })

      it('stops at the limits', () => {
        render(<RangeHost endDate={dec(10)} />)
        open()
        pointerEvent(novDay(10), 'pointerdown')
        dragOver(arrow('next month'))

        wait(DELAY)
        wait(REPEAT)
        wait(REPEAT)
        wait(REPEAT)
        expect(title()).toBe('December 2026')
        // Not waiting to turn a month it can never reach.
        expect(vi.getTimerCount()).toBe(0)
      })

      it('stops turning as it lets go', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')
        dragOver(novDay(11), arrow('next month'))
        wait(DELAY)
        pointerEvent(document, 'pointerup')

        wait(REPEAT * 3)
        expect(title()).toBe('December 2026')
      })

      it('stops turning if the drag is dropped', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')
        dragOver(arrow('next month'))
        pointerEvent(document, 'pointercancel')

        wait(DELAY * 3)
        expect(title()).toBe('November 2026')
      })

      it('stops turning on Escape, which closes the calendar', () => {
        render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')
        dragOver(arrow('next month'))
        fireEvent.keyDown(document, { key: 'Escape' })

        wait(DELAY * 3)
        expect(title()).toBe('November 2026')
      })

      it('leaves no timer behind if it is unmounted part way', () => {
        const { unmount } = render(<RangeHost />)
        open()
        pointerEvent(novDay(10), 'pointerdown')
        dragOver(arrow('next month'))

        unmount()
        expect(vi.getTimerCount()).toBe(0)
      })

      it('is no business of the year view, whose arrows move a year', () => {
        render(<RangeHost />)
        open()
        fireEvent.click(panel().querySelector('.prism-calendar__heading')!)
        const yearArrow = within(panel()).getByRole('button', { name: 'next year', hidden: true })

        expect(yearArrow.hasAttribute('data-page')).toBe(false)
      })

      it('takes a pointer over an arrow with no drag for an ordinary one', () => {
        render(<RangeHost />)
        open()

        dragOver(arrow('next month'))
        wait(DELAY * 3)
        expect(title()).toBe('November 2026')
      })
    })

    describe('the month', () => {
      it('marks every day of the range for a screen reader', () => {
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(6) }} />)
        open()

        expect(selectedLabels()).toEqual([
          'Wednesday 4 November 2026',
          'Thursday 5 November 2026',
          'Friday 6 November 2026',
        ])
        expect(grid().getAttribute('aria-multiselectable')).toBe('true')
      })

      it('gives the two end days the edge and the rim, and the rest neither', () => {
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(6) }} />)
        open()

        expect(edges()).toEqual(['4', '6'])
        expect(novDay(4).querySelector('.prism-rim')).not.toBeNull()
        expect(novDay(5).querySelector('.prism-rim')).toBeNull()
        expect(novDay(6).querySelector('.prism-rim')).not.toBeNull()
      })

      it('runs a band from the first day to the last', () => {
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(6) }} />)
        open()

        expect(novDay(4).parentElement?.className).toContain('prism-calendar__cell--band-start')
        expect(novDay(5).parentElement?.className).toBe('prism-calendar__cell--band')
        expect(novDay(6).parentElement?.className).toContain('prism-calendar__cell--band-end')
      })

      it('has no band for one day, which is just the one edge', () => {
        render(<RangeHost defaultValue={{ start: nov(4), end: nov(4) }} />)
        open()

        expect(edges()).toEqual(['4'])
        expect(panel().querySelector('.prism-calendar__cell--band')).toBeNull()
      })

      it('shows the part of a range that lies in the month', () => {
        render(<RangeHost defaultValue={{ start: nov(28), end: dec(3) }} />)
        open()
        fireEvent.click(arrow('next month'))

        expect(novDay(2).parentElement?.className).toBe('prism-calendar__cell--band')
        expect(edges()).toEqual(['3'])
      })

      it('opens on the first day', () => {
        render(<RangeHost defaultValue={{ start: dec(20), end: new Date(2027, 0, 5) }} />)
        open()
        expect(title()).toBe('December 2026')
      })
    })

    describe('the keyboard', () => {
      function openOnGrid() {
        input().focus()
        fireEvent.keyDown(input(), { key: 'ArrowDown' })
      }

      it('extends from the anchor with Shift and an arrow, each step taken up', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        openOnGrid()
        fireEvent.click(document.activeElement!)

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(4), end: nov(5) })
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(4), end: nov(12) })
        expect(isOpen()).toBe(true)
        expect(label(document.activeElement)).toBe('Thursday 12 November 2026')
      })

      it('extends from where the cursor is with no anchor', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        openOnGrid()

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(4), end: nov(5) })
      })

      it('closes on Enter after Shift and the arrows, keeping the range', () => {
        render(<RangeHost />)
        openOnGrid()
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true })

        fireEvent.click(document.activeElement!)
        expect(isOpen()).toBe(false)
        expect(input().value).toBe('4 Nov 2026 – 5 Nov 2026')
      })

      it('starts again on Enter once a plain arrow has moved on', () => {
        render(<RangeHost />)
        openOnGrid()
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true })
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })

        fireEvent.click(document.activeElement!)
        expect(isOpen()).toBe(true)
        expect(input().value).toBe('6 Nov 2026')
      })

      it('picks out to the cursor with Shift and Enter, and closes', () => {
        render(<RangeHost />)
        openOnGrid()
        fireEvent.click(document.activeElement!)
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })

        fireEvent.click(document.activeElement!, { shiftKey: true })
        expect(isOpen()).toBe(false)
        expect(input().value).toBe('4 Nov 2026 – 6 Nov 2026')
      })

      it('stops at the limits', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost endDate={nov(5)} onChange={onChange} />)
        openOnGrid()

        fireEvent.keyDown(document.activeElement!, { key: 'End', shiftKey: true })
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(4), end: nov(5) })
      })

      it('keeps a press of Page Up with Shift to moving by a year, extending as it goes', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost onChange={onChange} />)
        openOnGrid()

        fireEvent.keyDown(document.activeElement!, { key: 'PageDown', shiftKey: true })
        expect(title()).toBe('November 2027')
        expect(onChange).toHaveBeenLastCalledWith({ start: nov(4), end: new Date(2027, 10, 4) })
      })
    })

    describe('typing', () => {
      const format = { dateFormat: 'dd/MM/yyyy' }

      it('reads a range back', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost {...format} onChange={onChange} />)

        type('01/02/2026 – 05/02/2026')
        leave()
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: new Date(2026, 1, 1), end: new Date(2026, 1, 5) })
      })

      it('puts a range typed backwards the right way round', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost {...format} onChange={onChange} />)

        type('05/02/2026 - 01/02/2026')
        leave()
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: new Date(2026, 1, 1), end: new Date(2026, 1, 5) })
      })

      it('takes one date as a range of that day', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost {...format} onChange={onChange} />)

        type('01/02/2026')
        leave()
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ start: new Date(2026, 1, 1), end: new Date(2026, 1, 1) })
      })

      it('moves the open month to the first date as it is typed', () => {
        render(<RangeHost {...format} />)
        open()

        type('01/02/2025 – 05/02/2025')
        expect(title()).toBe('February 2025')
      })

      it('turns down a range with either end out of limits', () => {
        const value = { start: nov(4), end: nov(5) }
        render(<RangeHost {...format} defaultValue={value} startDate={nov(2)} endDate={nov(30)} />)

        type('10/11/2026 – 05/12/2026')
        leave()
        expect(input().value).toBe('04/11/2026 – 05/11/2026')

        type('01/11/2026 – 10/11/2026')
        leave()
        expect(input().value).toBe('04/11/2026 – 05/11/2026')
      })

      it('takes a range left half written as the one day it has', () => {
        render(<RangeHost {...format} />)

        type('10/11/2026 – ')
        leave()
        expect(input().value).toBe('10/11/2026')
      })

      it('clears from an emptied field', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost {...format} defaultValue={{ start: nov(4), end: nov(5) }} onChange={onChange} />)

        type('')
        leave()
        expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
      })
    })

    describe('its value', () => {
      it('shows value as given', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost value={{ start: nov(4), end: nov(8) }} onChange={onChange} />)
        open()

        drag(novDay(10), novDay(12))
        expect(onChange).toHaveBeenCalledOnce()
        expect(input().value).toBe('4 Nov 2026 – 8 Nov 2026')
      })

      it('follows a value held by its parent', () => {
        function Parent() {
          const [value, setValue] = useState<CalendarRange | null>(null)
          return <RangeHost value={value} onChange={setValue} />
        }
        render(<Parent />)
        open()

        drag(novDay(10), novDay(12))
        expect(input().value).toBe('10 Nov 2026 – 12 Nov 2026')
      })

      it('says nothing if the same range is picked again', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost defaultValue={{ start: nov(10), end: nov(12) }} onChange={onChange} />)
        open()

        drag(novDay(10), novDay(12))
        expect(onChange).not.toHaveBeenCalled()
      })

      it('clears to null', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost defaultValue={{ start: nov(10), end: nov(12) }} onChange={onChange} />)

        fireEvent.click(clearButton())
        expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
        expect(input().value).toBe('')
      })

      it('leaves the range alone as Today goes to its month', () => {
        const onChange = vi.fn<(value: CalendarRange | null) => void>()
        render(<RangeHost defaultValue={{ start: dec(1), end: dec(5) }} onChange={onChange} />)
        open()

        fireEvent.click(within(panel()).getByRole('button', { name: 'Today', hidden: true }))
        expect(title()).toBe('November 2026')
        expect(onChange).not.toHaveBeenCalled()
      })
    })

    describe('without range', () => {
      it('ignores Shift, and still gives onChange a day', () => {
        const onChange = vi.fn<(value: Date | null) => void>()
        render(<Host defaultValue={nov(4)} onChange={onChange} />)
        open()

        fireEvent.click(novDay(10), { shiftKey: true })
        expect(onChange).toHaveBeenCalledExactlyOnceWith(nov(10))
        expect(isOpen()).toBe(false)
      })

      it('has no drag', () => {
        const onChange = vi.fn<(value: Date | null) => void>()
        render(<Host onChange={onChange} />)
        open()

        drag(novDay(10), novDay(12))
        expect(onChange).not.toHaveBeenCalled()
        expect(edges()).toEqual([])
      })

      it('is not multi-selectable', () => {
        render(<Host />)
        open()
        expect(grid().hasAttribute('aria-multiselectable')).toBe(false)
      })
    })
  })

  describe('disabled and read-only', () => {
    it.each(['disabled', 'readOnly'])('can not be opened %s', (state) => {
      render(<Host {...{ [state]: true }} defaultValue={new Date(2026, 10, 4)} />)

      open()
      fireEvent.keyDown(input(), { key: 'ArrowDown' })
      expect(isOpen()).toBe(false)
      expect(toggle().disabled).toBe(true)
      expect(clearButton().disabled).toBe(true)
    })
  })
})
