import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { afterFade, transitionMs } from './afterFade'

function durations(value: string) {
  return { transitionDuration: value } as CSSStyleDeclaration
}

/** Fires a transitionend on `target`, as the browser would for `propertyName`. */
function ended(target: Element, propertyName = 'opacity') {
  target.dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName }))
}

describe('transitionMs', () => {
  it.each([
    ['0.2s', 200],
    ['160ms', 160],
    ['0.1s, 280ms', 280],
    ['0s', 0],
    ['', 0],
    ['var(--prism-fade-out-duration)', 0],
  ])('reads %j as %i ms', (value, ms) => {
    expect(transitionMs(durations(value))).toBe(ms)
  })
})

describe('afterFade', () => {
  let el: HTMLElement
  const done = vi.fn<() => void>()

  beforeEach(() => {
    vi.useFakeTimers()
    done.mockClear()
    el = document.body.appendChild(document.createElement('div'))
    el.style.transitionDuration = '0.2s'
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('waits out its delay as well, should its end go unheard', () => {
    el.style.transitionDelay = '0.1s'
    afterFade(el, done)
    vi.advanceTimersByTime(260)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(done).toHaveBeenCalledOnce()
  })

  it('waits for the opacity transition on the element to end', () => {
    afterFade(el, done)
    expect(done).not.toHaveBeenCalled()

    ended(el)
    expect(done).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    expect(done).toHaveBeenCalledOnce()
  })

  it.each([
    ['another property', () => ended(el, 'scale')],
    ['an element inside it', () => ended(el.appendChild(document.createElement('span')))],
  ])('ignores transitions of %s', (_, end) => {
    afterFade(el, done)
    end()
    expect(done).not.toHaveBeenCalled()
  })

  it('goes ahead once the duration has passed, should the end go unheard', () => {
    afterFade(el, done)
    vi.advanceTimersByTime(200)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(done).toHaveBeenCalledOnce()
  })

  it('goes ahead straight away with no transition to wait for', () => {
    el.style.transitionDuration = '0s'
    afterFade(el, done)
    expect(done).toHaveBeenCalledOnce()
  })

  it('never calls back once stopped', () => {
    afterFade(el, done)()
    ended(el)
    vi.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
  })

  describe('with the Web Animations API', () => {
    /** An opacity transition running on `el`, which `end` finishes or cancels. */
    function running() {
      let resolve!: () => void
      let reject!: (reason: unknown) => void
      const promise = new Promise<void>((yes, no) => {
        resolve = yes
        reject = no
      })
      // Unhandled once afterFade has stopped listening, as the browser's own is.
      promise.catch(() => {})
      const fade = { transitionProperty: 'opacity', finished: promise }
      el.getAnimations = () => [fade as unknown as CSSTransition]
      return { finish: resolve, cancel: () => reject(new DOMException('Cancelled', 'AbortError')) }
    }

    // Lets the transition's `finished` settle.
    const settle = () => vi.advanceTimersByTimeAsync(0)

    it('waits for the transition itself, however late it starts', async () => {
      const fade = running()
      afterFade(el, done)
      // Far past its duration from now: its first frame hasn't come yet.
      await vi.advanceTimersByTimeAsync(1000)
      expect(done).not.toHaveBeenCalled()

      fade.finish()
      await settle()
      expect(done).toHaveBeenCalledOnce()
    })

    it('goes ahead once the transition is cut short', async () => {
      const fade = running()
      afterFade(el, done)
      fade.cancel()
      await settle()
      expect(done).toHaveBeenCalledOnce()
    })

    it('never calls back once stopped', async () => {
      const fade = running()
      afterFade(el, done)()
      fade.finish()
      await settle()
      expect(done).not.toHaveBeenCalled()
    })

    it('falls back to its timing where no transition runs', () => {
      el.getAnimations = () => []
      afterFade(el, done)
      vi.advanceTimersByTime(250)
      expect(done).toHaveBeenCalledOnce()
    })
  })
})
