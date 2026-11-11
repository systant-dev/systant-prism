import { useSyncExternalStore } from 'react'

/** What a server renders with, which can't know the browser's, until hydration has matched it. */
const SERVER_LOCALE = 'en-US'

function subscribe(onChange: () => void) {
  window.addEventListener('languagechange', onChange)
  return () => window.removeEventListener('languagechange', onChange)
}

/** The browser's language, kept up with as it changes. */
export function useBrowserLocale() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.language,
    () => SERVER_LOCALE,
  )
}
