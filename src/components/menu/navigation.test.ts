import { describe, expect, it } from 'vitest'
import { focusableRows, focusMenu, rowForKey, rowForTyping } from './navigation'

describe('rowForKey', () => {
  it('steps down and up, going round at the ends', () => {
    expect(rowForKey('ArrowDown', 0, 3)).toBe(1)
    expect(rowForKey('ArrowDown', 2, 3)).toBe(0)
    expect(rowForKey('ArrowUp', 1, 3)).toBe(0)
    expect(rowForKey('ArrowUp', 0, 3)).toBe(2)
  })

  it('starts from the ends with no row focused', () => {
    expect(rowForKey('ArrowDown', -1, 3)).toBe(0)
    expect(rowForKey('ArrowUp', -1, 3)).toBe(2)
  })

  it('goes to the first and last rows on Home and End', () => {
    expect(rowForKey('Home', 1, 3)).toBe(0)
    expect(rowForKey('End', 1, 3)).toBe(2)
  })

  it('leaves other keys, and a menu with no rows, alone', () => {
    expect(rowForKey('a', 0, 3)).toBeUndefined()
    expect(rowForKey('ArrowDown', -1, 0)).toBeUndefined()
  })
})

describe('rowForTyping', () => {
  const labels = ['Copy', 'Cut', 'Paste', 'Café', 'Delete']

  it('finds a row from the start of its label, whatever its case', () => {
    expect(rowForTyping(labels, 'P', -1)).toBe(2)
    expect(rowForTyping(labels, 'de', 0)).toBe(4)
  })

  it('ignores accents, in the label or what is typed', () => {
    expect(rowForTyping(labels, 'caf', 0)).toBe(3)
    expect(rowForTyping(labels, 'dé', 0)).toBe(4)
  })

  it('stays on a row that still matches as typing goes on', () => {
    expect(rowForTyping(labels, 'co', 0)).toBe(0)
  })

  it('steps through the rows that start with one letter pressed over and over', () => {
    expect(rowForTyping(labels, 'c', 0)).toBe(1)
    expect(rowForTyping(labels, 'cc', 1)).toBe(3)
    expect(rowForTyping(labels, 'ccc', 3)).toBe(0)
  })

  it('goes round past the last row', () => {
    expect(rowForTyping(labels, 'pa', 4)).toBe(2)
  })

  it('finds nothing where nothing matches', () => {
    expect(rowForTyping(labels, 'z', 0)).toBe(-1)
    expect(rowForTyping([], 'a', -1)).toBe(-1)
  })
})

describe('focusMenu', () => {
  function list() {
    const el = document.createElement('div')
    el.tabIndex = -1
    el.innerHTML = `
      <div role="menuitem" tabindex="-1" aria-disabled="true">Off</div>
      <div role="menuitem" tabindex="-1">One</div>
      <div role="menuitemcheckbox" tabindex="-1">Two</div>
      <div role="menuitemradio" tabindex="-1">Three</div>
      <div role="separator"></div>`
    document.body.append(el)
    return el
  }

  it('finds the rows of every kind that can take the focus', () => {
    expect(focusableRows(list()).map((row) => row.textContent)).toEqual(['One', 'Two', 'Three'])
  })

  it('focuses the first row, the last or the menu itself', () => {
    const el = list()
    focusMenu(el, 'first')
    expect(document.activeElement?.textContent).toBe('One')
    focusMenu(el, 'last')
    expect(document.activeElement?.textContent).toBe('Three')
    focusMenu(el, 'menu')
    expect(document.activeElement).toBe(el)
  })

  it('falls back on the menu with no row to focus', () => {
    const el = document.createElement('div')
    el.tabIndex = -1
    document.body.append(el)
    focusMenu(el, 'first')
    expect(document.activeElement).toBe(el)
  })
})
