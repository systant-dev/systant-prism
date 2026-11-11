import { describe, expect, it } from 'vitest'
import {
  cardAt,
  coverage,
  isShown,
  minimiseCard,
  moveCard,
  restoreCard,
  settleLayout,
  shownCards,
  stepCard,
  toggleMaximised,
  type CardGridLayout,
} from './layout'

const layout = (over: Partial<CardGridLayout> = {}): CardGridLayout => ({
  order: ['a', 'b', 'c', 'd'],
  minimised: [],
  maximised: null,
  ...over,
})

describe('settleLayout', () => {
  it('adds cards it does not order at the end and drops ones that have gone', () => {
    expect(settleLayout(layout({ order: ['c', 'x', 'a'] }), ['a', 'b', 'c']).order).toEqual(['c', 'a', 'b'])
  })

  it('drops docked cards that have gone', () => {
    expect(settleLayout(layout({ minimised: ['x', 'b'] }), ['a', 'b']).minimised).toEqual(['b'])
  })

  it('stops a docked or missing card filling the grid', () => {
    expect(settleLayout(layout({ maximised: 'x' }), ['a']).maximised).toBeNull()
    expect(settleLayout(layout({ maximised: 'a', minimised: ['a'] }), ['a']).maximised).toBeNull()
    expect(settleLayout(layout({ maximised: 'a' }), ['a']).maximised).toBe('a')
  })
})

describe('shownCards', () => {
  it('leaves docked cards out', () => {
    expect(shownCards(layout({ minimised: ['b'] }))).toEqual(['a', 'c', 'd'])
  })

  it('shows only the maximised card', () => {
    const l = layout({ maximised: 'c' })
    expect(shownCards(l)).toEqual(['c'])
    expect(isShown(l, 'a')).toBe(false)
  })
})

describe('moveCard', () => {
  it('moves a card forward to after the target', () => {
    expect(moveCard(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a card back to before the target', () => {
    expect(moveCard(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })

  it('leaves the order as it was for itself or an unknown id', () => {
    const order = ['a', 'b']
    expect(moveCard(order, 'a', 'a')).toBe(order)
    expect(moveCard(order, 'a', 'x')).toBe(order)
  })
})

describe('stepCard', () => {
  it('steps past the next shown card, skipping docked ones', () => {
    expect(stepCard(layout({ minimised: ['b'] }), 'a', 1)).toEqual(['b', 'c', 'a', 'd'])
    expect(stepCard(layout(), 'c', -1)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('steps a row at a time by as many places as there are columns', () => {
    expect(stepCard(layout(), 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(stepCard(layout(), 'd', -2)).toEqual(['a', 'd', 'b', 'c'])
    const l = layout()
    expect(stepCard(l, 'c', 2)).toBe(l.order)
  })

  it('stays put at either end', () => {
    const l = layout()
    expect(stepCard(l, 'a', -1)).toBe(l.order)
    expect(stepCard(l, 'd', 1)).toBe(l.order)
  })
})

describe('minimise, restore and maximise', () => {
  it('docks a card, once, and stops it filling the grid', () => {
    const docked = minimiseCard(layout({ maximised: 'a' }), 'a')
    expect(docked).toEqual(layout({ minimised: ['a'], maximised: null }))
    expect(minimiseCard(docked, 'a')).toBe(docked)
  })

  it('keeps another card filling the grid as one is docked', () => {
    expect(minimiseCard(layout({ maximised: 'b' }), 'a').maximised).toBe('b')
  })

  it('restores a card and shows every card again', () => {
    expect(restoreCard(layout({ minimised: ['a', 'b'], maximised: 'c' }), 'a')).toEqual(
      layout({ minimised: ['b'], maximised: null }),
    )
  })

  it('toggles a card filling the grid', () => {
    const maximised = toggleMaximised(layout(), 'b')
    expect(maximised.maximised).toBe('b')
    expect(toggleMaximised(maximised, 'b').maximised).toBeNull()
    expect(toggleMaximised(maximised, 'c').maximised).toBe('c')
  })
})

describe('cardAt', () => {
  const rects: [string, { left: number; top: number; width: number; height: number }][] = [
    ['a', { left: 0, top: 0, width: 100, height: 50 }],
    ['b', { left: 110, top: 0, width: 100, height: 50 }],
  ]

  it('finds the box holding the point', () => {
    expect(cardAt(rects, 150, 25)).toBe('b')
    expect(cardAt(rects, 0, 0)).toBe('a')
  })

  it('finds none in a gap or past the far edges', () => {
    expect(cardAt(rects, 105, 25)).toBeNull()
    expect(cardAt(rects, 100, 25)).toBeNull()
    expect(cardAt(rects, 50, 50)).toBeNull()
  })
})

describe('coverage', () => {
  const card = { left: 0, top: 0, width: 100, height: 50 }

  it('is how much of the card the box covers', () => {
    expect(coverage({ left: 50, top: 0, width: 100, height: 50 }, card)).toBe(0.5)
    expect(coverage({ left: 50, top: 25, width: 100, height: 50 }, card)).toBe(0.25)
    expect(coverage({ left: -10, top: -10, width: 200, height: 200 }, card)).toBe(1)
  })

  it('is 0 apart or edge to edge', () => {
    expect(coverage({ left: 100, top: 0, width: 100, height: 50 }, card)).toBe(0)
    expect(coverage({ left: 0, top: 60, width: 100, height: 50 }, card)).toBe(0)
  })
})
