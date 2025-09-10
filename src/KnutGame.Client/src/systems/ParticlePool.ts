import Phaser from 'phaser'
import { MAX_PARTICLES } from '../gameConfig'

export class ParticlePool {
  private scene: Phaser.Scene
  private rectPool: Phaser.GameObjects.Rectangle[] = []
  private ellipsePool: Phaser.GameObjects.Ellipse[] = []
  private activeCount = 0
  private extraPool: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  private canSpawn(count = 1): boolean {
    return this.activeCount + count <= MAX_PARTICLES
  }

  private acquireRect(): Phaser.GameObjects.Rectangle {
    const obj = this.rectPool.pop()
    if (obj) return obj
    const r = this.scene.add.rectangle(0, 0, 2, 2, 0xffffff, 1)
    r.setDepth(900)
    return r
  }

  private acquireEllipse(): Phaser.GameObjects.Ellipse {
    const obj = this.ellipsePool.pop()
    if (obj) return obj
    const e = this.scene.add.ellipse(0, 0, 4, 4, 0xffffff, 1)
    e.setDepth(900)
    return e
  }

  private release(obj: Phaser.GameObjects.GameObject) {
    this.activeCount = Math.max(0, this.activeCount - 1)
    obj.setActive(false).setVisible(false)
    if (obj instanceof Phaser.GameObjects.Rectangle) this.rectPool.push(obj)
    else if (obj instanceof Phaser.GameObjects.Ellipse) this.ellipsePool.push(obj)
    else obj.destroy() // fallback safeguard
  }

  spawnRect(opts: { x: number, y: number, w?: number, h?: number, color?: number, alpha?: number, depth?: number, dx?: number, dy?: number, duration?: number }) {
    if (!this.canSpawn()) return
    const r = this.acquireRect()
    r.setActive(true).setVisible(true)
    r.setPosition(opts.x, opts.y)
    r.setSize(opts.w ?? 3, opts.h ?? 3)
    if (opts.depth !== undefined) r.setDepth(opts.depth)
    r.setFillStyle(opts.color ?? 0xffffff, opts.alpha ?? 1)
    const dx = opts.dx ?? Phaser.Math.Between(-20, 20)
    const dy = opts.dy ?? Phaser.Math.Between(-20, 20)
    const duration = opts.duration ?? Phaser.Math.Between(200, 400)
    this.activeCount++
    this.scene.tweens.add({
      targets: r,
      x: r.x + dx,
      y: r.y + dy,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(r)
    })
  }

  spawnEllipse(opts: { x: number, y: number, rx?: number, ry?: number, color?: number, alpha?: number, depth?: number, dx?: number, dy?: number, duration?: number }) {
    if (!this.canSpawn()) return
    const e = this.acquireEllipse()
    e.setActive(true).setVisible(true)
    e.setPosition(opts.x, opts.y)
    e.setDisplaySize(opts.rx ?? 6, opts.ry ?? 6)
    if (opts.depth !== undefined) e.setDepth(opts.depth)
    e.setFillStyle(opts.color ?? 0xffffff, opts.alpha ?? 1)
    const dx = opts.dx ?? Phaser.Math.Between(-20, 20)
    const dy = opts.dy ?? Phaser.Math.Between(-20, 20)
    const duration = opts.duration ?? Phaser.Math.Between(300, 600)
    this.activeCount++
    this.scene.tweens.add({
      targets: e,
      x: e.x + dx,
      y: e.y + dy,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(e)
    })
  }



  // Register any additional particle-like object so it is cleaned up on destroy()
  register(obj: Phaser.GameObjects.GameObject) {
    this.extraPool.push(obj)
  }

  // Expose counts for lightweight perf HUDs
  getActiveCount() { return this.activeCount }
  getPooledCounts() { return { rects: this.rectPool.length, ellipses: this.ellipsePool.length, extra: this.extraPool.length } }
  // Destroy all pooled objects and reset counters (for scene shutdown)
  destroy() {
    for (const r of this.rectPool) {
      try { (this.scene as any).tweens?.killTweensOf?.(r) } catch {}
      try { (r as any).destroy?.() } catch {}
    }
    for (const e of this.ellipsePool) {
      try { (this.scene as any).tweens?.killTweensOf?.(e) } catch {}
      try { (e as any).destroy?.() } catch {}
    }
    this.rectPool = []
    this.ellipsePool = []
    for (const g of this.extraPool) {
      try { (this.scene as any).tweens?.killTweensOf?.(g) } catch {}
      try { (g as any).destroy?.() } catch {}
    }
    this.extraPool = []
    this.activeCount = 0
  }
}

