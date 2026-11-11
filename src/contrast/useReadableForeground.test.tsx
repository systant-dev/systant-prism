import { act, cleanup, render, screen } from '@testing-library/react'
import { useRef, type CSSProperties } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReadableOptions } from './readableForeground'
import { backgroundBehind } from './backgroundBehind'
import { useReadableForeground } from './useReadableForeground'

function Label({ style, options }: { style?: CSSProperties; options?: ReadableOptions }) {
  const ref = useRef<HTMLSpanElement>(null)
  const readable = useReadableForeground(ref, options)
  return (
    <span ref={ref} data-testid="label" style={{ ...style, color: readable?.color }}>
      {readable ? `${readable.color} ${readable.passes ? 'passes' : 'fails'}` : 'unread'}
    </span>
  )
}

function label() {
  return screen.getByTestId('label')
}

// Lets a MutationObserver's records arrive.
const settle = () => act(async () => {})

afterEach(cleanup)

describe('backgroundBehind', () => {
  it('lays the element over its ancestors down to the first opaque colour', () => {
    const outer = document.createElement('div')
    outer.style.backgroundColor = 'rgb(255, 0, 0)'
    const inner = document.createElement('div')
    inner.style.backgroundColor = 'rgba(0, 0, 255, 0.5)'
    const text = document.createElement('span')
    outer.append(inner)
    inner.append(text)
    document.body.append(outer)

    expect(backgroundBehind(text)).toEqual({ r: 127.5, g: 0, b: 127.5, alpha: 1 })
    outer.remove()
  })

  it('stops at a background image, leaving what is over it', () => {
    const photo = document.createElement('div')
    photo.style.backgroundColor = 'rgb(255, 255, 255)'
    photo.style.backgroundImage = 'url(photo.webp)'
    const glass = document.createElement('div')
    glass.style.backgroundColor = 'rgba(0, 0, 0, 0.3)'
    photo.append(glass)
    document.body.append(photo)

    expect(backgroundBehind(glass)).toEqual({ r: 0, g: 0, b: 0, alpha: 0.3 })
    photo.remove()
  })
})

describe('useReadableForeground', () => {
  it('colours text for the background it is on', () => {
    render(
      <div style={{ backgroundColor: '#111318' }}>
        <Label />
      </div>,
    )
    expect(label().textContent).toBe('#ffffff passes')
  })

  it('judges a translucent background over the backdrop given', () => {
    render(
      <div style={{ backgroundImage: 'url(photo.webp)' }}>
        <Label style={{ backgroundColor: 'rgba(243, 244, 246, 0.3)' }} options={{ backdrop: ['#0f172a', '#334155'] }} />
      </div>,
    )
    expect(label().textContent).toBe('#ffffff passes')
  })

  it('reads again when an ancestor switches theme', async () => {
    render(
      <div data-testid="theme" style={{ backgroundColor: '#ffffff' }}>
        <Label />
      </div>,
    )
    expect(label().textContent).toBe('#000000 passes')

    screen.getByTestId('theme').style.backgroundColor = '#111318'
    await settle()
    expect(label().textContent).toBe('#ffffff passes')
  })

  it('reads again when the options change', () => {
    const { rerender } = render(
      <div style={{ backgroundColor: '#808080' }}>
        <Label options={{ candidates: ['#000000'] }} />
      </div>,
    )
    expect(label().textContent).toBe('#000000 passes')

    rerender(
      <div style={{ backgroundColor: '#808080' }}>
        <Label options={{ candidates: ['#000000'], level: 'AAA' }} />
      </div>,
    )
    expect(label().textContent).toBe('#000000 fails')
  })

  it('judges text by the opacity it is drawn at', () => {
    const { rerender } = render(
      <div style={{ backgroundColor: '#ffffff' }}>
        <Label options={{ candidates: ['#000000'] }} />
      </div>,
    )
    expect(label().textContent).toBe('#000000 passes')

    rerender(
      <div style={{ backgroundColor: '#ffffff' }}>
        <Label options={{ candidates: ['#000000'], opacity: 0.3 }} />
      </div>,
    )
    expect(label().textContent).toBe('#000000 fails')
  })
})
