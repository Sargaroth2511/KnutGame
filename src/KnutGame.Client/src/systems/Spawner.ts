import Phaser from 'phaser'
import { FALL_SPEED_MIN, FALL_SPEED_MAX, ITEM_SIZE, OBSTACLE_VX_MIN, OBSTACLE_VX_MAX, OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX } from '../gameConfig'
import { ItemType } from '../items'

/**
 * Configuration for obstacle size tiers used in spawning algorithm.
 * Each tier represents a different depth level with corresponding size and speed.
 */
interface ObstacleTier {
  /** Human-readable name for the tier */
  readonly name: string
  /** Width of the obstacle in pixels */
  readonly w: number
  /** Height of the obstacle in pixels */
  readonly h: number
  /** Minimum fall speed for this tier */
  readonly vMin: number
  /** Maximum fall speed for this tier */
  readonly vMax: number
}

/**
 * Configuration for spawning behavior including tier weights and spawn parameters.
 */
interface SpawnerConfig {
  /** Weights for each obstacle tier (higher = more likely to spawn) */
  readonly tierWeights: readonly number[]
  /** Available obstacle tiers */
  readonly tiers: readonly ObstacleTier[]
  /** Minimum spawn X position (pixels from left edge) */
  readonly spawnXMin: number
  /** Maximum spawn X position (pixels from right edge) */
  readonly spawnXMax: number
  /** Y position where obstacles spawn (pixels from top) */
  readonly spawnY: number
}

/**
 * Default configuration for obstacle spawning.
 * Defines three tiers (small, medium, large) with weighted probabilities.
 */
const DEFAULT_OBSTACLE_CONFIG: SpawnerConfig = {
  tierWeights: [2, 3, 2], // small: 2/7, medium: 3/7, large: 2/7
  tiers: [
    { name: 'small', w: 72, h: 144, vMin: FALL_SPEED_MIN - 10, vMax: FALL_SPEED_MIN + 40 },
    { name: 'medium', w: 96, h: 192, vMin: FALL_SPEED_MIN + 30, vMax: FALL_SPEED_MAX + 70 },
    { name: 'large', w: 128, h: 256, vMin: FALL_SPEED_MIN + 80, vMax: FALL_SPEED_MAX + 140 },
  ],
  spawnXMin: 40,
  spawnXMax: 40,
  spawnY: -60
} as const

/**
 * Manages the spawning, pooling, and lifecycle of game obstacles.
 * Uses an object pooling pattern to efficiently reuse obstacle sprites.
 *
 * Features:
 * - Three-tier depth system (small/medium/large) with different sizes and speeds
 * - Texture-based sprites with fallback to colored rectangles
 * - Physics body alignment for accurate collision detection
 * - Configurable difficulty scaling
 * - Memory-efficient object pooling
 */
export class ObstacleSpawner {
  /** Physics group containing all active obstacles */
  readonly group: Phaser.GameObjects.Group
  /** Pool of inactive obstacle sprites for reuse */
  private pool: Phaser.GameObjects.Sprite[] = []
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene
  /** Configuration for spawning behavior */
  private config: SpawnerConfig

  /**
   * Creates a new obstacle spawner.
   * @param scene - The Phaser scene this spawner belongs to
   * @param config - Optional custom configuration (uses defaults if not provided)
   */
  constructor(scene: Phaser.Scene, config: Partial<SpawnerConfig> = {}) {
    this.scene = scene
    this.config = { ...DEFAULT_OBSTACLE_CONFIG, ...config }
    this.group = this.scene.physics.add.group()
  }

  /**
   * Spawns a new obstacle with random properties based on difficulty.
   * Uses weighted random selection for tier assignment and applies physics properties.
   *
   * @param difficulty - Difficulty multiplier affecting obstacle speed (default: 1)
   * @returns The spawned obstacle sprite
   */
  spawn(difficulty: number = 1): Phaser.GameObjects.Sprite {
    const obstacle = this.getOrCreateObstacle()
    this.configureObstaclePosition(obstacle)
    const tier = this.selectRandomTier()
    this.configureObstacleSizeAndPhysics(obstacle, tier)
    this.configureObstacleMovement(obstacle, tier, difficulty)
    this.applyVisualEffects(obstacle, tier)

    this.group.add(obstacle)
    obstacle.setActive(true).setVisible(true)
    return obstacle
  }

  /**
   * Removes an obstacle from the game world and returns it to the pool.
   * @param obstacle - The obstacle sprite to remove
   */
  remove(obstacle: Phaser.GameObjects.Sprite): void {
    this.group.remove(obstacle)
    obstacle.setActive(false).setVisible(false)
    this.pool.push(obstacle)
  }

  /**
   * Gets an obstacle from the pool or creates a new one if none available.
   * @returns A configured obstacle sprite
   * @private
   */
  private getOrCreateObstacle(): Phaser.GameObjects.Sprite {
    let obstacle = this.pool.pop()
    const hasTreeTexture = this.scene.textures.exists('tree')

    if (!obstacle) {
      obstacle = hasTreeTexture
        ? this.scene.add.sprite(0, this.config.spawnY, 'tree')
        : (this.scene.add.rectangle(0, this.config.spawnY, 48, 96, 0x8B4513) as unknown as Phaser.GameObjects.Sprite)

      this.scene.physics.add.existing(obstacle)

      // Ensure bottom-center origin for consistent positioning
      if (this.isSprite(obstacle)) {
        obstacle.setOrigin(0.5, 1)
      }
    }

    return obstacle
  }

  /**
   * Sets the initial position of the obstacle to a random X coordinate.
   * @param obstacle - The obstacle to position
   * @private
   */
  private configureObstaclePosition(obstacle: Phaser.GameObjects.Sprite): void {
    const randomX = Phaser.Math.Between(
      this.config.spawnXMin,
      this.scene.cameras.main.width - this.config.spawnXMax
    )
    obstacle.setPosition(randomX, this.config.spawnY)
  }

  /**
   * Selects a random tier based on the configured weights.
   * @returns The selected obstacle tier configuration
   * @private
   */
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

  /**
   * Configures the size and physics body of the obstacle based on its tier.
   * @param obstacle - The obstacle to configure
   * @param tier - The tier configuration to apply
   * @private
   */
  private configureObstacleSizeAndPhysics(obstacle: Phaser.GameObjects.Sprite, tier: ObstacleTier): void {
    const body = obstacle.body as Phaser.Physics.Arcade.Body
    const hasTreeTexture = this.scene.textures.exists('tree')

    if (this.isSprite(obstacle) && hasTreeTexture) {
      // Scale sprite to match tier dimensions
      const sprite = obstacle as Phaser.GameObjects.Sprite
      const sourceWidth = sprite.width
      const scale = tier.w / Math.max(1, sourceWidth)
      sprite.setScale(scale)

      // Align physics body to display bounds
      const bounds = sprite.getBounds()
      const topLeftX = sprite.x - sprite.displayOriginX
      const topLeftY = sprite.y - sprite.displayOriginY
      const offsetX = bounds.x - topLeftX
      const offsetY = bounds.y - topLeftY

      body.setSize(bounds.width, bounds.height)
      body.setOffset(offsetX, offsetY)
    } else {
      // Fallback: use tier dimensions directly
      if (this.isRectangle(obstacle)) {
        obstacle.setSize(tier.w, tier.h)
      }
      body.setSize(tier.w, tier.h)
      body.setOffset(0, 0)
    }
  }

  /**
   * Configures movement properties including speed and rotation.
   * @param obstacle - The obstacle to configure
   * @param tier - The tier configuration
   * @param difficulty - Difficulty multiplier
   * @private
   */
  private configureObstacleMovement(obstacle: Phaser.GameObjects.Sprite, tier: ObstacleTier, difficulty: number): void {
    const speed = Math.round(Phaser.Math.Between(tier.vMin, tier.vMax) * Math.max(1, difficulty))
    obstacle.setData('speed', speed)
    obstacle.setData('tier', tier.name)

    // Initialize drift and rotation properties
    const vx = Phaser.Math.Between(OBSTACLE_VX_MIN, OBSTACLE_VX_MAX)
    const omega = Phaser.Math.Between(OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX)
    const swayPhase = Math.random() * Math.PI * 2

    obstacle.setData('vx', vx)
    obstacle.setData('omega', omega)
    obstacle.setData('swayPhase', swayPhase)
  }

  /**
   * Applies visual effects based on the obstacle's tier.
   * @param obstacle - The obstacle to enhance
   * @param tier - The tier configuration
   * @private
   */
  private applyVisualEffects(obstacle: Phaser.GameObjects.Sprite, tier: ObstacleTier): void {
    const hasTreeTexture = this.scene.textures.exists('tree')

    if (this.isSprite(obstacle) && hasTreeTexture) {
      const sprite = obstacle as Phaser.GameObjects.Sprite

      // Apply tier-based tinting to enhance depth perception
      switch (tier.name) {
        case 'small':
          sprite.setTint(0xE8FFE8) // Light green tint
          break
        case 'large':
          sprite.setTint(0x88CC88) // Darker green tint
          break
        default:
          sprite.clearTint()
          break
      }
    }
  }

  /**
   * Type guard to check if a game object is a sprite.
   * @param obj - The game object to check
   * @returns True if the object is a sprite
   * @private
   */
  private isSprite(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Sprite {
    return 'setOrigin' in obj && 'setScale' in obj && 'setTint' in obj
  }

  /**
   * Type guard to check if a game object is a rectangle.
   * @param obj - The game object to check
   * @returns True if the object is a rectangle
   * @private
   */
  private isRectangle(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Rectangle {
    return 'setSize' in obj && 'setFillStyle' in obj
  }
}

/**
 * Configuration for item spawning behavior.
 */
interface ItemSpawnerConfig {
  /** Size of spawned items in pixels */
  readonly itemSize: number
  /** Scale factor for rectangle fallback items */
  readonly rectangleScale: number
  /** Minimum spawn X position (pixels from left edge) */
  readonly spawnXMin: number
  /** Maximum spawn X position (pixels from right edge) */
  readonly spawnXMax: number
  /** Y position where items spawn (pixels from top) */
  readonly spawnY: number
}

/**
 * Default configuration for item spawning.
 */
const DEFAULT_ITEM_CONFIG: ItemSpawnerConfig = {
  itemSize: ITEM_SIZE,
  rectangleScale: 0.8,
  spawnXMin: 40,
  spawnXMax: 40,
  spawnY: -50
} as const

/**
 * Manages the spawning, pooling, and lifecycle of collectible items.
 * Supports multiple item types with texture-based sprites and fallback rendering.
 *
 * Features:
 * - Multiple item types (points, life, slowmo, multi, angel)
 * - Texture-based sprites with intelligent fallback to colored rectangles
 * - Physics body alignment for accurate collision detection
 * - Memory-efficient object pooling
 * - Unique ID generation for server-side validation
 */
export class ItemSpawner {
  /** Physics group containing all active items */
  readonly group: Phaser.GameObjects.Group
  /** Pool of inactive item objects for reuse */
  private pool: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle)[] = []
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene
  /** Configuration for spawning behavior */
  private config: ItemSpawnerConfig

  /**
   * Creates a new item spawner.
   * @param scene - The Phaser scene this spawner belongs to
   * @param config - Optional custom configuration (uses defaults if not provided)
   */
  constructor(scene: Phaser.Scene, config: Partial<ItemSpawnerConfig> = {}) {
    this.scene = scene
    this.config = { ...DEFAULT_ITEM_CONFIG, ...config }
    this.group = this.scene.physics.add.group()
  }

  /**
   * Spawns a random item from the basic item types.
   * @returns The spawned item rectangle (for backward compatibility)
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
   * Spawns an item of the specified type.
   * @param itemType - The type of item to spawn
   * @returns The spawned item
   * @private
   */
  private spawnType(itemType: ItemType): Phaser.GameObjects.Rectangle {
    const item = this.getOrCreateItem(itemType)
    this.configureItemProperties(item, itemType)
    this.configureItemPosition(item)
    this.configureItemPhysics(item)

    this.group.add(item)
    item.setActive(true)
    item.setVisible(true)
    return item as Phaser.GameObjects.Rectangle
  }

  /**
   * Gets an item from the pool or creates a new one if none available.
   * @param itemType - The type of item to create
   * @returns A configured item object
   * @private
   */
  private getOrCreateItem(itemType: ItemType): Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle {
    let item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle | undefined = this.pool.pop()
    const textureKey = this.findItemTextureKey(itemType)
    const color = this.getItemColor(itemType)

    if (!item) {
      if (textureKey && this.scene.textures.exists(textureKey)) {
        // Create sprite-based item
        const sprite = this.scene.add.sprite(0, this.config.spawnY, textureKey)
        sprite.setOrigin(0.5, 0.5)

        // Scale to match item size
        const baseSize = Math.max(sprite.width || this.config.itemSize, sprite.height || this.config.itemSize)
        const scale = this.config.itemSize / baseSize
        sprite.setScale(scale)

        this.scene.physics.add.existing(sprite)
        this.alignPhysicsBodyToSprite(sprite)
        item = sprite
      } else {
        // Create rectangle fallback
        const size = this.config.itemSize * this.config.rectangleScale
        item = this.scene.add.rectangle(0, this.config.spawnY, size, size, color)
        this.scene.physics.add.existing(item)
      }
    } else {
      // Reuse pooled object
      if (this.isSprite(item) && textureKey && this.scene.textures.exists(textureKey)) {
        const sprite = item as Phaser.GameObjects.Sprite
        sprite.setTexture(textureKey)

        // Re-scale for new texture
        const baseSize = Math.max(sprite.width || this.config.itemSize, sprite.height || this.config.itemSize)
        const scale = this.config.itemSize / baseSize
        sprite.setScale(scale)
        this.alignPhysicsBodyToSprite(sprite)
      } else if (this.isRectangle(item)) {
        const rectangle = item as Phaser.GameObjects.Rectangle
        rectangle.setFillStyle(color)

        const body = rectangle.body as Phaser.Physics.Arcade.Body
        const size = this.config.itemSize * this.config.rectangleScale
        body.setSize(size, size)
        body.setOffset(0, 0)
      }
    }

    return item
  }

  /**
   * Aligns the physics body of a sprite to its visible bounds.
   * @param sprite - The sprite to align
   * @private
   */
  private alignPhysicsBodyToSprite(sprite: Phaser.GameObjects.Sprite): void {
    const bounds = sprite.getBounds()
    const topLeftX = sprite.x - sprite.displayOriginX
    const topLeftY = sprite.y - sprite.displayOriginY
    const offsetX = bounds.x - topLeftX
    const offsetY = bounds.y - topLeftY

    const body = sprite.body as Phaser.Physics.Arcade.Body
    body.setSize(bounds.width, bounds.height)
    body.setOffset(offsetX, offsetY)
  }

  /**
   * Configures item-specific properties and metadata.
   * @param item - The item to configure
   * @param itemType - The type of the item
   * @private
   */
  private configureItemProperties(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle, itemType: ItemType): void {
    const color = this.getItemColor(itemType)
    const uniqueId = this.generateUniqueId()

    item.setData('color', color)
    item.setData('itemType', itemType)
    item.setData('id', uniqueId)
  }

  /**
   * Sets the position of the item to a random X coordinate.
   * @param item - The item to position
   * @private
   */
  private configureItemPosition(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    const randomX = Phaser.Math.Between(
      this.config.spawnXMin,
      this.scene.cameras.main.width - this.config.spawnXMax
    )
    item.setPosition(randomX, this.config.spawnY)
  }

  /**
   * Configures the physics properties of the item.
   * @param item - The item to configure
   * @private
   */
  private configureItemPhysics(item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
    item.setData('speed', speed)
  }

  /**
   * Removes an item from the game world and returns it to the pool.
   * @param item - The item rectangle to remove
   */
  remove(item: Phaser.GameObjects.Rectangle): void {
    this.group.remove(item)
    item.setActive(false).setVisible(false)
    this.pool.push(item)
  }

  /**
   * Gets the color associated with an item type.
   * @param itemType - The type of item
   * @returns The color as a hex number
   * @private
   */
  private getItemColor(itemType: ItemType): number {
    switch (itemType) {
      case ItemType.POINTS: return 0xffff00 // Yellow
      case ItemType.LIFE: return 0xff0000   // Red
      case ItemType.SLOWMO: return 0x00ffff // Cyan
      case ItemType.MULTI: return 0xff8800  // Orange
      case ItemType.ANGEL: return 0xffffff  // White
      default: return 0xffffff // Default white
    }
  }

  /**
   * Finds an appropriate texture key for the given item type.
   * Uses exact matches first, then falls back to substring matching.
   * @param itemType - The type of item to find a texture for
   * @returns The texture key if found, undefined otherwise
   * @private
   */
  private findItemTextureKey(itemType: ItemType): string | undefined {
    // Preferred exact texture names for each item type
    const exactMatches: Record<ItemType, string[]> = {
      [ItemType.POINTS]: ['gift', 'gift_yellow'],
      [ItemType.LIFE]: ['heart'],
      [ItemType.SLOWMO]: ['snowflake'],
      [ItemType.MULTI]: ['star'],
      [ItemType.ANGEL]: ['angel']
    }

    // Check for exact matches first
    for (const key of exactMatches[itemType]) {
      if (this.scene.textures.exists(key)) {
        return key
      }
    }

    // Fallback: search for textures containing hint keywords
    const textureHints: Record<ItemType, string[]> = {
      [ItemType.POINTS]: ['gift', 'present', 'box', 'yellow'],
      [ItemType.LIFE]: ['heart', 'redheart', 'life'],
      [ItemType.SLOWMO]: ['snowflake', 'snow', 'flake', 'icy'],
      [ItemType.MULTI]: ['star', 'orange', 'bonus'],
      [ItemType.ANGEL]: ['angel', 'cherub']
    }

    const availableTextures = Object.keys((this.scene.textures as any).list ?? {})
    for (const textureKey of availableTextures) {
      const lowerKey = textureKey.toLowerCase()
      if (textureHints[itemType].some(hint => lowerKey.includes(hint))) {
        return textureKey
      }
    }

    return undefined
  }

  /**
   * Generates a unique ID for an item.
   * Uses crypto.randomUUID() if available, otherwise falls back to timestamp + random string.
   * @returns A unique identifier string
   * @private
   */
  private generateUniqueId(): string {
    if ((globalThis as any).crypto?.randomUUID) {
      return (globalThis as any).crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  /**
   * Type guard to check if a game object is a sprite.
   * @param obj - The game object to check
   * @returns True if the object is a sprite
   * @private
   */
  private isSprite(obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): obj is Phaser.GameObjects.Sprite {
    return 'setTexture' in obj && 'setScale' in obj && 'getBounds' in obj
  }

  /**
   * Type guard to check if a game object is a rectangle.
   * @param obj - The game object to check
   * @returns True if the object is a rectangle
   * @private
   */
  private isRectangle(obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): obj is Phaser.GameObjects.Rectangle {
    return 'setFillStyle' in obj && 'setSize' in obj
  }
}
