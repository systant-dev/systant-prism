/** A className from the parts that are set: `cx('a', on && 'b', undefined)` → `'a b'` or `'a'`. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}
