import { describe, it, expect } from 'vitest'
import { MainScene } from '../src/MainScene'

describe('MainScene basics', () => {
  it('exports a constructible Scene', () => {
    const scene = new MainScene()
    expect(scene).toBeInstanceOf(MainScene)
  })

  it('has expected defaults for iteration 2/3', () => {
    const scene: any = new MainScene()
    // Defaults are set in field initializers
    expect(scene.lives).toBe(3)
    expect(scene.spawnInterval).toBe(2000)
    expect(scene.score ?? 0).toBe(0)
    expect(typeof (scene as any).update).toBe('function')
    expect(typeof (scene as any).create).toBe('function')
  })

  it('exposes obstacle/collision related members (iteration 3 presence)', () => {
    const scene: any = new MainScene()
    // Methods exist (implementation exercised in runtime)
    expect(typeof scene.spawnObstacle).toBe('function')
    expect(typeof scene.checkCollisions).toBe('function')
  })
})

