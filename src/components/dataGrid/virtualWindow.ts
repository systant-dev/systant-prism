/** Where each of a stack of items starts: item i runs from offsets[i] to offsets[i + 1]. */
export function stack(heights: readonly number[]): number[] {
  let end = 0
  const offsets = [0]
  for (const height of heights) offsets.push((end += height))
  return offsets
}

/** The first item that ends below `y`, by binary search. */
function itemAt(offsets: readonly number[], y: number) {
  let low = 0
  let high = offsets.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (offsets[mid + 1] > y) high = mid
    else low = mid + 1
  }
  return low
}

/**
 * The items of a stack that show in a view `height` tall scrolled to `top`,
 * plus `overscan` more on each side, so a quick scroll doesn't show a gap:
 * items `start` to `end`, not including `end`.
 */
export function visibleRange(offsets: readonly number[], top: number, height: number, overscan: number) {
  const count = offsets.length - 1
  if (count <= 0) return { start: 0, end: 0 }
  const first = itemAt(offsets, Math.max(0, top))
  const last = itemAt(offsets, top + height - 1)
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + 1 + overscan) }
}
