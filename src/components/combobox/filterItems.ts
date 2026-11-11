import { fold } from '../../shared'

/**
 * The items whose label holds `query`, whatever its case and accents: those that
 * start with it first, as what is being typed, then the rest, each in the order
 * they came. Space round the query doesn't count, and with nothing left to look
 * for every item matches.
 */
export function filterItems<I extends { label: string }>(items: readonly I[], query: string): readonly I[] {
  const wanted = fold(query.trim())
  if (!wanted) return items
  const starting: I[] = []
  const containing: I[] = []
  for (const item of items) {
    const label = fold(item.label)
    if (label.startsWith(wanted)) starting.push(item)
    else if (label.includes(wanted)) containing.push(item)
  }
  return [...starting, ...containing]
}
