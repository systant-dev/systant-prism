import { once } from '../../shared'

/**
 * A place in an input mask: a slot a character of a kind fills, written as a
 * capital where it says, or a character of its own.
 */
type Slot = { slot: RegExp; capital?: boolean }
type Token = Slot | { literal: string }

const DIGIT: Slot = { slot: /[0-9]/ }

/**
 * react-input-mask's codes, a digit, a letter, or either, and two of its own
 * for codes written in capitals: a letter, or a letter or a digit, either
 * typed as it likes and written as a capital.
 */
const SLOTS: Readonly<Record<string, Slot>> = {
  '9': DIGIT,
  a: { slot: /[A-Za-z]/ },
  '*': { slot: /[A-Za-z0-9]/ },
  A: { slot: /[A-Za-z]/, capital: true },
  X: { slot: /[A-Za-z0-9]/, capital: true },
}

function readMask(mask: string): Token[] {
  const tokens: Token[] = []
  for (let i = 0; i < mask.length; i++) {
    // A backslash takes the next character as it stands: '\9' is a 9, not a digit.
    if (mask[i] === '\\' && i + 1 < mask.length) tokens.push({ literal: mask[++i] })
    else if (SLOTS[mask[i]]) tokens.push(SLOTS[mask[i]])
    else tokens.push({ literal: mask[i] })
  }
  return tokens
}

// Masks are few and keystrokes many, so each is read once.
const read = new Map<string, Token[]>()

function tokensOf(mask: string) {
  return once(read, mask, () => readMask(mask))
}

/**
 * How a text fits a mask: as far as it fits, and what of that is in its slots;
 * whether every slot was filled; and whether nothing in it was left out. With `finished`, the mask's characters
 * after its last slot are put in too, for a value that is complete.
 */
function fit(text: string, mask: string, finished = false) {
  const tokens = tokensOf(mask)
  let lastSlot = -1
  tokens.forEach((token, index) => {
    if ('slot' in token) lastSlot = index
  })
  let out = ''
  let slots = ''
  let i = 0
  let skipped = false
  let filled = true
  for (const [index, token] of tokens.entries()) {
    if (i >= text.length) {
      if ('slot' in token) {
        filled = false
        break
      }
      // While typing, characters after the last one typed wait for the next, so they can be deleted back.
      if (finished && index > lastSlot) out += token.literal
      continue
    }
    if ('literal' in token) {
      out += token.literal
      // Typed or not: the mask puts it there either way.
      if (text[i] === token.literal) i++
      continue
    }
    while (i < text.length && !token.slot.test(text[i])) {
      skipped = true
      i++
    }
    if (i >= text.length) {
      filled = false
      break
    }
    const typed = token.capital ? text[i++].toUpperCase() : text[i++]
    out += typed
    slots += typed
  }
  return { out, slots, filled, whole: !skipped && i >= text.length }
}

/**
 * What typing `text` into a field with `mask` leaves in it: its characters in
 * the mask's slots, in order, those that fit no slot dropped, with the mask's
 * own characters put in between as they are reached. Characters past the last
 * slot are dropped too. It stops after the last character typed, so a mask's
 * characters ahead of the caret wait to be reached, and can be deleted back.
 */
export function conform(text: string, mask: string) {
  return fit(text, mask).out
}

/**
 * A stored value as its mask writes it, '02079460958' as '(020) 7946-0958', or
 * null where it doesn't fit: a character fits no slot, or there is one too many.
 */
export function applyInputMask(text: string, mask: string): string | null {
  const { out, filled, whole } = fit(text, mask, true)
  return whole && filled ? out : null
}

/**
 * What of a value fitted to its mask is in its slots, without the mask's own
 * characters: '(020) 7946-0958' as '02079460958'.
 */
export function unmask(text: string, mask: string) {
  return fit(text, mask).slots
}

/** Whether `text` fills every slot of `mask`. */
export function fillsMask(text: string, mask: string) {
  return fit(text, mask).filled
}

/** A mask's shape to show in an empty field: each slot an underscore, '(___) ___-____'. */
export function maskPlaceholder(mask: string) {
  return tokensOf(mask)
    .map((token) => ('slot' in token ? '_' : token.literal))
    .join('')
}

/** Whether every slot of a mask takes only a digit, for a keyboard of digits. */
export function digitsOnly(mask: string) {
  return tokensOf(mask).every((token) => !('slot' in token) || token === DIGIT)
}
