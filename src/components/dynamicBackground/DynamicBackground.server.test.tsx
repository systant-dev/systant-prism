import { act, cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DynamicBackground } from './DynamicBackground'
import { PICTURES } from './pictures'

// The whole of it, GlassBackdrop and all, as a server renders it: what is in the markup
// is what every reader is sent. DynamicBackground.test.tsx says what it hands on.

/** Anything that says where a file is: an address in a style, a picture's name, a place on a disk. */
const ADDRESS = /url\(|\.webp|file:|[a-z]:[\\/]|node_modules|\/src\/|\/dist\//i

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
})

describe('DynamicBackground in a server’s markup', () => {
  it('says nothing of where its own pictures are, by day or by night', () => {
    for (const scene of ['ocean', 'forest'] as const) {
      for (const initialNight of [false, true]) {
        for (const waitForScene of [true, false]) {
          const html = renderToString(
            <DynamicBackground scene={scene} initialNight={initialNight} waitForScene={waitForScene}>
              <p>Hello</p>
            </DynamicBackground>,
          )
          expect(html).toContain('Hello')
          expect(html).not.toMatch(ADDRESS)
        }
      }
    }
  })

  it('would say it, were it to ask: where they are is where this code is', () => {
    // What the check above is for: here that is this repository's folder, and on a server its own.
    expect(PICTURES.forest.day()).toMatch(ADDRESS)
  })

  it('puts its picture on as the page hydrates, with nothing for React to find amiss', async () => {
    // jsdom decodes no pictures: one that won't load stays the CSS background, which is what is looked at.
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.reject(new Error('No pictures in jsdom')),
    })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const page = <DynamicBackground data-testid="backdrop" waitForScene={false} />
    const container = document.body.appendChild(document.createElement('div'))
    container.innerHTML = renderToString(page)
    expect(container.innerHTML).not.toMatch(ADDRESS)

    const { getByTestId } = render(page, { container, hydrate: true })
    // No WebGPU here, so the picture is all there is to show, and stays: the day's or the night's, by the clock.
    await act(async () => {})
    expect(getByTestId('backdrop').style.backgroundImage).toMatch(/^url\(".*\/pictures\/ocean(-night)?\.webp"\)$/)
    expect(errors).not.toHaveBeenCalled()
  })

  it("holds the page's own pictures, which are the page's to send", () => {
    const pictures = { src: '/pictures/own.webp', nightSrc: '/pictures/own-night.webp' }
    expect(renderToString(<DynamicBackground {...pictures} />)).toContain('url(&quot;/pictures/own.webp&quot;)')
    expect(renderToString(<DynamicBackground {...pictures} initialNight />)).toContain(
      'url(&quot;/pictures/own-night.webp&quot;)',
    )
  })
})
