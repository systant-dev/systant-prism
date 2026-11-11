import { describe, expect, it } from 'vitest'
import { compactStyles } from '../vite.css'

const sheet = (text: string) => `// A comment of the module's, \`kept\`.\nexport const styles = \`${text}\`\n`

/**
 * CSS as a browser reads it: a comment is as good as a space, and so is any run of spaces,
 * and there is no need of any at either end of a stylesheet.
 */
function read(code: string) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ `/g, '`')
    .replace(/` /g, '`')
    .trim()
}

describe('compactStyles', () => {
  it('takes out comments, indents and blank lines', () => {
    const code = sheet('\n/* A comment. */\n.a {\n\n  color: red; /* Said after it. */\n  /* Alone. */\n}\n')
    expect(compactStyles(code)).toBe(sheet('.a {\ncolor: red;\n}\n'))
  })

  it('leaves a space where a comment parted two words', () => {
    expect(compactStyles(sheet('a/* x */b'))).toBe(sheet('a b'))
  })

  it('leaves code outside a stylesheet alone, a backtick in a comment included', () => {
    const code = "// `a` b\n/* `c` */\nconst d = '`'\n"
    expect(compactStyles(code)).toBe(code)
  })

  it('leaves a string as it is, comment and all', () => {
    expect(compactStyles(sheet("  content: '/* not */';"))).toBe(sheet("content: '/* not */';"))
  })

  it('leaves expressions as they are, nested templates and all', () => {
    const code = sheet('\n  ${list.map((n) => `  /* ${n} */`).join(",\\n  ")}\n  /* Gone. */\n')
    expect(compactStyles(code)).toBe(sheet('${list.map((n) => `  /* ${n} */`).join(",\\n  ")}\n'))
  })

  it('does every stylesheet of a module', () => {
    const code = `${sheet('  /* One. */\n  a\n')}${sheet('  /* Two. */\n  b\n')}`
    expect(compactStyles(code)).toBe(`${sheet('a\n')}${sheet('b\n')}`)
  })

  const modules = import.meta.glob<string>('../src/**/*.styles.ts', { query: '?raw', import: 'default', eager: true })

  it.each(Object.keys(modules))('leaves %s reading the same', (path) => {
    const code = modules[path]
    const compacted = compactStyles(code)
    expect(compacted.length).toBeLessThan(code.length)
    expect(read(compacted)).toBe(read(code))
  })
})
