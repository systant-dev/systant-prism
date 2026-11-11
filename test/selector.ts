// Helpers for the selectors' tests (src/components/selector/core and the
// selectors on it).
import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { Backdrop } from '../src/components/backdrop'

/**
 * Dispatches a pointer event from a pointer of `pointerType`. jsdom has no
 * PointerEvent, so it is a MouseEvent with the pointerType React reads.
 */
export function pointerEvent(el: Element, type: string, pointerType = 'mouse', init: MouseEventInit = {}) {
  const event = new MouseEvent(type, { bubbles: true, ...init })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  act(() => {
    el.dispatchEvent(event)
  })
}

/** Moves a pointer over the element. */
export function hover(el: Element, pointerType = 'mouse') {
  pointerEvent(el, 'pointermove', pointerType)
}

/** A GlassBackdrop's context value that records what it is asked to draw. */
export function fakeBackdrop() {
  const untrack = vi.fn<() => void>()
  const backdrop = {
    track: vi.fn<Backdrop['track']>(() => untrack),
    invalidate: vi.fn<Backdrop['invalidate']>(),
    moving: vi.fn<Backdrop['moving']>(() => () => {}),
  } satisfies Backdrop
  return { backdrop, untrack }
}
