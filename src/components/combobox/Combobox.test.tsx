import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import { Combobox, type ComboboxProps } from './Combobox'

const items = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
  { value: 'damson', label: 'Damson' },
  { value: 'pineapple', label: 'Pineapple' },
]

function input() {
  return screen.getByRole<HTMLInputElement>('combobox')
}

function pill() {
  return input().parentElement!
}

function chevron() {
  return pill().querySelector<HTMLButtonElement>('.prism-combobox__chevron')!
}

function clearButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Clear' })
}

function listbox() {
  return screen.getByRole('listbox', { hidden: true })
}

function options() {
  return within(listbox()).queryAllByRole('option', { hidden: true })
}

function option(name: string) {
  return options().find((el) => el.textContent === name)!
}

function shown() {
  return options().map((el) => el.textContent)
}

function ticked() {
  return options()
    .filter((el) => el.querySelector('.prism-combobox__tick'))
    .map((el) => el.textContent)
}

function type(text: string) {
  fireEvent.change(input(), { target: { value: text } })
}

function press(key: string) {
  return fireEvent.keyDown(input(), { key })
}

function isOpen() {
  return input().getAttribute('aria-expanded') === 'true'
}

function activeOption() {
  const id = input().getAttribute('aria-activedescendant')
  return id ? document.getElementById(id) : null
}

function Host(props: Partial<ComboboxProps>) {
  return <Combobox aria-label="Fruit" items={items} {...props} />
}

beforeEach(() => {
  manualResizes()
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Combobox', () => {
  describe('as a combobox', () => {
    it('ties the input to its list', () => {
      render(<Host />)

      expect(input().getAttribute('aria-autocomplete')).toBe('list')
      expect(input().getAttribute('aria-controls')).toBe(listbox().id)
      expect(input().getAttribute('autocomplete')).toBe('off')
      expect(listbox().getAttribute('aria-multiselectable')).toBe('true')
      expect(listbox().getAttribute('aria-label')).toBe('Fruit')
    })

    it('opens from a press on the field', () => {
      render(<Host />)
      expect(isOpen()).toBe(false)

      fireEvent.click(input())
      expect(isOpen()).toBe(true)
    })

    it('opens and closes from the chevron, which only the pointer can reach', () => {
      render(<Host />)
      expect(chevron().tabIndex).toBe(-1)
      expect(chevron().getAttribute('aria-hidden')).toBe('true')

      fireEvent.click(chevron())
      expect(isOpen()).toBe(true)

      fireEvent.click(chevron())
      expect(isOpen()).toBe(false)
    })

    it('stays closed as the focus arrives', () => {
      render(<Host />)

      act(() => input().focus())
      expect(isOpen()).toBe(false)
    })

    it('closes on Escape and on a press elsewhere, but not on one on the pill', () => {
      render(<Host />)
      fireEvent.click(input())

      fireEvent.pointerDown(pill())
      expect(isOpen()).toBe(true)

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(isOpen()).toBe(false)

      fireEvent.click(input())
      fireEvent.pointerDown(document.body)
      expect(isOpen()).toBe(false)
    })

    it('closes as the focus leaves, but not with the window', () => {
      render(<Host />)
      act(() => input().focus())
      fireEvent.click(input())

      // As a window losing the focus does: the input stays the active element.
      fireEvent.blur(input())
      expect(isOpen()).toBe(true)

      act(() => input().blur())
      expect(isOpen()).toBe(false)
    })

    it('keeps the focus on the input through a press on the list', () => {
      render(<Host />)

      // false: the default, moving the focus, was prevented.
      expect(fireEvent.mouseDown(option('Apple'))).toBe(false)
    })

    it('takes the list out of the tab order', () => {
      render(<Host />)
      expect(listbox().closest<HTMLElement>('.prism-scroll-area__viewport')!.tabIndex).toBe(-1)
    })
  })

  describe('auto-complete', () => {
    it('opens as it is typed in, and narrows the list', () => {
      render(<Host />)
      act(() => input().focus())

      type('an')
      expect(isOpen()).toBe(true)
      expect(shown()).toEqual(['Banana'])
    })

    it('makes the best match active, so Enter takes it', () => {
      render(<Host />)
      act(() => input().focus())

      type('app')
      expect(shown()).toEqual(['Apple', 'Pineapple'])
      expect(activeOption()).toBe(option('Apple'))

      press('Enter')
      expect(ticked()).toEqual(['Apple'])
    })

    it('passes over disabled entries for the best match', () => {
      render(<Host />)
      act(() => input().focus())

      type('c')
      expect(option('Cherry')).toBeTruthy()
      expect(activeOption()).toBeNull()
    })

    it('has nothing active with nothing typed', () => {
      render(<Host />)
      act(() => input().focus())

      type('a')
      type('')
      expect(shown()).toHaveLength(items.length)
      expect(activeOption()).toBeNull()
    })

    it('says so when nothing matches', () => {
      render(<Host />)
      act(() => input().focus())
      expect(screen.getByRole('status', { hidden: true }).textContent).toBe('')

      type('kiwi')
      expect(shown()).toEqual([])
      expect(screen.getByRole('status', { hidden: true }).textContent).toBe('No matches')
    })

    it('takes another line for no matches', () => {
      render(<Host noMatchesLabel="Rien" />)
      act(() => input().focus())

      type('kiwi')
      expect(screen.getByRole('status', { hidden: true }).textContent).toBe('Rien')
    })

    it('drops what was typed once the focus has gone', () => {
      render(<Host />)
      act(() => input().focus())
      type('an')

      act(() => input().blur())
      expect(input().value).toBe('')

      act(() => input().focus())
      expect(input().value).toBe('')
      expect(shown()).toHaveLength(items.length)
    })

    it('keeps the list as it was while it fades out', () => {
      render(<Host />)
      act(() => input().focus())
      type('an')

      act(() => input().blur())
      expect(shown()).toEqual(['Banana'])
    })

    it('keeps what was typed through a trip out of the window', () => {
      render(<Host />)
      act(() => input().focus())
      type('an')

      fireEvent.blur(input())
      fireEvent.focus(input())
      expect(input().value).toBe('an')
    })

    it('forgets what was typed on an Escape with the list already closed', () => {
      render(<Host />)
      act(() => input().focus())
      type('an')

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(input().value).toBe('an')

      press('Escape')
      expect(input().value).toBe('')
    })
  })

  describe('picking several', () => {
    it('ticks any number of entries, each at the end of its line', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host onChange={onChange} />)

      fireEvent.click(option('Banana'))
      fireEvent.click(option('Apple'))
      expect(ticked()).toEqual(['Apple', 'Banana'])
      expect(onChange).toHaveBeenLastCalledWith(['banana', 'apple'])
      expect(option('Apple').getAttribute('aria-selected')).toBe('true')
      expect(option('Damson').getAttribute('aria-selected')).toBe('false')
      expect(option('Apple').lastElementChild!.getAttribute('class')).toBe('prism-combobox__tick')
    })

    it('unticks an entry pressed again', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host defaultValue={['apple', 'banana']} onChange={onChange} />)

      fireEvent.click(option('Apple'))
      expect(ticked()).toEqual(['Banana'])
      expect(onChange).toHaveBeenLastCalledWith(['banana'])
    })

    it('stays open as an entry is ticked', () => {
      render(<Host />)
      fireEvent.click(input())

      fireEvent.click(option('Apple'))
      expect(isOpen()).toBe(true)
    })

    it('keeps the list narrowed and selects what was typed, to type over', () => {
      render(<Host />)
      act(() => input().focus())
      type('app')

      press('Enter')
      expect(shown()).toEqual(['Apple', 'Pineapple'])
      expect([input().selectionStart, input().selectionEnd]).toEqual([0, 3])
    })

    it('leaves a disabled entry as it is', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host defaultValue={['cherry']} onChange={onChange} />)

      fireEvent.click(option('Cherry'))
      expect(option('Cherry').getAttribute('aria-disabled')).toBe('true')
      expect(ticked()).toEqual(['Cherry'])
      expect(onChange).not.toHaveBeenCalled()
    })

    it('shows value as given', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host value={['apple']} onChange={onChange} />)

      fireEvent.click(option('Banana'))
      expect(onChange).toHaveBeenCalledExactlyOnceWith(['apple', 'banana'])
      expect(ticked()).toEqual(['Apple'])
    })

    it('follows a parent that holds the value', () => {
      function Parent() {
        const [value, setValue] = useState<string[]>([])
        return <Host value={value} onChange={setValue} />
      }
      render(<Parent />)

      fireEvent.click(option('Apple'))
      expect(ticked()).toEqual(['Apple'])
    })

    it('keeps values it has no entry for', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host defaultValue={['kiwi']} onChange={onChange} />)

      fireEvent.click(option('Apple'))
      expect(onChange).toHaveBeenCalledExactlyOnceWith(['kiwi', 'apple'])
    })
  })

  describe('what it shows', () => {
    it('shows the selected labels away from the field, in the order of the items', () => {
      render(<Host defaultValue={['banana', 'apple']} />)
      expect(input().value).toBe('Apple, Banana')
    })

    it('moves them to the placeholder with the focus, to type in', () => {
      render(<Host defaultValue={['apple']} placeholder="Pick fruit" />)

      act(() => input().focus())
      expect(input().value).toBe('')
      expect(input().placeholder).toBe('Apple')

      act(() => input().blur())
      expect(input().value).toBe('Apple')
    })

    it('keeps its placeholder with nothing selected', () => {
      render(<Host placeholder="Pick fruit" />)

      expect(input().placeholder).toBe('Pick fruit')
      act(() => input().focus())
      expect(input().placeholder).toBe('Pick fruit')
    })
  })

  describe('the keyboard', () => {
    it('opens on the first entry from the down arrow, and the last from the up arrow', () => {
      render(<Host />)

      press('ArrowDown')
      expect(isOpen()).toBe(true)
      expect(activeOption()).toBe(option('Apple'))

      fireEvent.keyDown(document, { key: 'Escape' })
      press('ArrowUp')
      expect(activeOption()).toBe(option('Pineapple'))
    })

    it('walks the entries, past disabled ones, stopping at the ends', () => {
      render(<Host />)

      press('ArrowDown')
      press('ArrowDown')
      press('ArrowDown')
      expect(activeOption()).toBe(option('Damson'))
      press('ArrowDown')
      press('ArrowDown')
      expect(activeOption()).toBe(option('Pineapple'))
    })

    it('walks only what still matches', () => {
      render(<Host />)
      act(() => input().focus())
      type('app')

      press('ArrowDown')
      expect(activeOption()).toBe(option('Pineapple'))
      press('ArrowDown')
      expect(activeOption()).toBe(option('Pineapple'))
    })

    it('keeps the arrows from moving the caret', () => {
      render(<Host />)
      expect(press('ArrowDown')).toBe(false)
    })

    it('leaves Home, End and Space to the text', () => {
      render(<Host />)
      press('ArrowDown')

      for (const key of ['Home', 'End', ' ']) expect(press(key)).toBe(true)
      expect(ticked()).toEqual([])
    })

    it('ticks and unticks the active entry with Enter', () => {
      render(<Host />)
      press('ArrowDown')

      press('Enter')
      expect(ticked()).toEqual(['Apple'])
      press('Enter')
      expect(ticked()).toEqual([])
    })

    it('leaves Enter to a form while closed, but keeps it from one while open', () => {
      render(<Host />)
      expect(press('Enter')).toBe(true)

      fireEvent.click(input())
      expect(press('Enter')).toBe(false)
    })

    it('leaves the keys to an input method mid-composition', () => {
      render(<Host />)
      fireEvent.keyDown(input(), { key: 'ArrowDown', isComposing: true })
      expect(isOpen()).toBe(false)
    })

    it('leaves a key whose default a handler of its own prevented', () => {
      render(<Host onKeyDown={(event) => event.preventDefault()} />)
      press('ArrowDown')
      expect(isOpen()).toBe(false)
    })

    it('makes the entry under the pointer active', () => {
      render(<Host />)
      fireEvent.click(input())

      fireEvent.pointerMove(option('Banana'))
      expect(activeOption()).toBe(option('Banana'))
      expect(option('Banana').classList.contains('prism-combobox__option--active')).toBe(true)

      fireEvent.pointerMove(option('Cherry'))
      expect(activeOption()).toBe(option('Banana'))
    })

    it('scrolls the active entry into view as a key moves it, but not as the pointer does', () => {
      const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>()
      HTMLElement.prototype.scrollIntoView = scrollIntoView
      render(<Host />)

      press('ArrowDown')
      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' })

      fireEvent.pointerMove(option('Damson'))
      expect(scrollIntoView).toHaveBeenCalledOnce()
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    })

    it('forgets the active entry as it closes', () => {
      render(<Host />)
      press('ArrowDown')

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(activeOption()).toBeNull()
    })
  })

  describe('the clear button', () => {
    it('has nothing to clear with nothing typed or selected', () => {
      render(<Host />)
      expect(clearButton().disabled).toBe(true)
    })

    it('clears what was typed first, leaving the selection', () => {
      render(<Host defaultValue={['apple']} />)
      act(() => input().focus())
      type('an')

      fireEvent.click(clearButton())
      expect(input().value).toBe('')
      expect(ticked()).toEqual(['Apple'])
    })

    it('then clears the selection, and hands the focus back', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host defaultValue={['apple']} onChange={onChange} />)

      fireEvent.click(clearButton())
      expect(onChange).toHaveBeenCalledExactlyOnceWith([])
      expect(ticked()).toEqual([])
      expect(clearButton().disabled).toBe(true)
      expect(document.activeElement).toBe(input())
    })

    it('takes another name', () => {
      render(<Host clearLabel="Effacer" />)
      expect(screen.getByRole('button', { name: 'Effacer' })).toBeTruthy()
    })
  })

  describe('that cannot be edited', () => {
    it.each(['disabled', 'readOnly'])("won't open, %s", (prop) => {
      render(<Host {...{ [prop]: true }} defaultValue={['apple']} />)

      fireEvent.click(input())
      press('ArrowDown')
      fireEvent.click(chevron())
      expect(isOpen()).toBe(false)
      expect(chevron().disabled).toBe(true)
      expect(clearButton().disabled).toBe(true)
    })

    it('keeps showing its selection with the focus, read-only', () => {
      render(<Host readOnly defaultValue={['apple']} />)

      act(() => input().focus())
      expect(input().value).toBe('Apple')
    })
  })

  describe('as an input', () => {
    it('gives its props to the input, but className and style to the pill', () => {
      render(<Host id="fruit" className="mine" style={{ marginLeft: 8 }} />)

      expect(input().id).toBe('fruit')
      expect([...pill().classList]).toEqual(['prism-textbox', 'prism-combobox', 'mine'])
      expect(pill().style.marginLeft).toBe('8px')
    })

    it('forwards the input to a ref', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Host ref={ref} />)
      expect(ref.current).toBe(input())
    })

    it('still calls handlers of its own for the events it listens to', () => {
      const handlers = {
        onClick: vi.fn<() => void>(),
        onFocus: vi.fn<() => void>(),
        onBlur: vi.fn<() => void>(),
        onKeyDown: vi.fn<() => void>(),
      }
      render(<Host {...handlers} />)

      act(() => input().focus())
      fireEvent.click(input())
      press('a')
      act(() => input().blur())
      for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledOnce()
    })

    it('is named by a <label>', () => {
      render(
        <label>
          Fruit <Combobox items={items} />
        </label>,
      )
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toBe(input())
    })
  })

  describe('the popup', () => {
    it('is as wide as the pill', () => {
      const resizes = manualResizes()
      render(<Host />)

      act(() => resizes.resize(pill(), 300, 40))
      expect(listbox().closest<HTMLElement>('.prism-popup')!.style.width).toBe('300px')
    })
  })
  describe('picking one', () => {
    it('is no multiselect list', () => {
      render(<Host multiple={false} />)
      expect(listbox().getAttribute('aria-multiselectable')).toBe('false')
    })

    it('takes the place of the one before as an entry is picked, closing the list and showing its label', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host multiple={false} defaultValue={['apple']} onChange={onChange} />)
      act(() => input().focus())
      expect(input().value).toBe('Apple')

      fireEvent.click(input())
      fireEvent.click(option('Banana'))
      expect(onChange).toHaveBeenLastCalledWith(['banana'])
      expect(isOpen()).toBe(false)
      expect(input().value).toBe('Banana')
      expect(ticked()).toEqual(['Banana'])
    })

    it('keeps the one picked as it is picked again, calling onChange for nothing', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host multiple={false} defaultValue={['apple']} onChange={onChange} />)
      fireEvent.click(input())
      fireEvent.click(option('Apple'))
      expect(onChange).not.toHaveBeenCalled()
      expect(ticked()).toEqual(['Apple'])
    })

    it('lists every entry until something is typed over the label, opening on the one picked', () => {
      render(<Host multiple={false} defaultValue={['damson']} />)
      act(() => input().focus())

      press('ArrowDown')
      expect(shown()).toEqual(['Apple', 'Banana', 'Cherry', 'Damson', 'Pineapple'])
      expect(activeOption()?.textContent).toBe('Damson')

      type('pine')
      expect(shown()).toEqual(['Pineapple'])
      press('Enter')
      expect(input().value).toBe('Pineapple')
      expect(ticked()).toEqual(['Pineapple'])
    })

    it('selects the label as the focus comes and after a pick, so typing replaces it', () => {
      render(<Host multiple={false} defaultValue={['apple']} />)
      act(() => input().focus())
      expect([input().selectionStart, input().selectionEnd]).toEqual([0, 5])

      fireEvent.click(input())
      fireEvent.click(option('Banana'))
      expect([input().selectionStart, input().selectionEnd]).toEqual([0, 6])
    })

    it('puts the label back over what was typed on Escape with the list closed', () => {
      render(<Host multiple={false} defaultValue={['apple']} />)
      act(() => input().focus())
      type('ban')
      press('Escape')
      expect(isOpen()).toBe(false)
      expect(input().value).toBe('ban')

      press('Escape')
      expect(input().value).toBe('Apple')
    })

    it('clears what was typed, and then the one picked', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host multiple={false} defaultValue={['apple']} onChange={onChange} />)
      act(() => input().focus())
      type('ban')

      fireEvent.click(clearButton())
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.click(clearButton())
      expect(onChange).toHaveBeenLastCalledWith([])
    })
  })
  describe('its own matching', () => {
    const numbers = (query: string) =>
      Array.from({ length: 3 }, (_, i) => ({ value: `${query}${i}`, label: `${query}${i}` }))

    it("lists the entries match gives for what is typed, which needn't be in items, the first active", () => {
      const match = vi.fn<(query: string) => { value: string; label: string }[]>((query) =>
        query ? numbers(query) : items,
      )
      render(<Host match={match} />)
      fireEvent.click(input())
      expect(shown()).toEqual(['Apple', 'Banana', 'Cherry', 'Damson', 'Pineapple'])

      type('7')
      expect(match).toHaveBeenLastCalledWith('7')
      expect(shown()).toEqual(['70', '71', '72'])
      expect(activeOption()?.textContent).toBe('70')
    })

    it('picks one of those entries', () => {
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host multiple={false} match={(query) => (query ? numbers(query) : items)} onChange={onChange} />)
      act(() => input().focus())
      type('4')
      press('ArrowDown')
      press('Enter')
      expect(onChange).toHaveBeenLastCalledWith(['41'])
    })
  })

  describe('text no entry is picked for', () => {
    it('goes to onCommitText on Enter with no entry active, and the label picked shows again', () => {
      const onCommitText = vi.fn<(text: string) => void>()
      render(<Host multiple={false} defaultValue={['apple']} onCommitText={onCommitText} />)
      act(() => input().focus())
      type(' kiwi ')
      expect(activeOption()).toBeNull()

      press('Enter')
      expect(onCommitText).toHaveBeenCalledWith('kiwi')
      expect(isOpen()).toBe(false)
      expect(input().value).toBe('Apple')
    })

    it('goes to onCommitText as the focus leaves, but not for nothing typed', () => {
      const onCommitText = vi.fn<(text: string) => void>()
      render(<Host multiple={false} onCommitText={onCommitText} />)
      act(() => input().focus())
      act(() => input().blur())
      expect(onCommitText).not.toHaveBeenCalled()

      act(() => input().focus())
      type('kiwi')
      act(() => input().blur())
      expect(onCommitText).toHaveBeenCalledWith('kiwi')
    })

    it('picks the active entry on Enter rather than handing the text over', () => {
      const onCommitText = vi.fn<(text: string) => void>()
      const onChange = vi.fn<(value: string[]) => void>()
      render(<Host multiple={false} onCommitText={onCommitText} onChange={onChange} />)
      act(() => input().focus())
      type('dam')
      press('Enter')
      expect(onChange).toHaveBeenLastCalledWith(['damson'])
      expect(onCommitText).not.toHaveBeenCalled()
    })

    it('stays in the field without onCommitText', () => {
      render(<Host multiple={false} defaultValue={['apple']} />)
      act(() => input().focus())
      type('kiwi')
      press('Enter')
      expect(input().value).toBe('kiwi')
    })
  })
})
