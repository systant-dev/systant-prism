import { describe, expect, it } from 'vitest'
import { localPoint } from './localPoint'

/** An element with these own sizes and borders, which jsdom doesn't lay out. */
function box({ width = 0, height = 0, borderLeft = 0, borderTop = 0 } = {}) {
  const el = document.createElement('div')
  Object.defineProperties(el, {
    offsetWidth: { value: width },
    offsetHeight: { value: height },
    clientLeft: { value: borderLeft },
    clientTop: { value: borderTop },
  })
  return el
}

describe('localPoint', () => {
  it('measures from the top-left of the padding box, inside the border', () => {
    const el = box({ width: 200, height: 100, borderLeft: 2, borderTop: 3 })
    expect(localPoint(el, new DOMRect(100, 50, 200, 100), 150, 90)).toEqual({ x: 48, y: 37 })
  })

  it("gives the point in the element's own px while it is scaled", () => {
    // 200×100 CSS px, shown at half size: its border counts in its own px too.
    const el = box({ width: 200, height: 100, borderLeft: 2, borderTop: 4 })
    expect(localPoint(el, new DOMRect(100, 50, 100, 50), 150, 60)).toEqual({ x: 98, y: 16 })
  })

  it('takes an element with no size of its own as unscaled', () => {
    expect(localPoint(box(), new DOMRect(10, 20, 100, 50), 40, 30)).toEqual({ x: 30, y: 10 })
  })
})
