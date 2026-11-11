import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeTextField } from '../../../test/textField'
import { Textbox } from './Textbox'

function input() {
  return screen.getByRole<HTMLInputElement>('textbox')
}

function pill() {
  return input().parentElement!
}

afterEach(cleanup)

describe('Textbox', () => {
  describeTextField(Textbox)

  it('renders an input, a separator, a clear button and a rim, in that order', () => {
    render(<Textbox aria-label="Name" />)

    expect(input().tagName).toBe('INPUT')
    expect(input().getAttribute('aria-label')).toBe('Name')
    expect([...pill().classList]).toEqual(['prism-textbox'])
    expect([...pill().children].map((child) => child.className)).toEqual([
      'prism-textbox__input',
      'prism-textbox__separator',
      'prism-textbox__icon-button prism-textbox__clear',
      'prism-rim',
    ])
    expect(pill().querySelector('.prism-textbox__separator')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('selects all its text as it takes the focus, however it gets there', () => {
    render(<Textbox defaultValue="Ada" />)

    input().focus()
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 3])
  })

  it('selects all its text from a press on the input, which the caret would undo', () => {
    render(<Textbox defaultValue="Ada" />)

    expect(fireEvent.mouseDown(input())).toBe(false)
    expect(document.activeElement).toBe(input())
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 3])
  })

  it('leaves a press on the input to the input once it has the focus', () => {
    render(<Textbox defaultValue="Ada" />)
    input().focus()

    expect(fireEvent.mouseDown(input())).toBe(true)
  })

  it('keeps its selection when a press elsewhere in the pill finds it focused', () => {
    render(<Textbox defaultValue="Ada" />)
    input().focus()
    input().setSelectionRange(1, 1)

    fireEvent.mouseDown(pill())
    expect([input().selectionStart, input().selectionEnd]).toEqual([1, 1])
  })

  it('selects again when the focus comes back from elsewhere on the page', () => {
    render(<Textbox defaultValue="Ada" />)
    input().focus()
    input().blur()
    input().setSelectionRange(1, 1)

    input().focus()
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 3])
  })

  it('keeps its selection when the focus comes back with the window', () => {
    render(<Textbox defaultValue="Ada" />)
    input().focus()
    input().setSelectionRange(1, 1)

    // As a window losing the focus does: the input stays the active element.
    fireEvent.blur(input())
    fireEvent.focus(input())
    expect([input().selectionStart, input().selectionEnd]).toEqual([1, 1])

    input().blur()
    input().focus()
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 3])
  })

  it('still calls handlers of its own for the events it listens to', () => {
    const handlers = { onFocus: vi.fn<() => void>(), onBlur: vi.fn<() => void>() }
    render(<Textbox {...handlers} />)

    input().focus()
    input().blur()
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledOnce()
  })

  it('takes only the types whose value is the text it shows', () => {
    // @ts-expect-error a number field reads as empty while it holds text that isn't a number.
    expect(<Textbox type="number" />).toBeTruthy()
    // @ts-expect-error nor is a checkbox a thing to clear.
    expect(<Textbox type="checkbox" />).toBeTruthy()
  })
})
