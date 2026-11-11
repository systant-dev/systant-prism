/**
 * What `record` holds under `key`, as `record[key]` gives it, except that a name every
 * object answers to (constructor, toString, __proto__ and the rest of Object.prototype)
 * gives nothing unless the record has one of its own.
 *
 * A column is named for a property of the rows, and the rows are whatever their JSON
 * holds: one may well have a "constructor", and the next row none. Read plainly, that
 * row's value would be the function that makes objects, and so would the column's
 * width, its filter and what `columns` says of it, in every record kept by column.
 * What a row gets from a class of its own is still read.
 */
export function held<T>(record: { readonly [key: string]: T } | null | undefined, key: string): T | undefined {
  if (record == null) return undefined
  return key in Object.prototype && !Object.hasOwn(record, key) ? undefined : record[key]
}
