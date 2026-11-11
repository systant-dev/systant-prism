import { cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames, placeAt, pointer } from '../../../test/dom'
import { useInnerSheen } from './useInnerSheen'

function Host({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const sheen = useInnerSheen(ref, enabled)
  return (
    <div ref={ref} data-testid="host" className={sheen.className}>
      {sheen.element}
    </div>
  )
}

function sheenAt(el: HTMLElement) {
  return [el.style.getPropertyValue('--prism-inner-sheen-x'), el.style.getPropertyValue('--prism-inner-sheen-y')]
}

/** The lit edges, in left/right/top/bottom order, e.g. 'left top'. */
function litEdges(el: HTMLElement) {
  return ['left', 'right', 'top', 'bottom']
    .filter((edge) => el.style.getPropertyValue(`--prism-inner-sheen-${edge}`) === '1')
    .join(' ')
}

let frames: ReturnType<typeof manualFrames>

beforeEach(() => {
  frames = manualFrames()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useInnerSheen', () => {
  it('adds the inner sheen class only when enabled', () => {
    const { rerender } = render(<Host />)
    expect(screen.getByTestId('host').classList.contains('prism-inner-sheen')).toBe(true)

    rerender(<Host enabled={false} />)
    expect(screen.getByTestId('host').classList.contains('prism-inner-sheen')).toBe(false)
  })

  it.each([
    [130, 90, 'left top'],
    [250, 90, 'right top'],
    [130, 110, 'left bottom'],
    [250, 110, 'right bottom'],
    [200, 90, 'left right top'],
    [130, 100, 'left top bottom'],
    [200, 100, 'left right top bottom'],
    [200.4, 99.6, 'left right top bottom'],
  ])('lights the edges of the halves the pointer is in (%s, %s)', (x, y, edges) => {
    render(<Host />)
    const host = screen.getByTestId('host')
    placeAt(host, 100, 50, 200, 100)

    pointer(host, 'pointermove', x, y)
    frames.flush()

    expect(litEdges(host)).toBe(edges)
  })

  it('places the sheen at the pointer, relative to the padding box', () => {
    render(<Host />)
    const host = screen.getByTestId('host')
    placeAt(host, 100, 50)
    Object.defineProperties(host, { clientLeft: { value: 2 }, clientTop: { value: 3 } })

    pointer(host, 'pointermove', 130, 90)
    frames.flush()

    expect(sheenAt(host)).toEqual(['28px', '37px'])
  })

  it('writes the lit edges only when they change', () => {
    render(<Host />)
    const host = screen.getByTestId('host')
    placeAt(host, 0, 0)
    pointer(host, 'pointermove', 10, 10)
    frames.flush()

    const setProperty = vi.spyOn(host.style, 'setProperty')
    pointer(host, 'pointermove', 30, 20)
    frames.settle()
    expect(new Set(setProperty.mock.calls.map(([name]) => name))).toEqual(
      new Set(['--prism-inner-sheen-x', '--prism-inner-sheen-y']),
    )

    pointer(host, 'pointermove', 70, 20)
    frames.flush()
    expect(litEdges(host)).toBe('right top')
  })

  it('switches the lit edges at once, with the pointer, while the sheen glides', () => {
    render(<Host />)
    const host = screen.getByTestId('host')
    placeAt(host, 0, 0, 200, 100)
    pointer(host, 'pointermove', 10, 50)
    frames.flush()

    pointer(host, 'pointermove', 190, 50)
    frames.flush()
    expect(parseFloat(sheenAt(host)[0])).toBeLessThan(190)
    expect(litEdges(host)).toBe('right top bottom')
  })

  it('stops tracking when disabled', () => {
    const { rerender } = render(<Host />)
    rerender(<Host enabled={false} />)
    const host = screen.getByTestId('host')

    pointer(host, 'pointermove', 10, 10)
    expect(frames.pending).toBe(0)
  })
})
