import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBackdrop, pointerEvent } from '../../../test/selector'
import { BackdropContext } from '../backdrop'
import { Toggle } from './Toggle'

function toggle() {
  return screen.getByRole('switch')
}

function knob() {
  return toggle().querySelector('.prism-toggle__knob')!
}

/** The knob is sunk, and the toggle pressed (its shrink and its rim's turn), together. */
function knobPressed() {
  const sunk = knob().classList.contains('prism-press--pressed')
  expect(toggle().classList.contains('prism-press--pressed')).toBe(sunk)
  return sunk
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Toggle', () => {
  it('renders a switch, off, with a glass track and knob', () => {
    render(<Toggle aria-label="Wi-Fi" />)

    expect(toggle().tagName).toBe('BUTTON')
    expect(toggle().getAttribute('aria-checked')).toBe('false')
    expect(toggle().getAttribute('aria-label')).toBe('Wi-Fi')
    expect([...toggle().classList]).toEqual(['prism-toggle', 'prism-press'])
    expect([...knob().classList]).toEqual(['prism-toggle__knob', 'prism-press'])
    expect(knob().getAttribute('aria-hidden')).toBe('true')
    expect(knob().querySelector('.prism-press__tint')).not.toBeNull()
    // The toggle presses without a shadow of its own.
    expect(toggle().querySelector(':scope > .prism-press__shadow')).toBeNull()
    expect(toggle().querySelector('.prism-toggle__fill')!.getAttribute('aria-hidden')).toBe('true')
  })

  it("edges its track with a button's rim, which turns while pressed", () => {
    render(<Toggle />)
    const rim = toggle().querySelector(':scope > .prism-rim')!
    expect([...rim.classList]).toEqual(['prism-rim', 'prism-rim--turns'])
    // Under the knob, which comes after it.
    expect(rim.nextElementSibling).toBe(knob())
    // The rim's own sheet has its tokens, so the button's isn't needed.
    expect(document.querySelector('style[data-href="prism-button"]')).toBeNull()
  })

  it('keeps its own state, starting from defaultChecked', () => {
    const onChange = vi.fn<(checked: boolean) => void>()
    render(<Toggle defaultChecked onChange={onChange} />)
    expect(toggle().getAttribute('aria-checked')).toBe('true')

    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-checked')).toBe('false')
    expect(onChange).toHaveBeenLastCalledWith(false)

    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-checked')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('shows checked as given, asking for changes through onChange', () => {
    const onChange = vi.fn<(checked: boolean) => void>()
    const { rerender } = render(<Toggle checked={false} onChange={onChange} />)

    fireEvent.click(toggle())
    expect(onChange).toHaveBeenCalledWith(true)
    expect(toggle().getAttribute('aria-checked')).toBe('false')

    rerender(<Toggle checked onChange={onChange} />)
    expect(toggle().getAttribute('aria-checked')).toBe('true')
  })

  it('follows state held by its parent', () => {
    function Parent() {
      const [on, setOn] = useState(false)
      return <Toggle checked={on} onChange={setOn} />
    }
    render(<Parent />)

    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-checked')).toBe('true')
  })

  it('is switched from a <label>', () => {
    render(
      <label>
        Wi-Fi <Toggle />
      </label>,
    )
    expect(screen.getByRole('switch', { name: 'Wi-Fi' })).toBe(toggle())

    fireEvent.click(screen.getByText('Wi-Fi'))
    expect(toggle().getAttribute('aria-checked')).toBe('true')
  })

  it('runs its own onClick first, and stops the switch when it prevents the default', () => {
    const onChange = vi.fn<(checked: boolean) => void>()
    render(<Toggle onClick={(event) => event.preventDefault()} onChange={onChange} />)

    fireEvent.click(toggle())
    expect(onChange).not.toHaveBeenCalled()
    expect(toggle().getAttribute('aria-checked')).toBe('false')
  })

  it('does not switch while disabled', () => {
    const onChange = vi.fn<(checked: boolean) => void>()
    render(<Toggle disabled onChange={onChange} />)

    fireEvent.click(toggle())
    expect(onChange).not.toHaveBeenCalled()
    expect(toggle().getAttribute('aria-checked')).toBe('false')
  })

  it('sinks the knob while the pointer holds the toggle down, until it comes up anywhere', () => {
    render(<Toggle />)
    expect(knobPressed()).toBe(false)

    pointerEvent(toggle(), 'pointerdown', 'mouse', { button: 0 })
    expect(knobPressed()).toBe(true)

    pointerEvent(document.body, 'pointerup')
    expect(knobPressed()).toBe(false)
  })

  it('leaves the knob up for a button other than the main one', () => {
    render(<Toggle />)
    pointerEvent(toggle(), 'pointerdown', 'mouse', { button: 2 })
    expect(knobPressed()).toBe(false)
  })

  it('lets the knob go when a touch turns into a scroll', () => {
    render(<Toggle />)
    pointerEvent(toggle(), 'pointerdown', 'touch', { button: 0 })
    expect(knobPressed()).toBe(true)

    pointerEvent(document.body, 'pointercancel', 'touch')
    expect(knobPressed()).toBe(false)
  })

  it('sinks the knob while the space bar is down, or until it loses focus', () => {
    render(<Toggle />)

    fireEvent.keyDown(toggle(), { key: ' ' })
    expect(knobPressed()).toBe(true)
    fireEvent.keyUp(toggle(), { key: ' ' })
    expect(knobPressed()).toBe(false)

    fireEvent.keyDown(toggle(), { key: ' ' })
    fireEvent.blur(toggle())
    expect(knobPressed()).toBe(false)

    fireEvent.keyDown(toggle(), { key: 'Enter' })
    expect(knobPressed()).toBe(false)
  })

  it('never sinks the knob while disabled', () => {
    render(<Toggle disabled />)
    pointerEvent(toggle(), 'pointerdown', 'mouse', { button: 0 })
    expect(knobPressed()).toBe(false)
  })

  it('still calls handlers of its own for the events it listens to', () => {
    const handlers = {
      onPointerDown: vi.fn<() => void>(),
      onKeyDown: vi.fn<() => void>(),
      onKeyUp: vi.fn<() => void>(),
      onBlur: vi.fn<() => void>(),
    }
    render(<Toggle {...handlers} />)

    pointerEvent(toggle(), 'pointerdown', 'mouse', { button: 0 })
    fireEvent.keyDown(toggle(), { key: ' ' })
    fireEvent.keyUp(toggle(), { key: ' ' })
    fireEvent.blur(toggle())
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledOnce()
  })

  it('has a backdrop draw the track and knob, unless turned off', () => {
    const { backdrop } = fakeBackdrop()
    const { rerender } = render(
      <BackdropContext value={backdrop}>
        <Toggle />
      </BackdropContext>,
    )
    expect(backdrop.track.mock.calls.map(([el]) => el)).toEqual(expect.arrayContaining([toggle(), knob()]))

    backdrop.track.mockClear()
    rerender(
      <BackdropContext value={backdrop}>
        <Toggle refract={false} />
      </BackdropContext>,
    )
    expect(backdrop.track).not.toHaveBeenCalled()
  })

  it('never submits a form by default', () => {
    render(<Toggle />)
    expect(toggle().getAttribute('type')).toBe('button')
  })

  it('adds its own className after the library classes, and merges its style', () => {
    render(<Toggle className="mine" style={{ marginLeft: 8 }} />)
    expect([...toggle().classList].at(-1)).toBe('mine')
    expect(toggle().style.marginLeft).toBe('8px')
  })

  it('forwards its element to a ref object', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Toggle ref={ref} />)
    expect(ref.current).toBe(toggle())
  })
})
