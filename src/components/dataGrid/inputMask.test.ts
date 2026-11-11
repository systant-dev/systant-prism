import { describe, expect, it } from 'vitest'
import { applyInputMask, conform, digitsOnly, fillsMask, maskPlaceholder, unmask } from './inputMask'

const phone = '(999) 9999-9999'

describe('conform', () => {
  it("puts typed characters in the mask's slots, with its own characters between, as they are reached", () => {
    expect(conform('0', phone)).toBe('(0')
    expect(conform('020', phone)).toBe('(020')
    expect(conform('0207', phone)).toBe('(020) 7')
    expect(conform('02079460958', phone)).toBe('(020) 7946-0958')
  })

  it("takes the mask's own characters typed in their places, and leaves those ahead of the caret to be deleted back", () => {
    expect(conform('(020) ', phone)).toBe('(020) ')
    expect(conform('(020)', phone)).toBe('(020)')
    expect(conform('(020', phone)).toBe('(020')
  })

  it('drops characters that fit no slot, and any past the last', () => {
    expect(conform('02a0x7', phone)).toBe('(020) 7')
    expect(conform('020794609581234', phone)).toBe('(020) 7946-0958')
  })

  it('reads letters, either, and characters taken as they stand', () => {
    expect(conform('ab12', 'aa-99')).toBe('ab-12')
    expect(conform('1a2b', '****')).toBe('1a2b')
    expect(conform('1a', '99')).toBe('1')
    expect(conform('12', '\\9-99')).toBe('9-12')
  })
})

describe('capitals', () => {
  it('writes a letter in an A or X slot as a capital, however it is typed or stored', () => {
    expect(conform('sw1a', 'AA9X')).toBe('SW1A')
    expect(applyInputMask('ab12cd', 'AA-99-aa')).toBe('AB-12-cd')
    expect(conform('1', 'A')).toBe('')
    expect(conform('1', 'X')).toBe('1')
    expect(digitsOnly('AA9')).toBe(false)
  })
})

describe('unmask', () => {
  it("keeps only what is in the mask's slots", () => {
    expect(unmask('(020) 7946-0958', phone)).toBe('02079460958')
    expect(unmask('ab12', 'AA-99')).toBe('AB12')
  })
})

describe('applyInputMask', () => {
  it('writes a stored value that fits as the mask does, its last characters and all', () => {
    expect(applyInputMask('02079460958', phone)).toBe('(020) 7946-0958')
    expect(applyInputMask('(020) 7946-0958', phone)).toBe('(020) 7946-0958')
    expect(applyInputMask('123', '999)')).toBe('123)')
  })

  it("gives null for a value that doesn't fit: too short, too long, or the wrong kind", () => {
    expect(applyInputMask('0207', phone)).toBeNull()
    expect(applyInputMask('020794609581', phone)).toBeNull()
    expect(applyInputMask('0207946095x', phone)).toBeNull()
  })
})

describe('the rest', () => {
  it('says whether every slot is filled', () => {
    expect(fillsMask('(020) 7946-0958', phone)).toBe(true)
    expect(fillsMask('(020) 7946-095', phone)).toBe(false)
    expect(fillsMask('123', '999)')).toBe(true)
  })

  it("shows a mask's shape, and whether it takes only digits", () => {
    expect(maskPlaceholder(phone)).toBe('(___) ____-____')
    expect(maskPlaceholder('aa-\\9')).toBe('__-9')
    expect(digitsOnly(phone)).toBe(true)
    expect(digitsOnly('aa-99')).toBe(false)
  })
})
