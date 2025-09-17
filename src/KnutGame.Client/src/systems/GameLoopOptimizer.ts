import Phaser from 'phaser'
import { FALL_SPEED_MIN, DYNAMICS_ENABLED, OBSTACLE_SWAY_AMP, OBSTACLE_SWAY_FREQ } from '../gameConfig'
import { slowMoFactor } from './scoring'

/**
 * Configuration for game loop optimization settings
 */
interface OptimizationConfig {
  /** Enable object culling for off-screen entities */
  enableCulling: boolean
  /** Culling margin in pixels (objects this far off-screen are still updated) */
  cullingMargin: number
  /** Enable batched updates for similar operations */
  enableBatching: boolean
  /** Maximum number of objects to process per batch */
  batchSize: number
  /** Enable spatial partitioning for collision detection */
  enableSpatialPartitioning: boolean
  /** Size of spatial grid cells in pixels */
  spatialGridSize: number
}

/**
 * Represents a spatial grid cell for collision optimization
 */
interface SpatialCell {
  /** Objects currently in this cell */
  objects: Phaser.GameObjects.GameObject[]
  /** X coordinate of the cell */
  x: number
  /** Y coordinate of the cell */
  y: number
}

/**
 * Batch update data for obstacles
 */
interface ObstacleBatch {
  /** Obstacles to update in this batch */
  obstacles: Phaser.GameObjects.Sprite[]
  /** Slow motion factor for this batch */
  slowMoFactor: number
  /** Current time for physics calculations */
  time: number
  /** Delta time for this frame */
  delta: number
  /** Camera bounds for culling */
  cameraBounds: Phaser.Geom.Rectangle
}

/**
 * Batch update data for items
 */
interface ItemBatch {
  /** Items to update in this batch */
  items: Phaser.GameObjects.Rectangle[]
  /** Slow motion factor for this batch */
  slowMoFactor: number
  /** Camera bounds for culling */
  cameraBounds: Phaser.Geom.Rectangle
}

/**
 * Performance metrics for optimization tracking
 */
interface OptimizationMetrics {
  /** Number of obstacles processed this frame */
  obstaclesProcessed: number
  /** Number of obstacles culled this frame */
  obstaclesCulled: number
  /** Number of items processed this frame */
  itemsProcessed: number
  /** Number of items culled this frame */
  itemsCulled: number
  /** Time spent on obstacle updates (ms) */
  obstacleUpdateTime: number
  /** Time spent on item updates (ms) */
  itemUpdateTime: number
  /** Time spent on collision detection (ms) */
  collisionTime: number
  /** Number of collision checks performed */
  collisionChecks: number
  /** Number of collision checks skipped due to optimization */
  collisionSkips: number
}

/**
 * Optimizes the main game loop by implementing batched updates, object culling,
 * and spatial partitioning for improved performance.
 */
export class GameLoopOptimizer {
  private config: OptimizationConfig
  private spatialGrid: Map<string, SpatialCell> = new Map()
  private metrics: OptimizationMetrics = this.createEmptyMetrics()
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, config: Partial<OptimizationConfig> = {}) {
    this.scene = scene
    this.config = {
      enableCulling: true,
      cullingMargin: 100,
      enableBatching: true,
      batchSize: 10,
      enableSpatialPartitioning: true,
      spatialGridSize: 128,
      ...config
    }
  }

  /**
   * Optimized obstacle update loop with batching and culling
   */
  updateObstacles(
    obstacles: Phaser.GameObjects.Group,
    scoreState: any,
    time: number,
    delta: number,
    onRemove: (obstacle: Phaser.GameObjects.Sprite) => void
  ): void {
    const startTime = performance.now()
    this.metrics.obstaclesProcessed = 0
    this.metrics.obstaclesCulled = 0

    const cameraBounds = this.getCameraBounds()
    const slowMoFactorValue = slowMoFactor(scoreState, 0.5) // Use same factor as original
    const activeObstacles = this.getActiveObstacles(obstacles)

    if (this.config.enableBatching) {
      this.updateObstaclesBatched(activeObstacles, slowMoFactorValue, time, delta, cameraBounds, onRemove)
    } else {
      this.updateObstaclesSequential(activeObstacles, slowMoFactorValue, time, delta, cameraBounds, onRemove)
    }

    this.metrics.obstacleUpdateTime = performance.now() - startTime
  }

  /**
   * Optimized item update loop with batching and culling
   */
  updateItems(
    items: Phaser.GameObjects.Group,
    scoreState: any,
    onRemove: (item: Phaser.GameObjects.Rectangle) => void
  ): void {
    const startTime = performance.now()
    this.metrics.itemsProcessed = 0
    this.metrics.itemsCulled = 0

    const cameraBounds = this.getCameraBounds()
    const slowMoFactorValue = slowMoFactor(scoreState, 0.5)
    const activeItems = this.getActiveItems(items)

    if (this.config.enableBatching) {
      this.updateItemsBatched(activeItems, slowMoFactorValue, cameraBounds, onRemove)
    } else {
      this.updateItemsSequential(activeItems, slowMoFactorValue, cameraBounds, onRemove)
    }

    this.metrics.itemUpdateTime = performance.now() - startTime
  }

  /**
   * Optimized collision detection with spatial partitioning and early exit
   * Note: This is a placeholder - actual collision detection is handled by OptimizedCollisionSystem
   */
  checkCollisionsOptimized(
    _player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    _obstacles: Phaser.GameObjects.Group,
    _items: Phaser.GameObjects.Group,
    _onObstacleHit: (obstacle: Phaser.GameObjects.Sprite) => void,
    _onItemCollect: (item: Phaser.GameObjects.Rectangle) => void
  ): void {
    const startTime = performance.now()
    this.metrics.collisionChecks = 0
    this.metrics.collisionSkips = 0

    // This method is kept for interface compatibility but actual collision detection
    // is now handled by the OptimizedCollisionSystem class

    this.metrics.collisionTime = performance.now() - startTime
  }

  /**
   * Gets current optimization metrics
   */
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics }
  }

  /**
   * Resets optimization metrics
   */
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics()
  }

  /**
   * Updates obstacles in batches for better performance
   */
  private updateObstaclesBatched(
    obstacles: Phaser.GameObjects.Sprite[],
    slowMoFactorValue: number,
    time: number,
    delta: number,
    cameraBounds: Phaser.Geom.Rectangle,
    onRemove: (obstacle: Phaser.GameObjects.Sprite) => void
  ): void {
    const batchSize = this.config.batchSize
    
    for (let i = 0; i < obstacles.length; i += batchSize) {
      const batch: ObstacleBatch = {
        obstacles: obstacles.slice(i, i + batchSize),
        slowMoFactor: slowMoFactorValue,
        time,
        delta,
        cameraBounds
      }
      
      this.processBatchedObstacles(batch, onRemove)
    }
  }

  /**
   * Processes a batch of obstacles together
   */
  private processBatchedObstacles(
    batch: ObstacleBatch,
    onRemove: (obstacle: Phaser.GameObjects.Sprite) => void
  ): void {
    const toRemove: Phaser.GameObjects.Sprite[] = []

    for (const obstacle of batch.obstacles) {
      if (this.config.enableCulling && this.isObstacleCulled(obstacle, batch.cameraBounds)) {
        this.metrics.obstaclesCulled++
        continue
      }

      this.updateSingleObstacle(obstacle, batch.slowMoFactor, batch.time, batch.delta)
      this.metrics.obstaclesProcessed++

      // Check if obstacle should be removed
      if (obstacle.y > batch.cameraBounds.bottom + 50) {
        toRemove.push(obstacle)
      }
    }

    // Remove obstacles outside the batch loop to avoid iterator issues
    for (const obstacle of toRemove) {
      onRemove(obstacle)
    }
  }

  /**
   * Updates obstacles sequentially (fallback method)
   */
  private updateObstaclesSequential(
    obstacles: Phaser.GameObjects.Sprite[],
    slowMoFactorValue: number,
    time: number,
    delta: number,
    cameraBounds: Phaser.Geom.Rectangle,
    onRemove: (obstacle: Phaser.GameObjects.Sprite) => void
  ): void {
    const toRemove: Phaser.GameObjects.Sprite[] = []

    for (const obstacle of obstacles) {
      if (this.config.enableCulling && this.isObstacleCulled(obstacle, cameraBounds)) {
        this.metrics.obstaclesCulled++
        continue
      }

      this.updateSingleObstacle(obstacle, slowMoFactorValue, time, delta)
      this.metrics.obstaclesProcessed++

      if (obstacle.y > cameraBounds.bottom + 50) {
        toRemove.push(obstacle)
      }
    }

    for (const obstacle of toRemove) {
      onRemove(obstacle)
    }
  }

  /**
   * Updates a single obstacle with physics and dynamics
   */
  private updateSingleObstacle(
    obstacle: Phaser.GameObjects.Sprite,
    slowMoFactorValue: number,
    time: number,
    delta: number
  ): void {
    const obsBody = obstacle.body as Phaser.Physics.Arcade.Body
    const speed = (obstacle.getData('speed') as number) ?? FALL_SPEED_MIN
    obsBody.setVelocityY(speed * slowMoFactorValue)

    if (DYNAMICS_ENABLED) {
      const dt = delta / 1000
      const vx = (obstacle.getData('vx') as number) || 0
      const swayPhase = (obstacle.getData('swayPhase') as number) || 0
      const sway = OBSTACLE_SWAY_AMP * Math.sin((time / 1000 + swayPhase) * OBSTACLE_SWAY_FREQ)
      obsBody.setVelocityX(vx + sway)
      
      const omega = (obstacle.getData('omega') as number) || 0
      obstacle.setAngle((obstacle.angle || 0) + omega * dt)
      
      // Edge bounce
      const margin = 20
      if (obstacle.x < margin || obstacle.x > this.scene.cameras.main.width - margin) {
        const nvx = -((obstacle.getData('vx') as number) || 0)
        obstacle.setData('vx', nvx)
      }
    } else {
      obsBody.setVelocityX(0)
    }
  }

  /**
   * Updates items in batches for better performance
   */
  private updateItemsBatched(
    items: Phaser.GameObjects.Rectangle[],
    slowMoFactorValue: number,
    cameraBounds: Phaser.Geom.Rectangle,
    onRemove: (item: Phaser.GameObjects.Rectangle) => void
  ): void {
    const batchSize = this.config.batchSize
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch: ItemBatch = {
        items: items.slice(i, i + batchSize),
        slowMoFactor: slowMoFactorValue,
        cameraBounds
      }
      
      this.processBatchedItems(batch, onRemove)
    }
  }

  /**
   * Processes a batch of items together
   */
  private processBatchedItems(
    batch: ItemBatch,
    onRemove: (item: Phaser.GameObjects.Rectangle) => void
  ): void {
    const toRemove: Phaser.GameObjects.Rectangle[] = []

    for (const item of batch.items) {
      if (this.config.enableCulling && this.isItemCulled(item, batch.cameraBounds)) {
        this.metrics.itemsCulled++
        continue
      }

      this.updateSingleItem(item, batch.slowMoFactor)
      this.metrics.itemsProcessed++

      // Check if item should be removed
      if (item.y > batch.cameraBounds.bottom + 50) {
        toRemove.push(item)
      }
    }

    // Remove items outside the batch loop
    for (const item of toRemove) {
      onRemove(item)
    }
  }

  /**
   * Updates items sequentially (fallback method)
   */
  private updateItemsSequential(
    items: Phaser.GameObjects.Rectangle[],
    slowMoFactorValue: number,
    cameraBounds: Phaser.Geom.Rectangle,
    onRemove: (item: Phaser.GameObjects.Rectangle) => void
  ): void {
    const toRemove: Phaser.GameObjects.Rectangle[] = []

    for (const item of items) {
      if (this.config.enableCulling && this.isItemCulled(item, cameraBounds)) {
        this.metrics.itemsCulled++
        continue
      }

      this.updateSingleItem(item, slowMoFactorValue)
      this.metrics.itemsProcessed++

      if (item.y > cameraBounds.bottom + 50) {
        toRemove.push(item)
      }
    }

    for (const item of toRemove) {
      onRemove(item)
    }
  }

  /**
   * Updates a single item with physics
   */
  private updateSingleItem(item: Phaser.GameObjects.Rectangle, slowMoFactorValue: number): void {
    const itmBody = item.body as Phaser.Physics.Arcade.Body
    const speed = (item.getData('speed') as number) ?? FALL_SPEED_MIN
    itmBody.setVelocityY(speed * slowMoFactorValue)
  }



  /**
   * Checks if an obstacle should be culled (not updated)
   */
  private isObstacleCulled(obstacle: Phaser.GameObjects.Sprite, cameraBounds: Phaser.Geom.Rectangle): boolean {
    const margin = this.config.cullingMargin
    return obstacle.y < cameraBounds.top - margin || 
           obstacle.y > cameraBounds.bottom + margin ||
           obstacle.x < cameraBounds.left - margin || 
           obstacle.x > cameraBounds.right + margin
  }

  /**
   * Checks if an item should be culled (not updated)
   */
  private isItemCulled(item: Phaser.GameObjects.Rectangle, cameraBounds: Phaser.Geom.Rectangle): boolean {
    const margin = this.config.cullingMargin
    return item.y < cameraBounds.top - margin || 
           item.y > cameraBounds.bottom + margin ||
           item.x < cameraBounds.left - margin || 
           item.x > cameraBounds.right + margin
  }

  /**
   * Gets camera bounds for culling calculations
   */
  private getCameraBounds(): Phaser.Geom.Rectangle {
    const cam = this.scene.cameras.main
    return new Phaser.Geom.Rectangle(cam.scrollX, cam.scrollY, cam.width, cam.height)
  }

  /**
   * Gets active obstacles as an array for efficient iteration
   */
  private getActiveObstacles(obstacles: Phaser.GameObjects.Group): Phaser.GameObjects.Sprite[] {
    const result: Phaser.GameObjects.Sprite[] = []
    obstacles.children.each((obstacle) => {
      if (obstacle.active) {
        result.push(obstacle as Phaser.GameObjects.Sprite)
      }
      return true
    })
    return result
  }

  /**
   * Gets active items as an array for efficient iteration
   */
  private getActiveItems(items: Phaser.GameObjects.Group): Phaser.GameObjects.Rectangle[] {
    const result: Phaser.GameObjects.Rectangle[] = []
    items.children.each((item) => {
      if (item.active) {
        result.push(item as Phaser.GameObjects.Rectangle)
      }
      return true
    })
    return result
  }

  /**
   * Updates the spatial grid for collision optimization
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateSpatialGrid(obstacles: Phaser.GameObjects.Group, items: Phaser.GameObjects.Group): void {
    this.spatialGrid.clear()
    
    // Add obstacles to grid
    obstacles.children.each((obstacle) => {
      if (obstacle.active) {
        const cell = this.getObjectCell(obstacle as Phaser.GameObjects.GameObject)
        this.addToSpatialCell(cell, obstacle as Phaser.GameObjects.GameObject)
      }
      return true
    })

    // Add items to grid
    items.children.each((item) => {
      if (item.active) {
        const cell = this.getObjectCell(item as Phaser.GameObjects.GameObject)
        this.addToSpatialCell(cell, item as Phaser.GameObjects.GameObject)
      }
      return true
    })
  }

  /**
   * Gets the spatial cell for a game object
   */
  private getObjectCell(obj: Phaser.GameObjects.GameObject): string {
    const x = Math.floor((obj as any).x / this.config.spatialGridSize)
    const y = Math.floor((obj as any).y / this.config.spatialGridSize)
    return `${x},${y}`
  }

  /**
   * Gets the spatial cell for the player
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getPlayerCell(player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite): string {
    const x = Math.floor(player.x / this.config.spatialGridSize)
    const y = Math.floor(player.y / this.config.spatialGridSize)
    return `${x},${y}`
  }

  /**
   * Adds an object to a spatial cell
   */
  private addToSpatialCell(cellKey: string, obj: Phaser.GameObjects.GameObject): void {
    if (!this.spatialGrid.has(cellKey)) {
      const [x, y] = cellKey.split(',').map(Number)
      this.spatialGrid.set(cellKey, { objects: [], x, y })
    }
    this.spatialGrid.get(cellKey)!.objects.push(obj)
  }

  /**
   * Gets objects near the player's cell
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getNearbyObjects(playerCell: string): Phaser.GameObjects.GameObject[] {
    const [px, py] = playerCell.split(',').map(Number)
    const nearby: Phaser.GameObjects.GameObject[] = []

    // Check 3x3 grid around player
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cellKey = `${px + dx},${py + dy}`
        const cell = this.spatialGrid.get(cellKey)
        if (cell) {
          nearby.push(...cell.objects)
        }
      }
    }

    return nearby
  }

  /**
   * Creates empty metrics object
   */
  private createEmptyMetrics(): OptimizationMetrics {
    return {
      obstaclesProcessed: 0,
      obstaclesCulled: 0,
      itemsProcessed: 0,
      itemsCulled: 0,
      obstacleUpdateTime: 0,
      itemUpdateTime: 0,
      collisionTime: 0,
      collisionChecks: 0,
      collisionSkips: 0
    }
  }
}