// Shaders are written with comments, and a lot of them, in template literals marked
// `/* wgsl */`. To a bundler those are only strings, so the minifiers of everyone who
// uses this library leave every word of them in their pages, for a browser to download
// and for a GPU driver to read past. This takes them out of what is built, along with
// each line's indent and the blank lines, and leaves the source as it is.
import type { Plugin } from 'vite'

const MARK = '/* wgsl */ `'

/** Where the expression that opens just before `start` ends: the index of its closing brace. */
export function endOfExpression(code: string, start: number) {
  let depth = 1
  for (let i = start; i < code.length; i++) {
    const c = code[i]
    if (c === "'" || c === '"') {
      for (i++; code[i] !== c; i++) if (code[i] === '\\') i++
    } else if (c === '`') {
      i = endOfTemplate(code, i + 1)
    } else if (c === '{') {
      depth++
    } else if (c === '}' && --depth === 0) {
      return i
    }
  }
  throw new Error('An expression in a shader is never closed')
}

/** The index of the backtick that closes the template whose text begins at `start`. */
export function endOfTemplate(code: string, start: number) {
  for (let i = start; i < code.length; i++) {
    if (code[i] === '\\') i++
    else if (code[i] === '`') return i
    else if (code[i] === '$' && code[i + 1] === '{') i = endOfExpression(code, i + 2)
  }
  throw new Error('A shader is never closed')
}

/** Text of a shader's template, with what the GPU doesn't need left out. */
function compactTemplate(template: string) {
  let out = ''
  let i = 0
  let inComment = false
  let lineStart = true
  while (i < template.length) {
    if (template[i] === '$' && template[i + 1] === '{') {
      const end = endOfExpression(template, i + 2)
      // An expression in a comment goes with it.
      if (!inComment) {
        out += template.slice(i, end + 1)
        lineStart = false
      }
      i = end + 1
    } else if (template[i] === '\n' || template[i] === '\r') {
      inComment = false
      if (!lineStart) out = `${out.trimEnd()}\n`
      lineStart = true
      i++
    } else if (inComment || (lineStart && (template[i] === ' ' || template[i] === '\t'))) {
      i++
    } else if (template[i] === '/' && template[i + 1] === '/') {
      inComment = true
    } else {
      out += template[i]
      lineStart = false
      i++
    }
  }
  return out
}

/** A module with what the GPU doesn't need left out of each of its shaders. */
export function compactShaders(code: string) {
  let out = ''
  let from = 0
  for (let at = code.indexOf(MARK); at >= 0; at = code.indexOf(MARK, from)) {
    const start = at + MARK.length
    const end = endOfTemplate(code, start)
    out += code.slice(from, start) + compactTemplate(code.slice(start, end))
    from = end
  }
  return out + code.slice(from)
}

/** Leaves the comments of shaders out of a build. */
export function compactWgsl(): Plugin {
  return {
    name: 'prism:compact-wgsl',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      if (!id.endsWith('.ts') || !code.includes(MARK)) return null
      return { code: compactShaders(code), map: null }
    },
  }
}
