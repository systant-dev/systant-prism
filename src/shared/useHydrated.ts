import { useSyncExternalStore } from 'react'

/** For a value that is read afresh at each render, with nothing to say when it has changed. */
const noChanges = () => () => {}

/** False on the server and while hydrating what it rendered, and true from then on. */
export function useHydrated() {
  return useSyncExternalStore(
    noChanges,
    () => true,
    () => false,
  )
}
