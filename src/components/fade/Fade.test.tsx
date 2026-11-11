import { act, cleanup, render, screen } from '@testing-library/react'
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Fade } from './Fade'
import type { FadeMode } from './useLayers'

function box() {
  return screen.getByTestId('fade')
}

function layers() {
  return [...box().querySelectorAll<HTMLElement>(':scope > .prism-fade__layer')]
}

/** Each layer's text and state, oldest first. */
function shown() {
  return layers().map((layer) => {
    const state = ['in', 'out', 'under'].find((s) => layer.classList.contains(`prism-fade__layer--${s}`)) ?? 'shown'
    return `${layer.textContent} ${state}`
  })
}

/** Ends the fade on a layer, as the browser would. */
function faded(layer: HTMLElement) {
  act(() => {
    layer.dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'opacity' }))
  })
}

// A page with state of its own, to show whether it stays mounted while it leaves.
function Page({ name }: { name: string }) {
  const [clicks, setClicks] = useState(0)
  return (
    <button onClick={() => setClicks(clicks + 1)}>
      {name}
      {clicks}
    </button>
  )
}

function Pages({ page, label = '', mode }: { page: string; label?: string; mode?: FadeMode }) {
  return (
    <Fade data-testid="fade" contentKey={page} mode={mode}>
      <Page key={page} name={page + label} />
    </Fade>
  )
}

// The layers' transition durations are set outright, for a test to know how long a fade is.
function withDuration(duration: string) {
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = `.prism-fade__layer { transition-duration: ${duration}; }`
}

beforeEach(() => {
  vi.useFakeTimers()
  withDuration('0.2s')
})

afterEach(() => {
  cleanup()
  document.head.querySelectorAll('style').forEach((style) => style.remove())
  vi.useRealTimers()
})

describe('Fade', () => {
  it('is a div holding its content in one layer, shown without a fade', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Fade ref={ref} contentKey="a" className="mine" data-testid="fade">
        Hello
      </Fade>,
    )
    expect(box()).toBe(ref.current)
    expect(box().className).toBe('prism-fade mine')
    expect(shown()).toEqual(['Hello shown'])
  })

  it('updates its content in place while the key stays the same', () => {
    const { rerender } = render(<Pages page="a" />)
    rerender(<Pages page="a" label="!" />)
    expect(shown()).toEqual(['a!0 shown'])
  })
})

describe('Fade, layer mode', () => {
  it('fades the old content out as the new content comes in over it', () => {
    const { rerender } = render(<Pages page="a" />)
    act(() => screen.getByRole('button').click())
    rerender(<Pages page="b" />)

    // The old page, still mounted with its state, under the new.
    expect(shown()).toEqual(['a1 out', 'b0 in'])
    expect(layers()[0].hasAttribute('inert')).toBe(true)
    expect(layers()[1].hasAttribute('inert')).toBe(false)

    faded(layers()[0])
    expect(shown()).toEqual(['b0 in'])
    faded(layers()[0])
    expect(shown()).toEqual(['b0 shown'])
  })

  it('settles every layer once its fade should have ended, should the end go unheard', () => {
    const { rerender } = render(<Pages page="a" />)
    rerender(<Pages page="b" />)
    act(() => vi.advanceTimersByTime(250))
    expect(shown()).toEqual(['b0 shown'])
  })

  it('swaps straight away with no fade to wait for', () => {
    withDuration('0s')
    const { rerender } = render(<Pages page="a" />)
    rerender(<Pages page="b" />)
    expect(shown()).toEqual(['b0 shown'])
  })

  it('fades out everything but the latest, if the key changes again', () => {
    const { rerender } = render(<Pages page="a" />)
    rerender(<Pages page="b" />)
    rerender(<Pages page="c" />)
    expect(shown()).toEqual(['a0 out', 'b0 out', 'c0 in'])

    faded(layers()[0])
    faded(layers()[0])
    expect(shown()).toEqual(['c0 in'])
  })

  it('brings the old key back as new content, if the key changes back', () => {
    const { rerender } = render(<Pages page="a" />)
    act(() => screen.getByRole('button').click())
    rerender(<Pages page="b" />)
    rerender(<Pages page="a" />)
    expect(shown()).toEqual(['a1 out', 'b0 out', 'a0 in'])
  })
})

describe('Fade, background mode', () => {
  it('fades the new content in over the old, which stays until covered', () => {
    const { rerender } = render(<Pages page="a" mode="background" />)
    rerender(<Pages page="b" mode="background" />)

    expect(box().classList).toContain('prism-fade--background')
    expect(shown()).toEqual(['a0 under', 'b0 in'])
    expect(layers()[0].hasAttribute('inert')).toBe(true)

    faded(layers()[1])
    expect(shown()).toEqual(['b0 shown'])
  })

  it('covers everything under the latest once it has faded in', () => {
    const { rerender } = render(<Pages page="a" mode="background" />)
    rerender(<Pages page="b" mode="background" />)
    rerender(<Pages page="a" mode="background" />)
    expect(shown()).toEqual(['a0 under', 'b0 under', 'a0 in'])

    faded(layers()[2])
    expect(shown()).toEqual(['a0 shown'])
  })
})
