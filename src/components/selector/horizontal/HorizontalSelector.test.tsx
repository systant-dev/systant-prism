import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../../test/dom'
import { fakeBackdrop, hover } from '../../../../test/selector'
import { BackdropContext } from '../../backdrop'
import { HorizontalSelector, type HorizontalSelectorItem } from './HorizontalSelector'

// The behaviour shared with VerticalSelector (src/components/selector/core) is
// tested there; these cover what the horizontal layout changes.

const items: HorizontalSelectorItem[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week', disabled: true },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

// jsdom has no layout: give the entries these widths, side by side from 4px in.
const widths = [40, 50, 60, 100]

function option(name: string) {
  return screen.getByRole('option', { name })
}

// The glass pill, on the selection.
function indicator() {
  return document.querySelector<HTMLElement>(
    '.prism-horizontal-selector__indicator:not(.prism-horizontal-selector__indicator--hover)',
  )!
}

// The dim pill that follows the pointer.
function hoverPill() {
  return document.querySelector<HTMLElement>('.prism-horizontal-selector__indicator--hover')!
}

function pill(name: 'x' | 'width', el = indicator()) {
  return el.style.getPropertyValue(`--prism-horizontal-selector-${name}`)
}

function layOut(sizes = widths) {
  let left = 4
  screen.getAllByRole('option').forEach((el, i) => {
    Object.defineProperty(el, 'offsetLeft', { configurable: true, value: left })
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: sizes[i] })
    left += sizes[i]
  })
}

function Controlled({ initial, rtl = false }: { initial?: string; rtl?: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <HorizontalSelector
      aria-label="Range"
      items={items}
      value={value}
      onChange={setValue}
      style={rtl ? { direction: 'rtl' } : undefined}
    />
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HorizontalSelector', () => {
  it('renders a horizontal listbox with an option per item', () => {
    render(<HorizontalSelector aria-label="Range" items={items} value="month" />)

    const list = screen.getByRole('listbox', { name: 'Range' })
    expect(list.getAttribute('aria-orientation')).toBe('horizontal')
    expect(list.classList.contains('prism-horizontal-selector')).toBe(true)
    expect(screen.getAllByRole('option').map((el) => el.textContent)).toEqual(['Day', 'Week', 'Month', 'Year'])
    expect(option('Month').getAttribute('aria-selected')).toBe('true')
    expect(option('Month').className).toBe('prism-horizontal-selector__option prism-press')
  })

  it('moves the selection with the left and right arrows, skipping disabled entries', () => {
    render(<Controlled initial="day" />)
    act(() => option('Day').focus())

    fireEvent.keyDown(option('Day'), { key: 'ArrowRight' })
    expect(option('Month').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(option('Month'))

    fireEvent.keyDown(option('Month'), { key: 'ArrowLeft' })
    expect(option('Day').getAttribute('aria-selected')).toBe('true')
  })

  it('follows the text right to left, where the next entry is on the left', () => {
    render(<Controlled initial="day" rtl />)
    act(() => option('Day').focus())

    fireEvent.keyDown(option('Day'), { key: 'ArrowLeft' })
    expect(option('Month').getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(option('Month'), { key: 'ArrowRight' })
    expect(option('Day').getAttribute('aria-selected')).toBe('true')
  })

  it('leaves the up and down arrows to the page', () => {
    render(<Controlled initial="day" />)
    act(() => option('Day').focus())
    expect(fireEvent.keyDown(option('Day'), { key: 'ArrowDown' })).toBe(true)
    expect(option('Day').getAttribute('aria-selected')).toBe('true')
  })

  it('rests the pill on the selected entry, as wide as it', () => {
    const { rerender } = render(<HorizontalSelector items={items} value="day" />)
    layOut()
    rerender(<HorizontalSelector items={items} value="month" />)

    expect(pill('x')).toBe('94px')
    expect(pill('width')).toBe('60px')
  })

  it('slides a dim pill to the hovered entry, keeping the glass pill on the selection', () => {
    render(<HorizontalSelector items={items} value="day" />)
    layOut()

    hover(option('Year'))
    expect(pill('x', hoverPill())).toBe('154px')
    expect(pill('width', hoverPill())).toBe('100px')
    expect(pill('x')).toBe('4px')
    expect(pill('width')).toBe('40px')
    expect(hoverPill().classList.contains('prism-horizontal-selector__indicator--shown')).toBe(true)

    fireEvent.pointerLeave(screen.getByRole('listbox'))
    expect(hoverPill().classList.contains('prism-horizontal-selector__indicator--shown')).toBe(false)
  })

  it('shrinks each entry, and the pills on them, by a fixed 4px on a press', () => {
    const resizes = manualResizes()
    render(<HorizontalSelector items={items} value="year" />)
    layOut()
    const list = screen.getByRole('listbox')
    Object.defineProperty(list, 'offsetWidth', { configurable: true, value: 258 })
    act(() => resizes.resize(list, 258, 44))

    const scale = (el: HTMLElement) => el.style.getPropertyValue('--prism-press-scale')
    expect(scale(option('Day'))).toBe('0.9')
    expect(scale(option('Year'))).toBe('0.96')
    expect(scale(indicator())).toBe('0.96')
    expect(scale(list)).toBe('')

    hover(option('Day'))
    expect(scale(hoverPill())).toBe('0.9')
    expect(scale(indicator())).toBe('0.96')
  })

  it('moves the pill when an entry resizes though the list doesn’t', () => {
    const resizes = manualResizes()
    render(<HorizontalSelector items={items} value="year" style={{ width: 300 }} />)
    Object.defineProperty(screen.getByRole('listbox'), 'offsetWidth', { configurable: true, value: 300 })
    layOut()
    act(() => resizes.resize(option('Day'), 40, 36))
    expect(pill('x')).toBe('154px')

    // A web font arrives: the entries share the list's same width differently.
    layOut([50, 50, 60, 90])
    act(() => resizes.resize(option('Day'), 50, 36))
    expect(pill('x')).toBe('164px')
    expect(pill('width')).toBe('90px')
    expect(option('Day').style.getPropertyValue('--prism-press-scale')).toBe('0.92')
  })

  it('watches the entries there are, as they come and go', () => {
    const resizes = manualResizes()
    const { rerender, unmount } = render(<HorizontalSelector items={items} />)
    // The list and its four entries.
    expect(resizes.observed).toBe(5)

    rerender(<HorizontalSelector items={items.slice(0, 2)} />)
    expect(resizes.observed).toBe(3)
    rerender(<HorizontalSelector items={items} />)
    expect(resizes.observed).toBe(5)

    unmount()
    expect(resizes.observed).toBe(0)
  })

  describe('glass', () => {
    const { backdrop } = fakeBackdrop()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('has a GlassBackdrop draw the track, and the glass pill while it shows', () => {
      render(
        <BackdropContext value={backdrop}>
          <HorizontalSelector items={items} value="day" />
        </BackdropContext>,
      )
      hover(option('Year'))
      const tracked = backdrop.track.mock.calls.map(([el]) => el)
      expect(tracked).toContain(screen.getByRole('listbox'))
      expect(tracked).toContain(indicator())
      expect(tracked).not.toContain(hoverPill())
    })

    it('turns the glass off', () => {
      render(
        <BackdropContext value={backdrop}>
          <HorizontalSelector items={items} value="day" refract={false} />
        </BackdropContext>,
      )
      expect(backdrop.track).not.toHaveBeenCalled()
      expect(screen.getByRole('listbox').className).toBe('prism-horizontal-selector')
    })
  })

  it('forwards its ref and other props to the list, merging its style', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <HorizontalSelector
        ref={ref}
        items={items}
        refract={false}
        className="tabs"
        style={{ width: 300 }}
        data-testid="list"
      />,
    )
    expect(ref.current).toBe(screen.getByTestId('list'))
    expect(ref.current!.className).toBe('prism-horizontal-selector tabs')
    expect(ref.current!.style.width).toBe('300px')
  })
})
