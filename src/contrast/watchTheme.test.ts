import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchTheme } from './watchTheme'

// Lets a MutationObserver's records arrive.
const settle = () => new Promise((resolve) => setTimeout(resolve))

let stop = () => {}

function watched() {
  const outer = document.createElement('div')
  const el = document.createElement('span')
  outer.append(el)
  document.body.append(outer)
  const onChange = vi.fn<() => void>()
  stop = watchTheme(el, onChange)
  return { outer, el, onChange }
}

afterEach(() => {
  stop()
  document.body.replaceChildren()
})

describe('watchTheme', () => {
  it('hears a class, style or data-theme change on the element or an ancestor', async () => {
    const { outer, el, onChange } = watched()

    outer.className = 'dark'
    await settle()
    el.style.color = 'white'
    await settle()
    outer.dataset.theme = 'dark'
    await settle()
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('hears a custom property that may set a colour', async () => {
    const { outer, onChange } = watched()

    outer.style.setProperty('--prism-card-fg', '#ffffff')
    await settle()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('passes over style changes that only move an element', async () => {
    const { outer, el, onChange } = watched()

    // The light source and inner sheen following the pointer, a dragged card, a popup placed.
    outer.style.setProperty('--prism-light-x', '12px')
    outer.style.setProperty('--prism-inner-sheen-y', '4px')
    outer.style.translate = '10px 20px'
    outer.style.transition = 'none'
    el.style.left = '8px'
    el.style.top = '16px'
    await settle()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hears a colour changed along with a move', async () => {
    const { outer, onChange } = watched()

    outer.style.translate = '10px 20px'
    outer.style.backgroundColor = 'black'
    await settle()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('reads a style change once, however many are watching inside what changed', async () => {
    const outer = document.createElement('div')
    document.body.append(outer)
    const heard = Array.from({ length: 5 }, () => {
      const el = outer.appendChild(document.createElement('span'))
      const onChange = vi.fn<() => void>()
      return { onChange, unwatch: watchTheme(el, onChange) }
    })
    // The parsing of a style attribute, which is what each watcher would do for itself.
    const parsed = vi.spyOn(HTMLElement.prototype, 'setAttribute')

    outer.style.translate = '10px 20px'
    await settle()
    expect(parsed).toHaveBeenCalledTimes(2)
    for (const { onChange } of heard) expect(onChange).not.toHaveBeenCalled()

    // And each still hears a change that counts, the next one read afresh.
    outer.style.backgroundColor = 'black'
    await settle()
    expect(parsed).toHaveBeenCalledTimes(4)
    for (const { onChange, unwatch } of heard) {
      expect(onChange).toHaveBeenCalledOnce()
      unwatch()
    }
    parsed.mockRestore()
  })

  it('stops hearing once stopped', async () => {
    const { outer, onChange } = watched()

    stop()
    outer.className = 'dark'
    await settle()
    expect(onChange).not.toHaveBeenCalled()
  })
})
