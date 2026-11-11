import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState, type CSSProperties } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes, navigatedTo } from '../../../../test/dom'
import { fakeBackdrop, hover, pointerEvent } from '../../../../test/selector'
import { BackdropContext } from '../../backdrop'
import { VerticalSelector, type VerticalSelectorItem } from './VerticalSelector'

const items: VerticalSelectorItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
  { value: 'damson', label: 'Damson' },
]

function option(name: string) {
  return screen.getByRole('option', { name })
}

// The glass pill, on the selection.
function indicator() {
  return document.querySelector<HTMLElement>(
    '.prism-vertical-selector__indicator:not(.prism-vertical-selector__indicator--hover)',
  )!
}

// The dim pill that follows the pointer.
function hoverPill() {
  return document.querySelector<HTMLElement>('.prism-vertical-selector__indicator--hover')!
}

function isShown(pill = indicator()) {
  return pill.classList.contains('prism-vertical-selector__indicator--shown')
}

function indicatorY(pill = indicator()) {
  return pill.style.getPropertyValue('--prism-vertical-selector-y')
}

function isPressed(pill: HTMLElement) {
  return pill.classList.contains('prism-press--pressed')
}

// Records, for each write to the pill's style, whether it was placed rather than glided.
function watchInstant(pill: HTMLElement) {
  const instant: boolean[] = []
  const setProperty = pill.style.setProperty.bind(pill.style)
  vi.spyOn(pill.style, 'setProperty').mockImplementation((...args) => {
    instant.push(pill.hasAttribute('data-instant'))
    setProperty(...args)
  })
  return instant
}

// jsdom has no layout: give each entry a row 40px tall, in order.
function layOut() {
  screen.getAllByRole('option').forEach((el, i) => {
    Object.defineProperty(el, 'offsetTop', { configurable: true, value: i * 40 })
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 40 })
  })
}

function Controlled({ initial, onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <VerticalSelector
      aria-label="Fruit"
      items={items}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('VerticalSelector', () => {
  it('renders a vertical listbox with an option per item', () => {
    render(<VerticalSelector aria-label="Fruit" items={items} value="cherry" />)

    const list = screen.getByRole('listbox', { name: 'Fruit' })
    expect(list.getAttribute('aria-orientation')).toBe('vertical')
    expect(screen.getAllByRole('option').map((el) => el.textContent)).toEqual(['Apple', 'Banana', 'Cherry', 'Damson'])
    expect(option('Cherry').getAttribute('aria-selected')).toBe('true')
    expect(option('Apple').getAttribute('aria-selected')).toBe('false')
    expect(option('Banana').getAttribute('aria-disabled')).toBe('true')
  })

  it('gives the entries no glass of their own', () => {
    render(<VerticalSelector items={items} value="apple" />)
    for (const el of screen.getAllByRole('option')) {
      expect(el.className).toBe('prism-vertical-selector__option prism-press')
    }
    expect(screen.getByRole('listbox').className).toBe('prism-vertical-selector')
  })

  it('selects an entry on click', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<Controlled onChange={onChange} />)

    fireEvent.click(option('Cherry'))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('cherry')
    expect(option('Cherry').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(option('Cherry'))
  })

  it('ignores clicks on a disabled entry and on the selected one', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<Controlled initial="apple" onChange={onChange} />)

    fireEvent.click(option('Banana'))
    fireEvent.click(option('Apple'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('has one tab stop, on the selected entry', () => {
    render(<VerticalSelector items={items} value="cherry" />)
    expect(screen.getAllByRole('option').map((el) => el.tabIndex)).toEqual([-1, -1, 0, -1])
  })

  it('puts the tab stop on the first enabled entry while none is selected', () => {
    render(<VerticalSelector items={[{ ...items[0], disabled: true }, ...items.slice(1)]} />)
    expect(option('Cherry').tabIndex).toBe(0)
  })

  it('moves the selection with the arrow keys, skipping disabled entries', () => {
    render(<Controlled initial="apple" />)
    act(() => option('Apple').focus())

    fireEvent.keyDown(option('Apple'), { key: 'ArrowDown' })
    expect(option('Cherry').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(option('Cherry'))

    fireEvent.keyDown(option('Cherry'), { key: 'ArrowDown' })
    fireEvent.keyDown(option('Damson'), { key: 'ArrowDown' })
    expect(option('Damson').getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(option('Damson'), { key: 'ArrowUp' })
    fireEvent.keyDown(option('Cherry'), { key: 'ArrowUp' })
    expect(option('Apple').getAttribute('aria-selected')).toBe('true')
  })

  it('jumps to the ends with Home and End', () => {
    render(<Controlled initial="cherry" />)
    act(() => option('Cherry').focus())

    fireEvent.keyDown(option('Cherry'), { key: 'End' })
    expect(option('Damson').getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(option('Damson'), { key: 'Home' })
    expect(option('Apple').getAttribute('aria-selected')).toBe('true')
  })

  it('selects the focused entry with Enter or Space', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<Controlled onChange={onChange} />)
    act(() => option('Apple').focus())

    fireEvent.keyDown(option('Apple'), { key: ' ' })
    expect(onChange).toHaveBeenCalledExactlyOnceWith('apple')
  })

  it('leaves keys alone that its own onKeyDown handled', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<VerticalSelector items={items} value="apple" onChange={onChange} onKeyDown={(e) => e.preventDefault()} />)
    act(() => option('Apple').focus())

    fireEvent.keyDown(option('Apple'), { key: 'ArrowDown' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rests the glass pill on the selected entry', () => {
    const { rerender } = render(<VerticalSelector items={items} value="apple" />)
    layOut()
    rerender(<VerticalSelector items={items} value="cherry" />)

    expect(isShown()).toBe(true)
    expect(indicatorY()).toBe('80px')
    expect(indicator().style.getPropertyValue('--prism-vertical-selector-height')).toBe('40px')
    expect(indicator().getAttribute('aria-hidden')).toBe('true')
  })

  it('hides both pills while nothing is selected or hovered', () => {
    render(<VerticalSelector items={items} />)
    expect(isShown()).toBe(false)
    expect(isShown(hoverPill())).toBe(false)
  })

  it('keeps the glass pill on the selection while a dim pill follows the pointer', () => {
    render(<VerticalSelector items={items} value="apple" />)
    layOut()

    hover(option('Damson'))
    expect(indicatorY()).toBe('0px')
    expect(isShown(hoverPill())).toBe(true)
    expect(indicatorY(hoverPill())).toBe('120px')
    expect(option('Damson').classList.contains('prism-vertical-selector__option--hovered')).toBe(true)

    // It fades out where it is, rather than gliding back.
    fireEvent.pointerLeave(screen.getByRole('listbox'))
    expect(isShown(hoverPill())).toBe(false)
    expect(indicatorY(hoverPill())).toBe('120px')
    expect(indicatorY()).toBe('0px')
    expect(option('Damson').classList.contains('prism-vertical-selector__option--hovered')).toBe(false)
  })

  it('hides the hover pill under the selected entry, still gliding it there', () => {
    render(<VerticalSelector items={items} value="apple" />)
    layOut()
    hover(option('Cherry'))
    const instant = watchInstant(hoverPill())

    hover(option('Apple'))
    expect(isShown(hoverPill())).toBe(false)
    expect(indicatorY(hoverPill())).toBe('0px')
    expect(instant.length).toBeGreaterThan(0)
    expect(instant).not.toContain(true)
  })

  it('shows only the hover pill while nothing is selected, placing it rather than gliding in', () => {
    render(<VerticalSelector items={items} />)
    layOut()
    // A browser has a pill at the start of its fade as it is shown: still faded out. jsdom
    // plays no fade and has it fully shown at once, so it is held faded out here.
    hoverPill().style.setProperty('opacity', '0', 'important')
    const instant = watchInstant(hoverPill())

    hover(option('Cherry'))
    expect(isShown()).toBe(false)
    expect(isShown(hoverPill())).toBe(true)
    expect(indicatorY(hoverPill())).toBe('80px')
    expect(instant).toEqual([true, true])
    expect(hoverPill().hasAttribute('data-instant')).toBe(false)

    fireEvent.pointerLeave(screen.getByRole('listbox'))
    expect(isShown(hoverPill())).toBe(false)
  })

  it('glides the hover pill between entries rather than placing it', () => {
    render(<VerticalSelector items={items} value="apple" />)
    layOut()
    hover(option('Cherry'))
    const instant = watchInstant(hoverPill())

    hover(option('Damson'))
    expect(instant.length).toBeGreaterThan(0)
    expect(instant).not.toContain(true)
  })

  it('moves the hover pill on a spring, frame by frame, until it is on its target', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    render(<VerticalSelector items={items} value="apple" />)
    layOut()
    hover(option('Cherry'))
    const springY = () => hoverPill().style.getPropertyValue('--_prism-vertical-selector-spring-y')

    hover(option('Damson'))
    // Its target is written at once, and where it is, so it never shows on its
    // target before the first frame; then where it has got to, frame by frame.
    expect(indicatorY(hoverPill())).toBe('120px')
    expect(springY()).toBe('80px')
    const seen: number[] = []
    for (let t = 16; frames.length; t += 16) {
      frames.shift()!(t)
      if (springY()) seen.push(parseFloat(springY()))
    }
    expect(seen.length).toBeGreaterThan(3)
    expect(seen.every((y, i) => y > 80 && y < 120 && (i === 0 || y > seen[i - 1]))).toBe(true)
    // At rest it is left on its target.
    expect(springY()).toBe('')
  })

  it('holds the glass pill back as the page loads until it has settled, then shows it', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    // A page navigated to half a second ago.
    navigatedTo()
    vi.spyOn(performance, 'now').mockReturnValue(500)
    const runFrames = (from: number, count: number) => {
      for (let i = 0; i < count; i++) act(() => frames.shift()!(from + i * 16))
    }
    const phase = () =>
      ['waiting', 'appearing'].find((p) =>
        screen.getByRole('listbox').classList.contains(`prism-vertical-selector--${p}`),
      ) ?? null

    // Inside a GlassBackdrop whose image hasn't loaded yet.
    const backdrop = document.body.appendChild(document.createElement('div'))
    backdrop.className = 'prism-backdrop'
    try {
      render(<VerticalSelector items={items} value="apple" />, {
        container: backdrop.appendChild(document.createElement('div')),
      })
      expect(phase()).toBe('waiting')
      expect(isShown()).toBe(true)

      // Steady frames aren't enough while the backdrop isn't drawing.
      runFrames(0, 10)
      expect(phase()).toBe('waiting')

      // Once it is, the pill shows; with no fade running (jsdom has none), the entrance is over.
      backdrop.classList.add('prism-backdrop--drawing')
      runFrames(160, 1)
      expect(phase()).toBe(null)
      cleanup()

      // Mounting once the page has settled, it shows the pill straight away.
      render(<VerticalSelector items={items} value="apple" />)
      expect(phase()).toBe(null)
    } finally {
      backdrop.remove()
    }
  })

  it('glides the glass pill to a new selection', () => {
    render(<Controlled initial="apple" />)
    layOut()
    const instant = watchInstant(indicator())

    fireEvent.click(option('Damson'))
    expect(indicatorY()).toBe('120px')
    expect(instant).toEqual([false, false])
  })

  it('keeps the glass pill up with its entry resizing rather than gliding after it', () => {
    render(<VerticalSelector items={items} value="cherry" />)
    // The entries resize, as when a web font swaps in, and a render notices
    // before the resize is reported.
    layOut()
    const instant = watchInstant(indicator())

    hover(option('Apple'))
    expect(indicatorY()).toBe('80px')
    expect(instant).toEqual([true, true])
  })

  it('gives only the glass pill refraction', () => {
    const { backdrop } = fakeBackdrop()
    render(
      <BackdropContext value={backdrop}>
        <VerticalSelector items={items} value="apple" />
      </BackdropContext>,
    )
    hover(option('Damson'))
    expect(backdrop.track).toHaveBeenCalledExactlyOnceWith(indicator())
    expect(backdrop.track).not.toHaveBeenCalledWith(hoverPill())
  })

  it('presses the pill on the held entry, darkening it', () => {
    render(<VerticalSelector items={items} value="apple" />)
    for (const pill of [indicator(), hoverPill()]) {
      expect(pill.classList.contains('prism-press')).toBe(true)
      expect(pill.querySelector('.prism-press__shadow')).not.toBeNull()
      expect(pill.querySelector('.prism-press__tint')).not.toBeNull()
    }

    hover(option('Damson'))
    fireEvent.pointerDown(option('Damson'), { button: 0 })
    expect(isPressed(hoverPill())).toBe(true)
    expect(isPressed(indicator())).toBe(false)
    fireEvent.pointerUp(window)
    expect(isPressed(hoverPill())).toBe(false)

    hover(option('Apple'))
    fireEvent.pointerDown(option('Apple'), { button: 0 })
    expect(isPressed(indicator())).toBe(true)
    fireEvent.pointerUp(window)
    expect(isPressed(indicator())).toBe(false)
  })

  it('leaves the pills unpressed when the held entry isn’t under one, or is disabled', () => {
    render(<VerticalSelector items={items} value="apple" />)

    fireEvent.pointerDown(option('Damson'), { button: 0 })
    expect(isPressed(indicator())).toBe(false)
    expect(isPressed(hoverPill())).toBe(false)

    hover(option('Cherry'))
    fireEvent.pointerDown(option('Banana'), { button: 0 })
    expect(isPressed(indicator())).toBe(false)
    expect(isPressed(hoverPill())).toBe(false)
  })

  it('lets go of the press when the pointer leaves the list', () => {
    render(<VerticalSelector items={items} value="apple" />)
    hover(option('Apple'))
    fireEvent.pointerDown(option('Apple'), { button: 0 })

    fireEvent.pointerLeave(screen.getByRole('listbox'))
    expect(isPressed(indicator())).toBe(false)
  })

  it('selects on a mouse press, gliding the glass pill there already pressed', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<Controlled initial="apple" onChange={onChange} />)
    layOut()
    hover(option('Damson'))
    const instant = watchInstant(indicator())

    fireEvent.pointerDown(option('Damson'), { button: 0 })
    expect(onChange).toHaveBeenCalledExactlyOnceWith('damson')
    // Focus is left to the browser's own, on the mousedown just after: focusing it
    // from the pointerdown would read as a script's focus, and show the focus ring.
    expect(document.activeElement).toBe(document.body)
    expect(indicatorY()).toBe('120px')
    expect(instant).toEqual([false, false])
    expect(isPressed(indicator())).toBe(true)
    // The hover pill gives way to the glass pill rather than being pressed.
    expect(isShown(hoverPill())).toBe(false)
    expect(isPressed(hoverPill())).toBe(false)

    // Letting go settles the pill where it is; the click that follows changes nothing.
    fireEvent.pointerUp(window)
    fireEvent.click(option('Damson'))
    expect(isPressed(indicator())).toBe(false)
    expect(onChange).toHaveBeenCalledOnce()
  })

  describe('landing', () => {
    // jsdom runs no transitions: give the glass pill a glide of its own, which
    // ends when `land` is called.
    function glide(property = 'translate') {
      let land!: () => void
      const finished = new Promise<void>((resolve) => (land = resolve))
      const getAnimations = vi.fn<() => Animation[]>(() => [
        { transitionProperty: property, finished } as unknown as Animation,
      ])
      Object.defineProperty(indicator(), 'getAnimations', { configurable: true, value: getAnimations })
      return {
        getAnimations,
        land: () =>
          act(async () => {
            land()
            await finished
          }),
      }
    }

    it('keeps the glass pill pressed after a quick click, until it lands', async () => {
      render(<Controlled initial="apple" />)
      const { land } = glide()

      fireEvent.pointerDown(option('Damson'), { button: 0 })
      fireEvent.pointerUp(window)
      expect(isPressed(indicator())).toBe(true)

      await land()
      expect(isPressed(indicator())).toBe(false)
    })

    it('keeps it pressed after landing while still held', async () => {
      render(<Controlled initial="apple" />)
      const { land } = glide()

      fireEvent.pointerDown(option('Damson'), { button: 0 })
      await land()
      expect(isPressed(indicator())).toBe(true)

      fireEvent.pointerUp(window)
      expect(isPressed(indicator())).toBe(false)
    })

    it('lets go at once with no glide to wait for', () => {
      render(<Controlled initial="apple" />)
      glide('opacity')

      fireEvent.pointerDown(option('Damson'), { button: 0 })
      fireEvent.pointerUp(window)
      expect(isPressed(indicator())).toBe(false)
    })

    it('lets go when the selection doesn’t follow the press', () => {
      render(<VerticalSelector items={items} value="apple" onChange={() => {}} />)
      const { getAnimations } = glide()

      fireEvent.pointerDown(option('Damson'), { button: 0 })
      fireEvent.pointerUp(window)
      expect(isPressed(indicator())).toBe(false)
      expect(getAnimations).not.toHaveBeenCalled()
    })

    it('waits for the newest glide when a second press retargets it', async () => {
      render(<Controlled initial="apple" />)
      const first = glide()
      fireEvent.pointerDown(option('Damson'), { button: 0 })
      fireEvent.pointerUp(window)

      const second = glide()
      fireEvent.pointerDown(option('Cherry'), { button: 0 })
      fireEvent.pointerUp(window)
      await first.land()
      expect(isPressed(indicator())).toBe(true)

      await second.land()
      expect(isPressed(indicator())).toBe(false)
    })
  })

  it('calls onChange once for a click, even when the value follows it late', () => {
    const onChange = vi.fn<(value: string) => void>()
    // The value doesn't follow onChange by the click, as with a router or a transition.
    render(<VerticalSelector items={items} value="apple" onChange={onChange} />)

    fireEvent.pointerDown(option('Damson'), { button: 0 })
    fireEvent.pointerUp(option('Damson'))
    fireEvent.click(option('Damson'))
    expect(onChange.mock.calls).toEqual([['damson']])
  })

  it('still selects on a click that no press came before', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<VerticalSelector items={items} value="apple" onChange={onChange} />)
    // A press dragged off the entry, so no click of its own…
    fireEvent.pointerDown(option('Damson'), { button: 0 })
    fireEvent.pointerUp(window)

    // …then, after a key, a click from assistive tech.
    fireEvent.keyDown(option('Apple'), { key: 'Tab' })
    fireEvent.click(option('Damson'))
    expect(onChange.mock.calls).toEqual([['damson'], ['damson']])
  })

  it('selects on a touch only as it lifts, so a swipe can scroll', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<Controlled initial="apple" onChange={onChange} />)
    pointerEvent(option('Damson'), 'pointerdown', 'touch', { button: 0 })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(option('Damson'))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('damson')
  })

  it('selects nothing on a press of another button, or of a disabled entry', () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<Controlled initial="apple" onChange={onChange} />)
    fireEvent.pointerDown(option('Damson'), { button: 2 })
    fireEvent.pointerDown(option('Banana'), { button: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })

  // jsdom has no layout: make the list, and the entries that span it, `width` wide.
  function spanWidth(width: number) {
    for (const el of [screen.getByRole('listbox'), ...screen.getAllByRole('option')]) {
      Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width })
    }
  }

  function pressScale(el: HTMLElement) {
    return el.style.getPropertyValue('--prism-press-scale')
  }

  it('shrinks the entries and pill by a fixed 4px on a press, whatever the list’s width', () => {
    const resizes = manualResizes()
    render(<VerticalSelector items={items} value="apple" />)
    const list = screen.getByRole('listbox')

    spanWidth(200)
    act(() => resizes.resize(list, 200, 160))
    expect(pressScale(option('Cherry'))).toBe('0.98')
    expect(pressScale(indicator())).toBe('0.98')

    spanWidth(400)
    act(() => resizes.resize(list, 400, 160))
    expect(pressScale(option('Cherry'))).toBe('0.99')
    expect(pressScale(indicator())).toBe('0.99')
  })

  it('takes the shrink from its custom property', () => {
    const resizes = manualResizes()
    render(
      <VerticalSelector items={items} style={{ '--prism-vertical-selector-press-shrink': '10px' } as CSSProperties} />,
    )
    spanWidth(200)
    act(() => resizes.resize(screen.getByRole('listbox'), 200, 160))
    expect(pressScale(option('Cherry'))).toBe('0.95')
  })

  it('doesn’t read the shrink again on a render', () => {
    const resizes = manualResizes()
    const { rerender } = render(<VerticalSelector items={items} value="apple" />)
    const list = screen.getByRole('listbox')
    spanWidth(200)
    act(() => resizes.resize(list, 200, 160))

    const computed = vi.spyOn(window, 'getComputedStyle')
    rerender(<VerticalSelector items={items} value="cherry" />)
    expect(computed.mock.calls.some(([el]) => el === list)).toBe(false)
  })

  it('fits the press once on mount without a ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
    render(<VerticalSelector items={items} value="apple" />)
    expect(pressScale(option('Cherry'))).toBe('0.98')
    offsetWidth.mockRestore()
  })

  it('keeps the hover pill on the held entry while the pointer drags to another', () => {
    render(<VerticalSelector items={items} value="apple" />)
    layOut()
    hover(option('Cherry'))
    fireEvent.pointerDown(option('Cherry'), { button: 0 })

    hover(option('Damson'))
    expect(indicatorY(hoverPill())).toBe('80px')
    expect(isPressed(hoverPill())).toBe(true)

    fireEvent.pointerUp(window)
    hover(option('Damson'))
    expect(indicatorY(hoverPill())).toBe('120px')
  })

  it('stops listening for the let-go when it unmounts mid-press', () => {
    const remove = vi.spyOn(AbortController.prototype, 'abort')
    const { unmount } = render(<VerticalSelector items={items} value="apple" />)
    fireEvent.pointerDown(option('Cherry'), { button: 0 })
    unmount()
    expect(remove).toHaveBeenCalled()
  })

  it('takes no focus from a click on a disabled entry', () => {
    render(<VerticalSelector items={items} value="apple" />)
    expect(fireEvent.mouseDown(option('Banana'))).toBe(false)
    expect(fireEvent.mouseDown(option('Cherry'))).toBe(true)
  })

  it('moves to the neighbours of a disabled entry that has focus', () => {
    render(<Controlled initial="apple" />)
    act(() => option('Banana').focus())
    fireEvent.keyDown(option('Banana'), { key: 'ArrowDown' })
    expect(option('Cherry').getAttribute('aria-selected')).toBe('true')

    act(() => option('Banana').focus())
    fireEvent.keyDown(option('Banana'), { key: 'ArrowUp' })
    expect(option('Apple').getAttribute('aria-selected')).toBe('true')
  })

  it('keeps the arrow keys from the page at either end', () => {
    render(<Controlled initial="damson" />)
    act(() => option('Damson').focus())
    expect(fireEvent.keyDown(option('Damson'), { key: 'ArrowDown' })).toBe(false)
    expect(document.activeElement).toBe(option('Damson'))
  })

  it('doesn’t hover on touch, or on a disabled entry', () => {
    render(<VerticalSelector items={items} value="apple" />)
    layOut()

    hover(option('Damson'), 'touch')
    hover(option('Banana'))
    expect(isShown(hoverPill())).toBe(false)
  })

  it('hides the hover pill when the keyboard takes over', () => {
    render(<Controlled initial="apple" />)
    layOut()
    act(() => option('Apple').focus())

    hover(option('Damson'))
    fireEvent.keyDown(option('Apple'), { key: 'ArrowDown' })
    expect(indicatorY()).toBe('80px')
    expect(isShown(hoverPill())).toBe(false)
  })

  describe('glass', () => {
    const { backdrop, untrack } = fakeBackdrop()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('has a GlassBackdrop draw the pill’s glass while it shows', () => {
      const { rerender } = render(
        <BackdropContext value={backdrop}>
          <VerticalSelector items={items} />
        </BackdropContext>,
      )
      expect(backdrop.track).not.toHaveBeenCalled()

      rerender(
        <BackdropContext value={backdrop}>
          <VerticalSelector items={items} value="apple" />
        </BackdropContext>,
      )
      expect(backdrop.track).toHaveBeenCalledExactlyOnceWith(indicator())

      rerender(
        <BackdropContext value={backdrop}>
          <VerticalSelector items={items} />
        </BackdropContext>,
      )
      expect(untrack).toHaveBeenCalledOnce()
    })

    it('turns the glass off', () => {
      render(
        <BackdropContext value={backdrop}>
          <VerticalSelector items={items} value="apple" refract={false} />
        </BackdropContext>,
      )
      expect(backdrop.track).not.toHaveBeenCalled()
    })
  })

  it('forwards its ref and other props to the list', () => {
    const ref = createRef<HTMLDivElement>()
    render(<VerticalSelector ref={ref} items={items} className="nav" data-testid="list" />)
    expect(ref.current).toBe(screen.getByTestId('list'))
    expect(ref.current!.className).toBe('prism-vertical-selector nav')
  })
})
