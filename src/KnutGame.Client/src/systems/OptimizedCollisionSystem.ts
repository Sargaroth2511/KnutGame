import Phaser from 'phaser'
// Removed unused import
import { globalBenchmark } from '../utils/performanceBenchmark'

/**
 * Spatial grid cell for collision optimization
 */
interface SpatialCell {
  obstacles: Phaser.GameObjects.Sprite[]
  items: Phaser.GameObjects.Rectangle[]
  x: number
  y: number
}

/**
 * Collision detection result with performance metrics
 */
interface CollisionResult {
  obstacleHits: Phaser.GameObjects.Sprite[]
  itemCollections: Phaser.GameObjects.Rectangle[]
  checksPerformed: number
  checksSkipped: number
  spatialCellsChecked: number
}

/**
 * Configuration for optimized collision detection
 */
interface CollisionConfig {
  /** Enable spatial partitioning optimization */
  enableSpatialPartitioning: boolean
  /** Size of spatial grid cells in pixels */
  spatialGridSize: number
  /** Enable early exit optimization */
  enableEarlyExit: boolean
  /** Enable collision caching */
  enableCaching: boolean
  /** Cache timeout in milliseconds */
  cacheTimeout: number
}

/**
 * Optimized collision detection system with spatial partitioning and early exit strategies
 */
export class OptimizedCollisionSystem {
  private spatialGrid: Map<string, SpatialCell> = new Map()
  private config: CollisionConfig

  constructor(config: Partial<CollisionConfig> = {}) {
    this.config = {
      enableSpatialPartitioning: true,
      spatialGridSize: 128,
      enableEarlyExit: true,
      enableCaching: false, // Disabled by default as it may not be beneficial for fast-moving objects
      cacheTimeout: 16, // One frame at 60fps
      ...config
    }
  }

  /**
   * Optimized collision detection with spatial partitioning and early exit
   */
  checkCollisions(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    obstacles: Phaser.GameObjects.Group,
    items: Phaser.GameObjects.Group,
    onObstacleHit: (obstacle: Phaser.GameObjects.Sprite) => void,
    onItemCollect: (item: Phaser.GameObjects.Rectangle) => void
  ): CollisionResult {
    return globalBenchmark.measure('collision_detection', () => {
      if (this.config.enableSpatialPartitioning) {
        return this.checkCollisionsSpatial(player, obstacles, items, onObstacleHit, onItemCollect)
      } else {
        return this.checkCollisionsBruteForce(player, obstacles, items, onObstacleHit, onItemCollect)
      }
    })
  }

  /**
   * Collision detection using spatial partitioning
   */
  private checkCollisionsSpatial(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    obstacles: Phaser.GameObjects.Group,
    items: Phaser.GameObjects.Group,
    onObstacleHit: (obstacle: Phaser.GameObjects.Sprite) => void,
    onItemCollect: (item: Phaser.GameObjects.Rectangle) => void
  ): CollisionResult {
    const result: CollisionResult = {
      obstacleHits: [],
      itemCollections: [],
      checksPerformed: 0,
      checksSkipped: 0,
      spatialCellsChecked: 0
    }

    // Update spatial grid
    this.updateSpatialGrid(obstacles, items)

    // Get player's spatial cells (player might span multiple cells)
    const playerCells = this.getPlayerCells(player)
    result.spatialCellsChecked = playerCells.length

    let obstacleHit = false
    let itemCollected = false

    // Check collisions only in relevant spatial cells
    for (const cellKey of playerCells) {
      const cell = this.spatialGrid.get(cellKey)
      if (!cell) continue

      // Check obstacle collisions with early exit
      if (!obstacleHit && this.config.enableEarlyExit) {
        for (const obstacle of cell.obstacles) {
          result.checksPerformed++
          
          if (this.checkObstacleCollision(player, obstacle)) {
            result.obstacleHits.push(obstacle)
            onObstacleHit(obstacle)
            obstacleHit = true
            break // Early exit after first hit
          }
        }
      }

      // Check item collisions with early exit
      if (!itemCollected && this.config.enableEarlyExit) {
        for (const item of cell.items) {
          result.checksPerformed++
          
          if (this.checkItemCollision(player, item)) {
            result.itemCollections.push(item)
            onItemCollect(item)
            itemCollected = true
            break // Early exit after first collection
          }
        }
      }

      // If both hit and collected, no need to check more cells
      if (obstacleHit && itemCollected && this.config.enableEarlyExit) {
        break
      }
    }

    // Calculate skipped checks
    const totalObstacles = obstacles.countActive(true)
    const totalItems = items.countActive(true)
    const totalPossibleChecks = totalObstacles + totalItems
    result.checksSkipped = Math.max(0, totalPossibleChecks - result.checksPerformed)

    return result
  }

  /**
   * Brute force collision detection (fallback)
   */
  private checkCollisionsBruteForce(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    obstacles: Phaser.GameObjects.Group,
    items: Phaser.GameObjects.Group,
    onObstacleHit: (obstacle: Phaser.GameObjects.Sprite) => void,
    onItemCollect: (item: Phaser.GameObjects.Rectangle) => void
  ): CollisionResult {
    const result: CollisionResult = {
      obstacleHits: [],
      itemCollections: [],
      checksPerformed: 0,
      checksSkipped: 0,
      spatialCellsChecked: 0
    }

    // Check obstacle collisions
    obstacles.children.each((obstacle) => {
      if (!obstacle.active) return true
      
      result.checksPerformed++
      
      if (this.checkObstacleCollision(player, obstacle as Phaser.GameObjects.Sprite)) {
        result.obstacleHits.push(obstacle as Phaser.GameObjects.Sprite)
        onObstacleHit(obstacle as Phaser.GameObjects.Sprite)
        
        if (this.config.enableEarlyExit) {
          return false // Stop checking more obstacles
        }
      }
      
      return true
    })

    // Check item collisions
    items.children.each((item) => {
      if (!item.active) return true
      
      result.checksPerformed++
      
      if (this.checkItemCollision(player, item as Phaser.GameObjects.Rectangle)) {
        result.itemCollections.push(item as Phaser.GameObjects.Rectangle)
        onItemCollect(item as Phaser.GameObjects.Rectangle)
        
        if (this.config.enableEarlyExit) {
          return false // Stop checking more items
        }
      }
      
      return true
    })

    return result
  }

  /**
   * Updates the spatial grid with current object positions
   */
  private updateSpatialGrid(obstacles: Phaser.GameObjects.Group, items: Phaser.GameObjects.Group): void {
    globalBenchmark.measure('spatial_grid_update', () => {
      this.spatialGrid.clear()

      // Add obstacles to spatial grid
      obstacles.children.each((obstacle) => {
        if (obstacle.active) {
          const cellKeys = this.getObjectCells(obstacle as Phaser.GameObjects.Sprite)
          for (const cellKey of cellKeys) {
            this.ensureSpatialCell(cellKey)
            this.spatialGrid.get(cellKey)!.obstacles.push(obstacle as Phaser.GameObjects.Sprite)
          }
        }
        return true
      })

      // Add items to spatial grid
      items.children.each((item) => {
        if (item.active) {
          const cellKeys = this.getObjectCells(item as Phaser.GameObjects.Rectangle)
          for (const cellKey of cellKeys) {
            this.ensureSpatialCell(cellKey)
            this.spatialGrid.get(cellKey)!.items.push(item as Phaser.GameObjects.Rectangle)
          }
        }
        return true
      })
    })
  }

  /**
   * Gets spatial cell keys that a game object occupies
   */
  private getObjectCells(obj: Phaser.GameObjects.GameObject): string[] {
    const bounds = this.getObjectBounds(obj)
    if (!bounds) return []

    const cellSize = this.config.spatialGridSize
    const minX = Math.floor(bounds.left / cellSize)
    const maxX = Math.floor(bounds.right / cellSize)
    const minY = Math.floor(bounds.top / cellSize)
    const maxY = Math.floor(bounds.bottom / cellSize)

    const cells: string[] = []
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        cells.push(`${x},${y}`)
      }
    }

    return cells
  }

  /**
   * Gets spatial cell keys that the player occupies
   */
  private getPlayerCells(player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite): string[] {
    return this.getObjectCells(player as Phaser.GameObjects.GameObject)
  }

  /**
   * Ensures a spatial cell exists
   */
  private ensureSpatialCell(cellKey: string): void {
    if (!this.spatialGrid.has(cellKey)) {
      const [x, y] = cellKey.split(',').map(Number)
      this.spatialGrid.set(cellKey, {
        obstacles: [],
        items: [],
        x,
        y
      })
    }
  }

  /**
   * Gets bounds of a game object
   */
  private getObjectBounds(obj: Phaser.GameObjects.GameObject): Phaser.Geom.Rectangle | null {
    const anyObj = obj as any
    if (typeof anyObj.getBounds === 'function') {
      return anyObj.getBounds()
    }
    
    // Fallback for objects without getBounds
    if (anyObj.x !== undefined && anyObj.y !== undefined) {
      const width = anyObj.displayWidth || anyObj.width || 32
      const height = anyObj.displayHeight || anyObj.height || 32
      return new Phaser.Geom.Rectangle(
        anyObj.x - width / 2,
        anyObj.y - height / 2,
        width,
        height
      )
    }
    
    return null
  }

  /**
   * Checks collision between player and obstacle using simplified bounds checking
   */
  private checkObstacleCollision(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    obstacle: Phaser.GameObjects.Sprite
  ): boolean {
    const playerBounds = this.getObjectBounds(player as Phaser.GameObjects.GameObject)
    const obstacleBounds = this.getObjectBounds(obstacle as Phaser.GameObjects.GameObject)
    
    if (!playerBounds || !obstacleBounds) return false
    
    // Simple AABB collision check for spatial optimization
    return Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, obstacleBounds)
  }

  /**
   * Checks collision between player and item using simplified bounds checking
   */
  private checkItemCollision(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    item: Phaser.GameObjects.Rectangle
  ): boolean {
    const playerBounds = this.getObjectBounds(player as Phaser.GameObjects.GameObject)
    const itemBounds = this.getObjectBounds(item as Phaser.GameObjects.GameObject)
    
    if (!playerBounds || !itemBounds) return false
    
    // Simple AABB collision check for spatial optimization
    return Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, itemBounds)
  }

  /**
   * Gets collision detection statistics
   */
  getStats(): {
    spatialCells: number
    obstaclesInGrid: number
    itemsInGrid: number
    averageObjectsPerCell: number
  } {
    let totalObstacles = 0
    let totalItems = 0
    
    for (const cell of this.spatialGrid.values()) {
      totalObstacles += cell.obstacles.length
      totalItems += cell.items.length
    }
    
    const totalCells = this.spatialGrid.size
    const totalObjects = totalObstacles + totalItems
    
    return {
      spatialCells: totalCells,
      obstaclesInGrid: totalObstacles,
      itemsInGrid: totalItems,
      averageObjectsPerCell: totalCells > 0 ? totalObjects / totalCells : 0
    }
  }

  /**
   * Clears the spatial grid (useful for cleanup)
   */
  clearSpatialGrid(): void {
    this.spatialGrid.clear()
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<CollisionConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}