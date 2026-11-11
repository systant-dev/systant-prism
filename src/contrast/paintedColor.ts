import type { Rgba } from './color'

let context: CanvasRenderingContext2D | null = null

/** Whether `css` is a colour the context takes: one it isn't sets fillStyle to nothing, leaving what was there. */
function takes(painter: CanvasRenderingContext2D, css: string) {
  painter.fillStyle = '#000000'
  painter.fillStyle = css
  const overBlack = painter.fillStyle
  painter.fillStyle = '#ffffff'
  painter.fillStyle = css
  return painter.fillStyle === overBlack
}

/**
 * Any colour the browser can paint, as the channels it paints: 0–255 in sRGB, to
 * the nearest whole one, so wider colours are brought into gamut. Null if it
 * isn't one, or where nothing can be painted (no DOM). `currentcolor` has no
 * element to resolve against here, so it is null too.
 */
export function paintedColor(css: string): Rgba | null {
  if (!css || css.includes('currentcolor') || typeof document === 'undefined') return null
  if (!context) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    context = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!context || !takes(context, css)) return null
  context.clearRect(0, 0, 1, 1)
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data
  return { r, g, b, alpha: alpha / 255 }
}
