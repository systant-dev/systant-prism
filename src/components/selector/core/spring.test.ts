import { describe, expect, it } from 'vitest'
import { settleSpring, springAtRest, springFrequency, stepSpring, type Spring } from './spring'

// Steps the spring frame by frame at 60fps for `ms`, recording each value.
function run(spring: Spring, ms: number, omega: number) {
  const values: number[] = []
  for (let t = 0; t < ms; t += 1000 / 60) {
    stepSpring(spring, 1 / 60, omega)
    values.push(spring.value)
  }
  return values
}

describe('spring', () => {
  it('comes within 1% of its target in the time it is given', () => {
    const spring = { value: 0, velocity: 0, target: 100 }
    run(spring, 300, springFrequency(300))
    expect(spring.value).toBeGreaterThan(98.5)
    expect(spring.value).toBeLessThanOrEqual(100)
  })

  it('never overshoots, from rest or already moving fast towards it', () => {
    for (const velocity of [0, 2000]) {
      const spring = { value: 0, velocity, target: 100 }
      const values = run(spring, 1000, springFrequency(300))
      expect(Math.max(...values)).toBeLessThanOrEqual(100)
      // Always heading the same way.
      expect(values.every((v, i) => i === 0 || v >= values[i - 1])).toBe(true)
    }
  })

  it('starts from rest gently rather than at its fastest', () => {
    const spring = { value: 0, velocity: 0, target: 100 }
    const [first, second] = run(spring, 40, springFrequency(300))
    expect(second - first).toBeGreaterThan(first)
  })

  it('keeps its speed when its target moves on', () => {
    const spring = { value: 0, velocity: 0, target: 40 }
    run(spring, 80, springFrequency(300))
    const { velocity } = spring
    spring.target = 80
    stepSpring(spring, 1 / 60, springFrequency(300))
    expect(spring.velocity).toBeGreaterThan(velocity)
  })

  it('is exact over a long frame, landing where many short ones would', () => {
    const long = { value: 0, velocity: 0, target: 100 }
    const short = { value: 0, velocity: 0, target: 100 }
    const omega = springFrequency(300)
    stepSpring(long, 0.2, omega)
    for (let i = 0; i < 12; i++) stepSpring(short, 0.2 / 12, omega)
    expect(long.value).toBeCloseTo(short.value, 6)
  })

  it('comes to rest, and settles in place', () => {
    const spring = { value: 0, velocity: 0, target: 100 }
    expect(springAtRest(spring)).toBe(false)
    run(spring, 600, springFrequency(300))
    expect(springAtRest(spring)).toBe(true)
    settleSpring(spring, 40)
    expect(spring).toEqual({ value: 40, velocity: 0, target: 40 })
  })
})
