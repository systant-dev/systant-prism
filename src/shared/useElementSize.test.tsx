import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../test/dom'
import { useElementSize } from './useElementSize'

// Commits, not renders: React may call a component once more before bailing out.
let commits = 0

function Sized({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const size = useElementSize(ref, enabled)
  useEffect(() => {
    commits++
  })
  return (
    <div ref={ref} data-testid="sized">
      {size ? `${size.width}x${size.height}` : 'unmeasured'}
    </div>
  )
}

function sized() {
  return screen.getByTestId('sized')
}

let resizes: ReturnType<typeof manualResizes>

beforeEach(() => {
  resizes = manualResizes()
  commits = 0
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useElementSize', () => {
  it('is null until the element is measured', () => {
    render(<Sized />)
    expect(sized().textContent).toBe('unmeasured')
    expect(resizes.observed).toBe(1)
  })

  it('reports the border-box size in whole pixels', () => {
    render(<Sized />)
    act(() => resizes.resize(sized(), 200.4, 99.6))
    expect(sized().textContent).toBe('200x100')
  })

  it('only commits a change in the rounded size', () => {
    render(<Sized />)
    act(() => resizes.resize(sized(), 200, 100))
    const after = commits

    act(() => resizes.resize(sized(), 200.3, 99.8))
    expect(commits).toBe(after)

    act(() => resizes.resize(sized(), 201, 100))
    expect(commits).toBe(after + 1)
    expect(sized().textContent).toBe('201x100')
  })

  it('measures nothing while disabled', () => {
    render(<Sized enabled={false} />)
    expect(resizes.observed).toBe(0)
    expect(sized().textContent).toBe('unmeasured')
  })

  it('forgets the size when disabled', () => {
    const { rerender } = render(<Sized />)
    act(() => resizes.resize(sized(), 200, 100))

    rerender(<Sized enabled={false} />)
    expect(resizes.observed).toBe(0)
    expect(sized().textContent).toBe('unmeasured')
  })

  it('stops observing on unmount', () => {
    const { unmount } = render(<Sized />)
    unmount()
    expect(resizes.observed).toBe(0)
  })
})
