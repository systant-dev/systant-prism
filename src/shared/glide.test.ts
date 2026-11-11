import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames, pointer } from '../../test/dom'
import { glideAfterPointer, type GlideOptions } from './glide'
import type { Point } from './localPoint'

let frames: ReturnType<typeof manualFrames>
let el: HTMLElement
let stop: (() => void) | undefined
// Where the point is drawn, last first.
let drawn: Point[]
// The element's top, which the target is measured from, as scrolling moves it.
let top: number

/** Follows the pointer over `el`, heading straight for it, less the element's top. */
function follow(options: Partial<GlideOptions> = {}) {
  stop = glideAfterPointer(
    el,
    { glideMs: 70, ...options },
    (at) => ({ x: at.x, y: at.y - top }),
    (at) => drawn.unshift({ x: at.x, y: at.y }),
  )
}

beforeEach(() => {
  frames = manualFrames()
  el = document.body.appendChild(document.createElement('div'))
  drawn = []
  top = 0
})

afterEach(() => {
  stop?.()
  stop = undefined
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('glideAfterPointer', () => {
  it('draws at most once per frame, at the latest position', () => {
    follow()
    pointer(el, 'pointermove', 10, 10)
    pointer(el, 'pointermove', 90, 80)
    expect(frames.pending).toBe(1)

    frames.flush()
    expect(drawn).toEqual([{ x: 90, y: 80 }])
  })

  it('glides to a new position over a few frames, then stops', () => {
    follow()
    pointer(el, 'pointermove', 10, 50)
    frames.flush()

    pointer(el, 'pointermove', 190, 50)
    frames.flush()
    expect(drawn[0].x).toBeGreaterThan(10)
    expect(drawn[0].x).toBeLessThan(190)

    const frameCount = frames.settle()
    expect(frameCount).toBeGreaterThan(3)
    expect(frameCount).toBeLessThan(40)
    expect(drawn[0]).toEqual({ x: 190, y: 50 })
  })

  it('jumps straight to the pointer when motion is reduced', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
    follow()
    pointer(el, 'pointermove', 10, 10)
    frames.flush()

    pointer(el, 'pointermove', 90, 80)
    frames.flush()
    expect(drawn[0]).toEqual({ x: 90, y: 80 })
    expect(frames.pending).toBe(0)
  })

  it('starts at the pointer, not where it left, on the next entry', () => {
    follow()
    pointer(el, 'pointermove', 10, 10)
    frames.flush()
    pointer(el, 'pointermove', 90, 90)
    frames.flush()

    pointer(el, 'pointerleave')
    expect(frames.pending).toBe(0)

    pointer(el, 'pointermove', 20, 80)
    frames.flush()
    expect(drawn[0]).toEqual({ x: 20, y: 80 })
  })

  it('follows touches unless told not to', () => {
    const touch = () =>
      el.dispatchEvent(
        Object.assign(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }), { pointerType: 'touch' }),
      )
    follow({ touch: false })
    touch()
    expect(frames.pending).toBe(0)
    stop!()

    follow()
    touch()
    expect(frames.pending).toBe(1)
  })

  it('follows scrolling while hovered, and stops once the pointer leaves', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    follow()
    pointer(el, 'pointermove', 20, 140)
    frames.flush()

    // The page scrolls 20px under a still pointer.
    top = -20
    window.dispatchEvent(new Event('scroll'))
    frames.flush()
    expect(drawn[0]).toEqual({ x: 20, y: 160 })

    pointer(el, 'pointerleave')
    window.dispatchEvent(new Event('scroll'))
    expect(frames.pending).toBe(0)
  })

  it('stops following when stopped, mid-hover', () => {
    follow()
    pointer(el, 'pointermove', 10, 10)
    expect(frames.pending).toBe(1)

    stop!()
    expect(frames.pending).toBe(0)
    pointer(el, 'pointermove', 20, 20)
    window.dispatchEvent(new Event('scroll'))
    expect(frames.pending).toBe(0)
  })
})
