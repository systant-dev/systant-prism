// What every text field does, for a Textbox's and a Textarea's tests to run: they
// share it through useTextField and TextFieldPill, so each is held to all of it.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, useState, type ChangeEvent, type ComponentType, type CSSProperties } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackdropContext } from '../src/components/backdrop'
import { fakeBackdrop } from './selector'

function field() {
  return screen.getByRole<HTMLInputElement>('textbox')
}

function pill() {
  return field().parentElement!
}

function clearButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Clear' })
}

/** Stubs document.execCommand, which jsdom lacks, until the test calls the function returned. */
function stubExecCommand(run: (command: string) => boolean) {
  const execCommand = vi.fn<(command: string) => boolean>(run)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  return { execCommand, restore: () => Reflect.deleteProperty(document, 'execCommand') }
}

// `any`: a Textbox's and a Textarea's props, whose events differ
export function describeTextField(Field: ComponentType<any>) {
  describe('as a text field', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('has no glass or press of its own', () => {
      const { backdrop } = fakeBackdrop()
      render(
        <BackdropContext value={backdrop}>
          <Field />
        </BackdropContext>,
      )
      expect(pill().querySelector('.prism-press__shadow')).toBeNull()
      expect(backdrop.track).not.toHaveBeenCalled()
    })

    it('names its clear button, which never submits a form', () => {
      render(<Field />)
      expect(clearButton().getAttribute('type')).toBe('button')
    })

    it('takes another name for its clear button', () => {
      render(<Field clearLabel="Effacer" />)
      expect(screen.getByRole('button', { name: 'Effacer' })).toBeTruthy()
    })

    it('clears a value of its own, leaving the focus on the field', () => {
      const onChange = vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>()
      render(<Field defaultValue="Ada" onChange={onChange} />)

      fireEvent.click(clearButton())
      expect(field().value).toBe('')
      expect(onChange).toHaveBeenCalledOnce()
      expect(document.activeElement).toBe(field())
    })

    it('clears a value held by its parent, through onChange', () => {
      function Parent() {
        const [text, setText] = useState('Ada')
        return <Field value={text} onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)} />
      }
      render(<Parent />)

      fireEvent.click(clearButton())
      expect(field().value).toBe('')
      expect(clearButton().disabled).toBe(true)
    })

    it('shows value as given', () => {
      const onChange = vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>()
      render(<Field value="Ada" onChange={onChange} />)

      fireEvent.click(clearButton())
      expect(onChange).toHaveBeenCalledOnce()
      expect(field().value).toBe('Ada')
      expect(clearButton().disabled).toBe(false)
    })

    it('leaves React to warn of a value with no onChange, as it would on the element itself', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(<Field value="Ada" />)

      expect(error.mock.calls.flat().join(' ')).toContain('without an `onChange` handler')
      error.mockRestore()
    })

    it('clears through the browser where it can, which keeps the edit on the undo stack', () => {
      let selected: (number | null)[] = []
      const { execCommand, restore } = stubExecCommand(() => {
        selected = [field().selectionStart, field().selectionEnd]
        return true
      })
      render(<Field defaultValue="Ada" />)

      fireEvent.click(clearButton())
      restore()
      expect(execCommand).toHaveBeenCalledExactlyOnceWith('delete')
      expect(selected).toEqual([0, 3])
      // The stub deleted nothing, so the value wasn't written by hand as well.
      expect(field().value).toBe('Ada')
    })

    it('writes the value by hand if the browser refuses', () => {
      const { restore } = stubExecCommand(() => false)
      render(<Field defaultValue="Ada" />)

      fireEvent.click(clearButton())
      restore()
      expect(field().value).toBe('')
    })

    it('clears without scrolling to the caret', () => {
      render(<Field defaultValue="Ada" />)
      const focus = vi.spyOn(field(), 'focus')

      fireEvent.click(clearButton())
      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
    })

    it('disables the clear button with nothing to clear, as it is typed into and emptied', () => {
      render(<Field />)
      expect(clearButton().disabled).toBe(true)

      fireEvent.change(field(), { target: { value: 'A' } })
      expect(clearButton().disabled).toBe(false)

      fireEvent.change(field(), { target: { value: '' } })
      expect(clearButton().disabled).toBe(true)
    })

    it('counts a value of 0 as something to clear', () => {
      render(<Field value={0} onChange={() => {}} />)
      expect(clearButton().disabled).toBe(false)
    })

    it('notices text typed before it hydrated', async () => {
      const container = document.body.appendChild(document.createElement('div'))
      container.innerHTML = renderToString(<Field aria-label="Name" />)
      container.querySelector<HTMLInputElement>('[aria-label="Name"]')!.value = 'Ada'

      render(<Field aria-label="Name" />, { container, hydrate: true })
      await waitFor(() => expect(clearButton().disabled).toBe(false))
    })

    it("follows its form's reset", async () => {
      render(
        <form data-testid="form">
          <Field defaultValue="" />
        </form>,
      )
      fireEvent.change(field(), { target: { value: 'Ada' } })
      expect(clearButton().disabled).toBe(false)

      screen.getByTestId<HTMLFormElement>('form').reset()
      await waitFor(() => expect(clearButton().disabled).toBe(true))
    })

    it('follows the reset of a form it joined after it mounted', async () => {
      const forms = (
        <>
          <form id="a" />
          <form id="b" data-testid="b" />
        </>
      )
      const { rerender } = render(
        <>
          {forms}
          <Field form="a" defaultValue="" />
        </>,
      )
      fireEvent.change(field(), { target: { value: 'Ada' } })
      rerender(
        <>
          {forms}
          <Field form="b" defaultValue="" />
        </>,
      )

      screen.getByTestId<HTMLFormElement>('b').reset()
      await waitFor(() => expect(clearButton().disabled).toBe(true))
    })

    it('leaves no timer behind when it is unmounted straight after a reset', () => {
      vi.useFakeTimers()
      const { unmount } = render(
        <form data-testid="form">
          <Field />
        </form>,
      )
      screen.getByTestId<HTMLFormElement>('form').reset()

      unmount()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('keeps the clear button disabled on a field that cannot be edited', () => {
      const { rerender } = render(<Field defaultValue="Ada" disabled />)
      expect(clearButton().disabled).toBe(true)
      expect(pill().classList.contains('prism-textbox--disabled')).toBe(true)

      rerender(<Field defaultValue="Ada" readOnly />)
      expect(clearButton().disabled).toBe(true)
    })

    it('focuses the field from a press elsewhere in the pill, keeping the focus inside it', () => {
      render(<Field defaultValue="Ada" />)

      // false: the default, moving the focus, was prevented.
      expect(fireEvent.mouseDown(clearButton())).toBe(false)
      expect(document.activeElement).toBe(field())

      expect(fireEvent.mouseDown(pill())).toBe(false)
      expect(document.activeElement).toBe(field())
    })

    it('moves nothing into view as a press focuses the field', () => {
      render(<Field defaultValue="Ada" />)
      const focus = vi.spyOn(field(), 'focus')

      fireEvent.mouseDown(pill())
      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
    })

    it('gives its props to the field, but className and style to the pill', () => {
      render(<Field id="name" placeholder="Name" className="mine" style={{ marginLeft: 8 }} />)

      expect(field().id).toBe('name')
      expect(field().placeholder).toBe('Name')
      expect([...pill().classList].at(-1)).toBe('mine')
      expect(pill().style.marginLeft).toBe('8px')
      expect(field().classList.contains('mine')).toBe(false)
    })

    it('is named by a <label>', () => {
      render(
        <label>
          Name <Field />
        </label>,
      )
      expect(screen.getByRole('textbox', { name: 'Name' })).toBe(field())
    })

    it('picks the colours of its selection for what is behind it', () => {
      const colours = {
        '--prism-textbox-selection': '#6d7cff',
        '--prism-textbox-selection-fg': '#111318',
        backgroundColor: '#ffffff',
      } as CSSProperties
      render(<Field style={colours} />)

      expect(pill().style.getPropertyValue('--_prism-textbox-selection-bg')).toBe('#6d7cff')
      expect(pill().style.getPropertyValue('--_prism-textbox-selection-fg')).toBe('#111318')
    })

    it('leaves the colours of its selection to its styles when asked', () => {
      const colours = { '--prism-textbox-selection': '#6d7cff', '--prism-textbox-selection-fg': '#111318' }
      render(<Field readableSelection={false} style={colours as CSSProperties} />)
      expect(pill().style.getPropertyValue('--_prism-textbox-selection-bg')).toBe('')
    })

    it('forwards the field to a ref object', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Field ref={ref} />)
      expect(ref.current).toBe(field())
    })
  })
}
