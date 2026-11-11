import { cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../../test/dom'
import type { Edges } from '../../../shared'
import { useScrollEdges } from './useScrollEdges'

let resizes: ReturnType<typeof manualResizes>

beforeEach(() => {
  resizes = manualResizes()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A scroller of either id, fading 16px; scrolled 5px down a column 400px taller than it. */
function Scroller({
  id,
  enabled = true,
  onChange,
}: {
  id: string
  enabled?: boolean
  onChange: (fade: Edges) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollEdges(ref, onChange, enabled)
  return (
    <div
      key={id}
      data-testid={id}
      ref={(el) => {
        ref.current = el
        if (el) {
          el.style.setProperty('--prism-scroll-fade', '16px')
          el.style.overflowY = 'auto'
          Object.defineProperties(el, {
            clientHeight: { value: 200 },
            scrollHeight: { value: 600 },
            scrollTop: { value: id === 'a' ? 5 : 10, configurable: true },
          })
        }
      }}
    >
      <p>Content</p>
    </div>
  )
}

const top = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.lastCall?.[0].top

describe('useScrollEdges', () => {
  it('reports the edges on mount, and none once disabled or unmounted', () => {
    const onChange = vi.fn<(fade: Edges) => void>()
    const { rerender, unmount } = render(<Scroller id="a" onChange={onChange} />)
    expect(top(onChange)).toBe(5)

    rerender(<Scroller id="a" enabled={false} onChange={onChange} />)
    expect(top(onChange)).toBe(0)

    rerender(<Scroller id="a" onChange={onChange} />)
    expect(top(onChange)).toBe(5)
    unmount()
    expect(top(onChange)).toBe(0)
  })

  it('follows the ref to a scroller swapped in for another', () => {
    const onChange = vi.fn<(fade: Edges) => void>()
    const { rerender } = render(<Scroller id="a" onChange={onChange} />)
    const a = screen.getByTestId('a')

    rerender(<Scroller id="b" onChange={onChange} />)
    expect(top(onChange)).toBe(10)

    // The old scroller is no longer watched; the new one is.
    onChange.mockClear()
    resizes.resize(a, 100, 100)
    expect(onChange).not.toHaveBeenCalled()
    Object.defineProperty(screen.getByTestId('b'), 'scrollTop', { value: 12 })
    resizes.resize(screen.getByTestId('b'), 100, 100)
    expect(top(onChange)).toBe(12)
  })

  it('watches a child added later for resizes', async () => {
    const onChange = vi.fn<(fade: Edges) => void>()
    render(<Scroller id="a" onChange={onChange} />)
    const el = screen.getByTestId('a')
    const child = document.createElement('p')
    el.append(child)
    await Promise.resolve()

    Object.defineProperty(el, 'scrollTop', { value: 7 })
    resizes.resize(child, 100, 100)
    expect(top(onChange)).toBe(7)
  })
})
