import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes, placeAt, pointer } from '../../../test/dom'
import { readShape } from './columns'
import { columnTracks, columnWidths, NARROWEST } from './columnWidths'
import { DataGrid } from './DataGrid'
import type { DataGridSource, Row } from './types'

const people = [
  { id: 1, name: 'Ada', age: 36 },
  { id: 2, name: 'Grace Brewster Hopper', age: 85 },
  { id: 3, name: 'Alan', age: 41 },
]

/** A column's track where it shares the grid's width, which the tests below write as `*`. */
const SHARE = 'minmax(var(--prism-data-grid-column-min), 1fr)'

let resizes: ReturnType<typeof manualResizes>
const setPointerCapture = vi.fn<(pointerId: number) => void>()

beforeEach(() => {
  resizes = manualResizes()
  // jsdom has no pointer capture.
  Element.prototype.setPointerCapture = setPointerCapture
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
})

/** The outer grid's view, whose style holds its columns' tracks. */
const view = () => document.querySelector<HTMLElement>('.prism-data-grid__view')!
const tracks = () => view().style.getPropertyValue('--_prism-data-grid-cells').replaceAll(SHARE, '*')
const least = () => view().style.getPropertyValue('--_prism-data-grid-cells-least')
const handle = (header: string) => screen.getByRole('separator', { name: `Resize ${header}` })

/** Lays the header's columns out in jsdom, which lays nothing out: side by side from 0, each 100px wide. */
function layOutHeaders() {
  const headers = document.querySelectorAll('.prism-data-grid__head .prism-data-grid__track > [role="columnheader"]')
  headers.forEach((header, i) => placeAt(header, i * 100, 0, 100, 40))
}

/**
 * Lays text out in jsdom: every element as wide as the longest line of its
 * text, at 10px a character, and one as wide as a column's least 120px.
 */
function layOutText() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const narrowest = this.getAttribute('style')?.includes('--prism-data-grid-column-min')
    const lines = (this.textContent ?? '').split('\n')
    const width = narrowest ? 120 : Math.max(...lines.map((line) => line.length)) * 10
    const rect = { x: 0, y: 0, left: 0, top: 0, width, height: 40, right: width, bottom: 40 }
    return { ...rect, toJSON: () => rect }
  })
}

/** Presses a column's handle at `from`, and moves the pointer to each of `to` in turn. */
function drag(header: string, from: number, ...to: number[]) {
  act(() => pointer(handle(header), 'pointerdown', from, 0, { pointerId: 1 }))
  for (const x of to) act(() => pointer(handle(header), 'pointermove', x, 0, { pointerId: 1 }))
}

describe('columnTracks', () => {
  const shape = (columns = {}) => readShape([{ id: 1, name: 'Ada', age: 36 }], columns).columns

  it('gives every column a share of the width, none under its least, where none has a width', () => {
    const columns = shape()
    expect(columnTracks(columns, columnWidths(columns, {}))).toEqual({
      cells: `${SHARE} ${SHARE} ${SHARE}`,
      least: '3 * var(--prism-data-grid-column-min)',
    })
    expect(columnTracks([], {})).toEqual({ cells: 'none', least: '0 * var(--prism-data-grid-column-min)' })
  })

  it('makes a column with a width that wide, and counts it in the least the grid can be', () => {
    const columns = shape({ name: { width: 200 } })
    expect(columnTracks(columns, columnWidths(columns, {}))).toEqual({
      cells: `${SHARE} 200px ${SHARE}`,
      least: '2 * var(--prism-data-grid-column-min) + 200px',
    })
    expect(columnTracks(columns, columnWidths(columns, { id: 60.5, age: 80 }))).toEqual({
      cells: '60.5px 200px 80px',
      least: '340.5px',
    })
  })

  it('takes a width a column was sized to over the one it asks for, and none under the narrowest', () => {
    const columns = shape({ id: { width: 10 }, name: { width: 200 }, age: { width: 'auto' } })
    expect(columnWidths(columns, {})).toEqual({ id: NARROWEST, name: 200 })
    expect(columnWidths(columns, { name: 90, age: 75 })).toEqual({ id: NARROWEST, name: 90, age: 75 })
  })
})

describe('DataGrid column widths', () => {
  it('makes a column as wide as it asks, the rest sharing what is left', () => {
    render(<DataGrid aria-label="People" data={people} columns={{ name: { width: 200 } }} />)
    expect(tracks()).toBe('* 200px *')
    expect(least()).toBe('calc(2 * var(--prism-data-grid-column-min) + 200px)')
    // The rows are never narrower than the columns' least and the lane beside them.
    expect(view().style.getPropertyValue('--_prism-data-grid-least')).toBe(
      'calc(0px + 2 * var(--prism-data-grid-column-min) + 200px + var(--prism-data-grid-expander-width))',
    )
    expect(handle('name').getAttribute('aria-valuenow')).toBe('200')
    expect(handle('id').hasAttribute('aria-valuenow')).toBe(false)
  })

  it('has a handle on every header, unless the grid or the column says not', () => {
    const { rerender } = render(<DataGrid aria-label="People" data={people} />)
    expect(screen.getAllByRole('separator').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Resize id',
      'Resize name',
      'Resize age',
    ])

    rerender(<DataGrid aria-label="People" data={people} columns={{ id: { resizable: false } }} />)
    expect(screen.getAllByRole('separator')).toHaveLength(2)

    rerender(<DataGrid aria-label="People" data={people} resizable={false} columns={{ age: { resizable: true } }} />)
    expect(screen.getAllByRole('separator').map((s) => s.getAttribute('aria-label'))).toEqual(['Resize age'])
  })

  it("follows a pointer dragging a header's edge, holding the columns before it as they show", () => {
    render(<DataGrid aria-label="People" data={people} />)
    layOutHeaders()

    // The name column, from 100 to 200, taken hold of 2px past its edge.
    drag('name', 202, 252)
    expect(setPointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(tracks()).toBe('100px 150px *')
    expect(handle('name').getAttribute('aria-valuenow')).toBe('150')
    expect(handle('name').hasAttribute('data-dragging')).toBe(true)

    act(() => pointer(handle('name'), 'pointermove', 162, 0, { pointerId: 1 }))
    expect(tracks()).toBe('100px 60px *')

    // Let go, it follows no more.
    act(() => pointer(handle('name'), 'lostpointercapture', 162, 0, { pointerId: 1 }))
    expect(handle('name').hasAttribute('data-dragging')).toBe(false)
    act(() => pointer(handle('name'), 'pointermove', 300, 0, { pointerId: 1 }))
    expect(tracks()).toBe('100px 60px *')
  })

  it('makes no column narrower than the narrowest, however far its edge is dragged', () => {
    render(<DataGrid aria-label="People" data={people} />)
    layOutHeaders()
    drag('id', 100, -500)
    expect(tracks()).toBe(`${NARROWEST}px * *`)
  })

  it('changes nothing for a press that never moves, nor for another pointer or button', () => {
    render(<DataGrid aria-label="People" data={people} />)
    layOutHeaders()

    drag('name', 200, 200)
    act(() => pointer(handle('name'), 'pointermove', 260, 0, { pointerId: 2 }))
    expect(tracks()).toBe('* * *')

    act(() => pointer(handle('name'), 'lostpointercapture', 200, 0, { pointerId: 1 }))
    act(() => fireEvent.pointerDown(handle('name'), { button: 2, clientX: 200 }))
    act(() => pointer(handle('name'), 'pointermove', 260, 0))
    expect(tracks()).toBe('* * *')
  })

  it('widens a column as its edge is dragged left where the columns run right to left', () => {
    const sheet = Object.assign(document.createElement('style'), {
      textContent: '.prism-data-grid__header { direction: rtl; }',
    })
    document.head.append(sheet)
    render(<DataGrid aria-label="People" data={people} />)
    layOutHeaders()

    // Its far edge is its left one, at 100.
    drag('name', 100, 60)
    sheet.remove()
    expect(tracks()).toBe('100px 140px *')
  })

  it('moves an edge by the arrow keys, from the width the column shows, leaving the rest to share', () => {
    render(<DataGrid aria-label="People" data={people} />)
    layOutHeaders()

    fireEvent.keyDown(handle('name'), { key: 'ArrowRight' })
    expect(tracks()).toBe('* 116px *')
    fireEvent.keyDown(handle('name'), { key: 'ArrowLeft' })
    expect(tracks()).toBe('* 84px *')
    // Not a key of its own.
    fireEvent.keyDown(handle('name'), { key: 'ArrowRight', ctrlKey: true })
    fireEvent.keyDown(handle('name'), { key: 'ArrowDown' })
    expect(tracks()).toBe('* 84px *')
  })
})

describe('DataGrid fitting a column', () => {
  it('fits a column to its header and its values on a double-click of its handle, or Enter', () => {
    render(<DataGrid aria-label="People" data={people} showFilter={false} />)
    layOutText()

    fireEvent.doubleClick(handle('name'))
    // Grace Brewster Hopper, at 10px a letter.
    expect(tracks()).toBe('* 210px *')

    // Three letters of header over two digits, and neither as wide as the narrowest.
    fireEvent.keyDown(handle('age'), { key: 'Enter' })
    expect(tracks()).toBe(`* 210px ${NARROWEST}px`)
    // What it was measured with is gone again.
    expect(document.querySelectorAll('.prism-data-grid__track > [style]')).toHaveLength(0)
    expect(document.querySelectorAll('.prism-data-grid__head [role="columnheader"]')).toHaveLength(3)
  })

  it('fits every column that can be resized at once, on the button under the rows', () => {
    render(<DataGrid aria-label="People" data={people} showFilter={false} columns={{ id: { resizable: false } }} />)
    layOutText()

    fireEvent.click(screen.getByRole('button', { name: 'Fit columns' }))
    expect(tracks()).toBe(`* 210px ${NARROWEST}px`)
    expect(document.querySelectorAll('.prism-data-grid__track > [style]')).toHaveLength(0)
  })

  it('has no button to fit the columns where none can be resized, and one in a child grid for its own', () => {
    const nested = [{ id: 1, name: 'Ada', orders: [{ id: 10, item: 'Analytical engine' }] }]
    const { rerender } = render(<DataGrid aria-label="People" data={nested} resizable={false} />)
    expect(screen.queryByRole('button', { name: 'Fit columns' })).toBeNull()

    rerender(<DataGrid aria-label="People" data={nested} showFilter={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }))
    layOutText()
    // The child grid's comes first: its footer is inside the outer grid's rows.
    fireEvent.click(screen.getAllByRole('button', { name: 'Fit columns' })[0])
    const [outer, inner] = [...document.querySelectorAll<HTMLElement>('.prism-data-grid__view')].map((grid) =>
      grid.style.getPropertyValue('--_prism-data-grid-cells').replaceAll(SHARE, '*'),
    )
    expect(outer).toBe('* *')
    // Analytical engine, in the orders.
    expect(inner).toBe(`${NARROWEST}px 170px`)
  })

  it('fits to every row the filters let through, on every page, as each is written', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: i, amount: i === 30 ? 1234567.5 : i }))
    render(
      <DataGrid
        aria-label="People"
        data={many}
        pageSize={10}
        locale="en-GB"
        columns={{ id: { showFilter: false }, amount: { mask: '#,##0.00' } }}
      />,
    )
    layOutText()

    // 1,234,567.50, on the fourth page.
    fireEvent.doubleClick(handle('amount'))
    expect(tracks()).toBe('* 120px')

    // Filtered out, the longest left is 29.00, under a header of six letters.
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter amount' }), { target: { value: '<30' } })
    fireEvent.doubleClick(handle('amount'))
    expect(tracks()).toBe('* 120px')
    fireEvent.doubleClick(handle('id'))
    expect(tracks()).toBe(`${NARROWEST}px 120px`)
  })

  it('leaves a column with a filter room for it, and one with a summary room for that', () => {
    const { rerender } = render(<DataGrid aria-label="People" data={people} />)
    layOutText()
    fireEvent.doubleClick(handle('id'))
    expect(tracks()).toBe('120px * *')

    rerender(<DataGrid aria-label="People" data={people} showFilter={false} showSummary />)
    // "Total 162", in the summary row, over two digits.
    fireEvent.doubleClick(handle('age'))
    expect(tracks()).toBe('120px * 90px')
  })

  it('fits a column no wider than the window the columns show through', () => {
    render(<DataGrid aria-label="People" data={people} showFilter={false} />)
    layOutText()
    const window = document.querySelector('.prism-data-grid__head .prism-data-grid__cells')!
    Object.defineProperty(window, 'clientWidth', { value: 150, configurable: true })

    fireEvent.doubleClick(handle('name'))
    expect(tracks()).toBe('* 150px *')
  })

  it('fits nothing while the grid is not laid out', () => {
    render(<DataGrid aria-label="People" data={people} />)
    fireEvent.doubleClick(handle('name'))
    expect(tracks()).toBe('* * *')
  })

  it('fits a column that asks to be as its rows first show, and keeps to a width it is then dragged to', () => {
    layOutText()
    const columns = { name: { width: 'auto' as const } }
    const { rerender } = render(<DataGrid aria-label="People" data={people} showFilter={false} columns={columns} />)
    expect(tracks()).toBe('* 210px *')

    fireEvent.keyDown(handle('name'), { key: 'ArrowLeft' })
    // The handle's column is laid out as wide as its header's text: 40px, less a step, is under the narrowest.
    expect(tracks()).toBe(`* ${NARROWEST}px *`)
    rerender(<DataGrid aria-label="People" data={[...people]} showFilter={false} columns={columns} />)
    expect(tracks()).toBe(`* ${NARROWEST}px *`)
  })

  it('fits it once a source has given its rows', async () => {
    layOutText()
    const source: DataGridSource = { read: async () => people as Row[] }
    render(<DataGrid aria-label="People" source={source} showFilter={false} columns={{ name: { width: 'auto' } }} />)
    expect(tracks()).toBe('*')

    await screen.findByText('Ada')
    expect(tracks()).toBe('* 210px *')
  })

  it('fits it as a grid that was hidden comes to be laid out', () => {
    render(<DataGrid aria-label="People" data={people} showFilter={false} columns={{ name: { width: 'auto' } }} />)
    expect(tracks()).toBe('* * *')

    layOutText()
    const body = document.querySelector('.prism-data-grid__body .prism-scroll-area__viewport')!
    act(() => resizes.resize(body, 600, 300))
    expect(tracks()).toBe('* 210px *')
  })
})
