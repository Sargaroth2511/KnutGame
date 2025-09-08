import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Vite config', () => {
  it('uses /game/ as base', () => {
    const configContent = readFileSync(join(__dirname, '../vite.config.ts'), 'utf-8')
    expect(configContent).toContain("base: '/game/'")
  })

  it('outputs to server wwwroot/game', () => {
    const configContent = readFileSync(join(__dirname, '../vite.config.ts'), 'utf-8')
    expect(configContent).toContain("outDir: '../KnutGame.Server/wwwroot/game'")
  })
})

