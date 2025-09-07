import { describe, it, expect } from 'vitest'
import config from '../vite.config'

describe('Vite config', () => {
  it('uses /game/ as base', () => {
    expect((config as any).base).toBe('/game/')
  })

  it('outputs to server wwwroot/game', () => {
    const outDir = (config as any).build?.outDir
    expect(outDir).toMatch(/KnutGame\.Server\/wwwroot\/game$/)
  })
})

