// Colour parsing and the WCAG 2.2 contrast maths: relative luminance and the
// contrast ratio between two colours, after
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance and #dfn-contrast-ratio.
//
// Channels are 0–255 and alpha 0–1, kept unrounded so that laying colours over
// each other loses nothing until a colour is written out with toHex.
// oxlint-disable-next-line no-restricted-imports -- straight from the module, not the index, which takes in hooks: a server imports this (src/server.ts)
import { clamp } from '../shared/clamp'
import { paintedColor } from './paintedColor'

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Rgba extends Rgb {
  alpha: number
}

const KEYWORDS: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, alpha: 0 },
  black: { r: 0, g: 0, b: 0, alpha: 1 },
  white: { r: 255, g: 255, b: 255, alpha: 1 },
}

/** A number or percentage, `100%` being `full`; `none` is 0, as in CSS. NaN if it is neither. */
function readNumber(token: string, full: number) {
  if (token === 'none') return 0
  return token.endsWith('%') ? (parseFloat(token) / 100) * full : Number(token)
}

/** How many degrees each unit of angle is. */
const DEGREES: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }

/** A hue in degrees, from a bare number or one in deg, grad, rad or turn. */
function readHue(token: string) {
  const match = /^(-?[\d.]+(?:e-?\d+)?)(deg|grad|rad|turn)?$/.exec(token)
  if (!match) return token === 'none' ? 0 : NaN
  const value = parseFloat(match[1])
  return value * DEGREES[match[2] ?? 'deg']
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const s = clamp(saturation, 0, 1)
  const l = clamp(lightness, 0, 1)
  const channel = (n: number) => {
    // Wrapped to 0–12, as a negative hue's remainder is negative.
    const k = (((n + hue / 30) % 12) + 12) % 12
    return (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
  }
  return { r: channel(0), g: channel(8), b: channel(4) }
}

function parseHex(hex: string): Rgba | null {
  if (!/^[\da-f]+$/i.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return null
  const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
  const byte = (i: number) => parseInt(full.slice(i * 2, i * 2 + 2), 16)
  return { r: byte(0), g: byte(1), b: byte(2), alpha: full.length === 8 ? byte(3) / 255 : 1 }
}

/**
 * The notations read exactly, unrounded and without a browser: hex, rgb()/rgba(),
 * hsl()/hsla() (in either the comma or the space syntax), color(srgb …) (what
 * browsers compute a color-mix() in srgb to), and the keywords transparent, black
 * and white.
 */
function readNotation(value: string): Rgba | null {
  if (Object.hasOwn(KEYWORDS, value)) return { ...KEYWORDS[value] }
  if (value.startsWith('#')) return parseHex(value.slice(1))

  const match = /^(rgba?|hsla?|color)\((.*)\)$/.exec(value)
  if (!match) return null
  const [, fn, inner] = match
  const args = inner
    .replace('/', ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
  // color(srgb r g b / a), each channel 0–1.
  if (fn === 'color' && args.shift() !== 'srgb') return null
  if (args.length < 3 || args.length > 4) return null

  let rgb: Rgb
  if (fn === 'color') {
    const [r, g, b] = args.slice(0, 3).map((token) => readNumber(token, 1) * 255)
    rgb = { r, g, b }
  } else if (fn.startsWith('rgb')) {
    const [r, g, b] = args.slice(0, 3).map((token) => readNumber(token, 255))
    rgb = { r, g, b }
  } else {
    // Modern hsl() also takes bare numbers for saturation and lightness, out of 100.
    const [s, l] = args.slice(1, 3).map((token) => readNumber(token, 100) / 100)
    rgb = hslToRgb(readHue(args[0]), s, l)
  }

  const alpha = args.length === 4 ? readNumber(args[3], 1) : 1
  const channels = [rgb.r, rgb.g, rgb.b, alpha]
  if (channels.some((n) => !Number.isFinite(n))) return null
  return {
    r: clamp(rgb.r, 0, 255),
    g: clamp(rgb.g, 0, 255),
    b: clamp(rgb.b, 0, 255),
    alpha: clamp(alpha, 0, 1),
  }
}

/**
 * A CSS colour as channels, or null if it isn't one. Any colour the browser can
 * paint is understood: what readNotation doesn't read (a named colour, oklch(),
 * lab(), and what browsers compute a color-mix() outside srgb to) is painted to
 * find out, which needs a DOM.
 */
export function parseColor(css: string): Rgba | null {
  const value = css.trim().toLowerCase()
  return readNotation(value) ?? paintedColor(value)
}

/** Like parseColor, but throws on a colour it doesn't understand, naming it. */
export function toRgba(css: string): Rgba {
  const color = parseColor(css)
  if (!color) throw new Error(`Not a colour prism can read: ${JSON.stringify(css)}`)
  return color
}

/** `top` laid over `bottom` (source-over), as one colour. Either may be translucent. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top.alpha + bottom.alpha * (1 - top.alpha)
  if (alpha === 0) return { r: 0, g: 0, b: 0, alpha: 0 }
  const blend = (a: number, b: number) => (a * top.alpha + b * bottom.alpha * (1 - top.alpha)) / alpha
  return { r: blend(top.r, bottom.r), g: blend(top.g, bottom.g), b: blend(top.b, bottom.b), alpha }
}

/** `from` moved `amount` (0–1) of the way to `to`, channel by channel. */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const lerp = (a: number, b: number) => a + (b - a) * amount
  return { r: lerp(from.r, to.r), g: lerp(from.g, to.g), b: lerp(from.b, to.b) }
}

/** WCAG relative luminance: 0 for black, 1 for white. */
export function luminance({ r, g, b }: Rgb) {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** The WCAG contrast ratio between two opaque colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/** `#rrggbb`, ignoring alpha. */
export function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b]
    .map((n) =>
      Math.round(clamp(n, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** `rgb(r g b / alpha)`, unrounded, so it parses back to the same colour. */
export function toCss({ r, g, b, alpha }: Rgba) {
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
