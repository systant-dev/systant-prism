/**
 * Calls `onMove` once `el` has moved from `box`, its border box in the viewport,
 * whatever moved it: content above it growing, a font or image loading, a class
 * changing its margin. An IntersectionObserver whose root is the viewport shrunk
 * to `box` sees less of the element the moment it leaves. Where a scrolling
 * ancestor clips the element, the part that shows is watched instead; a wholly
 * clipped one isn't watched. Returns a function that stops watching.
 */
export function watchMove(el: Element, box: DOMRectReadOnly, onMove: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined' || !box.width || !box.height) return () => {}

  const root = document.documentElement
  // Whole px, rounded outwards, so a box on a sub-pixel is still wholly inside.
  const rootMargin = [box.top, root.clientWidth - box.right, root.clientHeight - box.bottom, box.left]
    .map((inset) => `${-Math.floor(inset)}px`)
    .join(' ')
  let observer: IntersectionObserver | null = null

  function observe(threshold: number, clipped: boolean) {
    let first = true
    const next = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry.intersectionRatio
        if (ratio === threshold) {
          first = false
          return
        }
        next.disconnect()
        if (!first) return onMove()
        // The first report is where it is now: how much a clipping ancestor shows.
        if (ratio > 0 && !clipped) observe(ratio, true)
      },
      // The document as root, so the margin applies inside a cross-origin iframe too.
      { root: document, rootMargin, threshold },
    )
    observer = next
    next.observe(el)
  }

  observe(1, false)
  return () => observer?.disconnect()
}
