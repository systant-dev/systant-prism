import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cssVars } from './cssVars'
import { once } from './once'
import { knowsTransitions, runningTransition } from './transitions'
import { useControllable } from './useControllable'
import { useFocusLeft } from './useFocusLeft'
import { useHandler } from './useHandler'

afterEach(cleanup)

describe('useHandler', () => {
  it('stays the same function from render to render, and calls the handler of the last render', () => {
    const { result, rerender } = renderHook(({ by }) => useHandler((n: number) => n * by), {
      initialProps: { by: 2 },
    })
    const first = result.current
    expect(first(3)).toBe(6)

    rerender({ by: 10 })
    expect(result.current).toBe(first)
    expect(first(3)).toBe(30)
  })
})

describe('useControllable', () => {
  it('keeps a value of its own, from where it starts, while it is given none', () => {
    const { result } = renderHook(() => useControllable<number | null>(undefined, () => 1))
    expect(result.current[0]).toBe(1)
    act(() => result.current[1](2))
    expect(result.current[0]).toBe(2)
    // Null is a value like any other: a calendar with no day picked.
    act(() => result.current[1](null))
    expect(result.current[0]).toBeNull()
  })

  it('shows the value it is given, and holds none of its own for it', () => {
    const { result, rerender } = renderHook(({ value }) => useControllable<number | null>(value, 1), {
      initialProps: { value: 5 as number | null | undefined },
    })
    expect(result.current[0]).toBe(5)
    act(() => result.current[1](6))
    expect(result.current[0]).toBe(5)

    rerender({ value: null })
    expect(result.current[0]).toBeNull()
    // Given none any more, it goes back to its own, which a change while it was given never touched.
    rerender({ value: undefined })
    expect(result.current[0]).toBe(1)
  })
})

describe('useFocusLeft', () => {
  function Panel({ open, onLeft }: { open: boolean; onLeft: () => void }) {
    const field = useRef<HTMLInputElement>(null)
    const panel = useRef<HTMLDivElement>(null)
    useFocusLeft(open, [field, panel], onLeft)
    return (
      <>
        <input ref={field} aria-label="field" />
        <div ref={panel}>
          <button>inside</button>
        </div>
        <button>outside</button>
      </>
    )
  }

  it('says so once the focus moves outside all it is given, and only while it watches', () => {
    const onLeft = vi.fn<() => void>()
    const { rerender } = render(<Panel open onLeft={onLeft} />)

    act(() => screen.getByLabelText('field').focus())
    act(() => screen.getByRole('button', { name: 'inside' }).focus())
    expect(onLeft).not.toHaveBeenCalled()

    act(() => screen.getByRole('button', { name: 'outside' }).focus())
    expect(onLeft).toHaveBeenCalledOnce()

    rerender(<Panel open={false} onLeft={onLeft} />)
    act(() => screen.getByLabelText('field').focus())
    act(() => screen.getByRole('button', { name: 'outside' }).focus())
    expect(onLeft).toHaveBeenCalledOnce()
  })
})

describe('transitions', () => {
  const OPACITY = new Set(['opacity'])
  const transition = (transitionProperty: string) => ({ transitionProperty }) as unknown as Animation

  it('finds a transition of the properties asked after, on an element that can say', () => {
    const el = document.createElement('div')
    el.getAnimations = () => [transition('translate'), transition('opacity')]
    expect(knowsTransitions(el)).toBe(true)
    expect(runningTransition(el, OPACITY)).toMatchObject({ transitionProperty: 'opacity' })
    expect(runningTransition(el, new Set(['scale']))).toBeUndefined()
  })

  it('finds none where they cannot be asked after, which it says apart from that', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'getAnimations', { value: undefined })
    expect(knowsTransitions(el)).toBe(false)
    expect(runningTransition(el, OPACITY)).toBeUndefined()
  })
})

describe('once and cssVars', () => {
  it('makes what is asked for the first time only', () => {
    const cache = new Map<string, object>()
    const make = vi.fn<() => object>(() => ({}))
    const first = once(cache, 'a', make)
    expect(once(cache, 'a', make)).toBe(first)
    expect(once(cache, 'b', make)).not.toBe(first)
    expect(make).toHaveBeenCalledTimes(2)
  })

  it('gives custom properties as a style, as they are', () => {
    const vars = { '--prism-a': 1, '--prism-b': 'red', '--prism-c': undefined }
    expect(cssVars(vars)).toBe(vars)
  })
})
