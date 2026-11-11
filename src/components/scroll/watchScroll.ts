/**
 * Calls `onChange` whenever what `el` shows of its content may have changed: it
 * scrolls, it or one of its children resizes, a child is added or removed, or
 * text directly inside it changes (which resizes no child to report it).
 * Scroll events already come at most once a frame, and resizes are reported
 * after layout and before paint, so `onChange` can measure and write straight
 * away. Returns a function that stops watching.
 */
export function watchScroll(el: HTMLElement, onChange: () => void): () => void {
  const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => onChange())
  resizes?.observe(el)
  for (const child of el.children) resizes?.observe(child)

  // Text can only be watched over the whole subtree; anything deeper than el's
  // own text nodes is skipped here, as a child it changes resizes instead.
  const mutations =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          let changed = false
          for (const { type, target, addedNodes, removedNodes } of records) {
            if (type === 'characterData') {
              if (target.parentNode === el) changed = true
            } else if (target === el) {
              for (const node of removedNodes) if (node instanceof Element) resizes?.unobserve(node)
              for (const node of addedNodes) if (node instanceof Element) resizes?.observe(node)
              changed = true
            }
          }
          if (changed) onChange()
        })
  mutations?.observe(el, { childList: true, characterData: true, subtree: true })

  el.addEventListener('scroll', onChange, { passive: true })
  return () => {
    el.removeEventListener('scroll', onChange)
    mutations?.disconnect()
    resizes?.disconnect()
  }
}
