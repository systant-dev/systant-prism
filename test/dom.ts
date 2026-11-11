// Helpers for tests that drive pointer-following code in jsdom, which has no
// layout and no real animation frames.
import { onTestFinished, vi } from 'vitest'

/**
 * A div on the page until the test ends. Only an element on the page has computed
 * styles, in jsdom as in a browser.
 */
export function onPage() {
  const el = document.createElement('div')
  document.body.append(el)
  onTestFinished(() => el.remove())
  return el
}

/**
 * Has the page say it was navigated to, as a browser's does once it has loaded. A test's
 * context may have no navigation timing at all to spy on, so it is given some first.
 */
export function navigatedTo() {
  performance.getEntriesByType ??= () => []
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{} as PerformanceEntry])
}

/** Gives jsdom what it lacks of a dialog, as spies. They stay until replaced, so call it before each test. */
export function stubDialogs() {
  HTMLDialogElement.prototype.showModal = vi.fn<HTMLDialogElement['showModal']>(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn<HTMLDialogElement['close']>(function (this: HTMLDialogElement) {
    this.open = false
  })
}

/**
 * Replaces requestAnimationFrame with a queue that only runs when flushed, so a
 * test controls exactly when a frame happens. Each flush is a frame 1/60s after
 * the last, by the timestamp the callbacks get. Undo with vi.unstubAllGlobals().
 */
export function manualFrames() {
  let nextId = 1
  let now = 0
  const queued = new Map<number, FrameRequestCallback>()

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.set(nextId, callback)
    return nextId++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id))

  return {
    get pending() {
      return queued.size
    },
    flush() {
      const callbacks = [...queued.values()]
      queued.clear()
      now += 1000 / 60
      for (const callback of callbacks) callback(now)
    },
    /** Flushes frame after frame until none is requested; returns how many ran. */
    settle(limit = 600) {
      let count = 0
      while (queued.size && count < limit) {
        this.flush()
        count++
      }
      return count
    },
  }
}

/**
 * Replaces ResizeObserver, which jsdom lacks, with one that only reports when a
 * test resizes an element. Undo with vi.unstubAllGlobals().
 */
export function manualResizes() {
  const observers = new Set<{ callback: ResizeObserverCallback; targets: Set<Element> }>()

  vi.stubGlobal(
    'ResizeObserver',
    class {
      #observer: { callback: ResizeObserverCallback; targets: Set<Element> }
      constructor(callback: ResizeObserverCallback) {
        this.#observer = { callback, targets: new Set() }
        observers.add(this.#observer)
      }
      observe(el: Element) {
        this.#observer.targets.add(el)
      }
      unobserve(el: Element) {
        this.#observer.targets.delete(el)
      }
      disconnect() {
        observers.delete(this.#observer)
      }
    },
  )

  return {
    /** How many elements are being watched. */
    get observed() {
      let count = 0
      for (const { targets } of observers) count += targets.size
      return count
    },
    resize(el: Element, inlineSize: number, blockSize: number) {
      const entry = { target: el, borderBoxSize: [{ inlineSize, blockSize }] } as unknown as ResizeObserverEntry
      for (const { callback, targets } of observers) {
        if (targets.has(el)) callback([entry], {} as ResizeObserver)
      }
    },
  }
}

/**
 * Replaces IntersectionObserver, which jsdom lacks, with one that only reports
 * when a test says how much of an element is showing. Undo with vi.unstubAllGlobals().
 */
export function manualIntersections() {
  interface Observer {
    callback: IntersectionObserverCallback
    options: IntersectionObserverInit
    targets: Set<Element>
    self: IntersectionObserver
  }
  const observers = new Set<Observer>()
  let created = 0

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      #observer: Observer
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
        this.#observer = { callback, options, targets: new Set(), self: this as unknown as IntersectionObserver }
        observers.add(this.#observer)
        created++
      }
      observe(el: Element) {
        this.#observer.targets.add(el)
      }
      unobserve(el: Element) {
        this.#observer.targets.delete(el)
      }
      disconnect() {
        observers.delete(this.#observer)
      }
      takeRecords() {
        return []
      }
    },
  )

  return {
    /** How many elements are being watched. */
    get observed() {
      let count = 0
      for (const { targets } of observers) count += targets.size
      return count
    },
    /** How many observers have been made. */
    get created() {
      return created
    },
    /** The options of every observer watching `el`. */
    optionsFor(el: Element) {
      return [...observers].filter(({ targets }) => targets.has(el)).map(({ options }) => options)
    },
    /** Reports that `ratio` of the element shows, to every observer watching it. */
    intersect(el: Element, ratio: number) {
      const entry = { target: el, intersectionRatio: ratio, isIntersecting: ratio > 0 } as IntersectionObserverEntry
      // A snapshot: a callback may disconnect its observer and make another.
      for (const { callback, targets, self } of [...observers]) {
        if (targets.has(el)) callback([entry], self)
      }
    },
  }
}

/** Gives the element a viewport box, as getBoundingClientRect reports it. */
export function placeAt(el: Element, left: number, top: number, width = 100, height = 100) {
  const rect = { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height }
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ ...rect, toJSON: () => rect })
}

/**
 * jsdom has no PointerEvent; the code under test reads clientX/Y, and some of
 * it which pointer it is (pointerId, pointerType) and its buttons, given here.
 */
export function pointer(
  target: EventTarget,
  type: string,
  clientX = 0,
  clientY = 0,
  { pointerId, pointerType, buttons }: { pointerId?: number; pointerType?: string; buttons?: number } = {},
) {
  const event = new MouseEvent(type, { clientX, clientY, buttons, bubbles: true })
  if (pointerId !== undefined) Object.defineProperty(event, 'pointerId', { value: pointerId })
  if (pointerType !== undefined) Object.defineProperty(event, 'pointerType', { value: pointerType })
  target.dispatchEvent(event)
}
