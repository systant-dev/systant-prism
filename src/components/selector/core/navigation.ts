import type { ReactNode } from 'react'

export interface SelectorItem<T extends string = string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

/** The first entry that can be picked. */
export function firstEnabled<T extends string>(items: readonly SelectorItem<T>[]) {
  return items.find((item) => !item.disabled)
}

// The nearest enabled entry past `from`, in the direction of `step`.
function nextEnabled<T extends string>(items: readonly SelectorItem<T>[], from: number, step: 1 | -1) {
  for (let i = from + step; i >= 0 && i < items.length; i += step) {
    if (!items[i].disabled) return items[i]
  }
}

/**
 * The entry a key moves the selection to, from the entry at `at` (-1 while
 * none has focus), or undefined for a key it leaves alone. `back` and
 * `forward` step along the list, skipping disabled entries, and at either end
 * stay put, still taking the key so it doesn't scroll the page; Home and End
 * go to the first and last enabled entries; Enter and Space pick the focused
 * one. `at` counts every entry, so it holds while a disabled one has focus.
 */
export function entryForKey<T extends string>(
  items: readonly SelectorItem<T>[],
  at: number,
  key: string,
  { back, forward }: { back: string; forward: string },
): SelectorItem<T> | undefined {
  const enabled = items.filter((item) => !item.disabled)
  if (!enabled.length) return
  if (key === forward) return at < 0 ? enabled[0] : (nextEnabled(items, at, 1) ?? items[at])
  if (key === back) return at < 0 ? enabled[enabled.length - 1] : (nextEnabled(items, at, -1) ?? items[at])
  if (key === 'Home') return enabled[0]
  if (key === 'End') return enabled[enabled.length - 1]
  if ((key === 'Enter' || key === ' ') && at >= 0) return items[at]
}
