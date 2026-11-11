import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualIntersections } from '../../../test/dom'
import { watchMove } from './watchMove'

let intersections: ReturnType<typeof manualIntersections>
let onMove: ReturnType<typeof vi.fn<() => void>>
let el: HTMLElement

function box(left: number, top: number, width: number, height: number) {
  return new DOMRect(left, top, width, height)
}

beforeEach(() => {
  intersections = manualIntersections()
  onMove = vi.fn<() => void>()
  el = document.createElement('div')
  Object.defineProperties(document.documentElement, {
    clientWidth: { value: 1000, configurable: true },
    clientHeight: { value: 800, configurable: true },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('watchMove', () => {
  it('watches the viewport shrunk to the box, rounded outwards to whole px', () => {
    watchMove(el, box(100.5, 50, 200, 100.4), onMove)
    expect(intersections.optionsFor(el)).toEqual([
      { root: document, rootMargin: '-50px -699px -649px -100px', threshold: 1 },
    ])
  })

  it('reports nothing where the element is, and a move away from it', () => {
    watchMove(el, box(100, 50, 200, 100), onMove)
    intersections.intersect(el, 1)
    expect(onMove).not.toHaveBeenCalled()

    intersections.intersect(el, 0.8)
    expect(onMove).toHaveBeenCalledOnce()
    expect(intersections.observed).toBe(0)
  })

  it('watches the part a clipping ancestor shows', () => {
    watchMove(el, box(100, 50, 200, 100), onMove)
    intersections.intersect(el, 0.5)
    expect(onMove).not.toHaveBeenCalled()
    expect(intersections.optionsFor(el)).toMatchObject([{ threshold: 0.5 }])

    intersections.intersect(el, 0.5)
    expect(onMove).not.toHaveBeenCalled()
    intersections.intersect(el, 0.4)
    expect(onMove).toHaveBeenCalledOnce()
  })

  it("doesn't watch a wholly clipped element", () => {
    watchMove(el, box(100, 50, 200, 100), onMove)
    intersections.intersect(el, 0)
    expect(intersections.observed).toBe(0)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('watches nothing without a size', () => {
    watchMove(el, box(100, 50, 0, 0), onMove)
    expect(intersections.created).toBe(0)
  })

  it('stops watching when asked', () => {
    const stop = watchMove(el, box(100, 50, 200, 100), onMove)
    intersections.intersect(el, 0.5)
    stop()
    expect(intersections.observed).toBe(0)
  })
})
