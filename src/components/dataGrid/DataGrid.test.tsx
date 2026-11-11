import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import { FADE_SIZE, fadeMask } from '../scroll'
import { KINDS } from './columnTypes'
import { DataGrid } from './DataGrid'
import { dataGridStyles } from './DataGrid.styles'
import type { DataGridSource, Row } from './types'

const people = [
  { id: 1, name: 'Ada', age: 36, orders: [{ id: 10, item: 'Engine' }] },
  {
    id: 2,
    name: 'Grace',
    age: 85,
    orders: [
      { id: 20, item: 'Compiler' },
      { id: 21, item: 'Bug' },
    ],
  },
  { id: 3, name: 'Alan', age: 41, orders: [] },
]

let resizes: ReturnType<typeof manualResizes>

beforeEach(() => {
  resizes = manualResizes()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** The grid's table, the outermost one: a child grid's is inside it. */
const table = () => screen.getAllByRole('table')[0]

/** The values of the outer grid's body rows, by the text of their cells. */
function bodyRows(name = 'People') {
  const grid = screen.getByRole('table', { name })
  return within(grid)
    .getAllByRole('row')
    .filter((row) => row.parentElement?.classList.contains('prism-data-grid__rows'))
    .filter((row) => row.closest('[role="table"]') === grid)
    .map((row) =>
      within(row)
        .queryAllByRole('cell')
        .map((cell) => cell.textContent),
    )
}

/** The outer grid's values in the column headed `header`, row by row. */
function columnValues(header: string) {
  const grid = screen.getByRole('table', { name: 'People' })
  const headers = [...grid.querySelector('.prism-data-grid__head')!.querySelectorAll('[role="columnheader"]')]
  const i = headers.findIndex((h) => h.querySelector('button')?.textContent === header)
  return bodyRows().map((cells) => cells[i])
}

const names = () => columnValues('name')

/**
 * Gives jsdom popovers that really show, for the tests in a describe that open
 * one (a menu, a calendar): jsdom has none, and hides [popover], so nothing in
 * one could take the focus.
 */
function showPopovers() {
  const shown = Object.assign(document.createElement('style'), {
    textContent: '[data-showing] { display: block !important; }',
  })

  beforeEach(() => {
    document.head.append(shown)
    HTMLElement.prototype.showPopover = function () {
      this.dataset.showing = ''
    }
    HTMLElement.prototype.hidePopover = function () {
      delete this.dataset.showing
    }
  })

  afterEach(() => {
    cleanup()
    shown.remove()
    // @ts-expect-error -- jsdom has none of its own
    delete HTMLElement.prototype.showPopover
    // @ts-expect-error -- as above
    delete HTMLElement.prototype.hidePopover
  })
}

describe('DataGrid', () => {
  it('heads columns by headers or property names, and makes nested arrays child collections', () => {
    render(<DataGrid aria-label="People" data={people} columns={{ name: { header: 'Full name' } }} />)

    const headers = within(table())
      .getAllByRole('columnheader')
      .map((h) => h.querySelector('button')?.textContent)
    // The expander's header first, which has no button, and last the one that clears the filters, whose button has no text.
    expect(headers).toEqual([undefined, 'id', 'Full name', 'age', ''])
    expect(bodyRows()).toEqual([
      // The last, in the end lane, matches the header's cell for the button that clears the filters.
      ['', '1', 'Ada', '36', ''],
      ['', '2', 'Grace', '85', ''],
      ['', '3', 'Alan', '41', ''],
    ])
    expect(screen.getByRole('status').textContent).toBe('3 rows')
  })

  it('sorts by a column from a press on its header: ascending, descending, then none', () => {
    render(<DataGrid aria-label="People" data={people} />)
    const age = screen.getByRole('button', { name: 'age' })
    const header = age.closest('[role="columnheader"]')!

    fireEvent.click(age)
    expect(header.getAttribute('aria-sort')).toBe('ascending')
    expect(names()).toEqual(['Ada', 'Alan', 'Grace'])

    fireEvent.click(age)
    expect(header.getAttribute('aria-sort')).toBe('descending')
    expect(names()).toEqual(['Grace', 'Alan', 'Ada'])

    fireEvent.click(age)
    expect(header.hasAttribute('aria-sort')).toBe(false)
    expect(names()).toEqual(['Ada', 'Grace', 'Alan'])
  })

  it('filters by the text in a column header', () => {
    render(<DataGrid aria-label="People" data={people} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter name' }), { target: { value: 'al' } })

    expect(names()).toEqual(['Alan'])
    expect(screen.getByRole('status').textContent).toBe('1 row')
  })

  it('pages the rows, going back to the first page as the filter changes', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `Person ${i}` }))
    render(<DataGrid aria-label="People" data={many} pageSize={2} />)
    const cellsOf = () => bodyRows().map((cells) => cells[1])

    expect(cellsOf()).toEqual(['Person 0', 'Person 1'])
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(cellsOf()).toEqual(['Person 4'])
    expect(screen.getByText('Page 3 of 3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter name' }), { target: { value: 'person' } })
    expect(cellsOf()).toEqual(['Person 0', 'Person 1'])
  })

  it('draws only the rows in view, and those scrolled to', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => ({ id: i, name: `Person ${i}` }))
    render(<DataGrid aria-label="People" data={many} rowHeight={40} />)
    const viewport = document.querySelector<HTMLElement>('.prism-scroll-area__viewport')!
    act(() => resizes.resize(viewport, 600, 400))

    // 10 rows fill 400px, and 4 more are drawn past the end.
    expect(bodyRows()).toHaveLength(14)
    expect(table().getAttribute('aria-rowcount')).toBe('10001')
    expect(document.querySelector<HTMLElement>('.prism-data-grid__rows')!.style.height).toBe('400000px')

    viewport.scrollTop = 40 * 5000
    fireEvent.scroll(viewport)

    const rows = bodyRows().map((cells) => cells[0])
    expect(rows[0]).toBe('4996')
    expect(rows).toContain('5009')
    const first = document.querySelector<HTMLElement>('.prism-data-grid__rows > [role="row"]')!
    expect(first.style.top).toBe(`${40 * 4996}px`)
    expect(first.getAttribute('aria-rowindex')).toBe('4998')
  })

  it("expands a row to a grid of its child collection, headed by headers or the collection's name", () => {
    render(
      <DataGrid
        aria-label="People"
        data={people}
        columns={{ orders: { header: 'Orders' }, item: { header: 'Item' } }}
      />,
    )
    const [, grace] = screen.getAllByRole('button', { name: 'Show details' })

    fireEvent.click(grace)

    expect(grace.getAttribute('aria-expanded')).toBe('true')
    expect(bodyRows('Orders')).toEqual([
      ['20', 'Compiler', ''],
      ['21', 'Bug', ''],
    ])
    expect(within(screen.getByRole('table', { name: 'Orders' })).getByRole('button', { name: 'Item' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }))
    expect(screen.queryByRole('table', { name: 'Orders' })).toBeNull()
  })
})

/** A source over rows in memory, each method a spy, any of which a test can leave out. */
function memorySource(rows: Row[]) {
  let next = 100
  return {
    read: vi.fn<() => Promise<Row[]>>(async () => rows),
    create: vi.fn<(row: Partial<Row>) => Promise<Row>>(async (row) => ({ ...row, id: next++ })),
    update: vi.fn<(row: Row, changes: Partial<Row>) => Promise<Row>>(async (row, changes) => ({ ...row, ...changes })),
    remove: vi.fn<(row: Row) => Promise<void>>(async () => {}),
  } satisfies DataGridSource
}

const flat = () => people.map(({ id, name, age }) => ({ id, name, age }))

describe('DataGrid with a source', () => {
  it('shows it is loading until the rows are read', async () => {
    let resolve!: (rows: Row[]) => void
    const source = { read: () => new Promise<Row[]>((r) => (resolve = r)) }
    render(<DataGrid aria-label="People" source={source} />)

    expect(table().getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('progressbar')).toBeTruthy()

    await act(async () => resolve(flat()))
    expect(table().hasAttribute('aria-busy')).toBe(false)
    expect(names()).toEqual(['Ada', 'Grace', 'Alan'])
  })

  it('only offers the changes the source can make', async () => {
    render(<DataGrid aria-label="People" source={{ read: async () => flat() }} />)
    await screen.findByText('Ada')

    expect(screen.queryByRole('button', { name: 'Edit row' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete row' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add row/ })).toBeNull()
  })

  it('sends only the changed values of an edited row, typed as their column, and shows the row it gets back', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const editor = screen.getByRole('row', { name: 'Edited row' })
    fireEvent.change(within(editor).getByRole('textbox', { name: 'age' }), { target: { value: '37' } })
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save' })))

    expect(source.update).toHaveBeenCalledWith({ id: 1, name: 'Ada', age: 36 }, { age: 37 })
    expect(screen.queryByRole('row', { name: 'Edited row' })).toBeNull()
    expect(bodyRows()[0]).toEqual(['1', 'Ada', '37', ''])
  })

  it('saves with Enter and cancels with Escape', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[1])
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'name' }), { key: 'Escape' })
    expect(screen.queryByRole('row', { name: 'Edited row' })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[1])
    const name = screen.getByRole('textbox', { name: 'name' })
    fireEvent.change(name, { target: { value: 'Grace H' } })
    await act(async () => fireEvent.keyDown(name, { key: 'Enter' }))
    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), { name: 'Grace H' })
  })

  it('adds a row, sending the values given but not the key the source gives, and deletes one', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getByRole('button', { name: /Add row/ }))
    const editor = screen.getByRole('row', { name: 'New row' })
    expect(within(editor).queryByRole('textbox', { name: 'id' })).toBeNull()
    expect(document.activeElement).toBe(within(editor).getByRole('textbox', { name: 'name' }))
    fireEvent.change(within(editor).getByRole('textbox', { name: 'name' }), { target: { value: 'Edsger' } })
    fireEvent.change(within(editor).getByRole('textbox', { name: 'age' }), { target: { value: '72' } })
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save' })))

    expect(source.create).toHaveBeenCalledWith({ name: 'Edsger', age: 72 })
    expect(names()).toEqual(['Ada', 'Grace', 'Alan', 'Edsger'])

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete row' })[0])
    expect(source.remove).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete this row' })))
    expect(source.remove).toHaveBeenCalledWith({ id: 1, name: 'Ada', age: 36 })
    expect(names()).toEqual(['Grace', 'Alan', 'Edsger'])
  })

  it('says what went wrong, keeping the edit open, and offers to read again when reading failed', async () => {
    const source = memorySource(flat())
    source.update.mockRejectedValueOnce(new Error('PATCH /people/1 failed: 409 Conflict'))
    source.read.mockRejectedValueOnce(new Error('GET /people failed: 500'))
    render(<DataGrid aria-label="People" source={source} />)

    expect((await screen.findByRole('alert')).textContent).toBe('GET /people failed: 500')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Ada')
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    fireEvent.change(screen.getByRole('textbox', { name: 'age' }), { target: { value: '1' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))

    expect(screen.getByRole('alert').textContent).toBe('PATCH /people/1 failed: 409 Conflict')
    expect(screen.getByRole('row', { name: 'Edited row' })).toBeTruthy()
  })

  it("reads a row's child collection from the child source it is given, once as it opens", async () => {
    const orders = memorySource([{ id: 30, item: 'Difference engine' }])
    const childSource = vi.fn<(parent: Row, collection: string) => DataGridSource>(() => orders)
    render(<DataGrid aria-label="People" data={people} childSource={childSource} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[2])
    await waitFor(() => expect(bodyRows('orders')).toEqual([['30', 'Difference engine', '']]))

    expect(childSource).toHaveBeenCalledOnce()
    expect(childSource).toHaveBeenCalledWith(people[2], 'orders')
    expect(
      within(screen.getByRole('table', { name: 'orders' })).getAllByRole('button', { name: 'Edit row' }),
    ).toHaveLength(1)
  })
})

describe('DataGrid column types', () => {
  showPopovers()

  const tasks = () => [
    { id: 1, title: 'Write', status: 'open', done: false, due: '2026-11-20', cost: 120 },
    { id: 2, title: 'Test', status: 'closed', done: true, due: '2026-10-01', cost: 40 },
    { id: 3, title: 'Ship', status: 'open', done: true, due: null, cost: 300 },
  ]
  const columns = {
    status: {
      type: 'dropdown' as const,
      options: [
        { value: 'open', label: 'Open' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    due: { type: 'date' as const },
  }

  it('shows each value as its type does: labels for choices, ticks for checkboxes, dates as the reader writes them', () => {
    render(<DataGrid aria-label="People" data={tasks()} columns={columns} />)

    expect(columnValues('status')).toEqual(['Open', 'Closed', 'Open'])
    // In the browser's language, which the grid takes without a locale of its own.
    const due = new Intl.DateTimeFormat(navigator.language, { dateStyle: 'medium' }).format(new Date(2026, 10, 20))
    expect(columnValues('due')).toEqual([due, expect.any(String), ''])
    const ticks = document.querySelectorAll('.prism-data-grid__cell--checkbox')
    expect([...ticks].map((cell) => [cell.querySelector('svg') !== null, cell.textContent])).toEqual([
      [false, 'No'],
      [true, 'Yes'],
      [true, 'Yes'],
    ])
    expect(screen.getByRole('button', { name: 'cost' }).closest('.prism-data-grid__cell--end')).not.toBeNull()
  })

  it('filters numbers by comparison and choices by those picked', () => {
    render(<DataGrid aria-label="People" data={tasks()} columns={columns} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter cost' }), { target: { value: '>=120' } })
    expect(columnValues('title')).toEqual(['Write', 'Ship'])

    const status = screen.getByRole('combobox', { name: 'Filter status' })
    fireEvent.change(status, { target: { value: 'clo' } })
    fireEvent.keyDown(status, { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('0 rows')
  })

  it('edits a dropdown from its menu and a checkbox with a toggle, sending the values as stored', async () => {
    const source = memorySource(tasks())
    render(<DataGrid aria-label="People" source={source} columns={columns} />)
    await screen.findByText('Write')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const editor = screen.getByRole('row', { name: 'Edited row' })
    fireEvent.click(within(editor).getByRole('button', { name: 'status: Open' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Closed' }))
    fireEvent.click(within(editor).getByRole('switch', { name: 'done' }))
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save' })))

    // The date went through its editor unchanged, so it isn't sent.
    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { status: 'closed', done: true })
    expect(columnValues('status')[0]).toBe('Closed')
  })

  it('clears a dropdown with its None choice', async () => {
    const source = memorySource(tasks())
    render(<DataGrid aria-label="People" source={source} columns={columns} />)
    await screen.findByText('Write')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const editor = screen.getByRole('row', { name: 'Edited row' })
    fireEvent.click(within(editor).getByRole('button', { name: 'status: Open' }))
    expect(screen.getByRole('menuitemradio', { name: 'None' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'None' }))
    expect(within(editor).getByRole('button', { name: 'status: none' })).toBeTruthy()
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save' })))

    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { status: null })
    expect(columnValues('status')[0]).toBe('')
  })

  it("keeps editing as Escape closes a dropdown's menu, and cancels on the next", async () => {
    render(<DataGrid aria-label="People" source={memorySource(tasks())} columns={columns} />)
    await screen.findByText('Write')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const status = screen.getByRole('button', { name: 'status: Open' })
    fireEvent.click(status)
    expect(status.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: 'Open' }), { key: 'Escape' })
    expect(screen.getByRole('row', { name: 'Edited row' })).toBeTruthy()

    fireEvent.keyDown(status, { key: 'Escape' })
    expect(screen.queryByRole('row', { name: 'Edited row' })).toBeNull()
  })
})

describe('DataGrid editing what the editor would write back differently', () => {
  it('leaves a timestamp in a date column as it was while another value is edited', async () => {
    const source = memorySource([{ id: 1, title: 'Write', due: '2026-11-20T09:30:00Z' }])
    render(<DataGrid aria-label="People" source={source} columns={{ due: { type: 'date' } }} />)
    await screen.findByText('Write')

    fireEvent.click(screen.getByRole('button', { name: 'Edit row' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'title' }), { target: { value: 'Rewrite' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))

    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { title: 'Rewrite' })
  })
})

describe('DataGrid review fixes', () => {
  it('says what a source gave that is not a list of rows, rather than failing to draw', async () => {
    const source = { read: async () => ({ data: [{ id: 1 }] }) as unknown as Row[] }
    render(<DataGrid aria-label="People" source={source} />)

    expect((await screen.findByRole('alert')).textContent).toBe('The source gave an object, not a list of rows.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('scrolls the body to a filter the focus moves to outside the window, and keeps the body as the page turns', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `n${i}`, city: 'x', note: 'y' }))
    render(<DataGrid aria-label="People" data={many} pageSize={10} />)
    const body = document.querySelector<HTMLElement>('.prism-data-grid__body .prism-scroll-area__viewport')!
    // Lays the header out in jsdom, which has none: a 250px window over four 120px columns.
    const window = document.querySelector<HTMLElement>('.prism-data-grid__head .prism-data-grid__cells')!
    Object.defineProperty(window, 'clientWidth', { value: 250, configurable: true })
    const headers = [...window.querySelectorAll<HTMLElement>('[role="columnheader"]')]
    headers.forEach((header, i) =>
      Object.defineProperties(header, {
        offsetLeft: { value: i * 120, configurable: true },
        offsetWidth: { value: 120, configurable: true },
      }),
    )

    // The note column, from 360 to 480, past the window's right edge.
    fireEvent.focus(within(headers[3]).getByRole('textbox'))
    expect(body.scrollLeft).toBe(230)
    // The id column, from 0, past its left edge now.
    fireEvent.focus(within(headers[0]).getByRole('textbox'))
    expect(body.scrollLeft).toBe(0)
    // One in the window, from 120 to 240 in one from 100 to 350, leaves it be.
    body.scrollLeft = 100
    fireEvent.focus(within(headers[1]).getByRole('textbox'))
    expect(body.scrollLeft).toBe(100)

    body.scrollTop = 200
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(document.querySelector('.prism-data-grid__body .prism-scroll-area__viewport')).toBe(body)
    expect(body.scrollTop).toBe(0)
    expect(body.scrollLeft).toBe(100)
  })

  it("heads an empty child collection with the columns the collection has in other rows, not the parent's", () => {
    render(
      <DataGrid
        aria-label="People"
        data={people}
        columns={{ name: { header: 'Name' }, orders: { header: 'Orders' } }}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[2])

    const child = screen.getByRole('table', { name: 'Orders' })
    expect([...child.querySelectorAll('.prism-data-grid__sort')].map((b) => b.textContent)).toEqual(['id', 'item'])
  })

  it('will not save text in a number column, saying why and marking the field until it changes', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const age = screen.getByRole('textbox', { name: 'age' })
    fireEvent.change(age, { target: { value: 'old' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))

    expect(source.update).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('age must be a number.')
    expect(age.getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(age, { target: { value: '40' } })
    expect(age.hasAttribute('aria-invalid')).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sends a new row its untouched values, a toggle left off included, but not empty ones', async () => {
    const source = memorySource([{ id: 1, name: 'a', note: 'x', done: true }])
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('a')

    fireEvent.click(screen.getByRole('button', { name: /Add row/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'name' }), { target: { value: 'b' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))

    expect(source.create).toHaveBeenCalledWith({ name: 'b', done: false })
  })

  it('holds sorting, filtering and the pages while a row is being edited', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `n${i}` }))
    render(<DataGrid aria-label="People" source={memorySource(many)} pageSize={5} />)
    await screen.findByText('n0')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    expect(screen.getByRole('button', { name: 'name' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('textbox', { name: 'Filter name' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'name' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', false)
  })

  it('lets go of an edit whose row has gone, as a new source reads its own rows', async () => {
    const { rerender } = render(<DataGrid aria-label="People" source={memorySource(flat())} />)
    await screen.findByText('Ada')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    expect(screen.getByRole('button', { name: 'name' })).toHaveProperty('disabled', true)

    rerender(<DataGrid aria-label="People" source={memorySource(flat())} />)
    await screen.findByText('Ada')

    expect(screen.queryByRole('row', { name: 'Edited row' })).toBeNull()
    expect(screen.getByRole('button', { name: 'name' })).toHaveProperty('disabled', false)
    expect(screen.getAllByRole('button', { name: 'Edit row' })[0]).toHaveProperty('disabled', false)
  })

  it('leaves Enter to an input method composing, and saves on the next', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const name = screen.getByRole('textbox', { name: 'name' })
    fireEvent.change(name, { target: { value: 'エイダ' } })
    await act(async () => fireEvent.keyDown(name, { key: 'Enter', isComposing: true }))
    expect(source.update).not.toHaveBeenCalled()

    await act(async () => fireEvent.keyDown(name, { key: 'Enter' }))
    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { name: 'エイダ' })
  })
})

describe('DataGrid fading at the sides', () => {
  // Stands in for the stylesheets, whose var() and overflow jsdom can't resolve.
  const sheet = Object.assign(document.createElement('style'), {
    textContent: `.prism-data-grid__body > .prism-scroll-area__viewport.prism-scroll-fade {
      --prism-scroll-fade: 32px; overflow-x: auto; overflow-y: auto;
    }`,
  })

  beforeEach(() => document.head.append(sheet))
  afterEach(() => sheet.remove())

  /** Lays the body out 300px wide over 900px of columns, scrolled `scrollLeft` across. */
  function scrollBody(scrollLeft: number) {
    const body = document.querySelector<HTMLElement>('.prism-data-grid__body .prism-scroll-area__viewport')!
    Object.defineProperties(body, {
      clientWidth: { value: 300, configurable: true },
      scrollWidth: { value: 900, configurable: true },
      clientHeight: { value: 200, configurable: true },
      scrollHeight: { value: 200, configurable: true },
      scrollLeft: { value: scrollLeft, configurable: true },
    })
    fireEvent.scroll(body)
    return body
  }

  // Set on the table, for the header and the summary row both to fade by.
  const headFade = () =>
    ['left', 'right'].map((side) => table().style.getPropertyValue(`--_prism-data-grid-fade-${side}`))

  it('fades the header as far in as the rows towards each side with more to scroll to', () => {
    render(<DataGrid aria-label="People" data={people} />)

    let body = scrollBody(0)
    expect(headFade()).toEqual(['0px', '32px'])
    expect(body.style.getPropertyValue('--prism-scroll-fade-right')).toBe('32px')

    body = scrollBody(300)
    expect(headFade()).toEqual(['32px', '32px'])

    scrollBody(600)
    expect(headFade()).toEqual(['32px', '0px'])
  })

  it('fades as far as any scroller does up and down, unless told otherwise', () => {
    expect(dataGridStyles).toContain(`--prism-data-grid-fade: ${FADE_SIZE};`)
    expect(dataGridStyles).toContain('--prism-scroll-fade-size: var(--prism-data-grid-fade);')
  })

  it('fades its columns by the mask a scroller fades by', () => {
    expect(dataGridStyles).toContain(
      `mask-image: ${fadeMask('right', 'var(--_prism-data-grid-fade-left)', 'var(--_prism-data-grid-fade-right)')};`,
    )
  })
})

describe('DataGrid showFilter', () => {
  const filters = () =>
    screen.queryAllByRole('textbox', { name: /^Filter / }).map((box) => box.getAttribute('aria-label'))

  it('gives every column a filter by default, but a column that says not', () => {
    render(<DataGrid aria-label="People" data={people} columns={{ id: { showFilter: false } }} />)
    expect(filters()).toEqual(['Filter name', 'Filter age'])
  })

  it('hides the filters with showFilter off, but a column that asks for one', () => {
    const { rerender } = render(<DataGrid aria-label="People" data={people} showFilter={false} />)
    expect(filters()).toEqual([])
    // Still sorts.
    expect(screen.getByRole('button', { name: 'name' })).toBeTruthy()

    rerender(<DataGrid aria-label="People" data={people} showFilter={false} columns={{ name: { showFilter: true } }} />)
    expect(filters()).toEqual(['Filter name'])
  })

  it('stops filtering by a filter as it is hidden', () => {
    const { rerender } = render(<DataGrid aria-label="People" data={people} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter name' }), { target: { value: 'grace' } })
    expect(names()).toEqual(['Grace'])

    rerender(<DataGrid aria-label="People" data={people} showFilter={false} />)
    expect(names()).toEqual(['Ada', 'Grace', 'Alan'])
  })

  it('passes showFilter on to child grids', () => {
    render(<DataGrid aria-label="People" data={people} showFilter={false} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[0])
    expect(screen.getByRole('table', { name: 'orders' })).toBeTruthy()
    expect(filters()).toEqual([])
  })
})

describe('DataGrid summary row', () => {
  const summaryCells = () => {
    const row = document.querySelector('.prism-data-grid__row--summary')
    return row && [...row.querySelectorAll('[role="cell"]')].map((cell) => cell.textContent)
  }

  it('shows none by default', () => {
    render(<DataGrid aria-label="People" data={flat()} />)
    expect(summaryCells()).toBeNull()
    expect(table().getAttribute('aria-rowcount')).toBe('4')
  })

  it('totals each number column but the key with showSummary, as the last row of the table', () => {
    render(<DataGrid aria-label="People" data={flat()} showSummary />)

    expect(summaryCells()).toEqual(['', '', 'Total 162', ''])
    expect(table().getAttribute('aria-rowcount')).toBe('5')
    expect(screen.getByRole('row', { name: /Total/ }).getAttribute('aria-rowindex')).toBe('5')
  })

  it('shows the summary each column asks for, and the row for a column that asks without showSummary', () => {
    const columns = { age: { summary: 'average' as const }, id: { summary: 'max' as const } }
    render(<DataGrid aria-label="People" data={flat()} columns={columns} />)
    expect(summaryCells()).toEqual(['Max 3', '', 'Average 54', ''])
  })

  it('summarises every row the filters let through, on every page', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, group: i % 2 ? 'odd' : 'even', n: i }))
    render(<DataGrid aria-label="People" data={many} pageSize={5} showSummary />)
    expect(summaryCells()).toEqual(['', '', 'Total 435', ''])

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter group' }), { target: { value: 'odd' } })
    expect(summaryCells()).toEqual(['', '', 'Total 225', ''])
  })

  it('follows a change saved through the source', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} showSummary />)
    await screen.findByText('Ada')
    // The actions column has an empty cell too.
    expect(summaryCells()).toEqual(['', '', 'Total 162', ''])

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    fireEvent.change(screen.getByRole('textbox', { name: 'age' }), { target: { value: '40' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(summaryCells()).toEqual(['', '', 'Total 166', ''])
  })

  it('lays its values on a track in a window, as the header and rows do, to move with the body', () => {
    render(<DataGrid aria-label="People" data={flat()} showSummary />)
    const track = document.querySelector(
      '.prism-data-grid__row--summary > .prism-data-grid__cells > .prism-data-grid__track',
    )
    expect(track?.textContent).toContain('Total 162')
  })
})

describe('DataGrid masks', () => {
  const sales = [
    { id: 1, amount: 1234.5, on: '2026-11-09' },
    { id: 2, amount: 20, on: '2026-01-05' },
  ]
  const columns = { amount: { mask: '£#,##0.00' }, on: { type: 'date' as const, mask: 'dd/MM/yyyy' } }

  it('writes cells and the summary as their masks say, and filters by what they show', () => {
    render(<DataGrid aria-label="People" data={sales} columns={columns} showSummary />)

    expect(columnValues('amount')).toEqual(['£1,234.50', '£20.00'])
    expect(columnValues('on')).toEqual(['09/11/2026', '05/01/2026'])
    expect(document.querySelector('.prism-data-grid__row--summary')!.textContent).toContain('Total £1,254.50')

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter amount' }), { target: { value: '£1,2' } })
    expect(columnValues('amount')).toEqual(['£1,234.50'])
  })

  it('edits a number as the number, and a date in the pattern of its mask', async () => {
    const source = memorySource(sales)
    render(<DataGrid aria-label="People" source={source} columns={columns} />)
    await screen.findByText('£20.00')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    expect(screen.getByRole('textbox', { name: 'amount' })).toHaveProperty('value', '1234.5')
    expect(screen.getByRole('combobox', { name: 'on' })).toHaveProperty('value', '09/11/2026')
  })
})

describe('DataGrid input masks', () => {
  const contacts = () => [
    { id: 1, name: 'Ada', phone: '02079460958' },
    { id: 2, name: 'Grace', phone: '(161) 4960-0000' },
  ]
  const columns = { phone: { mask: '(999) 9999-9999' } }

  it('shows text that fits its mask as the mask writes it, and finds it either way', () => {
    render(<DataGrid aria-label="People" data={contacts()} columns={columns} />)
    expect(columnValues('phone')).toEqual(['(020) 7946-0958', '(161) 4960-0000'])

    const filter = screen.getByRole('textbox', { name: 'Filter phone' })
    fireEvent.change(filter, { target: { value: '0207' } })
    expect(columnValues('phone')).toEqual(['(020) 7946-0958'])
    fireEvent.change(filter, { target: { value: '(161)' } })
    expect(columnValues('phone')).toEqual(['(161) 4960-0000'])
  })

  it('fits what is typed to the mask, showing its shape while empty, with a keyboard of digits', async () => {
    render(<DataGrid aria-label="People" source={memorySource(contacts())} columns={columns} />)
    await screen.findByText('Ada')
    fireEvent.click(screen.getByRole('button', { name: /Add row/ }))
    const phone = screen.getByRole('textbox', { name: 'phone' }) as HTMLInputElement

    expect(phone.placeholder).toBe('(___) ____-____')
    expect(phone.inputMode).toBe('numeric')
    fireEvent.change(phone, { target: { value: '02x07' } })
    expect(phone.value).toBe('(020) 7')
  })

  it('keeps the caret where the typing is, rather than at the end', async () => {
    render(<DataGrid aria-label="People" source={memorySource(contacts())} columns={columns} />)
    await screen.findByText('Ada')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const phone = screen.getByRole('textbox', { name: 'phone' }) as HTMLInputElement
    expect(phone.value).toBe('(020) 7946-0958')
    phone.focus()

    // A 5 typed after "(020) 7", which pushes the rest along and the last digit off the end.
    fireEvent.change(phone, { target: { value: '(020) 75946-0958', selectionStart: 8, selectionEnd: 8 } })
    expect(phone.value).toBe('(020) 7594-6095')
    expect(phone.selectionStart).toBe(8)
  })

  it('saves only a value that fills the mask, as the mask writes it', async () => {
    const source = memorySource(contacts())
    render(<DataGrid aria-label="People" source={source} columns={columns} />)
    await screen.findByText('Ada')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[1])
    const phone = screen.getByRole('textbox', { name: 'phone' })

    fireEvent.change(phone, { target: { value: '0161496' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(source.update).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('phone must be filled in as (___) ____-____.')

    fireEvent.change(phone, { target: { value: '01614960123' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), { phone: '(016) 1496-0123' })
  })

  it('saves only what fills the slots where the column says not to save the mask', async () => {
    const source = memorySource(contacts())
    render(<DataGrid aria-label="People" source={source} columns={{ phone: { ...columns.phone, saveMask: false } }} />)
    await screen.findByText('Ada')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[1])

    fireEvent.change(screen.getByRole('textbox', { name: 'phone' }), { target: { value: '01614960123' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), { phone: '01614960123' })
    expect(columnValues('phone')[1]).toBe('(016) 1496-0123')
  })
})

describe('DataGrid date filters', () => {
  showPopovers()

  const events = [
    { id: 1, title: 'Launch', on: '2026-11-02' },
    { id: 2, title: 'Review', on: '2026-11-05T16:30:00' },
    { id: 3, title: 'Party', on: '2026-11-20' },
    { id: 4, title: 'Unplanned', on: null },
  ]
  const columns = { on: { type: 'date' as const, mask: 'dd/MM/yyyy' } }

  it('filters a date column by a run of days picked on a calendar, in the pattern of its mask', () => {
    render(<DataGrid aria-label="People" data={events} columns={columns} />)
    const filter = screen.getByRole('combobox', { name: 'Filter on' })
    expect(filter.closest('.prism-calendar--range')).not.toBeNull()

    fireEvent.change(filter, { target: { value: '01/11/2026 – 05/11/2026' } })
    filter.focus()
    act(() => filter.blur())
    expect(columnValues('title')).toEqual(['Launch', 'Review'])
    expect(screen.getByRole('status').textContent).toBe('2 rows')
  })

  it('filters nothing once the run of days is cleared', () => {
    render(<DataGrid aria-label="People" data={events} columns={columns} />)
    const filter = screen.getByRole('combobox', { name: 'Filter on' })
    fireEvent.change(filter, { target: { value: '20/11/2026' } })
    filter.focus()
    act(() => filter.blur())
    expect(columnValues('title')).toEqual(['Party'])

    fireEvent.click(within(filter.closest('.prism-calendar')!).getByRole('button', { name: 'Clear' }))
    expect(columnValues('title')).toEqual(['Launch', 'Review', 'Party', 'Unplanned'])
  })
})

describe('DataGrid locale and money', () => {
  const orders = () => [
    { id: 1, item: 'Lens', price: 1234.5, weight: 2.25 },
    { id: 2, item: 'Prism', price: 20, weight: 0.5 },
  ]
  const columns = { price: { type: 'money' as const }, weight: { mask: '0.00 kg' } }
  const euros = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

  it("writes money in its currency the locale's way, and numbers and masks with its separators, the summary too", () => {
    render(<DataGrid aria-label="People" data={orders()} columns={columns} locale="de-DE" currency="EUR" showSummary />)

    expect(columnValues('price')).toEqual([euros(1234.5), euros(20)])
    expect(columnValues('weight')).toEqual(['2,25 kg', '0,50 kg'])
    expect(document.querySelector('.prism-data-grid__row--summary')!.textContent).toContain(`Total ${euros(1254.5)}`)
  })

  it('writes money in the currency it is given, whatever the locale', () => {
    render(<DataGrid aria-label="People" data={orders()} columns={columns} locale="en-GB" currency="USD" />)
    expect(columnValues('price')).toEqual(['US$1,234.50', 'US$20.00'])
  })

  it("edits money in the locale's way, and saves the amount", async () => {
    const source = memorySource(orders())
    render(<DataGrid aria-label="People" source={source} columns={columns} locale="de-DE" currency="EUR" />)
    await screen.findByText('Lens')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    const price = screen.getByRole('textbox', { name: 'price' })
    expect(price).toHaveProperty('value', '1234,50')
    fireEvent.change(price, { target: { value: '1.500,75 €' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))

    expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { price: 1500.75 })
  })

  it("filters money by a comparison typed in the locale's way", () => {
    render(<DataGrid aria-label="People" data={orders()} columns={columns} locale="de-DE" currency="EUR" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter price' }), { target: { value: '>1.000' } })
    expect(columnValues('item')).toEqual(['Lens'])
  })

  it('writes a money column with no currency given as numbers, rather than guess one from the locale', () => {
    render(<DataGrid aria-label="People" data={orders()} columns={columns} locale="fr-FR" />)
    expect(columnValues('price')).toEqual(['1234,5', '20'])
  })
})

describe('DataGrid date filters in a locale', () => {
  showPopovers()

  it("takes a run of days typed the grid's locale's way, with no mask", () => {
    const events = [
      { id: 1, title: 'Launch', on: '2026-11-02' },
      { id: 2, title: 'Party', on: '2026-11-20' },
    ]
    render(<DataGrid aria-label="People" data={events} columns={{ on: { type: 'date' } }} locale="de-DE" />)
    const filter = screen.getByRole('combobox', { name: 'Filter on' })

    // German writes the day first, with points.
    fireEvent.change(filter, { target: { value: '01.11.2026 - 05.11.2026' } })
    filter.focus()
    act(() => filter.blur())
    expect(columnValues('title')).toEqual(['Launch'])
  })
})

describe('DataGrid sticky lanes', () => {
  /** A row's parts: its lanes and its column cells. */
  const partsOf = (row: Element) => ({
    start: row.querySelector(':scope > .prism-data-grid__lane--start') !== null,
    cells: row.querySelectorAll(
      ':scope > .prism-data-grid__cells > .prism-data-grid__track > :is([role="cell"], [role="columnheader"])',
    ).length,
    end: row.querySelector(':scope > .prism-data-grid__lane--end') !== null,
  })

  it('keeps the expander and the actions in lanes either side of the columns, in every kind of row', async () => {
    render(<DataGrid aria-label="People" source={memorySource(people)} showSummary />)
    await screen.findByText('Ada')

    const header = document.querySelector('.prism-data-grid__head [role="row"]')!
    const row = document.querySelector('.prism-data-grid__rows > [role="row"]')!
    const summary = document.querySelector('.prism-data-grid__row--summary')!
    for (const r of [header, row, summary]) expect(partsOf(r)).toEqual({ start: true, cells: 3, end: true })

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    expect(partsOf(screen.getByRole('row', { name: 'Edited row' }))).toEqual({ start: true, cells: 3, end: true })
  })

  it('has no lanes where there is no expander, no actions and no filter', () => {
    render(<DataGrid aria-label="People" data={flat()} showFilter={false} />)
    expect(partsOf(document.querySelector('.prism-data-grid__rows > [role="row"]')!)).toEqual({
      start: false,
      cells: 3,
      end: false,
    })
  })

  it('names a scroll timeline of its own for the tracks, unlike a child grid', () => {
    render(<DataGrid aria-label="People" data={people} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[0])

    const [outer, inner] = [...document.querySelectorAll<HTMLElement>('.prism-data-grid__view')].map((view) =>
      view.style.getPropertyValue('--_prism-data-grid-timeline'),
    )
    expect(outer).toMatch(/^--prism-data-grid-[\w-]+$/)
    expect(inner).toMatch(/^--prism-data-grid-[\w-]+$/)
    expect(inner).not.toBe(outer)
  })

  it('gives the window its lanes, and the track its columns, least width and all', async () => {
    render(<DataGrid aria-label="People" source={memorySource(people)} />)
    await screen.findByText('Ada')
    const view = table().closest<HTMLElement>('.prism-data-grid__view')!.style
    expect(view.getPropertyValue('--_prism-data-grid-start')).toBe('var(--prism-data-grid-expander-width)')
    expect(view.getPropertyValue('--_prism-data-grid-end')).toBe('var(--prism-data-grid-actions-width)')
    expect(view.getPropertyValue('--_prism-data-grid-cells-least')).toBe('calc(3 * var(--prism-data-grid-column-min))')
  })

  it('leaves the tracks to the scroll timeline where the browser has one, as jsdom says it has', async () => {
    render(<DataGrid aria-label="People" source={memorySource(people)} />)
    await screen.findByText('Ada')
    const body = document.querySelector<HTMLElement>('.prism-data-grid__body .prism-scroll-area__viewport')!
    body.scrollLeft = 120
    fireEvent.scroll(body)
    expect(table().style.getPropertyValue('--_prism-data-grid-scroll')).toBe('')
  })

  it('moves the tracks by a script where the browser has no scroll timelines', async () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(false)
    render(<DataGrid aria-label="People" source={memorySource(people)} />)
    await screen.findByText('Ada')
    const body = document.querySelector<HTMLElement>('.prism-data-grid__body .prism-scroll-area__viewport')!
    body.scrollLeft = 120
    fireEvent.scroll(body)
    expect(table().style.getPropertyValue('--_prism-data-grid-scroll')).toBe('120px')
  })
})

describe('DataGrid clearing filters', () => {
  showPopovers()

  const clear = () => screen.getByRole('button', { name: 'Clear filters' })

  it('clears every filter at once, text, choices and dates, from a button level with them', () => {
    const rows = [
      { id: 1, name: 'Ada', status: 'open', on: '2026-11-02' },
      { id: 2, name: 'Grace', status: 'closed', on: '2026-11-20' },
      { id: 3, name: 'Alan', status: 'open', on: '2026-10-01' },
    ]
    render(
      <DataGrid aria-label="People" data={rows} columns={{ status: { type: 'dropdown' }, on: { type: 'date' } }} />,
    )
    expect(clear()).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter name' }), { target: { value: 'a' } })
    const status = screen.getByRole('combobox', { name: 'Filter status' })
    fireEvent.change(status, { target: { value: 'open' } })
    fireEvent.keyDown(status, { key: 'Enter' })
    expect(columnValues('name')).toEqual(['Ada', 'Alan'])
    expect(clear()).toHaveProperty('disabled', false)

    fireEvent.click(clear())
    expect(columnValues('name')).toEqual(['Ada', 'Grace', 'Alan'])
    expect(screen.getByRole('textbox', { name: 'Filter name' })).toHaveProperty('value', '')
    expect(clear()).toHaveProperty('disabled', true)
  })

  it('goes back to the first page as it clears', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `n${i}` }))
    render(<DataGrid aria-label="People" data={many} pageSize={5} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter name' }), { target: { value: 'n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeTruthy()

    fireEvent.click(clear())
    expect(screen.getByText('Page 1 of 3')).toBeTruthy()
  })

  it('waits while a row is being edited, as the filters do', async () => {
    render(<DataGrid aria-label="People" source={memorySource(flat())} />)
    await screen.findByText('Ada')
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter name' }), { target: { value: 'a' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])
    expect(clear()).toHaveProperty('disabled', true)
  })

  it('has a narrow lane of its own where there are no actions, and none where no column has a filter', () => {
    const { rerender } = render(<DataGrid aria-label="People" data={flat()} />)
    const end = () =>
      table().closest<HTMLElement>('.prism-data-grid__view')!.style.getPropertyValue('--_prism-data-grid-end')
    expect(end()).toBe('var(--prism-data-grid-expander-width)')

    rerender(<DataGrid aria-label="People" data={flat()} showFilter={false} />)
    expect(end()).toBe('0px')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })
})

describe('DataGrid pages', () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `n${i}` }))
  const firstName = () => columnValues('name')[0]
  const field = () => screen.getByRole('textbox', { name: 'Page, of 100' }) as HTMLInputElement

  it('goes to the first and the last page, those buttons waiting at their ends', () => {
    render(<DataGrid aria-label="People" data={many} pageSize={10} />)
    expect(screen.getByRole('button', { name: 'First page' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Last page' }))
    expect(firstName()).toBe('n990')
    expect(field().value).toBe('100')
    expect(screen.getByRole('button', { name: 'Last page' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'First page' }))
    expect(firstName()).toBe('n0')
  })

  it('goes to a page typed in, on Enter or as the focus leaves, the last for one past it', () => {
    render(<DataGrid aria-label="People" data={many} pageSize={10} />)

    fireEvent.change(field(), { target: { value: '57' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(firstName()).toBe('n560')
    expect(screen.getByText('Page 57 of 100')).toBeTruthy()

    fireEvent.change(field(), { target: { value: '4000' } })
    fireEvent.blur(field())
    expect(firstName()).toBe('n990')
  })

  it('puts back the page showing on Escape, and for nothing or text that is no page', () => {
    render(<DataGrid aria-label="People" data={many} pageSize={10} />)
    act(() => field().focus())

    fireEvent.change(field(), { target: { value: '12' } })
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(field().value).toBe('1')
    fireEvent.blur(field())
    expect(firstName()).toBe('n0')

    fireEvent.change(field(), { target: { value: 'x' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(field().value).toBe('1')

    fireEvent.change(field(), { target: { value: '' } })
    act(() => field().blur())
    expect(field().value).toBe('1')
    expect(firstName()).toBe('n0')
  })

  it('shows the page the buttons turn to, and leaves Enter to an input method composing', () => {
    render(<DataGrid aria-label="People" data={many} pageSize={10} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(field().value).toBe('2')

    fireEvent.change(field(), { target: { value: '42' } })
    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true })
    expect(firstName()).toBe('n10')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(firstName()).toBe('n410')
    expect(field().value).toBe('42')
  })

  it("goes to a page typed in the digits of the grid's locale", () => {
    render(<DataGrid aria-label="People" data={many} pageSize={10} locale="ar-EG" />)

    fireEvent.change(field(), { target: { value: '٥٧' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(firstName()).toBe('n560')

    fireEvent.change(field(), { target: { value: '12' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(firstName()).toBe('n110')
  })
})

describe('DataGrid review: performance and bugs', () => {
  showPopovers()

  it('has as many cells in each row as the header has, with a lane for clearing filters', () => {
    render(<DataGrid aria-label="People" data={flat()} />)
    const header = document.querySelectorAll('.prism-data-grid__head [role="columnheader"]').length
    const row = document
      .querySelector('.prism-data-grid__rows > [role="row"]')!
      .querySelectorAll('[role="cell"]').length
    expect([header, row]).toEqual([4, 4])
  })

  it("writes its counts in the grid's locale, not the browser's", () => {
    const many = Array.from({ length: 12_345 }, (_, i) => ({ id: i }))
    render(<DataGrid aria-label="People" data={many} pageSize={10} locale="de-DE" />)
    expect(screen.getByRole('status').textContent).toBe('12.345 rows')
    expect(document.querySelector('.prism-data-grid__page')!.textContent).toContain('of 1.235')
  })

  it('draws the rows again as rows come into view, not for every pixel scrolled', () => {
    const format = vi.spyOn(KINDS.text, 'format')
    const many = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `n${i}` }))
    render(<DataGrid aria-label="People" data={many} rowHeight={40} />)
    const viewport = document.querySelector<HTMLElement>('.prism-data-grid__body .prism-scroll-area__viewport')!
    // The first pixel brings the top of the next row into view at the bottom.
    viewport.scrollTop = 5
    fireEvent.scroll(viewport)
    format.mockClear()

    viewport.scrollTop = 10
    fireEvent.scroll(viewport)
    viewport.scrollTop = 20
    fireEvent.scroll(viewport)
    expect(format).not.toHaveBeenCalled()

    // Far enough for new rows to come in: only those are drawn.
    viewport.scrollTop = 400
    fireEvent.scroll(viewport)
    expect(format.mock.calls.length).toBeGreaterThan(0)
    expect(format.mock.calls.length).toBeLessThanOrEqual(10)
  })
})

describe('DataGrid columns compared by content', () => {
  it("doesn't read the rows again for columns written inline, but does for columns that change", async () => {
    const shape = vi.spyOn(await import('./columns'), 'readShape')
    const rows = [{ id: 1, price: 5 }]
    const { rerender } = render(<DataGrid aria-label="People" data={rows} columns={{ price: { type: 'money' } }} />)
    shape.mockClear()

    rerender(<DataGrid aria-label="People" data={rows} columns={{ price: { type: 'money' } }} />)
    expect(shape).not.toHaveBeenCalled()

    rerender(<DataGrid aria-label="People" data={rows} columns={{ price: { type: 'number' } }} />)
    expect(shape).toHaveBeenCalled()
    expect(columnValues('price')).toEqual(['5'])
  })
})

describe('DataGrid outstanding fixes', () => {
  it('tells rows with the same key apart, expanding each on its own', () => {
    const twins = [
      { id: 1, name: 'Ada', orders: [{ item: 'Engine' }] },
      { id: 1, name: 'Ava', orders: [{ item: 'Loom' }] },
    ]
    render(<DataGrid aria-label="People" data={twins} />)
    expect(names()).toEqual(['Ada', 'Ava'])

    fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[1])
    expect(screen.getByText('Loom')).toBeTruthy()
    expect(screen.queryByText('Engine')).toBeNull()
  })

  it('takes its rows as data or from a source, but not both', () => {
    // @ts-expect-error -- one or the other
    const both = <DataGrid aria-label="People" data={people} source={memorySource(flat())} />
    expect(both.props.data).toBe(people)
  })

  it('lets the keyboard reach the body, to scroll it', () => {
    render(<DataGrid aria-label="People" data={people} />)
    const viewport = table().querySelector('.prism-data-grid__body .prism-scroll-area__viewport')!
    expect(viewport.getAttribute('tabindex')).toBe('0')
  })

  it('keeps the place in the table of a row being edited', async () => {
    render(<DataGrid aria-label="People" source={memorySource(flat())} />)
    await screen.findByText('Ada')
    const second = screen.getAllByRole('button', { name: 'Edit row' })[1]
    const index = second.closest('[role="row"]')!.getAttribute('aria-rowindex')

    fireEvent.click(second)
    expect(screen.getByRole('row', { name: 'Edited row' }).getAttribute('aria-rowindex')).toBe(index)
  })
})

describe('DataGrid confirming a delete', () => {
  it('asks before it deletes a row, on buttons that take the place of its own', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete row' })[0])
    const yes = screen.getByRole('button', { name: 'Delete this row' })
    expect(document.activeElement).toBe(yes)
    expect(screen.getAllByRole('button', { name: 'Delete row' })).toHaveLength(2)

    await act(async () => fireEvent.click(yes))
    expect(source.remove).toHaveBeenCalledWith({ id: 1, name: 'Ada', age: 36 })
    expect(names()).toEqual(['Grace', 'Alan'])
  })

  it('keeps the row on the second button or Escape, the focus going back to the delete button', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} />)
    await screen.findByText('Ada')

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete row' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Keep this row' }))
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Delete row' })[1])

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete row' })[1])
    fireEvent.keyDown(screen.getByRole('button', { name: 'Delete this row' }), { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Delete this row' })).toBeNull()
    expect(source.remove).not.toHaveBeenCalled()
  })

  it('deletes at once with confirmDelete off', async () => {
    const source = memorySource(flat())
    render(<DataGrid aria-label="People" source={source} confirmDelete={false} />)
    await screen.findByText('Ada')

    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Delete row' })[0]))
    expect(source.remove).toHaveBeenCalledWith({ id: 1, name: 'Ada', age: 36 })
  })
})
