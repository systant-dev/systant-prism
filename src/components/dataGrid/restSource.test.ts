import { describe, expect, it, vi } from 'vitest'
import { restSource } from './restSource'

/** A fetch that answers every request with `body` (JSON, or nothing) and `status`, and records what it was asked. */
function fakeFetch(body?: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status, statusText: 'Status' }),
  )
}

/** A fetch that answers every request with `text` as it stands. */
function rawFetch(text: string) {
  return vi.fn<typeof fetch>(async () => new Response(text, { status: 200 }))
}

function sent(send: ReturnType<typeof fakeFetch>, call = 0) {
  const [url, init] = send.mock.calls[call]
  return { url, method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined, init }
}

describe('restSource', () => {
  it('GETs the collection for its rows', async () => {
    const send = fakeFetch([{ id: 1 }])
    const rows = await restSource('/api/people/', { fetch: send }).read()

    expect(rows).toEqual([{ id: 1 }])
    expect(sent(send)).toMatchObject({ url: '/api/people', method: 'GET', body: undefined })
    expect(new Headers(sent(send).init?.headers).get('Accept')).toBe('application/json')
  })

  it('POSTs a new row as JSON and takes the row it gets back', async () => {
    const send = fakeFetch({ id: 7, name: 'Ada' })
    const made = await restSource('/api/people', { fetch: send }).create({ name: 'Ada' })

    expect(made).toEqual({ id: 7, name: 'Ada' })
    expect(sent(send)).toMatchObject({ url: '/api/people', method: 'POST', body: { name: 'Ada' } })
    expect(new Headers(sent(send).init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('PATCHes the changes to the row by its key, by default', async () => {
    const send = fakeFetch()
    const stored = await restSource('/api/people', { fetch: send }).update({ id: 'a/b', name: 'A', age: 1 }, { age: 2 })

    expect(stored).toEqual({ id: 'a/b', name: 'A', age: 2 })
    expect(sent(send)).toMatchObject({ url: '/api/people/a%2Fb', method: 'PATCH', body: { age: 2 } })
  })

  it('PUTs the whole row, keyed by the property asked for', async () => {
    const send = fakeFetch({ code: 'x', name: 'B', updated: true })
    const stored = await restSource('/api/people', { fetch: send, edit: 'put', key: 'code' }).update(
      { code: 'x', name: 'A' },
      { name: 'B' },
    )

    expect(stored).toEqual({ code: 'x', name: 'B', updated: true })
    expect(sent(send)).toMatchObject({ url: '/api/people/x', method: 'PUT', body: { code: 'x', name: 'B' } })
  })

  it('DELETEs the row by its key', async () => {
    const send = fakeFetch(undefined, 204)
    await restSource('/api/people', { fetch: send }).remove({ id: 3 })
    expect(sent(send)).toMatchObject({ url: '/api/people/3', method: 'DELETE' })
  })

  it('takes a change as made when the response to it is no row, leaving the row as sent', async () => {
    const row = { id: 3, name: 'A' }
    // Text that isn't JSON, then JSON that isn't a row: neither is spread into it.
    for (const answer of ['OK', '<!doctype html><p>Saved</p>', '"ok"', 'true', '[1, 2]', 'null']) {
      const source = restSource('/api/people', { fetch: rawFetch(answer) })
      expect(await source.update(row, { name: 'B' })).toEqual({ id: 3, name: 'B' })
      expect(await source.create({ name: 'C' })).toEqual({ name: 'C' })
      await expect(source.remove(row)).resolves.toBeUndefined()
    }
  })

  it("fails a read whose response isn't JSON, saying so", async () => {
    const source = restSource('/api/people', { fetch: rawFetch('<!doctype html><p>Sign in</p>') })
    await expect(source.read()).rejects.toThrow("GET /api/people didn't answer in JSON")
  })

  it('keeps the query of the URL it is given on every request, after the key', async () => {
    const send = fakeFetch(undefined, 204)
    const source = restSource('/api/people/?expand=orders#top', { fetch: send })
    await source.read()
    await source.remove({ id: 3 })
    expect(send.mock.calls.map(([url]) => url)).toEqual([
      '/api/people?expand=orders#top',
      '/api/people/3?expand=orders#top',
    ])
  })

  it('sends nothing for a row without its key', async () => {
    const send = fakeFetch()
    const source = restSource('/api/people', { fetch: send })
    await expect(source.remove({ name: 'Ada' })).rejects.toThrow('The row has no id to address it by.')
    await expect(source.update({ id: '' }, { name: 'A' })).rejects.toThrow('no id')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing for a row whose key a URL would read as a folder', async () => {
    // "/api/people/.." is "/api/" to a browser, and so is "/api/people/%2E%2E": a change
    // to a row so named, or its deletion, would go to something else altogether.
    expect(new URL('/api/people/..', 'https://example.test').pathname).toBe('/api/')
    expect(new URL('/api/people/%2E%2E', 'https://example.test').pathname).toBe('/api/')
    const send = fakeFetch()
    const source = restSource('/api/people', { fetch: send })
    for (const id of ['..', '.']) {
      await expect(source.remove({ id })).rejects.toThrow(`A row can't be addressed by a id of "${id}".`)
      await expect(source.update({ id }, { name: 'A' })).rejects.toThrow("can't be addressed")
    }
    expect(send).not.toHaveBeenCalled()
    // A key that only holds dots is a name like any other.
    await source.remove({ id: '...' })
    await source.remove({ id: 'a..b' })
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/people/...', '/api/people/a..b'])
  })

  it('sends the headers and options it is given, and throws on a failed response', async () => {
    const send = fakeFetch({ message: 'nope' }, 403)
    const source = restSource('/api/people', {
      fetch: send,
      init: { credentials: 'include', headers: { Authorization: 'Bearer t' } },
    })

    await expect(source.read()).rejects.toThrow('GET /api/people failed: 403 Status')
    expect(sent(send).init?.credentials).toBe('include')
    expect(new Headers(sent(send).init?.headers).get('Authorization')).toBe('Bearer t')
  })

  it('aborts on the signal of its options as well as the one a read is given', async () => {
    const send = fakeFetch([])
    const mine = new AbortController()
    const source = restSource('/api/people', { fetch: send, init: { signal: mine.signal } })
    const grids = new AbortController()
    await source.read(grids.signal)
    await source.remove({ id: 3 })

    const [onRead, onRemove] = [sent(send, 0).init?.signal, sent(send, 1).init?.signal]
    expect(onRemove).toBe(mine.signal)
    expect(onRead?.aborted).toBe(false)
    grids.abort()
    expect(onRead?.aborted).toBe(true)

    const second = new AbortController()
    await source.read(second.signal)
    mine.abort()
    expect(sent(send, 2).init?.signal?.aborted).toBe(true)
  })
})
