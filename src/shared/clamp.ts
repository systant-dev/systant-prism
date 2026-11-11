/** `value` kept from `min` to `max`, or at `min` where there is no room between them. */
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}
