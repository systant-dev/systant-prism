import { act, cleanup } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VerticalSelector } from '../vertical'
import { navigatedTo } from '../../../../test/dom'

const items = [{ value: 'a', label: 'A' }]
const selector = <VerticalSelector items={items} value="a" />

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('useEntrance', () => {
  it("hydrates as the server rendered it, as the page loads, with the pill the server's HTML has shown", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const host = document.createElement('div')
    host.innerHTML = renderToString(selector)
    document.body.append(host)
    // Loading, in a browser: the server has no navigation to go by
    navigatedTo()
    vi.spyOn(performance, 'now').mockReturnValue(100)

    const onRecoverableError = vi.fn<(error: unknown) => void>()
    let root: ReturnType<typeof hydrateRoot>
    await act(async () => {
      root = hydrateRoot(host, selector, { onRecoverableError })
    })

    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(host.querySelector('.prism-vertical-selector--waiting')).toBeNull()
    act(() => root.unmount())
  })
})
