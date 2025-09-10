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
    setDepth: () => fakeRectInst,
    setFillStyle: () => fakeRectInst,
    destroy: () => { /* no-op */ },
  })
  const fakeEllipse = () => ({
    x: 0, y: 0,
    setActive: () => fakeEllipseInst,
    setVisible: () => fakeEllipseInst,
    setPosition: () => fakeEllipseInst,
    setDisplaySize: () => fakeEllipseInst,
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

