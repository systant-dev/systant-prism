import { describe, expect, it, vi } from 'vitest'
import {
  apart,
  counterScale,
  drawOver,
  easingCurve,
  glideStreaks,
  halt,
  lineUpStreaks,
  spring,
  springFalloff,
  springOffsets,
  stopSpring,
} from './motion'

function card() {
  const el = document.createElement('div')
  const streaks = document.createElement('span')
  streaks.className = 'prism-card__streaks'
  el.append(streaks)
  return { el, streaks }
}

const rect = (left: number, top: number, width = 100, height = 50) => ({ left, top, width, height })

describe('drawOver', () => {
  it('draws a card laid out at one box over another by translate and scale', () => {
    const { el } = card()
    expect(drawOver(el, rect(100, 0), rect(0, 20, 200, 50))).toBe(true)
    expect(el.style.translate).toBe('-100px 20px')
    expect(el.style.scale).toBe('2 1')
  })

  it('leaves a card all but where it is as it is', () => {
    const { el } = card()
    expect(drawOver(el, rect(0, 0), rect(0.2, 0.3))).toBe(false)
    expect(el.style.translate).toBe('')
    expect(apart(rect(0, 0), rect(0.2, 0.3))).toBe(false)
    expect(apart(rect(0, 0), rect(4, 0))).toBe(true)
  })
})

describe('streaks', () => {
  it('lines them up at once for where the card is drawn in the grid', () => {
    const { el, streaks } = card()
    expect(lineUpStreaks(el, rect(110, 60))).toBe(true)
    expect(streaks.style.backgroundPosition).toBe('-5110px -5060px')
    expect(streaks.style.transition).toBe('none')
  })

  it('leaves them be where they already line up, as when gliding there', () => {
    const { el, streaks } = card()
    glideStreaks(el, rect(110, 0))
    const gliding = streaks.style.transition
    expect(gliding).toContain('background-position')

    expect(lineUpStreaks(el, rect(110, 0))).toBe(false)
    expect(streaks.style.transition).toBe(gliding)
  })

  it('slides them on the grid’s timing as the card glides', () => {
    const { el, streaks } = card()
    lineUpStreaks(el, rect(0, 0))
    glideStreaks(el, rect(220, 60))
    expect(streaks.style.backgroundPosition).toBe('-5220px -5060px')
    expect(streaks.style.transition).toBe(
      'background-position var(--prism-card-grid-glide-duration) var(--prism-card-grid-easing)',
    )
  })
})

describe('spring', () => {
  it('swings out first, then back past where it began, each swing smaller and slower', () => {
    const offsets = springOffsets(96)
    expect(offsets[0]).toBe(0)
    expect(Math.max(...offsets)).toBe(1)
    // Its swings, one each way in turn: how wide each gets and how long it lasts
    const swings: { widest: number; length: number }[] = []
    let sign = 0
    for (const offset of offsets.slice(1, -1)) {
      const side = Math.sign(offset)
      if (side !== 0 && side !== sign) {
        swings.push({ widest: 0, length: 0 })
        sign = side
      }
      const swing = swings.at(-1)!
      swing.widest = Math.max(swing.widest, Math.abs(offset))
      swing.length++
    }
    expect(Math.sign(offsets.find((o) => o !== 0)!)).toBe(1)
    expect(swings.length).toBeGreaterThanOrEqual(4)
    for (let k = 1; k < swings.length; k++) expect(swings[k].widest).toBeLessThan(swings[k - 1].widest)
    for (let k = 1; k < 4; k++) expect(swings[k].length).toBeGreaterThanOrEqual(swings[k - 1].length)
  })

  it('settles into rest rather than stopping short', () => {
    const offsets = springOffsets(96)
    expect(offsets.at(-1)).toBe(0)
    // The last fifth all but still, and slowing to nothing
    expect(Math.max(...offsets.slice(-20).map(Math.abs))).toBeLessThan(0.03)
    expect(Math.abs(offsets.at(-2)! - offsets.at(-1)!)).toBeLessThan(0.001)
  })

  it('gives cards further from the dropped one less of its spring', () => {
    expect(springFalloff(0)).toBeLessThan(1)
    expect(springFalloff(300)).toBeLessThan(springFalloff(100))
    expect(springFalloff(1200)).toBeLessThan(0.1)
  })

  it('animates the transform of the card along the way given, after the delay', () => {
    const { el } = card()
    const animate = vi.fn<(keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation>(
      () => ({}) as Animation,
    )
    el.animate = animate as unknown as HTMLElement['animate']
    el.getAnimations = () => []

    spring(el, { x: 1, y: 0 }, 6, { delay: 150, duration: 700 })
    const [keyframes, options] = animate.mock.calls[0]
    expect(options).toMatchObject({ delay: 150, duration: 700, id: 'prism-card-grid-spring' })
    const xs = keyframes.map((k) => parseFloat(String(k.transform).slice('translate('.length)))
    expect(Math.max(...xs)).toBeCloseTo(6)
    expect(keyframes.at(-1)!.transform).toBe('translate(0px, 0px)')
  })

  it('runs nothing too small to see, or without the Web Animations API', () => {
    const { el } = card()
    expect(spring(el, { x: 1, y: 0 }, 6, { delay: 0, duration: 700 })).toBeNull()
    el.animate = vi.fn<() => Animation>() as unknown as HTMLElement['animate']
    expect(spring(el, { x: 1, y: 0 }, 0.1, { delay: 0, duration: 700 })).toBeNull()
    expect(el.animate).not.toHaveBeenCalled()
  })

  it('stops only its own spring', () => {
    const { el } = card()
    const own = { id: 'prism-card-grid-spring', cancel: vi.fn<() => void>() }
    const other = { id: '', cancel: vi.fn<() => void>() }
    el.getAnimations = () => [own, other] as unknown as Animation[]
    stopSpring(el)
    expect(own.cancel).toHaveBeenCalledOnce()
    expect(other.cancel).not.toHaveBeenCalled()
  })
})

describe('easingCurve', () => {
  it('reads a cubic-bezier, its keywords, and anything else as linear', () => {
    const strong = easingCurve(' cubic-bezier(0.22, 1, 0.36, 1) ')
    expect(strong(0)).toBeCloseTo(0)
    expect(strong(1)).toBeCloseTo(1)
    expect(strong(0.5)).toBeGreaterThan(0.85)
    expect(easingCurve('ease-in')(0.5)).toBeLessThan(0.5)
    expect(easingCurve('linear')(0.3)).toBe(0.3)
    expect(easingCurve('steps(4)')(0.3)).toBe(0.3)
  })
})

describe('counterScale', () => {
  function gridCard() {
    const { el } = card()
    const content = document.createElement('div')
    content.className = 'prism-card-grid__content'
    el.prepend(content)
    const running: { id: string; cancel: () => void }[] = []
    const animate = vi.fn<(keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation>((_, options) => {
      const animation = Object.assign(new EventTarget(), { id: options.id!, cancel: vi.fn<() => void>() })
      running.push(animation)
      return animation as unknown as Animation
    })
    content.animate = animate as unknown as HTMLElement['animate']
    content.getAnimations = () => running as unknown as Animation[]
    return { el, animate, running }
  }

  it('scales the content against the card, from the inverse of where it starts to its own size, as the card clips it', () => {
    const { el, animate } = gridCard()
    counterScale(el, 2, 4, 250, 'linear')

    const [keyframes, options] = animate.mock.calls[0]
    expect(options).toMatchObject({ duration: 250, easing: 'linear', id: 'prism-card-grid-counter-scale' })
    expect(keyframes[0].transform).toBe('scale(0.5, 0.25)')
    // Halfway through a linear glide (the middle of its moments) the card is drawn at 1.5 × 2.5
    expect(keyframes[(keyframes.length - 1) / 2].transform).toBe(`scale(${1 / 1.5}, ${1 / 2.5})`)
    expect(keyframes.at(-1)!.transform).toBe('scale(1, 1)')
    expect(el.style.overflow).toBe('clip')
  })

  it('stops, and lets the card stop clipping, as the card is halted for a new move', () => {
    const { el, running } = gridCard()
    counterScale(el, 0.5, 0.5, 250, 'linear')
    halt(el)
    expect(running[0].cancel).toHaveBeenCalledOnce()
    expect(el.style.overflow).toBe('')
  })

  it('runs nothing for a card not changing size, or without the Web Animations API', () => {
    const { el, animate } = gridCard()
    expect(counterScale(el, 1, 1.001, 250, 'linear')).toBeNull()
    expect(counterScale(el, 2, 2, 0, 'linear')).toBeNull()
    expect(animate).not.toHaveBeenCalled()
    expect(counterScale(card().el, 2, 2, 250, 'linear')).toBeNull()
    expect(el.style.overflow).toBe('')
  })
})
