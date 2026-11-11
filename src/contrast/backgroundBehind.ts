import { over, parseColor, type Rgba } from './color'

/**
 * The background behind `el`'s text, as one colour: its own background colour
 * and its ancestors', laid over each other down to the first opaque one. It is
 * translucent (or transparent) when they all are, or when an image, or a colour
 * this can't read, lies beneath them: what shows through there is unknown.
 * Gradients are passed over, as sheens rather than backgrounds. It stops at an
 * element in the top layer (an open popover or modal dialog), whose ancestors
 * aren't behind it on screen. With `until`, it stops short of that ancestor,
 * for something drawn over its background (a GlassBackdrop's canvas, say).
 */
export function backgroundBehind(el: Element, until?: Element | null): Rgba {
  let color: Rgba = { r: 0, g: 0, b: 0, alpha: 0 }
  for (let node: Element | null = el; node && node !== until; node = node.parentElement) {
    const computed = getComputedStyle(node)
    // An image is painted over its element's colour, so what is behind is unknown. A
    // gradient is taken as a sheen over the colour (a button's), and passed over.
    if (computed.backgroundImage.includes('url(')) break
    // Browsers compute an unset background as transparent; jsdom leaves it empty.
    const layer = parseColor(computed.backgroundColor || 'transparent')
    if (!layer) break
    color = over(color, layer)
    if (color.alpha >= 1 || inTopLayer(node)) break
  }
  return color
}

function inTopLayer(el: Element) {
  try {
    return el.matches(':popover-open, :modal')
  } catch {
    // Selectors the browser (or jsdom) doesn't know.
    return false
  }
}
