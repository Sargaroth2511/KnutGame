import { describe, it, expect } from 'vitest'
import { ParticlePool } from '../src/systems/ParticlePool'
import { MAX_PARTICLES } from '../src/gameConfig'

type TweenConfig = { onComplete?: () => void }

function makeFakeScene() {
  const tweens: TweenConfig[] = []
  const calls = { add: 0 }

  const fakeRect = () => ({
    x: 0, y: 0,
    setActive: () => fakeRectInst,
    setVisible: () => fakeRectInst,
    setPosition: () => fakeRectInst,
    setSize: () => fakeRectInst,
    setAlpha: () => fakeRectInst,
    setDepth: () => fakeRectInst,
    setFillStyle: () => fakeRectInst,
    destroy: () => { /* no-op */ },
  })
  const fakeEllipse = () => ({
    x: 0, y: 0,
    setActive: () => fakeEllipseInst,
    setVisible: () => fakeEllipseInst,
    setPosition: () => fakeEllipseInst,
    setSize: () => fakeEllipseInst,
    setAlpha: () => fakeEllipseInst,
    setDepth: () => fakeEllipseInst,
    setFillStyle: () => fakeEllipseInst,
    destroy: () => { /* no-op */ },
  })
  const fakeRectInst = fakeRect()
  const fakeEllipseInst = fakeEllipse()

  const scene: any = {
    add: {
      rectangle: () => ({ ...fakeRectInst }),
      ellipse: () => ({ ...fakeEllipseInst }),
    },
    tweens: {
      add: (cfg: TweenConfig) => { calls.add++; tweens.push(cfg); return {}; },
    },
  }
  return { scene, tweens, calls }
}

describe('ParticlePool capping', () => {
  it('does not spawn more than MAX_PARTICLES rectangles', () => {
    const { scene, tweens, calls } = makeFakeScene()
    const pool = new ParticlePool(scene as any)
    const N = MAX_PARTICLES
    for (let i = 0; i < N * 2; i++) {
      pool.spawnRect({ x: 0, y: 0 })
    }
    expect(calls.add).toBe(N)

    // Release half, then ensure only that capacity can be spawned again
    for (let i = 0; i < Math.floor(N / 2); i++) tweens[i].onComplete?.()
    for (let i = 0; i < N; i++) pool.spawnRect({ x: 1, y: 1 })
    expect(calls.add).toBe(N + Math.floor(N / 2))
  })

  it('does not spawn more than MAX_PARTICLES ellipses', () => {
    const { scene, tweens, calls } = makeFakeScene()
    const pool = new ParticlePool(scene as any)
    const N = MAX_PARTICLES
    for (let i = 0; i < N * 2; i++) {
      pool.spawnEllipse({ x: 0, y: 0 })
    }
    expect(calls.add).toBe(N)

    // Release all, then can spawn full capacity again
    for (const t of tweens) t.onComplete?.()
    for (let i = 0; i < N; i++) pool.spawnEllipse({ x: 2, y: 2 })
    expect(calls.add).toBe(N + N)
  })
})

describe('ParticlePool spawn/destroy behavior', () => {
  it('caps mixed particle types at MAX_PARTICLES and resumes when freed', () => {
    const { scene, tweens, calls } = makeFakeScene()
    const pool = new ParticlePool(scene as any)
    const N = MAX_PARTICLES
    // Fill to capacity with rectangles
    for (let i = 0; i < N; i++) pool.spawnRect({ x: 0, y: 0 })
    expect(pool.getActiveCount()).toBe(N)
    const before = calls.add
    // Further spawns (ellipses) are ignored
    for (let i = 0; i < 10; i++) pool.spawnEllipse({ x: 1, y: 1 })
    expect(calls.add).toBe(before)
    expect(pool.getActiveCount()).toBe(N)

    // Free some via tween completion
    tweens[0].onComplete?.();
    tweens[1].onComplete?.();
    tweens[2].onComplete?.();
    expect(pool.getActiveCount()).toBe(N - 3)

    // Only freed capacity is allowed to spawn
    for (let i = 0; i < 10; i++) pool.spawnEllipse({ x: 2, y: 2 })
    expect(pool.getActiveCount()).toBe(N)
  })

  it('destroy() resets counts and ignores late completes without going negative', () => {
    const { scene, tweens } = makeFakeScene()
    const pool = new ParticlePool(scene as any)
    for (let i = 0; i < 5; i++) pool.spawnRect({ x: i, y: i })
    expect(pool.getActiveCount()).toBe(5)
    pool.destroy()
    expect(pool.getActiveCount()).toBe(0)
    // Old tween completions should not reduce below zero
    for (const t of tweens) t.onComplete?.()
    expect(pool.getActiveCount()).toBe(0)
  })

  it('register()ed extras are destroyed on destroy()', () => {
    const { scene } = makeFakeScene()
    let destroyed = 0
    const extra: any = { destroy: () => { destroyed++ } }
    const pool = new ParticlePool(scene as any)
    pool.register(extra)
    expect(destroyed).toBe(0)
    pool.destroy()
    expect(destroyed).toBe(1)
  })
})
