// Style changes to these alone can't change the colours text is drawn in or
// over: where things are and how they move. prism writes them every frame (the
// light source and inner sheen follow the pointer on a card, a dragged card
// moves by translate, a popup is placed as the page scrolls), and each would
// otherwise read every watched element's colours again, a computed-style walk
// up the page per element per frame.
const COLOURLESS =
  /^(?:translate|scale|rotate|transform|transition(?:-.+)?|opacity|filter|overflow(?:-.+)?|left|top|right|bottom|--prism-(?:light|inner-sheen|glare|scroll-fade)-.+)$/

// Parses style attributes, so they are compared as the browser reads them.
let probe: HTMLElement | null = null

/** A style attribute's declarations, by property. */
function declarations(css: string | null) {
  probe ??= document.createElement('div')
  probe.setAttribute('style', css ?? '')
  const { style } = probe
  const byProperty = new Map<string, string>()
  for (let i = 0; i < style.length; i++) byProperty.set(style[i], style.getPropertyValue(style[i]))
  return byProperty
}

/** Whether a style attribute going from `before` to `after` could have changed a colour: unless only COLOURLESS properties did. */
function styleMayChangeColour(before: string | null, after: string | null) {
  const was = declarations(before)
  const now = declarations(after)
  for (const property of new Set([...was.keys(), ...now.keys()])) {
    if (was.get(property) !== now.get(property) && !COLOURLESS.test(property)) return true
  }
  return false
}

// What each change of a style attribute came to, by what it was and is, for as long as
// it is being told. Every element watched inside the one that changed hears of the same
// change, two dozen fields in a grid as the light crosses its card, and each would
// otherwise parse it afresh: 1.3 ms a frame on the demo's grid, against 0.3 this way.
const judged = new Map<string, boolean>()

/** Whether the mutation could have changed a colour: any but a style change to COLOURLESS properties alone. */
function mayChangeColour({ attributeName, oldValue, target }: MutationRecord) {
  if (attributeName !== 'style') return true
  const now = (target as Element).getAttribute('style')
  const change = `${oldValue}\0${now}`
  let may = judged.get(change)
  if (may === undefined) {
    // Forgotten once every watcher has heard: they all do before any other microtask runs.
    if (!judged.size) queueMicrotask(() => judged.clear())
    judged.set(change, (may = styleMayChangeColour(oldValue, now)))
  }
  return may
}

/**
 * Calls `onChange` when the colours `el` is drawn in may have changed without
 * a re-render: the colour scheme changing, or a class, style or data-theme
 * attribute changing on it or an ancestor, which is how themes are usually
 * switched. A style change that only moves an element (COLOURLESS) is passed
 * over. Returns a function that stops watching.
 */
export function watchTheme(el: Element, onChange: () => void): () => void {
  const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
  scheme?.addEventListener('change', onChange)

  const themes =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          if (records.some(mayChangeColour)) onChange()
        })
  for (let node: Element | null = el; node; node = node.parentElement) {
    themes?.observe(node, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
      attributeOldValue: true,
    })
  }

  return () => {
    scheme?.removeEventListener('change', onChange)
    themes?.disconnect()
  }
}
