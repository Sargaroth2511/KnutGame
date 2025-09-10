import { describe, it, expect } from 'vitest'
import { ToppledManager } from '../src/systems/ToppledManager'
import { TOPPLE_DURATION_MS, TOPPLE_BLOCK_MS, MAX_TOPPLED, TOPPLE_IMPACT_SPIN } from '../src/gameConfig'

type TweenCfg = { onComplete?: () => void }

function makeScene() {
  const tweens: TweenCfg[] = []
  const scene: any = {
    tweens: {
      add: (cfg: TweenCfg) => { tweens.push(cfg); return {} },
    }
  }
  return { scene, tweens }
}

function makeGroup() {
  const added: any[] = []
  const removed: any[] = []
  const group: any = {
    add: (o: any) => { added.push(o) },
    remove: (o: any) => { removed.push(o) },
    children: { each: (_: any) => {} }
  }
  return { group, added, removed }
}

function makeFallingSprite(x = 100, y = 200) {
  let lastAngle = 0
  let destroyed = false
  const calls = { setAngle: 0, setPosition: 0, setActive: 0, setVisible: 0 }
  const body = { enable: true, setVelocity: (_x: number, _y: number) => {} }
  const sprite: any = {
    x, y,
    angle: 0,
    body,
    setOrigin: (_x: number, _y: number) => sprite,
    setAngle: (a: number) => { lastAngle = a; sprite.angle = a; calls.setAngle++; return sprite },
    setPosition: (_x: number, _y: number) => { calls.setPosition++; sprite.x = _x; sprite.y = _y; return sprite },
    setActive: (_?: boolean) => { calls.setActive++; return sprite },
    setVisible: (_?: boolean) => { calls.setVisible++; return sprite },
    destroy: () => { destroyed = true },
    getBounds: () => ({ x: x - 24, y: y - 96, width: 48, height: 96 })
  }
  return { sprite, get lastAngle() { return lastAngle }, get destroyed() { return destroyed }, calls }
}

describe('ToppledManager timeline', () => {
  it('topples towards player and settles after TOPPLE_DURATION_MS, then despawns after block window', () => {
    const { scene, tweens } = makeScene()
    const { group, removed } = makeGroup()
    const mgr = new ToppledManager(scene as any, group as any, undefined, 220)
    const s = makeFallingSprite(100, 200)

    // Player is left of obstacle → topple left (negative angle)
    mgr.addFromFalling(s.sprite as any, 50)
    // Some implementations apply an immediate impact spin; accept either 0 or -TOPPLE_IMPACT_SPIN on init
    const initAngle = Math.round(s.lastAngle)
    expect([0, -TOPPLE_IMPACT_SPIN]).toContain(initAngle)

    // Progress through topple: angle moves toward -90, base Y stays constant, slide grows
    const baseY = s.sprite.y
    mgr.update(Math.ceil(TOPPLE_DURATION_MS / 4))
    const angleQ1 = s.lastAngle
    const xQ1 = s.sprite.x
    expect(angleQ1).toBeLessThan(0)
    expect(s.sprite.y).toBe(baseY)
    mgr.update(Math.ceil(TOPPLE_DURATION_MS / 4))
    const angleQ2 = s.lastAngle
    const xQ2 = s.sprite.x
    expect(angleQ2).toBeLessThan(angleQ1) // more negative -> closer to -90
    expect(xQ2).toBeLessThan(xQ1) // sliding left when player is left
    const priorCalls = s.calls.setAngle
    mgr.update(TOPPLE_DURATION_MS / 2)
    // Settled — subsequent updates should not change angle anymore
    const afterToppleAngle = s.lastAngle
    mgr.update(100)
    expect(s.calls.setAngle).toBe(priorCalls + 1) // only one more change to reach final
    expect(s.lastAngle).toBe(afterToppleAngle)

    // Run out block time -> removal + fade tween
    mgr.update(TOPPLE_BLOCK_MS + 10)
    expect(removed.length).toBe(1)
    expect(tweens.length).toBe(1)
    // Complete tween → sprite destroyed
    tweens[0].onComplete?.()
    expect(s.destroyed).toBe(true)
  })

  it('topples to the right when player is on right', () => {
    const { scene } = makeScene()
    const { group } = makeGroup()
    const mgr = new ToppledManager(scene as any, group as any, undefined, 250)
    const s = makeFallingSprite(100, 200)
    mgr.addFromFalling(s.sprite as any, 150)
    mgr.update(Math.ceil(TOPPLE_DURATION_MS * 0.5))
    expect(s.lastAngle).toBeGreaterThan(0)
    // Slide should move x to the right over the course of the animation
    const xMid = s.sprite.x
    mgr.update(Math.ceil(TOPPLE_DURATION_MS * 0.4))
    const xLate = s.sprite.x
    expect(xLate).toBeGreaterThanOrEqual(xMid)
  })

  it('caps active toppled entries and evicts oldest', () => {
    const { scene } = makeScene()
    const { group, removed } = makeGroup()
    const mgr = new ToppledManager(scene as any, group as any, undefined, 300)
    const entries = Array.from({ length: MAX_TOPPLED + 1 }, (_v, i) => makeFallingSprite(100 + i * 10, 200))
    for (const e of entries) mgr.addFromFalling(e.sprite as any, 0)
    // When exceeding cap, oldest should be removed immediately
    expect(removed.length).toBe(1)
    expect(entries[0].destroyed).toBe(true)
  })
})
