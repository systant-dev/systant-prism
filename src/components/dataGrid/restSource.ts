import { held } from './held'
import type { DataGridSource, Row } from './types'

export interface RestSourceOptions {
  /** The property that identifies a row, appended to the URL to address it. */
  key?: string
  /** How an edit is sent: a PATCH of the changed properties, or a PUT of the whole row. */
  edit?: 'patch' | 'put'
  /** Added to every request: headers, credentials and the like. */
  init?: RequestInit
  /** The fetch to send requests with, for one that adds auth, say. */
  fetch?: typeof fetch
}

/**
 * A source for a REST collection at `url`: GET `url` for its rows, POST `url`
 * to add one, PATCH or PUT `url/{key}` to change one and DELETE `url/{key}` to
 * delete one, all as JSON, keeping any query `url` has. A row sent back in a
 * response is taken as stored; an empty response, or one that isn't a row (a
 * plain "OK", `true`), leaves the row as sent. A row without its key can't be
 * changed or deleted, nor one whose key is `.` or `..`, which a URL reads as a
 * folder: the request fails before it is sent.
 */
export function restSource<R extends Row = Row>(
  url: string,
  { key = 'id', edit = 'patch', init, fetch: send = (input, options) => fetch(input, options) }: RestSourceOptions = {},
): Required<DataGridSource<R>> {
  // The path, and any query or fragment, which every request keeps: `/api/people?expand=orders`
  // addresses a row as `/api/people/3?expand=orders`.
  const split = url.search(/[?#]/)
  const path = (split < 0 ? url : url.slice(0, split)).replace(/\/+$/, '')
  const query = split < 0 ? '' : url.slice(split)
  const collection = path + query
  const itemUrl = (row: R) => {
    const id = held(row, key)
    // Rather than send a change to `/api/people/undefined`.
    if (id == null || id === '') throw new Error(`The row has no ${key} to address it by.`)
    const name = String(id)
    // To a URL these mean "here" and "the folder above", encoded or not: a change to a row
    // so named, or its deletion, would go to the collection itself or to whatever lies
    // above it. A row's key is whatever the server, or someone who added the row, says it is.
    if (name === '.' || name === '..') throw new Error(`A row can't be addressed by a ${key} of "${name}".`)
    return `${path}/${encodeURIComponent(name)}${query}`
  }

  async function request<T>(method: string, target: string, body?: unknown, signal?: AbortSignal) {
    const headers = new Headers(init?.headers)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    if (body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    const response = await send(target, {
      ...init,
      method,
      headers,
      // The grid's, as it stops reading, and any `init` has: either aborts it.
      signal: signal && init?.signal ? AbortSignal.any([init.signal, signal]) : (signal ?? init?.signal),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`${method} ${target} failed: ${response.status} ${response.statusText}`.trim())
    const text = await response.text()
    if (!text) return undefined
    try {
      return JSON.parse(text) as T
    } catch {
      // A change has gone through by now, whatever the server said of it ("OK", a page):
      // to throw would report as failed what was saved. Rows that can't be read have failed.
      if (method !== 'GET') return undefined
      throw new Error(`${method} ${target} didn't answer in JSON`)
    }
  }

  /** The row a change's response sent back, if it sent one: not `true`, "ok" or a list, which would spread into it. */
  const sentBack = (answer: unknown) =>
    typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? (answer as Partial<R>) : undefined

  return {
    read: async (signal) => (await request<R[]>('GET', collection, undefined, signal)) ?? [],
    create: async (row) => ({ ...row, ...sentBack(await request('POST', collection, row)) }) as R,
    update: async (row, changes) => {
      const stored = { ...row, ...changes }
      const body = edit === 'put' ? stored : changes
      return { ...stored, ...sentBack(await request(edit.toUpperCase(), itemUrl(row), body)) }
    },
    remove: async (row) => {
      await request('DELETE', itemUrl(row))
    },
  }
}
