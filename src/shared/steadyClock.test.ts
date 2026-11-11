import { describe, expect, it } from 'vitest'
import { LONGEST_FADE_STEP, steadyClock } from './steadyClock'

describe('steadyClock', () => {
  it('starts at 0 on its first reading, however late that is', () => {
    expect(steadyClock()(5000)).toBe(0)
  })

  it('runs with the time between readings', () => {
    const clock = steadyClock()
    clock(1000)
    expect(clock(1016)).toBe(16)
    expect(clock(1050)).toBe(50)
  })

  it('moves on by no more than its longest step through a stall', () => {
    const clock = steadyClock()
    clock(1000)
    expect(clock(1400)).toBe(LONGEST_FADE_STEP)
    const short = steadyClock(10)
    short(0)
    expect(short(400)).toBe(10)
  })

  it('never runs backwards', () => {
    const clock = steadyClock()
    clock(1000)
    clock(1020)
    expect(clock(900)).toBe(20)
  })
})
