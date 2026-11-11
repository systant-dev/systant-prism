import { describe, expect, it } from 'vitest'
import { compactShaders } from '../vite.wgsl'

const shader = (text: string) => `const a = /* wgsl */ \`${text}\`\nconst b = 1 // kept\n`

describe('compactShaders', () => {
  it('takes out comments, indents and blank lines', () => {
    const code = shader('\n// A comment.\nfn main() {\n\n  let x = 1.0; // Said after it.\n  // Alone.\n  return;\n}\n')
    expect(compactShaders(code)).toBe(shader('fn main() {\nlet x = 1.0;\nreturn;\n}\n'))
  })

  it('leaves code outside a shader alone', () => {
    const code = '  const a = 1 // kept\n\n  const b = `  // kept too`\n'
    expect(compactShaders(code)).toBe(code)
  })

  it('leaves expressions as they are, nested templates and all', () => {
    const code = shader('const A = ${list.map((n) => `vec2f(${n}) // kept`).join(",\\n  ")};\n  // Gone.\n')
    expect(compactShaders(code)).toBe(shader('const A = ${list.map((n) => `vec2f(${n}) // kept`).join(",\\n  ")};\n'))
  })

  it('keeps an expression that opens a line, without its indent', () => {
    expect(compactShaders(shader('\n  ${stages}\n  ok\n'))).toBe(shader('${stages}\nok\n'))
  })

  it('takes out an expression in a comment along with it', () => {
    expect(compactShaders(shader('a\n// About ${1 / 2} of it.\nb\n'))).toBe(shader('a\nb\n'))
  })

  it('reads a closing brace in a string as a string', () => {
    const code = shader('${"}"} // Gone.\nb\n')
    expect(compactShaders(code)).toBe(shader('${"}"}\nb\n'))
  })

  it('does every shader of a module', () => {
    const code = `${shader('  // One.\n  a\n')}${shader('  // Two.\n  b\n')}`
    expect(compactShaders(code)).toBe(`${shader('a\n')}${shader('b\n')}`)
  })
})
