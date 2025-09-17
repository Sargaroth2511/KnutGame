import Phaser from 'phaser'
import { FALL_SPEED_MIN, FALL_SPEED_MAX, ITEM_SIZE, OBSTACLE_VX_MIN, OBSTACLE_VX_MAX, OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX } from '../gameConfig'
import { ItemType } from '../items'
import { EnhancedObjectPool, PoolStats, DEFAULT_POOL_CONFIG } from './EnhancedObjectPool'

/**
 * Configuration for obstacle size tiers used in spawning algorithm.
 */
interface ObstacleTier {
  readonly name: string
  readonly w: number
  readonly h: number
  readonly vMin: number
  readonly vMax: number
}

/**
 * Configuration for enhanced spawning behavior.
 */
interface EnhancedSpawnerConfig {
  readonly tierWeights: readonly number[]
  readonly tiers: readonly ObstacleTier[]
  readonly spawnXMin: number
  readonly spawnXMax: number
  readonly spawnY: number
  readonly enablePoolOptimization: boolean
  readonly poolOptimizationInterval: number
}

/**
 * Default configuration for enhanced obstacle spawning.
 */
const DEFAULT_ENHANCED_OBSTACLE_CONFIG: EnhancedSpawnerConfig = {
  tierWeights: [2, 3, 2],
  tiers: [
    { name: 'small', w: 72, h: 144, vMin: FALL_SPEED_MIN - 10, vMax: FALL_SPEED_MIN + 40 },
    { name: 'medium', w: 96, h: 192, vMin: FALL_SPEED_MIN + 30, vMax: FALL_SPEED_MAX + 70 },
    { name: 'large', w: 128, h: 256, vMin: FALL_SPEED_MIN + 80, vMax: FALL_SPEED_MAX + 140 },
  ],
  spawnXMin: 40,
  spawnXMax: 40,
  spawnY: -60,
  enablePoolOptimization: true,
  poolOptimizationInterval: 5000 // 5 seconds
} as const

/**
 * Enhanced obstacle spawner with intelligent pooling and memory management.
 * Provides automatic pool optimization and performance monitoring.
 */
export class EnhancedObstacleSpawner {
  readonly group: Phaser.GameObjects.Group
  private readonly scene: Phaser.Scene
  private readonly config: EnhancedSpawnerConfig
  private readonly obstaclePool: EnhancedObjectPool<Phaser.GameObjects.Sprite>
  private lastOptimizationTime = 0

  constructor(scene: Phaser.Scene, config: Partial<EnhancedSpawnerConfig> = {}) {
    this.scene = scene
    this.config = { ...DEFAULT_ENHANCED_OBSTACLE_CONFIG, ...config }
    this.group = this.scene.physics.add.group()
    
    this.obstaclePool = new EnhancedObjectPool(
      () => this.createObstacle(),
      (obstacle) => this.resetObstacle(obstacle),
      (obstacle) => this.destroyObstacle(obstacle),
      {
        ...DEFAULT_POOL_CONFIG,
        initialSize: 15,
        maxSize: 50,
        minSize: 8,
        autoAdjust: true
      }
    )
  }

  /**
   * Spawns a new obstacle with enhanced pooling.
   * @param difficulty - Difficulty multiplier affecting obstacle speed
   * @returns The spawned obstacle sprite
   */
  spawn(difficulty: number = 1): Phaser.GameObjects.Sprite {
    const obstacle = this.obstaclePool.acquire()
    this.configureObstaclePosition(obstacle)
    const tier = this.selectRandomTier()
    this.configureObstacleSizeAndPhysics(obstacle, tier)
    this.configureObstacleMovement(obstacle, tier, difficulty)
    this.applyVisualEffects(obstacle, tier)

    this.group.add(obstacle)
    obstacle.setActive(true).setVisible(true)
    
    this.considerPoolOptimization()
    return obstacle
  }

  /**
   * Removes an obstacle and returns it to the enhanced pool.
   * @param obstacle - The obstacle sprite to remove
   */
  remove(obstacle: Phaser.GameObjects.Sprite): void {
    this.group.remove(obstacle)
    this.obstaclePool.release(obstacle)
  }

  /**
   * Gets pool performance statistics.
   * @returns Pool usage and performance statistics
   */
  getPoolStats(): PoolStats {
    return this.obstaclePool.getStats()
  }

  /**
   * Forces pool optimization.
   */
  optimizePool(): void {
    this.obstaclePool.adjustPoolSize()
  }

  /**
   * Destroys the spawner and all pooled objects.
   */
  destroy(): void {
    this.obstaclePool.destroy()
    this.group.destroy()
  }

  /**
   * Creates a new obstacle sprite.
   * @returns A new obstacle sprite
   * @private
   */
  private createObstacle(): Phaser.GameObjects.Sprite {
    const hasTreeTexture = this.scene.textures.exists('tree')
    const obstacle = hasTreeTexture
      ? this.scene.add.sprite(0, this.config.spawnY, 'tree')
      : (this.scene.add.rectangle(0, this.config.spawnY, 48, 96, 0x8B4513) as unknown as Phaser.GameObjects.Sprite)

    this.scene.physics.add.existing(obstacle)

    if (this.isSprite(obstacle)) {
      obstacle.setOrigin(0.5, 1)
    }

    return obstacle
  }

  /**
   * Resets an obstacle for reuse.
   * @param obstacle - The obstacle to reset
   * @private
   */
  private resetObstacle(obstacle: Phaser.GameObjects.Sprite): void {
    obstacle.setActive(false)
    obstacle.setVisible(false)
    obstacle.setPosition(0, this.config.spawnY)
    obstacle.setRotation(0)
    obstacle.setScale(1)
    obstacle.clearTint()
    
    // Clear custom data
    obstacle.setData('speed', null)
    obstacle.setData('tier', null)
    obstacle.setData('vx', null)
    obstacle.setData('omega', null)
    obstacle.setData('swayPhase', null)
    
    // Kill any existing tweens
    this.scene.tweens?.killTweensOf?.(obstacle)
  }

  /**
   * Destroys an obstacle sprite.
   * @param obstacle - The obstacle to destroy
   * @private
   */
  private destroyObstacle(obstacle: Phaser.GameObjects.Sprite): void {
    try {
      this.scene.tweens?.killTweensOf?.(obstacle)
      obstacle.destroy?.()
    } catch (error) {
      console.warn('Failed to destroy obstacle:', error)
    }
  }

  /**
   * Considers whether pool optimization is needed.
   * @private
   */
  private considerPoolOptimization(): void {
    if (!this.config.enablePoolOptimization) return
    
    const now = Date.now()
    if (now - this.lastOptimizationTime > this.config.poolOptimizationInterval) {
      this.optimizePool()
      this.lastOptimizationTime = now
    }
  }

  // ... (rest of the private methods remain the same as original ObstacleSpawner)
  private configureObstaclePosition(obstacle: Phaser.GameObjects.Sprite): void {
    const randomX = Phaser.Math.Between(
      this.config.spawnXMin,
      this.scene.cameras.main.width - this.config.spawnXMax
    )
    obstacle.setPosition(randomX, this.config.spawnY)
  }

  private selectRandomTier(): ObstacleTier {
    const total = this.config.tierWeights.reduce((a, b) => a + b, 0)
    let random = Math.random() * total
    let selectedIndex = 0

    for (let i = 0; i < this.config.tierWeights.length; i++) {
      if (random < this.config.tierWeights[i]) {
        selectedIndex = i
        break
      }
      random -= this.config.tierWeights[i]
    }

    return this.config.tiers[selectedIndex]
  }

  private configureObstacleSizeAndPhysics(obstacle: Phaser.GameObjects.Sprite, tier: ObstacleTier): void {
    const body = obstacle.body as Phaser.Physics.Arcade.Body
    const hasTreeTexture = this.scene.textures.exists('tree')

    if (this.isSprite(obstacle) && hasTreeTexture) {
      const sprite = obstacle as Phaser.GameObjects.Sprite
      const sourceWidth = sprite.width
      const scale = tier.w / Math.max(1, sourceWidth)
      sprite.setScale(scale)

      const bounds = sprite.getBounds()
      const topLeftX = sprite.x - sprite.displayOriginX
      const topLeftY = sprite.y - sprite.displayOriginY
      const offsetX = bounds.x - topLeftX
      const offsetY = bounds.y - topLeftY

      body.setSize(bounds.width, bounds.height)
      body.setOffset(offsetX, offsetY)
    } else {
      if (this.isRectangle(obstacle)) {
        obstacle.setSize(tier.w, tier.h)
      }
      body.setSize(tier.w, tier.h)
      body.setOffset(0, 0)
    }
  }

  private configureObstacleMovement(obstacle: Phaser.GameObjects.Sprite, tier: ObstacleTier, difficulty: number): void {
    const speed = Math.round(Phaser.Math.Between(tier.vMin, tier.vMax) * Math.max(1, difficulty))
    obstacle.setData('speed', speed)
    obstacle.setData('tier', tier.name)

    const vx = Phaser.Math.Between(OBSTACLE_VX_MIN, OBSTACLE_VX_MAX)
    const omega = Phaser.Math.Between(OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX)
    const swayPhase = Math.random() * Math.PI * 2

    obstacle.setData('vx', vx)
    obstacle.setData('omega', omega)
    obstacle.setData('swayPhase', swayPhase)
  }

  private applyVisualEffects(obstacle: Phaser.GameObjects.Sprite, tier: ObstacleTier): void {
    const hasTreeTexture = this.scene.textures.exists('tree')

    if (this.isSprite(obstacle) && hasTreeTexture) {
      const sprite = obstacle as Phaser.GameObjects.Sprite

      switch (tier.name) {
        case 'small':
          sprite.setTint(0xE8FFE8)
          break
        case 'large':
          sprite.setTint(0x88CC88)
          break
        default:
          sprite.clearTint()
          break
      }
    }
  }

  private isSprite(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Sprite {
    return 'setOrigin' in obj && 'setScale' in obj && 'setTint' in obj
  }

  private isRectangle(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Rectangle {
    return 'setSize' in obj && 'setFillStyle' in obj
  }
}

/**
 * Enhanced item spawner with intelligent pooling and memory management.
 */
export class EnhancedItemSpawner {
  readonly group: Phaser.GameObjects.Group
  private readonly scene: Phaser.Scene
  private readonly itemPool: EnhancedObjectPool<Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle>
  private lastOptimizationTime = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.group = this.scene.physics.add.group()
    
    this.itemPool = new EnhancedObjectPool(
      () => this.createItem(),
      (item) => this.resetItem(item),
      (item) => this.destroyItem(item),
      {
        ...DEFAULT_POOL_CONFIG,
        initialSize: 10,
        maxSize: 30,
        minSize: 5,
        autoAdjust: true
      }
    )
  }

  /**
   * Spawns a random item with enhanced pooling.
   * @returns The spawned item
   */
  spawn(): Phaser.GameObjects.Rectangle {
    const itemTypes = [ItemType.POINTS, ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI]
    const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)]
    return this.spawnType(randomType)
  }

  /**
   * Spawns a coin (points) item.
   * @returns The spawned coin item
   */
  spawnCoin(): Phaser.GameObjects.Rectangle {
    return this.spawnType(ItemType.POINTS)
  }

  /**
   * Spawns a random power-up item.
   * @returns The spawned power-up item
   */
  spawnPowerup(): Phaser.GameObjects.Rectangle {
    const powerupTypes = [ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI, ItemType.ANGEL]
    const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)]
    return this.spawnType(randomType)
  }

  /**
   * Removes an item and returns it to the enhanced pool.
   * @param item - The item to remove
   */
  remove(item: Phaser.GameObjects.Rectangle): void {
    this.group.remove(item)
    this.itemPool.release(item as any)
  }

  /**
   * Gets pool performance statistics.
   * @returns Pool usage and performance statistics
   */
  getPoolStats(): PoolStats {
    return this.itemPool.getStats()
  }

  /**
   * Forces pool optimization.
   */
  optimizePool(): void {
    this.itemPool.adjustPoolSize()
  }

  /**
   * Destroys the spawner and all pooled objects.
   */
  destroy(): void {
    this.itemPool.destroy()
    this.group.destroy()
  }

  /**
   * Spawns an item of the specified type.
   * @param itemType - The type of item to spawn
   * @returns The spawned item
   * @private
   */
  private spawnType(itemType: ItemType): Phaser.GameObjects.Rectangle {
    const item = this.itemPool.acquire()
    this.configureItemProperties(item, itemType)
    this.configureItemPosition(item)
    this.configureItemPhysics(item)

    this.group.add(item)
    item.setActive(true)
    item.setVisible(true)
    
    this.considerPoolOptimization()
    return item as Phaser.GameObjects.Rectangle
  }

  /**
   * Creates a new item object.
   * @returns A new item object
   * @private
   */
  private createItem(): Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle {
    // Create a basic rectangle that can be reconfigured for any item type
    const size = ITEM_SIZE * 0.8
    const item = this.scene.add.rectangle(0, -50, size, size, 0xffffff)
    this.scene.physics.add.existing(item)
    return item
  }

  /**
   * Resets an item for reuse.
   * @param item - The item to reset
   * @private
   */
  private resetItem(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    item.setActive(false)
    item.setVisible(false)
    item.setPosition(0, -50)
    item.setRotation(0)
    item.setScale(1)
    
    // Clear custom data
    item.setData('color', null)
    item.setData('itemType', null)
    item.setData('id', null)
    item.setData('speed', null)
    
    // Kill any existing tweens
    this.scene.tweens?.killTweensOf?.(item)
  }

  /**
   * Destroys an item object.
   * @param item - The item to destroy
   * @private
   */
  private destroyItem(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    try {
      this.scene.tweens?.killTweensOf?.(item)
      item.destroy?.()
    } catch (error) {
      console.warn('Failed to destroy item:', error)
    }
  }

  /**
   * Considers whether pool optimization is needed.
   * @private
   */
  private considerPoolOptimization(): void {
    const now = Date.now()
    if (now - this.lastOptimizationTime > 5000) { // 5 seconds
      this.optimizePool()
      this.lastOptimizationTime = now
    }
  }

  // ... (rest of the private methods for item configuration)
  private configureItemProperties(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle, itemType: ItemType): void {
    const color = this.getItemColor(itemType)
    const uniqueId = this.generateUniqueId()

    if (this.isRectangle(item)) {
      item.setFillStyle(color)
    }

    item.setData('color', color)
    item.setData('itemType', itemType)
    item.setData('id', uniqueId)
  }

  private configureItemPosition(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    const randomX = Phaser.Math.Between(40, this.scene.cameras.main.width - 40)
    item.setPosition(randomX, -50)
  }

  private configureItemPhysics(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
    item.setData('speed', speed)
  }

  private getItemColor(itemType: ItemType): number {
    switch (itemType) {
      case ItemType.POINTS: return 0xffff00
      case ItemType.LIFE: return 0xff0000
      case ItemType.SLOWMO: return 0x00ffff
      case ItemType.MULTI: return 0xff8800
      case ItemType.ANGEL: return 0xffffff
      default: return 0xffffff
    }
  }

  private generateUniqueId(): string {
    if ((globalThis as any).crypto?.randomUUID) {
      return (globalThis as any).crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  private isRectangle(obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): obj is Phaser.GameObjects.Rectangle {
    return 'setFillStyle' in obj && 'setSize' in obj
  }
}