import { describe, expect, it } from 'vitest'
import { readShape } from './columns'
import { filterRows, nextSort, pageCount, pageRows, sortRows } from './view'

const rows = [
  { name: 'Zoë', age: 30, code: 'item 10' },
  { name: 'adam', age: null, code: 'item 2' },
  { name: 'Émile', age: 4, code: 'item 1' },
]

const { columns } = readShape(rows)

const names = (list: readonly Record<string, unknown>[]) => list.map((r) => r.name)

describe('filterRows', () => {
  it('keeps the rows holding every filter, whatever the case and accents', () => {
    expect(names(filterRows(rows, columns, { name: 'EMI' }))).toEqual(['Émile'])
    expect(names(filterRows(rows, columns, { name: 'a', code: '2' }))).toEqual(['adam'])
  })

  it('filters each column as its type does, and ignores empty filters and unknown columns', () => {
    expect(names(filterRows(rows, columns, { age: '3' }))).toEqual(['Zoë'])
    expect(names(filterRows(rows, columns, { age: '<10' }))).toEqual(['Émile'])
    expect(filterRows(rows, columns, { gone: 'x' })).toBe(rows)
  })

  it('ignores the filter of a column whose filter is hidden', () => {
    const hidden = readShape(rows, { name: { showFilter: false } }).columns
    expect(filterRows(rows, hidden, { name: 'adam' })).toBe(rows)
    expect(names(filterRows(rows, hidden, { name: 'adam', age: '4' }))).toEqual(['Émile'])
    expect(filterRows(rows, columns, { name: '  ' })).toBe(rows)
  })
})

describe('sortRows', () => {
  it('sorts numbers by size, with empty values last either way', () => {
    expect(names(sortRows(rows, columns, { key: 'age', direction: 'ascending' }))).toEqual(['Émile', 'Zoë', 'adam'])
    expect(names(sortRows(rows, columns, { key: 'age', direction: 'descending' }))).toEqual(['Zoë', 'Émile', 'adam'])
  })

  it('sorts empty text last either way too', () => {
    const list = [{ name: '' }, { name: 'b' }, { name: 'a' }]
    const shape = readShape(list).columns
    expect(names(sortRows(list, shape, { key: 'name', direction: 'ascending' }))).toEqual(['a', 'b', ''])
    expect(names(sortRows(list, shape, { key: 'name', direction: 'descending' }))).toEqual(['b', 'a', ''])
  })

  it('sorts text as people read it', () => {
    expect(names(sortRows(rows, columns, { key: 'name', direction: 'ascending' }))).toEqual(['adam', 'Émile', 'Zoë'])
    expect(sortRows(rows, columns, { key: 'code', direction: 'ascending' }).map((r) => r.code)).toEqual([
      'item 1',
      'item 2',
      'item 10',
    ])
  })

  it("sorts text in the order of the grid's locale, not the reader's", () => {
    const list = [{ name: 'z' }, { name: 'ä' }, { name: 'b' }]
    const sortedAs = (locale: string) =>
      names(sortRows(list, readShape(list, {}, { locale }).columns, { key: 'name', direction: 'ascending' }))
    expect(sortedAs('en-GB')).toEqual(['ä', 'b', 'z'])
    // Swedish has ä as a letter of its own, after z.
    expect(sortedAs('sv-SE')).toEqual(['b', 'z', 'ä'])
  })

  it('sorts a dropdown by the labels of its choices', () => {
    const coded = readShape(rows, { code: { type: 'dropdown', options: [{ value: 'item 1', label: 'Zulu' }] } }).columns
    expect(sortRows(rows, coded, { key: 'code', direction: 'ascending' }).map((r) => r.code)).toEqual([
      'item 2',
      'item 10',
      'item 1',
    ])
  })

  it('leaves the rows as they are with no sort, and never changes them', () => {
    expect(sortRows(rows, columns, null)).toBe(rows)
    sortRows(rows, columns, { key: 'name', direction: 'ascending' })
    expect(names(rows)).toEqual(['Zoë', 'adam', 'Émile'])
  })
})

describe('nextSort', () => {
  it('goes ascending, descending, then none, starting again on another column', () => {
    const up = nextSort(null, 'a')
    expect(up).toEqual({ key: 'a', direction: 'ascending' })
    const down = nextSort(up, 'a')
    expect(down).toEqual({ key: 'a', direction: 'descending' })
    expect(nextSort(down, 'a')).toBeNull()
    expect(nextSort(down, 'b')).toEqual({ key: 'b', direction: 'ascending' })
  })
})

describe('pages', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ i }))

  it('cuts rows into pages, the last holding what is left', () => {
    expect(pageCount(25, 10)).toBe(3)
    expect(pageRows(many, 2, 10).map((r) => r.i)).toEqual([20, 21, 22, 23, 24])
  })

  it('has one page of them all with no paging, and with no rows', () => {
    expect(pageCount(25, 0)).toBe(1)
    expect(pageRows(many, 0, 0)).toBe(many)
    expect(pageCount(0, 10)).toBe(1)
  })
})
