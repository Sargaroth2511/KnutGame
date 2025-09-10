import Phaser from 'phaser'
import { TOPPLE_BLOCK_MS, TOPPLE_DURATION_MS, MAX_TOPPLED, TOPPLE_KNOCKBACK_PX, TOPPLE_IMPACT_SPIN, TOPPLE_DROP_ACCEL, TOPPLE_MAX_DROP_V, TOPPLE_IMPACT_MS, TOPPLE_FALL_VX, TOPPLE_FALL_TAU } from '../gameConfig'
import { toppleTimeline } from './physicsLike'

type Entry = {
  sprite: Phaser.GameObjects.Sprite,
  baseX: number,
  baseY: number,
  dir: 1 | -1,
  elapsed: number,
  state: 'impact' | 'fallingToGround' | 'toppling' | 'settled',
  lifeLeft: number,
  vy: number,
  vx: number,
  impactLeft: number,
  startAngle: number
}

export class ToppledManager {
  private scene: Phaser.Scene
  private animGroup: Phaser.GameObjects.Group
  private blockGroup: Phaser.GameObjects.Group
  private active: Entry[] = []
  private groundY?: number

  constructor(scene: Phaser.Scene, animGroup: Phaser.GameObjects.Group, blockGroup?: Phaser.GameObjects.Group, groundY?: number) {
    this.scene = scene
    this.animGroup = animGroup
    this.blockGroup = blockGroup ?? animGroup
    this.groundY = groundY
  }

  addFromFalling(obstacle: Phaser.GameObjects.Sprite, playerX: number) {
    if (this.active.length >= MAX_TOPPLED) {
      const old = this.active.shift()!
      this.animGroup.remove(old.sprite)
      old.sprite.destroy()
    }
    const body = (obstacle.body as Phaser.Physics.Arcade.Body | undefined)
    let vy0 = 0
    if (body) {
      vy0 = (body.velocity?.y as number) || 0
      body.setVelocity(0, 0); body.enable = false
    }
    ; (obstacle as any).setOrigin?.(0.5, 1)
    const dir: 1 | -1 = (playerX < obstacle.x) ? -1 : 1
    const simpleMode = (this.blockGroup === this.animGroup)
    const entry: Entry = {
      sprite: obstacle,
      baseX: obstacle.x,
      baseY: obstacle.y,
      dir,
      elapsed: 0,
      state: simpleMode ? 'toppling' : 'impact',
      lifeLeft: TOPPLE_BLOCK_MS,
      vy: Math.min(vy0, TOPPLE_MAX_DROP_V),
      vx: TOPPLE_FALL_VX * dir,
      impactLeft: TOPPLE_IMPACT_MS,
      startAngle: obstacle.angle || 0
    }
    obstacle.setActive(true).setVisible(true)
    this.animGroup.add(obstacle)
  }

  update(deltaMs: number) {
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i]
      if (e.state === 'impact') {

        const dt = deltaMs / 1000
        e.impactLeft -= deltaMs
        const p = 1 - Math.max(0, e.impactLeft) / TOPPLE_IMPACT_MS
        const eased = 1 - Math.pow(1 - p, 2)
        const x = e.baseX + TOPPLE_KNOCKBACK_PX * eased * e.dir
        // gently reduce vy (prevent suction)
        e.vy *= Math.max(0, 1 - 3 * dt)
        e.sprite.setPosition(x, e.baseY)
        e.sprite.setAngle(e.startAngle + (TOPPLE_IMPACT_SPIN * eased * e.dir))
        if (e.impactLeft <= 0) {
          e.state = 'fallingToGround'
        }
      } else if (e.state === 'fallingToGround') {
        const dt = deltaMs / 1000
        e.vy = Math.min(e.vy + TOPPLE_DROP_ACCEL * dt, TOPPLE_MAX_DROP_V)
        e.vx += (-e.vx / TOPPLE_FALL_TAU) * dt
        e.baseX += e.vx * dt
        e.baseY += e.vy * dt
        const spriteBottom = e.baseY
        if (this.groundY !== undefined && spriteBottom >= this.groundY) {
          e.baseY = this.groundY
          e.state = 'toppling'
          e.elapsed = 0
          e.startAngle = e.sprite.angle
          // Place under player depth if available
          try { const anyScene: any = this.scene as any; if (anyScene.player && anyScene.player.depth !== undefined) { e.sprite.setDepth(anyScene.player.depth - 1) } } catch { }
        }
        e.sprite.setPosition(e.baseX, e.baseY)
      } else if (e.state === 'toppling') {
        e.elapsed += deltaMs
        const t = toppleTimeline(e.elapsed, { durationMs: TOPPLE_DURATION_MS })
        const sizeScale = Math.max(0.9, Math.min(1.6, (e.sprite.displayHeight || 160) / 160))
        const ang = e.startAngle + Math.abs(t.angleDeg) * e.dir
        const slide = t.slidePx * sizeScale * e.dir
        e.sprite.setAngle(ang)
        const simpleModeNow = (this.blockGroup === this.animGroup) || this.groundY === undefined
        e.sprite.setPosition(e.baseX + slide, simpleModeNow ? e.baseY : (this.groundY as number))
        if (e.elapsed >= TOPPLE_DURATION_MS) {
          e.state = 'settled'
          if (this.animGroup !== this.blockGroup) {
            try { (this.animGroup as any).remove?.(e.sprite) } catch { }
          }
          // Grace delay before enabling collisions to avoid unfair re-hit
          (this.scene as any).time?.delayedCall?.(150, () => { if (e.sprite.active) this.blockGroup.add(e.sprite) })
        }
      } else {
        e.lifeLeft -= deltaMs
        if (e.lifeLeft <= 0) {
          const s = e.sprite
          this.scene.tweens.add({ targets: s, alpha: 0, duration: 180, onComplete: () => { s.destroy() } })
          this.blockGroup.remove(e.sprite)
          this.active.splice(i, 1)
          i--
        }
      }
    }
  }

  clear() {
    for (const e of this.active) {
      try { (this.scene as any).tweens?.killTweensOf?.(e.sprite) } catch { }
      try { e.sprite.destroy() } catch { }
    }
    this.animGroup.clear(true, true)
    this.blockGroup.clear(true, true)
    this.active = []
  }
}
