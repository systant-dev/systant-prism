/**
 * What `make` gives for `key`, made the first time it is asked for and kept in `cache`:
 * for what is slow to make and asked for over and over, as Intl's formatters are.
 */
export function once<T>(cache: Map<string, T>, key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)!
}
