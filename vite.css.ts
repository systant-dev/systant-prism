// Stylesheets are written with comments, and a lot of them, in the template literals of
// the *.styles.ts modules. As with shaders (vite.wgsl.ts), those are only strings to a
// bundler, so every page that uses this library would download every word of them.
// This takes them out of what is built, along with each line's indent and the blank
// lines, and leaves the source as it is.
import type { Plugin } from 'vite'
import { endOfExpression, endOfTemplate } from './vite.wgsl.ts'

const SPACE = /\s/

/** Text of a stylesheet's template, with what the browser doesn't need left out. */
function compactTemplate(template: string) {
  let out = ''
  let lineStart = true
  let i = 0
  const keep = (text: string) => {
    out += text
    lineStart = false
  }
  while (i < template.length) {
    const c = template[i]
    if (c === '$' && template[i + 1] === '{') {
      const end = endOfExpression(template, i + 2)
      keep(template.slice(i, end + 1))
      i = end + 1
    } else if (c === '\\') {
      keep(template.slice(i, i + 2))
      i += 2
    } else if (c === '\n' || c === '\r') {
      if (!lineStart) out = `${out.trimEnd()}\n`
      lineStart = true
      i++
    } else if (lineStart && (c === ' ' || c === '\t')) {
      i++
    } else if (c === '/' && template[i + 1] === '*') {
      const close = template.indexOf('*/', i + 2)
      if (close < 0) throw new Error('A comment in a stylesheet is never closed')
      i = close + 2
      // A comment parts what is either side of it, as a space would.
      const before = out.at(-1)
      const after = template[i]
      if (!lineStart && before && after && !SPACE.test(before) && !SPACE.test(after)) out += ' '
    } else if (c === "'" || c === '"') {
      // Whatever a string holds, a /* included, stays as it is.
      let end = i + 1
      while (end < template.length && template[end] !== c) {
        if (template[end] === '\\') end++
        else if (template[end] === '$' && template[end + 1] === '{') end = endOfExpression(template, end + 2)
        end++
      }
      keep(template.slice(i, end + 1))
      i = end + 1
    } else {
      keep(c)
      i++
    }
  }
  return out
}

/** A module with what the browser doesn't need left out of each of its templates, which are all CSS. */
export function compactStyles(code: string) {
  let out = ''
  let from = 0
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      if (end < 0) break
      i = end
    } else if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      if (end < 0) break
      i = end + 1
    } else if (c === "'" || c === '"') {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++
    } else if (c === '`') {
      const end = endOfTemplate(code, i + 1)
      out += code.slice(from, i + 1) + compactTemplate(code.slice(i + 1, end))
      from = end
      i = end
    }
  }
  return out + code.slice(from)
}

/** Leaves the comments of stylesheets out of a build. */
export function compactCss(): Plugin {
  return {
    name: 'prism:compact-css',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      if (!/\.styles\.ts$/.test(id.split('?')[0])) return null
      return { code: compactStyles(code), map: null }
    },
  }
}
