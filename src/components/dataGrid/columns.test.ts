import { describe, expect, it } from 'vitest'
import { readShape } from './columns'

describe('readShape', () => {
  it('makes a column of each property, in the order they first appear, typed by their values', () => {
    const { columns, children } = readShape([
      { id: 1, name: 'Ada', active: true },
      { id: 2, name: 'Grace', joined: '1906-12-09', tags: { a: 1 } },
    ])

    expect(columns.map(({ key, header, type }) => [key, header, type])).toEqual([
      ['id', 'id', 'number'],
      ['name', 'name', 'text'],
      ['active', 'active', 'checkbox'],
      ['joined', 'joined', 'text'],
      ['tags', 'tags', 'json'],
    ])
    expect(children).toEqual([])
  })

  it('heads and types columns as asked, falling back to the property name and values', () => {
    const { columns } = readShape([{ id: 1, name: 'Ada', joined: '1815-12-10' }], {
      name: { header: 'Full name' },
      joined: { header: 'Joined', type: 'date' },
    })
    expect(columns.map(({ header, type }) => [header, type])).toEqual([
      ['id', 'number'],
      ['Full name', 'text'],
      ['Joined', 'date'],
    ])
  })

  it('makes child collections of arrays of objects, and columns of the rest', () => {
    const { columns, children } = readShape([
      { id: 1, orders: [{ id: 10 }], tags: ['a', 'b'] },
      { id: 2, orders: [] },
    ])

    expect(children).toEqual(['orders'])
    expect(columns.map((c) => [c.key, c.type])).toEqual([
      ['id', 'number'],
      ['tags', 'json'],
    ])
  })

  it('types a column with mixed values as text, or JSON where one is an object', () => {
    const { columns } = readShape([
      { a: null, b: 1, c: 1 },
      { a: 2, b: 'x', c: { d: 1 } },
    ])
    expect(columns.map((c) => c.type)).toEqual(['number', 'text', 'json'])
  })

  it("gives a dropdown its choices as given, labelled or not, or else the column's values in order", () => {
    const rows = [{ status: 'open' }, { status: 'closed' }, { status: 'open' }, { status: null }]

    const given = readShape(rows, {
      status: { type: 'dropdown', options: [{ value: 'open', label: 'Open' }, 'closed'] },
    })
    expect(given.columns[0].options).toEqual([
      { value: 'open', label: 'Open', key: 'open' },
      { value: 'closed', label: 'closed', key: 'closed' },
    ])

    const read = readShape(rows, { status: { type: 'dropdown' } })
    expect(read.columns[0].options.map((o) => o.value)).toEqual(['closed', 'open'])
  })

  it("lists a dropdown's choices read from its values in the order of the grid's locale", () => {
    const rows = [{ town: 'Zürich' }, { town: 'Ängelholm' }, { town: 'Bern' }]
    const choices = (locale: string) =>
      readShape(rows, { town: { type: 'dropdown' } }, { locale }).columns[0].options.map((o) => o.value)
    expect(choices('en-GB')).toEqual(['Ängelholm', 'Bern', 'Zürich'])
    expect(choices('sv-SE')).toEqual(['Bern', 'Zürich', 'Ängelholm'])
  })

  it('gives a checkbox its two choices, and other types none', () => {
    const { columns } = readShape([{ ok: true, n: 1 }])
    expect(columns[0].options.map((o) => o.label)).toEqual(['Yes', 'No'])
    expect(columns[1].options).toEqual([])
  })

  it('gives the columns of each child collection across every row, for a row where it is empty', () => {
    const { childColumns } = readShape(
      [
        { id: 1, orders: [{ id: 10, item: 'Engine' }] },
        { id: 2, orders: [{ id: 20, total: 5, lines: [{ sku: 'a' }] }] },
        { id: 3, orders: [] },
      ],
      { name: { header: 'Name' } },
    )
    // Not the grandchild collection, nor the parent's described columns.
    expect(childColumns).toEqual({ orders: ['id', 'item', 'total'] })
  })

  it('takes the columns it is given while there are no rows, rather than those described', () => {
    const { columns } = readShape(
      [],
      { name: { header: 'Name' }, price: { type: 'number' } },
      {
        empty: ['price'],
      },
    )
    expect(columns.map(({ key, type }) => [key, type])).toEqual([['price', 'number']])
  })

  it("gives each column a filter as its own showFilter says, or else as the grid's does", () => {
    const rows = [{ id: 1, name: 'Ada', city: 'London' }]
    const columns = { id: { showFilter: false }, city: { showFilter: true } }
    const filterable = (showFilter?: boolean) =>
      readShape(rows, columns, { showFilter }).columns.map((c) => [c.key, c.filterable])

    expect(filterable()).toEqual([
      ['id', false],
      ['name', true],
      ['city', true],
    ])
    expect(filterable(false)).toEqual([
      ['id', false],
      ['name', false],
      ['city', true],
    ])
  })

  it("gives each column the width it asks for, and a handle to resize it as its own resizable says, or else the grid's", () => {
    const rows = [{ id: 1, name: 'Ada', city: 'London' }]
    const columns = { id: { width: 60, resizable: false }, name: { width: 'auto' as const }, city: { resizable: true } }
    const sized = (resizable?: boolean) =>
      readShape(rows, columns, { resizable }).columns.map((c) => [c.key, c.width, c.resizable])

    expect(sized()).toEqual([
      ['id', 60, false],
      ['name', 'auto', true],
      ['city', null, true],
    ])
    expect(sized(false)).toEqual([
      ['id', 60, false],
      ['name', 'auto', false],
      ['city', null, true],
    ])
  })

  it('totals number columns but the key where the grid shows summaries, as each column allows', () => {
    const rows = [{ id: 1, name: 'Ada', credit: 1200, score: 7, rank: 2 }]
    const columns = {
      score: { summary: 'average' as const },
      rank: { summary: false as const },
      name: { summary: 'total' as const },
    }
    const summaries = (showSummary: boolean) =>
      readShape(rows, columns, { showSummary, rowKey: 'id' }).columns.map((c) => [c.key, c.summary])

    expect(summaries(true)).toEqual([
      ['id', null],
      ['name', null],
      ['credit', 'total'],
      ['score', 'average'],
      ['rank', null],
    ])
    // A column that asks for a summary has one without the grid's.
    expect(summaries(false)).toEqual([
      ['id', null],
      ['name', null],
      ['credit', null],
      ['score', 'average'],
      ['rank', null],
    ])
    expect(readShape(rows, { id: { summary: 'max' } }, { rowKey: 'id' }).columns[0].summary).toBe('max')
  })

  it("gives a money column its own currency, or else the grid's, and without either makes it a number column", () => {
    const rows = [{ a: 1, b: 2, c: 3, n: 4 }]
    const columns = {
      a: { type: 'money' as const, currency: 'JPY' },
      b: { type: 'money' as const },
      c: { type: 'money' as const },
    }
    const shape = (options: { currency?: string }) =>
      readShape(rows, columns, { locale: 'fr-FR', ...options }).columns.map((c) => `${c.type} ${c.currency}`.trim())
    expect(shape({})).toEqual(['money JPY', 'number', 'number', 'number'])
    expect(shape({ currency: 'GBP' })).toEqual(['money JPY', 'money GBP', 'money GBP', 'number'])
  })

  it('totals money columns with showSummary, as it does numbers', () => {
    const { columns } = readShape(
      [{ id: 1, price: 2 }],
      { price: { type: 'money' } },
      { showSummary: true, rowKey: 'id' },
    )
    expect(columns.map((c) => c.summary)).toEqual([null, 'total'])
  })

  it('takes the columns from those described while there are no rows', () => {
    const { columns } = readShape([], { name: { header: 'Name' }, price: { type: 'number' } })
    expect(columns.map(({ key, header, type }) => [key, header, type])).toEqual([
      ['name', 'Name', 'text'],
      ['price', 'price', 'number'],
    ])
  })
})
