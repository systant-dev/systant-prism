import type { KeyboardEvent } from 'react'

/**
 * A keydown handler that calls `handler` on Enter, but not while an input
 * method is composing: Enter there takes up what was composed (Japanese typed
 * as kana, say), and isn't meant for the field.
 */
export const onEnter = (handler: () => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) handler()
}
