 import Phaser from 'phaser'
import { FALL_SPEED_MIN, FALL_SPEED_MAX, ITEM_SIZE, OBSTACLE_VX_MIN, OBSTACLE_VX_MAX, OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX } from '../gameConfig'
import { ItemType } from '../items'

export class ObstacleSpawner {
  readonly group: Phaser.GameObjects.Group
  private pool: Phaser.GameObjects.Sprite[] = []
  private scene: Phaser.Scene
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.group = this.scene.physics.add.group()
  }

  spawn(difficulty: number = 1): Phaser.GameObjects.Sprite {
    let obstacle = this.pool.pop()
    const hasTree = this.scene.textures.exists('tree')
    if (!obstacle) {
      obstacle = hasTree
        ? this.scene.add.sprite(0, -60, 'tree')
        : (this.scene.add.rectangle(0, -60, 48, 96, 0x8B4513) as unknown as Phaser.GameObjects.Sprite)
      this.scene.physics.add.existing(obstacle)
      // Ensure bottom-center origin for all obstacle sprites
      if ((obstacle as any).setOrigin) (obstacle as any).setOrigin(0.5, 1)
    }

    const randomX = Phaser.Math.Between(40, this.scene.cameras.main.width - 40)
    obstacle.setPosition(randomX, -60)

    // Size tier to fake depth; larger = closer = faster (sizes doubled again)
    const tiers = [
      { name: 'small', w: 72, h: 144, vMin: FALL_SPEED_MIN - 10, vMax: FALL_SPEED_MIN + 40 },
      { name: 'medium', w: 96, h: 192, vMin: FALL_SPEED_MIN + 30, vMax: FALL_SPEED_MAX + 70 },
      { name: 'large', w: 128, h: 256, vMin: FALL_SPEED_MIN + 80, vMax: FALL_SPEED_MAX + 140 },
    ] as const
    const weights = [2, 3, 2]
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < weights.length; i++) { if (r < weights[i]) { idx = i; break } r -= weights[i] }
    const tier = tiers[idx]

    const body = obstacle.body as Phaser.Physics.Arcade.Body
    if ((obstacle as any).setScale && hasTree) {
      // Scale sprite to match tier width
      const srcW = (obstacle as any).width
      const scale = tier.w / Math.max(1, srcW)
      ;(obstacle as any).setScale(scale)
      // Align body to exact display bounds (accounts for origin and scale)
      const b = (obstacle as any).getBounds() as Phaser.Geom.Rectangle
      const topLeftX = (obstacle as any).x - (obstacle as any).displayOriginX
      const topLeftY = (obstacle as any).y - (obstacle as any).displayOriginY
      const offX = b.x - topLeftX
      const offY = b.y - topLeftY
      body.setSize(b.width, b.height)
      body.setOffset(offX, offY)
    } else {
      // Fallback rectangle: use tier AABB
      ;(obstacle as any).setSize?.(tier.w, tier.h)
      body.setSize(tier.w, tier.h)
      body.setOffset(0, 0)
    }
    const speed = Math.round(Phaser.Math.Between(tier.vMin, tier.vMax) * Math.max(1, difficulty))
    obstacle.setData('speed', speed)
    obstacle.setData('tier', tier.name)
    // Subtle tint by tier to enhance depth
    if ((obstacle as any).setTint && hasTree) {
      const sprite = obstacle as unknown as Phaser.GameObjects.Sprite
      if (tier.name === 'small') sprite.setTint(0xE8FFE8)
      else if (tier.name === 'large') sprite.setTint(0x88CC88)
      else sprite.clearTint()
    }

    // Initialize drift/rotation data
    const vx = Phaser.Math.Between(OBSTACLE_VX_MIN, OBSTACLE_VX_MAX)
    const omega = Phaser.Math.Between(OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX)
    obstacle.setData('vx', vx)
    obstacle.setData('omega', omega)
    obstacle.setData('swayPhase', Math.random() * Math.PI * 2)

    this.group.add(obstacle)
    obstacle.setActive(true).setVisible(true)
    return obstacle
  }

  remove(obstacle: Phaser.GameObjects.Sprite) {
    this.group.remove(obstacle)
    obstacle.setActive(false).setVisible(false)
    this.pool.push(obstacle)
  }
}

export class ItemSpawner {
  readonly group: Phaser.GameObjects.Group
  private scene: Phaser.Scene

  private pool: Phaser.GameObjects.GameObject[] = []
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.group = this.scene.physics.add.group()
  }

  spawn(): Phaser.GameObjects.Rectangle {
    // Back compatible random
    const any = [ItemType.POINTS, ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI]
    const t = any[Math.floor(Math.random() * any.length)]
    return this.spawnType(t)
  }

  spawnCoin(): Phaser.GameObjects.Rectangle { return this.spawnType(ItemType.POINTS) }
  spawnPowerup(): Phaser.GameObjects.Rectangle {
    const types = [ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI]
    const t = types[Math.floor(Math.random() * types.length)]
    return this.spawnType(t)
  }

  private spawnType(randomType: ItemType): Phaser.GameObjects.Rectangle {
    let item = this.pool.pop() as any

    // Map item type to texture key (fallback to rectangle if not found)
    const key = this.findItemTextureKey(randomType)
    const color = this.colorForItem(randomType)

    if (!item) {
      if (key && this.scene.textures.exists(key)) {
        const s = this.scene.add.sprite(0, -50, key)
        s.setOrigin(0.5, 0.5)
        // scale to ITEM_SIZE
        const base = Math.max(s.width || ITEM_SIZE, s.height || ITEM_SIZE)
        const scale = ITEM_SIZE / base
        s.setScale(scale)
        this.scene.physics.add.existing(s)
        // Align physics body to visible bounds
        const b = s.getBounds()
        const topLeftX = s.x - s.displayOriginX
        const topLeftY = s.y - s.displayOriginY
        const offX = b.x - topLeftX
        const offY = b.y - topLeftY
        const body = s.body as Phaser.Physics.Arcade.Body
        body.setSize(b.width, b.height)
        body.setOffset(offX, offY)
        item = s
      } else {
        const size = ITEM_SIZE * 0.8
        item = this.scene.add.rectangle(0, -50, size, size, color)
        this.scene.physics.add.existing(item)
      }
    } else {
      // Reuse pooled object
      if ((item as any).setTexture && key && this.scene.textures.exists(key)) {
        const s = item as Phaser.GameObjects.Sprite
        s.setTexture(key)
        const base = Math.max(s.width || ITEM_SIZE, s.height || ITEM_SIZE)
        const scale = ITEM_SIZE / base
        s.setScale(scale)
        const b = s.getBounds()
        const topLeftX = s.x - s.displayOriginX
        const topLeftY = s.y - s.displayOriginY
        const offX = b.x - topLeftX
        const offY = b.y - topLeftY
        const body = s.body as Phaser.Physics.Arcade.Body
        body.setSize(b.width, b.height)
        body.setOffset(offX, offY)
      } else if ((item as any).setFillStyle) {
        (item as Phaser.GameObjects.Rectangle).setFillStyle(color)
        const body = (item as any).body as Phaser.Physics.Arcade.Body
        const size = ITEM_SIZE * 0.8
        body.setSize(size, size)
        body.setOffset(0, 0)
      }
    }
    ;(item as any).setData('color', color)

    ;(item as any).setData('itemType', randomType)
    // Assign a unique ID for server-side validation
    const newId = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    ;(item as any).setData('id', newId)

    const randomX = Phaser.Math.Between(40, this.scene.cameras.main.width - 40)
    ;(item as any).setPosition(randomX, -50)

    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
    ;(item as any).setData('speed', speed)

    this.group.add(item)
    ;(item as any).setActive(true).setVisible(true)
    return item as Phaser.GameObjects.Rectangle
  }

  remove(item: Phaser.GameObjects.Rectangle) {
    this.group.remove(item)
    item.setActive(false).setVisible(false)
    this.pool.push(item)
  }

  private colorForItem(t: ItemType): number {
    switch (t) {
      case ItemType.POINTS: return 0xffff00
      case ItemType.LIFE: return 0xff0000
      case ItemType.SLOWMO: return 0x00ffff
      case ItemType.MULTI: return 0xff8800
      default: return 0xffffff
    }
  }

  private findItemTextureKey(t: ItemType): string | undefined {
    const hints: Record<ItemType, string[]> = {
      [ItemType.POINTS]: ['gift', 'present', 'box', 'yellow'],
      [ItemType.LIFE]: ['heart', 'redheart', 'life'],
      [ItemType.SLOWMO]: ['snowflake', 'snow', 'flake', 'icy'],
      [ItemType.MULTI]: ['star', 'orange', 'bonus']
    }
    const keys = Object.keys((this.scene.textures as any).list ?? {})
    // Prefer exact matches of common names
    const exactCandidates: Record<ItemType, string[]> = {
      [ItemType.POINTS]: ['gift', 'gift_yellow'],
      [ItemType.LIFE]: ['heart'],
      [ItemType.SLOWMO]: ['snowflake'],
      [ItemType.MULTI]: ['star']
    }
    for (const k of exactCandidates[t]) if (this.scene.textures.exists(k)) return k
    // Fallback: substring search by hints
    for (const k of keys) {
      const lower = k.toLowerCase()
      if (hints[t].some(h => lower.includes(h))) return k
    }
    return undefined
  }
}
