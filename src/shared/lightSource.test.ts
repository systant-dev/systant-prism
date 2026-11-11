import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames, placeAt, pointer } from '../../test/dom'
import type { trackLight as TrackLight } from './lightSource'

// The light source is module state, so every test gets a fresh copy.
let trackLight: typeof TrackLight
let frames: ReturnType<typeof manualFrames>
const untrack: (() => void)[] = []

function tracked(left: number, top: number) {
  const el = document.createElement('div')
  document.body.append(el)
  placeAt(el, left, top)
  untrack.push(trackLight(el))
  return el
}

function lightOn(el: HTMLElement) {
  return ['x', 'y', 'on'].map((p) => el.style.getPropertyValue(`--prism-light-${p}`))
}

beforeEach(async () => {
  frames = manualFrames()
  vi.resetModules()
  ;({ trackLight } = await import('./lightSource'))
})

afterEach(() => {
  for (const stop of untrack.splice(0)) stop()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('trackLight', () => {
  it('gives each element the light position relative to its own box', () => {
    const a = tracked(0, 0)
    const b = tracked(150, 0)

    pointer(window, 'pointermove', 120, 40)
    frames.flush()

    expect(lightOn(a)).toEqual(['120px', '40px', '1'])
    expect(lightOn(b)).toEqual(['-30px', '40px', '1'])
  })

  it('ignores a touch, which has no hover', () => {
    const el = tracked(0, 0)
    frames.flush()
    const before = lightOn(el)

    window.dispatchEvent(
      Object.assign(new MouseEvent('pointermove', { clientX: 20, clientY: 20 }), { pointerType: 'touch' }),
    )
    frames.flush()
    expect(lightOn(el)).toEqual(before)
    expect(lightOn(el)[2]).not.toBe('1')
  })

  it('reads its reach from another property when given one', () => {
    const el = document.createElement('div')
    el.style.setProperty('--prism-edge-light-size', '100px')
    document.body.append(el)
    placeAt(el, 1000, 0)
    untrack.push(trackLight(el, '--prism-edge-light-size'))

    // 150px away: within the default 280px, beyond 100px.
    pointer(window, 'pointermove', 850, 50)
    frames.flush()
    pointer(window, 'pointermove', 860, 50)
    frames.flush()

    expect(lightOn(el)).toEqual(['-150px', '50px', '1'])
  })

  it('writes at most once per frame', () => {
    tracked(0, 0)
    frames.flush()

    pointer(window, 'pointermove', 10, 10)
    pointer(window, 'pointermove', 20, 20)
    expect(frames.pending).toBe(1)
  })

  it('skips elements beyond its reach, after one last write', () => {
    const near = tracked(0, 0)
    const far = tracked(1000, 0)

    pointer(window, 'pointermove', 50, 50)
    frames.flush()
    // Out of range, but just left it (it starts in range): moved fully off.
    expect(lightOn(far)).toEqual(['-950px', '50px', '1'])

    pointer(window, 'pointermove', 60, 60)
    frames.flush()
    expect(lightOn(near)).toEqual(['60px', '60px', '1'])
    expect(lightOn(far)).toEqual(['-950px', '50px', '1'])
  })

  it('reads its reach from --prism-card-highlight-size', () => {
    const el = document.createElement('div')
    el.style.setProperty('--prism-card-highlight-size', '500px')
    document.body.append(el)
    placeAt(el, 1000, 0)
    untrack.push(trackLight(el))

    pointer(window, 'pointermove', 600, 50)
    frames.flush()
    pointer(window, 'pointermove', 610, 50)
    frames.flush()

    // 390px away: beyond the default 280px, within 500px.
    expect(lightOn(el)).toEqual(['-390px', '50px', '1'])
  })

  it('turns off when the pointer leaves the page', () => {
    const el = tracked(0, 0)
    pointer(window, 'pointermove', 50, 50)
    frames.flush()

    pointer(document.documentElement, 'pointerleave')
    frames.flush()

    expect(lightOn(el)).toEqual(['50px', '50px', '0'])
  })

  it('lights an element again when the pointer comes back in range', () => {
    const el = tracked(0, 0)
    pointer(window, 'pointermove', 1000, 50)
    frames.flush()
    pointer(window, 'pointermove', 1010, 50)
    frames.flush()
    expect(lightOn(el)).toEqual(['1000px', '50px', '1'])

    pointer(window, 'pointermove', 150, 50)
    frames.flush()
    expect(lightOn(el)).toEqual(['150px', '50px', '1'])
  })

  it('turns off when the window loses focus', () => {
    const el = tracked(0, 0)
    pointer(window, 'pointermove', 50, 50)
    frames.flush()

    window.dispatchEvent(new Event('blur'))
    frames.flush()

    expect(lightOn(el)).toEqual(['50px', '50px', '0'])
  })

  it.each(['scroll', 'resize'])('follows the element when the window fires %s', (type) => {
    const el = tracked(0, 0)
    pointer(window, 'pointermove', 50, 50)
    frames.flush()

    placeAt(el, 0, -20)
    window.dispatchEvent(new Event(type))
    expect(frames.pending).toBe(1)
    frames.flush()

    expect(lightOn(el)).toEqual(['50px', '70px', '1'])
  })

  it('keeps lighting the others when one stops being tracked', () => {
    const a = tracked(0, 0)
    const b = tracked(150, 0)
    frames.flush()
    untrack.shift()!()

    pointer(window, 'pointermove', 120, 40)
    frames.flush()

    expect(lightOn(a)).toEqual(['0px', '0px', '0'])
    expect(lightOn(b)).toEqual(['-30px', '40px', '1'])
  })

  it('stops listening once nothing is tracked', () => {
    tracked(0, 0)
    frames.flush()
    for (const stop of untrack.splice(0)) stop()

    pointer(window, 'pointermove', 50, 50)
    window.dispatchEvent(new Event('scroll'))
    expect(frames.pending).toBe(0)
  })
})
