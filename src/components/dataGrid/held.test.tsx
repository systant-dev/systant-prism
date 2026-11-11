import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import { readShape } from './columns'
import { columnTracks, columnWidths } from './columnWidths'
import { DataGrid } from './DataGrid'
import { held } from './held'
import { restSource } from './restSource'
import { summarize } from './summary'
import type { Row } from './types'
import { filterRows, sortRows } from './view'

/** Names every object answers to without holding anything under them. */
const INHERITED = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']

/** Rows as JSON gives them: the first holds a value under each of those names, the second holds none. */
const rows = () =>
  JSON.parse(
    '[{"id":1,"constructor":"Ada","toString":"b","valueOf":3,"hasOwnProperty":"d","__proto__":"e"},{"id":2}]',
  ) as Row[]

beforeEach(() => {
  manualResizes()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('held', () => {
  it('gives what a record holds, and nothing for a name it only inherits', () => {
    const [full, bare] = rows()
    for (const name of INHERITED) {
      expect([name, held(full, name)]).toEqual([name, full[name]])
      expect([name, held(bare, name)]).toEqual([name, undefined])
      expect([name, held({}, name)]).toEqual([name, undefined])
    }
    expect(held(full, '__proto__')).toBe('e')
    expect(held(bare, 'id')).toBe(2)
    expect(held(bare, 'name')).toBeUndefined()
    expect(held(undefined, 'id')).toBeUndefined()
    expect(held(null, 'toString')).toBeUndefined()
  })

  it('still reads what a row gets from a class of its own', () => {
    class Person {
      first: string
      constructor(first: string) {
        this.first = first
      }
      get shout() {
        return this.first.toUpperCase()
      }
    }
    const row = new Person('Ada') as unknown as Row
    expect(held(row, 'first')).toBe('Ada')
    expect(held(row, 'shout')).toBe('ADA')
    expect(held(row, 'constructor')).toBeUndefined()
  })
})

describe('a column named for something every object has', () => {
  const columns = () => readShape(rows()).columns

  it('is a column like any other, as its name and values suggest', () => {
    expect(columns().map((c) => [c.key, c.header, c.type, c.width])).toEqual([
      ['id', 'id', 'number', null],
      ['constructor', 'constructor', 'text', null],
      ['toString', 'toString', 'text', null],
      ['valueOf', 'valueOf', 'number', null],
      ['hasOwnProperty', 'hasOwnProperty', 'text', null],
      ['__proto__', '__proto__', 'text', null],
    ])
    // And takes what `columns` says of it, own names and all.
    const spec = JSON.parse('{"__proto__":{"header":"Proto","width":90},"constructor":{"header":"Made by"}}')
    const shaped = readShape(rows(), spec).columns
    expect(shaped.find((c) => c.key === '__proto__')).toMatchObject({ header: 'Proto', width: 90 })
    expect(shaped.find((c) => c.key === 'constructor')?.header).toBe('Made by')
  })

  it('has no width until it is given one, and keeps the one it is given', () => {
    expect(columnWidths(columns(), {})).toEqual({})
    expect(columnTracks(columns(), {}).cells).not.toContain('NaN')

    const sized = Object.fromEntries(INHERITED.map((name, i) => [name, 100 + i]))
    const widths = columnWidths(columns(), sized)
    expect(Object.entries(widths)).toEqual(Object.entries(sized))
    expect(columnTracks(columns(), widths).cells).toBe(
      'minmax(var(--prism-data-grid-column-min), 1fr) 100px 101px 102px 103px 104px',
    )
    // One that asks for a width of its own gets it.
    const asked = readShape(rows(), JSON.parse('{"__proto__":{"width":90}}')).columns
    expect(Object.entries(columnWidths(asked, {}))).toEqual([['__proto__', 90]])
  })

  it('filters, sorts and adds up by what the rows hold', () => {
    const shape = columns()
    expect(filterRows(rows(), shape, {})).toHaveLength(2)
    expect(filterRows(rows(), shape, { constructor: 'ada' })).toEqual([rows()[0]])
    expect(filterRows(rows(), shape, JSON.parse('{"__proto__":"e"}'))).toEqual([rows()[0]])
    // A row with nothing there sorts last, either way.
    for (const direction of ['ascending', 'descending'] as const) {
      expect(sortRows(rows().reverse(), shape, { key: 'toString', direction }).map((row) => row.id)).toEqual([1, 2])
    }
    expect(summarize(rows(), 'valueOf', 'total')).toBe(3)
    expect(summarize(rows(), 'constructor', 'total')).toBe(0)
  })

  it('shows what each row holds, and nothing where it holds none', () => {
    render(<DataGrid aria-label="Things" data={rows()} showSummary />)
    const grid = screen.getByRole('table', { name: 'Things' })
    const cells = within(grid)
      .getAllByRole('row')
      .filter((row) => row.parentElement?.classList.contains('prism-data-grid__rows'))
      .map((row) =>
        within(row)
          .queryAllByRole('cell')
          .map((cell) => cell.textContent),
      )
    expect(cells).toEqual([
      ['1', 'Ada', 'b', '3', 'd', 'e', ''],
      ['2', '', '', '', '', '', ''],
    ])
    const view = document.querySelector<HTMLElement>('.prism-data-grid__view')!
    expect(view.style.getPropertyValue('--_prism-data-grid-cells')).not.toContain('NaN')
    // No filter is in use, so there is none to clear, and each can be typed into.
    expect(screen.getByRole('status').textContent).toBe('2 rows')
    for (const name of INHERITED.filter((each) => each !== 'valueOf')) {
      expect((screen.getByRole('textbox', { name: `Filter ${name}` }) as HTMLInputElement).value).toBe('')
    }
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter constructor' }), { target: { value: 'ad' } })
    expect(screen.getByRole('status').textContent).toBe('1 row')
  })
})

describe('restSource with a key every object has', () => {
  it('sends nothing for a row that holds no such key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const source = restSource('/api/things', { key: 'constructor', fetch })
    await expect(source.remove({ id: 2 })).rejects.toThrow('The row has no constructor to address it by.')
    expect(fetch).not.toHaveBeenCalled()
  })
})
