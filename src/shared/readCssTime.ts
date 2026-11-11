/** A CSS time (`0.2s`, `160ms`) in ms, or 0 where it isn't one. */
export function readCssTime(value: string) {
  const ms = parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)
  return Number.isFinite(ms) ? ms : 0
}
