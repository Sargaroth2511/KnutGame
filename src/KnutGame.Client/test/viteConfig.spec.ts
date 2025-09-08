import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import vm from 'node:vm'

function loadViteConfigObject(): any {
  const file = join(process.cwd(), 'vite.config.ts')
  const src = readFileSync(file, 'utf-8')
  const idx = src.indexOf('defineConfig(')
  if (idx < 0) throw new Error('defineConfig(' + ' not found')
  // Find the object literal that starts after the first '{' following defineConfig(
  const startBrace = src.indexOf('{', idx)
  if (startBrace < 0) throw new Error('config object start not found')
  let i = startBrace
  let depth = 0
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { i++; break }
    }
  }
  if (depth !== 0) throw new Error('unbalanced braces in vite.config.ts')
  const objLiteral = src.slice(startBrace, i)
  const code = 'module = { exports: {} }; module.exports = ' + objLiteral
  const context = vm.createContext({ module: { exports: {} } })
  vm.runInContext(code, context, { timeout: 1000 })
  return (context as any).module.exports
}

describe('Vite config', () => {
  const config = loadViteConfigObject()

  it('uses /game/ as base', () => {
    expect(config.base).toBe('/game/')
  })

  it('outputs to server wwwroot/game', () => {
    expect(config.build?.outDir).toBe('../KnutGame.Server/wwwroot/game')
  })
})
