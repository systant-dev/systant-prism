import { useState } from 'react'

/**
 * A value a component is given or else keeps for itself: `controlled` where it is
 * given, and otherwise its own, starting from `initial`. `keep` holds a new one where
 * it is the component's own to hold, and does nothing where it is given: the caller
 * says it has changed (its onChange) either way, and shows what it is given back.
 *
 * Only undefined is none given, so null can be a value: a calendar with no day picked.
 */
export function useControllable<T>(controlled: T | undefined, initial: T | (() => T)): [T, (next: T) => void] {
  const [own, setOwn] = useState(initial)
  const given = controlled !== undefined
  return [
    given ? controlled : own,
    (next) => {
      if (!given) setOwn(next)
    },
  ]
}
