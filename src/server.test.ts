/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { isNightAt, samplePicture } from './server'

/** Every module's source, by its path from here. */
const sources = import.meta.glob<string>(['./**/*.ts', './**/*.tsx', '!./**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** What a module imports at run time: type-only imports are left out, as they leave nothing behind. */
function importsOf(code: string) {
  const statements = /^(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm
  return [...code.matchAll(statements)].filter(([, typeOnly]) => !typeOnly).map(([, , specifier]) => specifier)
}

/** `specifier` from the module at `from`, both as paths from here. */
function resolve(from: string, specifier: string) {
  const parts = from.split('/').slice(0, -1)
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  const base = parts.join('/')
  const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((path) => path in sources)
  if (!found) throw new Error(`can't find ${specifier} from ${from}`)
  return found
}

/** Every module `entry` reaches at run time, and every package any of them imports, with who imports it. */
function reach(entry: string) {
  const modules = new Set<string>()
  const packages = new Map<string, string>()
  const visit = (path: string) => {
    if (modules.has(path)) return
    modules.add(path)
    for (const specifier of importsOf(sources[path])) {
      if (specifier.startsWith('.')) visit(resolve(path, specifier))
      else packages.set(specifier, path)
    }
  }
  visit(entry)
  return { modules: [...modules], packages }
}

describe('@systant/prism/server', () => {
  const { modules, packages } = reach('./server.ts')

  it('follows what it imports', () => {
    expect(modules).toContain('./components/backdrop/sampler.ts')
    expect(modules).toContain('./contrast/color.ts')
  })

  // A React Server Component can't import React's hooks, nor anything else meant for a browser.
  it('imports no package, React included', () => {
    expect(Object.fromEntries(packages)).toEqual({})
  })

  it('reaches no component, hook or index that would take them in', () => {
    expect(modules.filter((path) => path.endsWith('.tsx') || path.endsWith('/index.ts'))).toEqual([])
  })

  it('says whether a scene shows night at a place', () => {
    const edinburgh = { latitude: 55.95, longitude: -3.19 }
    expect(isNightAt(edinburgh, new Date('2026-12-21T12:00:00Z'))).toBe(false)
    expect(isNightAt(edinburgh, new Date('2026-12-21T18:00:00Z'))).toBe(true)
    expect(isNightAt({ latitude: -33.87, longitude: 151.21 }, new Date('2026-12-21T12:00:00Z'))).toBe(true)
  })

  it('reads the colours of a picture', () => {
    const data = new Uint8Array([200, 100, 40, 200, 100, 40])
    expect(samplePicture({ data, width: 2, height: 1 })).toEqual({
      tones: ['#c86428', '#c86428', '#c86428'],
      range: ['#c86428', '#c86428'],
      dominant: '#c86428',
    })
  })
})
