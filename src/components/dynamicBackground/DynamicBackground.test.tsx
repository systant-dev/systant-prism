import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createForestScene,
  createOceanScene,
  forestScene,
  GlassBackdrop,
  oceanScene,
  type SceneFactory,
} from '../backdrop'
import { DynamicBackground } from './DynamicBackground'
import { PAGE_IMAGES, PICTURES } from './pictures'

// What it hands the GlassBackdrop is all it does; the backdrop has tests of its own.
vi.mock('../backdrop', () => {
  const scene = (name: string) => Object.assign((() => {}) as unknown as SceneFactory, { sceneName: name })
  return {
    GlassBackdrop: vi.fn<typeof GlassBackdrop>(({ children }) => <>{children}</>),
    forestScene: scene('forest'),
    oceanScene: scene('ocean'),
    createForestScene: vi.fn<typeof createForestScene>(() => scene('placed forest')),
    createOceanScene: vi.fn<typeof createOceanScene>(() => scene('placed ocean')),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** The props the GlassBackdrop was last given. */
function given() {
  return vi.mocked(GlassBackdrop).mock.lastCall![0]
}

describe('DynamicBackground', () => {
  it('shows the ocean by default, with its pictures and their colours', () => {
    render(<DynamicBackground />)
    const props = given()
    expect(props.scene).toBe(oceanScene)
    expect(props.src).toMatch(/\/pictures\/ocean\.webp$/)
    expect(props.nightSrc).toMatch(/\/pictures\/ocean-night\.webp$/)
    expect(props.pageImage).toBe(PAGE_IMAGES.ocean.day)
    expect(props.nightPageImage).toBe(PAGE_IMAGES.ocean.night)
  })

  it('shows the forest, with its own pictures', () => {
    render(<DynamicBackground scene="forest" />)
    const props = given()
    expect(props.scene).toBe(forestScene)
    expect(props.src).toMatch(/\/pictures\/forest\.webp$/)
    expect(props.nightSrc).toMatch(/\/pictures\/forest-night\.webp$/)
    expect(props.pageImage).toBe(PAGE_IMAGES.forest.day)
  })

  it('leaves animation to prefers-reduced-motion unless told', () => {
    const { rerender } = render(<DynamicBackground />)
    expect(given().still).toBeUndefined()
    rerender(<DynamicBackground animated={false} />)
    expect(given().still).toBe(true)
    rerender(<DynamicBackground animated />)
    expect(given().still).toBe(false)
  })

  it('follows the local time unless given one', () => {
    const { rerender } = render(<DynamicBackground />)
    expect(given().sceneTime).toBeUndefined()
    rerender(<DynamicBackground time={null} />)
    expect(given().sceneTime).toBeUndefined()

    const moment = new Date(2026, 5, 21, 18, 30)
    rerender(<DynamicBackground time={moment} />)
    expect(given().sceneTime).toBe(moment)
  })

  it('takes minutes past midnight as today, by the local clock', () => {
    render(<DynamicBackground time={21 * 60 + 35} />)
    const shown = given().sceneTime!
    const today = new Date()
    expect([shown.getFullYear(), shown.getMonth(), shown.getDate()]).toEqual([
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ])
    expect([shown.getHours(), shown.getMinutes(), shown.getSeconds()]).toEqual([21, 35, 0])
  })

  it('makes a scene for a place once, however often it is shown', () => {
    const { rerender, unmount } = render(<DynamicBackground scene="forest" latitude={55.95} longitude={-3.19} />)
    const placed = given().scene
    expect(createForestScene).toHaveBeenCalledWith({ latitude: 55.95, longitude: -3.19 })
    rerender(<DynamicBackground scene="forest" latitude={55.95} longitude={-3.19} rain />)
    unmount()
    render(<DynamicBackground scene="forest" latitude={55.95} longitude={-3.19} />)
    expect(given().scene).toBe(placed)
    expect(createForestScene).toHaveBeenCalledTimes(1)

    render(<DynamicBackground scene="ocean" latitude={55.95} longitude={-3.19} />)
    expect(createOceanScene).toHaveBeenCalledWith({ latitude: 55.95, longitude: -3.19 })
  })

  it('keeps the scenes of the last few places only, and one that is showing whatever comes and goes', () => {
    const at = (place: number) => <DynamicBackground latitude={60 + place} longitude={10} />
    const { rerender } = render(at(0))
    const first = given().scene
    for (let place = 1; place <= 8; place++) rerender(at(place))
    expect(createOceanScene).toHaveBeenCalledTimes(9)

    // The last eight are kept: the one before this is still there.
    rerender(at(7))
    expect(createOceanScene).toHaveBeenCalledTimes(9)
    // The first has gone, and is made again.
    rerender(at(0))
    expect(createOceanScene).toHaveBeenCalledTimes(10)
    expect(given().scene).not.toBe(first)

    // One on show keeps its scene from render to render, though enough others have come since to let it go.
    const showing = given().scene
    for (let place = 20; place < 30; place++) render(at(place))
    rerender(at(0))
    expect(given().scene).toBe(showing)
  })

  it('goes by the time zone when only half a place is given', () => {
    render(<DynamicBackground latitude={10} />)
    expect(given().scene).toBe(oceanScene)
    expect(createOceanScene).not.toHaveBeenCalled()
  })

  it("shows pictures of the page's own in place of its own, without their colours", () => {
    render(<DynamicBackground src="/day.webp" nightSrc="/night.webp" />)
    const props = given()
    expect(props.src).toBe('/day.webp')
    expect(props.nightSrc).toBe('/night.webp')
    expect(props.pageImage).toBeUndefined()
    expect(props.nightPageImage).toBeUndefined()
  })

  it('asks for none of its own pictures on a server, and for them once the page has hydrated', () => {
    const asked = [
      vi.spyOn(PICTURES.ocean, 'day'),
      vi.spyOn(PICTURES.ocean, 'night'),
      vi.spyOn(PICTURES.forest, 'day'),
      vi.spyOn(PICTURES.forest, 'night'),
    ]
    const html = renderToString(<DynamicBackground />)
    // Where they are is a folder on the server's disk, which its markup would tell every reader.
    for (const picture of asked) expect(picture).not.toHaveBeenCalled()
    expect(given().src).toBeUndefined()
    expect(given().nightSrc).toBeUndefined()
    // Their colours are no address, and still go on from the first.
    expect(given().pageImage).toBe(PAGE_IMAGES.ocean.day)

    const container = document.body.appendChild(document.createElement('div'))
    container.innerHTML = html
    render(<DynamicBackground />, { container, hydrate: true })
    expect(given().src).toMatch(/\/pictures\/ocean\.webp$/)
    expect(given().nightSrc).toMatch(/\/pictures\/ocean-night\.webp$/)
    for (const picture of asked) picture.mockRestore()
  })

  it("gives a server the page's own pictures, which are the page's to put in its markup", () => {
    renderToString(<DynamicBackground src="/day.webp" nightSrc="/night.webp" />)
    expect(given().src).toBe('/day.webp')
    expect(given().nightSrc).toBe('/night.webp')
  })

  it('passes everything else on to the GlassBackdrop', () => {
    const { getByText } = render(
      <DynamicBackground rain waitForScene={false} className="page" style={{ inset: 0 }}>
        <p>Hello</p>
      </DynamicBackground>,
    )
    expect(getByText('Hello')).toBeTruthy()
    expect(given()).toMatchObject({ rain: true, waitForScene: false, className: 'page', style: { inset: 0 } })
  })
})
