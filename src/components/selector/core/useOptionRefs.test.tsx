import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useOptionRefs, type OptionRefs } from './useOptionRefs'

afterEach(cleanup)

// Renders an entry per value, handing out what the hook returned.
function List({ values, out }: { values: string[]; out: (refs: OptionRefs<string>) => void }) {
  const refs = useOptionRefs(values)
  out(refs)
  return values.map((value) => <div key={value} ref={refs.optionRef(value)} />)
}

describe('useOptionRefs', () => {
  it('keeps each entry’s element, and the same callback for it across renders', () => {
    let refs!: OptionRefs<string>
    const { rerender } = render(<List values={['a', 'b']} out={(r) => (refs = r)} />)
    const first = refs.optionRef('a')
    expect([...refs.options.keys()]).toEqual(['a', 'b'])

    rerender(<List values={['a', 'b']} out={(r) => (refs = r)} />)
    expect(refs.optionRef('a')).toBe(first)
  })

  it('lets go of the callbacks of entries no longer listed', () => {
    let refs!: OptionRefs<string>
    const { rerender } = render(<List values={['a', 'b', 'c']} out={(r) => (refs = r)} />)
    const gone = refs.optionRef('b')

    rerender(<List values={['a', 'c']} out={(r) => (refs = r)} />)
    expect([...refs.options.keys()]).toEqual(['a', 'c'])
    // A new callback, as the old one was let go.
    expect(refs.optionRef('b')).not.toBe(gone)
  })
})
