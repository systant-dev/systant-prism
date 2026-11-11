/** Eases in and out, as cubic-bezier(0.65, 0, 0.35, 1): the background fade's easing (src/components/fade). */
export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}
