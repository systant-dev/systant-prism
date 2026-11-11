import { describe, expect, it } from 'vitest'
import { filterItems } from './filterItems'

const items = [{ label: 'Banana' }, { label: 'Apple' }, { label: 'Pineapple' }, { label: 'Crème fraîche' }]

const labels = (query: string) => filterItems(items, query).map((item) => item.label)

describe('filterItems', () => {
  it('keeps every item with nothing to look for', () => {
    expect(filterItems(items, '')).toBe(items)
    expect(filterItems(items, '   ')).toBe(items)
  })

  it('finds a label anywhere in it, in any case', () => {
    expect(labels('NAN')).toEqual(['Banana'])
  })

  it('puts the labels that start with the query first', () => {
    expect(labels('app')).toEqual(['Apple', 'Pineapple'])
  })

  it('keeps the given order within each group', () => {
    expect(labels('a')).toEqual(['Apple', 'Banana', 'Pineapple', 'Crème fraîche'])
  })

  it('takes no notice of accents, in the label or the query', () => {
    expect(labels('creme')).toEqual(['Crème fraîche'])
    expect(labels('bànana')).toEqual(['Banana'])
  })

  it('takes no notice of space round the query, but keeps it within', () => {
    expect(labels('  apple ')).toEqual(['Apple', 'Pineapple'])
    expect(labels('crème f')).toEqual(['Crème fraîche'])
  })

  it('finds nothing where nothing matches', () => {
    expect(labels('kiwi')).toEqual([])
  })
})
