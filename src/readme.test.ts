/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'

/** A file's text, by its path from here. */
const texts = import.meta.glob<string>(['../README.md', '../docs/*.md', './index.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const README = '../README.md'
const index = texts['./index.ts']
/** The README and the pages under docs, by path. */
const pages = Object.entries(texts).filter(([path]) => path.endsWith('.md'))

/** A heading as the anchor a link to it is written with. */
function anchorOf(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** The anchors of a page's headings. */
function anchorsOf(text: string) {
  const headings = text.split('\n').filter((line) => /^#+ /.test(line))
  return new Set(headings.map((line) => anchorOf(line.replace(/^#+ /, ''))))
}

/** The links a page makes to itself and to other pages, leaving out those to other sites. */
function linksOf(text: string) {
  return [...text.matchAll(/\]\(([^)]+)\)/g)].map(([, link]) => link).filter((link) => !/^[a-z]+:/i.test(link))
}

/** The path a link from one page leads to, written as the pages' own paths are. */
function resolve(from: string, to: string) {
  const parts = from.split('/').slice(0, -1)
  for (const part of to.split('/')) {
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  return parts.join('/')
}

describe('README and docs', () => {
  it('link only to pages and sections that exist', () => {
    const anchors = new Map(pages.map(([path, text]) => [path, anchorsOf(text)]))
    const broken = pages.flatMap(([path, text]) =>
      linksOf(text).filter((link) => {
        const [file, anchor] = link.split('#')
        const target = file ? resolve(path, file) : path
        return !anchors.has(target) || (anchor !== undefined && !anchors.get(target)!.has(anchor))
      }),
    )
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flatMap(([, text]) => linksOf(text)).length).toBeGreaterThan(0)
    expect(broken).toEqual([])
  })

  it('reach every page under docs from the README', () => {
    const linked = new Set(linksOf(texts[README]).map((link) => resolve(README, link.split('#')[0])))
    expect(pages.map(([path]) => path).filter((path) => path !== README && !linked.has(path))).toEqual([])
  })

  it('say something of every component, hook and function the package exports', () => {
    // Types aside: they are named by the props and options the sections describe.
    const names = [...index.matchAll(/^export (?!type\b)\{([^}]+)\}/gm)]
      .flatMap(([, list]) => list.split(','))
      .map((name) => name.trim())
      .filter((name) => name && !name.startsWith('type '))
    const all = pages.map(([, text]) => text).join('\n')
    expect(names.length).toBeGreaterThan(30)
    expect(names.filter((name) => !new RegExp(`\\b${name}\\b`).test(all))).toEqual([])
  })
})
