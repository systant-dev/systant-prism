import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { placeAt, pointer } from '../../../test/dom'
import { fakeBackdrop } from '../../../test/selector'
import { describeTextField } from '../../../test/textField'
import { BackdropContext } from '../backdrop'
import { Textarea } from './Textarea'

function field() {
  return screen.getByRole<HTMLTextAreaElement>('textbox')
}

function pill() {
  return field().parentElement!
}

function handle() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Resize' })
}

/** Drags the handle by (x, y), from a pill of 320 by 120, and lets go, as a browser reports it. */
function drag(x: number, y: number) {
  placeAt(pill(), 0, 0, 320, 120)
  act(() => {
    pointer(handle(), 'pointerdown', 300, 100, { pointerId: 1 })
    pointer(handle(), 'pointermove', 300 + x, 100 + y, { pointerId: 1 })
    pointer(handle(), 'pointerup', 300 + x, 100 + y, { pointerId: 1 })
    pointer(handle(), 'lostpointercapture', 300 + x, 100 + y, { pointerId: 1 })
  })
}

// jsdom has no pointer capture; the element a pointer is captured to gets its events.
const setPointerCapture = vi.fn<(pointerId: number) => void>()

beforeEach(() => {
  setPointerCapture.mockClear()
  Element.prototype.setPointerCapture = setPointerCapture
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
})

describe('Textarea', () => {
  describeTextField(Textarea)

  it('renders a textarea, a separator, a clear button, a scrollbar, a handle and a rim, in that order', () => {
    render(<Textarea aria-label="Notes" />)

    expect(field().tagName).toBe('TEXTAREA')
    expect(field().getAttribute('aria-label')).toBe('Notes')
    expect([...pill().classList]).toEqual(['prism-textbox', 'prism-textarea'])
    expect([...pill().children].map((child) => child.className)).toEqual([
      'prism-textbox__input prism-scrollbar',
      'prism-textbox__separator',
      'prism-textbox__icon-button prism-textbox__clear',
      'prism-textarea__rail',
      'prism-textbox__icon-button prism-textarea__resize',
      'prism-rim',
    ])
  })

  it('has five rows, unless given others', () => {
    const { rerender } = render(<Textarea />)
    expect(field().rows).toBe(5)

    rerender(<Textarea rows={8} />)
    expect(field().rows).toBe(8)
  })

  it('leaves its text unselected as it takes the focus, however it gets there', () => {
    render(<Textarea defaultValue="Ada" />)
    field().setSelectionRange(1, 1)

    field().focus()
    expect([field().selectionStart, field().selectionEnd]).toEqual([1, 1])
  })

  it('leaves a press on the textarea to the textarea, to place the caret', () => {
    render(<Textarea defaultValue="Ada" />)
    expect(fireEvent.mouseDown(field())).toBe(true)
  })

  it('stays where it is scrolled as a press on its scrollbar focuses it, as the caret would pull it back', () => {
    render(<Textarea defaultValue="Ada" />)
    const focus = vi.spyOn(field(), 'focus')

    fireEvent.mouseDown(pill().querySelector('.prism-textarea__bar')!)
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  })

  it('takes other names for its buttons', () => {
    render(<Textarea clearLabel="Effacer" resizeLabel="Redimensionner" />)
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Redimensionner' })).toBeTruthy()
  })

  it('has a scrollbar of its own, hidden from assistive tech and Tab', () => {
    render(<Textarea />)
    const bar = pill().querySelector<HTMLElement>('.prism-textarea__bar')!

    expect(bar.closest('[aria-hidden]')?.className).toBe('prism-textarea__rail')
    expect(bar.tabIndex).toBe(-1)
    expect(bar.classList.contains('prism-scrollbar')).toBe(true)
  })

  it('gives the field its own scrollbar back where they overlay the content', () => {
    // jsdom lays nothing out, so its bar comes out 0 thick, as overlay scrollbars do.
    render(<Textarea />)
    expect(pill().hasAttribute('data-native-scrollbars')).toBe(true)
  })

  it('keeps watching its scrollbar as it is typed into, rather than starting over', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    render(<Textarea />)
    disconnect.mockClear()

    fireEvent.change(field(), { target: { value: 'A' } })
    fireEvent.change(field(), { target: { value: 'Ad' } })
    expect(disconnect).not.toHaveBeenCalled()
    disconnect.mockRestore()
  })

  it('sizes its scrollbar again as the text changes, typed or given', () => {
    const { rerender } = render(<Textarea value="Ada" onChange={() => {}} />)
    const extent = pill().querySelector<HTMLElement>('.prism-textarea__extent')!
    const bar = extent.parentElement!
    Object.defineProperty(field(), 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(bar, 'clientHeight', { value: 50, configurable: true })

    Object.defineProperty(field(), 'scrollHeight', { value: 400, configurable: true })
    rerender(<Textarea value="Lovelace" onChange={() => {}} />)
    expect(extent.style.height).toBe('200px')

    Object.defineProperty(field(), 'scrollHeight', { value: 600, configurable: true })
    rerender(<Textarea value="Ada Lovelace" onChange={() => {}} />)
    expect(extent.style.height).toBe('300px')
  })

  describe('resizing', () => {
    it('leaves the size to the styles until it is resized', () => {
      render(<Textarea />)
      expect(pill().style.width).toBe('')
      expect(pill().style.height).toBe('')
    })

    it('follows a drag of the handle, never wider than what it is in', () => {
      render(<Textarea />)

      placeAt(pill(), 0, 0, 320, 120)
      act(() => pointer(handle(), 'pointerdown', 300, 100, { pointerId: 1 }))
      expect(setPointerCapture).toHaveBeenCalledExactlyOnceWith(1)

      act(() => pointer(handle(), 'pointermove', 340, 130, { pointerId: 1 }))
      expect(pill().style.width).toBe('min(100%, 360px)')
      expect(pill().style.height).toBe('150px')

      act(() => pointer(handle(), 'pointermove', 280, 90, { pointerId: 1 }))
      expect(pill().style.width).toBe('min(100%, 300px)')
      expect(pill().style.height).toBe('110px')
    })

    it('goes no smaller than nothing, for its own limits to hold, however far up and back it is dragged', () => {
      render(<Textarea />)
      placeAt(pill(), 0, 0, 320, 120)
      act(() => pointer(handle(), 'pointerdown', 300, 100, { pointerId: 1 }))
      act(() => pointer(handle(), 'pointermove', -100, -100, { pointerId: 1 }))
      expect(pill().style.width).toBe('min(100%, 0px)')
      expect(pill().style.height).toBe('0px')
    })

    it('stops once it loses the pointer', () => {
      render(<Textarea />)
      drag(40, 30)

      act(() => pointer(handle(), 'pointermove', 500, 500, { pointerId: 1 }))
      expect(pill().style.width).toBe('min(100%, 360px)')
    })

    it('hands over to a second pointer, whatever becomes of the first', () => {
      render(<Textarea />)
      placeAt(pill(), 0, 0, 320, 120)

      act(() => {
        pointer(handle(), 'pointerdown', 300, 100, { pointerId: 1 })
        pointer(handle(), 'pointerdown', 300, 100, { pointerId: 2 })
        pointer(handle(), 'lostpointercapture', 300, 100, { pointerId: 1 })
        pointer(handle(), 'pointermove', 340, 100, { pointerId: 2 })
      })
      expect(pill().style.width).toBe('min(100%, 360px)')
    })

    it('ignores other pointers, and buttons other than the main one', () => {
      render(<Textarea />)
      placeAt(pill(), 0, 0, 320, 120)

      act(() => {
        fireEvent(handle(), new MouseEvent('pointerdown', { button: 2, bubbles: true }))
        pointer(handle(), 'pointermove', 500, 500)
      })
      expect(pill().style.width).toBe('')
      expect(setPointerCapture).not.toHaveBeenCalled()

      act(() => {
        pointer(handle(), 'pointerdown', 300, 100, { pointerId: 1 })
        pointer(handle(), 'pointermove', 500, 500, { pointerId: 2 })
      })
      expect(pill().style.width).toBe('')
    })

    it('moves the handle with the arrow keys, each from the size it really came to', () => {
      render(<Textarea />)
      placeAt(pill(), 0, 0, 320, 120)

      fireEvent.keyDown(handle(), { key: 'ArrowRight' })
      expect(pill().style.width).toBe('min(100%, 336px)')
      expect(pill().style.height).toBe('120px')

      fireEvent.keyDown(handle(), { key: 'ArrowDown' })
      expect(pill().style.height).toBe('136px')

      fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
      expect(pill().style.width).toBe('min(100%, 304px)')

      fireEvent.keyDown(handle(), { key: 'ArrowUp' })
      expect(pill().style.height).toBe('104px')
    })

    it('leaves other keys alone', () => {
      render(<Textarea />)
      expect(fireEvent.keyDown(handle(), { key: 'a' })).toBe(true)
      expect(pill().style.width).toBe('')
    })

    it("leaves the browser's own shortcuts alone, as Alt+Left is Back", () => {
      render(<Textarea />)
      placeAt(pill(), 0, 0, 320, 120)

      for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
        expect(fireEvent.keyDown(handle(), { key: 'ArrowLeft', [modifier]: true })).toBe(true)
      }
      expect(pill().style.width).toBe('')
    })

    it('narrows as the handle moves right in text that runs right to left', () => {
      render(<Textarea style={{ direction: 'rtl' }} />)
      drag(40, 0)
      expect(pill().style.width).toBe('min(100%, 280px)')

      placeAt(pill(), 0, 0, 280, 120)
      fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
      expect(pill().style.width).toBe('min(100%, 296px)')
    })

    it('wins over a width in its style', () => {
      render(<Textarea style={{ width: '100%' }} />)
      drag(40, 0)
      expect(pill().style.width).toBe('min(100%, 360px)')
    })

    it('takes no focus from a press on the handle, nor gives it to the textarea', () => {
      render(<Textarea />)
      expect(fireEvent.mouseDown(handle())).toBe(false)
      expect(document.activeElement).toBe(document.body)
    })

    it('resizes while read-only, but not while disabled', () => {
      const { rerender } = render(<Textarea readOnly />)
      expect(handle().disabled).toBe(false)

      rerender(<Textarea disabled />)
      expect(handle().disabled).toBe(true)
    })

    it('redraws the backdrop as it changes size, and has no glass of its own', () => {
      const { backdrop } = fakeBackdrop()
      render(
        <BackdropContext value={backdrop}>
          <Textarea />
        </BackdropContext>,
      )
      expect(backdrop.invalidate).not.toHaveBeenCalled()

      drag(40, 30)
      expect(backdrop.invalidate).toHaveBeenCalled()
      expect(backdrop.track).not.toHaveBeenCalled()
    })
  })
})
