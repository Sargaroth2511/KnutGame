import { describe, it, expect, beforeEach, vi } from 'vitest'
import Phaser from 'phaser'
import { OptimizedCollisionSystem } from '../src/systems/OptimizedCollisionSystem'

// Mock Phaser objects
const createMockPlayer = (x: number, y: number) => ({
  x,
  y,
  getBounds: () => new Phaser.Geom.Rectangle(x - 16, y - 16, 32, 32)
}) as unknown as Phaser.GameObjects.Rectangle

const createMockObstacle = (x: number, y: number, active: boolean = true) => ({
  x,
  y,
  active,
  scene: {} as Phaser.Scene,
  getBounds: () => new Phaser.Geom.Rectangle(x - 24, y - 24, 48, 48)
}) as unknown as Phaser.GameObjects.Sprite

const createMockItem = (x: number, y: number, active: boolean = true) => ({
  x,
  y,
  active,
  scene: {} as Phaser.Scene,
  getBounds: () => new Phaser.Geom.Rectangle(x - 16, y - 16, 32, 32)
}) as unknown as Phaser.GameObjects.Rectangle

const createMockGroup = (objects: any[]) => ({
  children: {
    each: (callback: (obj: any) => boolean) => {
      for (const obj of objects) {
        if (!callback(obj)) break
      }
    }
  },
  countActive: vi.fn().mockReturnValue(objects.filter(obj => obj.active).length)
}) as unknown as Phaser.GameObjects.Group

describe('OptimizedCollisionSystem', () => {
  let collisionSystem: OptimizedCollisionSystem
  let player: Phaser.GameObjects.Rectangle

  beforeEach(() => {
    collisionSystem = new OptimizedCollisionSystem({
      enableSpatialPartitioning: true,
      enableEarlyExit: true,
      spatialGridSize: 128
    })
    player = createMockPlayer(100, 100)
  })

  describe('spatial partitioning', () => {
    it('should create spatial grid for collision optimization', () => {
      const obstacles = [
        createMockObstacle(100, 100),
        createMockObstacle(300, 300)
      ]
      const items = [
        createMockItem(150, 150)
      ]

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      const result = collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      expect(result.spatialCellsChecked).toBeGreaterThan(0)
      
      const stats = collisionSystem.getStats()
      expect(stats.spatialCells).toBeGreaterThan(0)
      expect(stats.obstaclesInGrid).toBe(obstacles.length)
      expect(stats.itemsInGrid).toBe(items.length)
    })

    it('should reduce collision checks with spatial partitioning', () => {
      // Create objects far apart to test spatial optimization
      const obstacles = [
        createMockObstacle(100, 100),   // Near player
        createMockObstacle(1000, 1000)  // Far from player
      ]
      const items = [
        createMockItem(150, 150),       // Near player
        createMockItem(1000, 1000)      // Far from player
      ]

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      const result = collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      // Should skip some checks due to spatial partitioning
      expect(result.checksSkipped).toBeGreaterThan(0)
    })
  })

  describe('early exit optimization', () => {
    it('should exit early after first collision', () => {
      const obstacles = [
        createMockObstacle(100, 100), // This should collide
        createMockObstacle(105, 105)  // This should be skipped due to early exit
      ]

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup([])
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      // Should only hit once due to early exit
      expect(onObstacleHit).toHaveBeenCalledTimes(1)
    })

    it('should handle both obstacle and item collisions with early exit', () => {
      const obstacles = [createMockObstacle(100, 100)]
      const items = [createMockItem(100, 100)]

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      expect(onObstacleHit).toHaveBeenCalledTimes(1)
      expect(onItemCollect).toHaveBeenCalledTimes(1)
    })
  })

  describe('fallback to brute force', () => {
    it('should work without spatial partitioning', () => {
      const collisionSystemNoSpatial = new OptimizedCollisionSystem({
        enableSpatialPartitioning: false
      })

      const obstacles = [createMockObstacle(100, 100)]
      const items = [createMockItem(100, 100)]

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      const result = collisionSystemNoSpatial.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      expect(result.checksPerformed).toBeGreaterThan(0)
      expect(result.spatialCellsChecked).toBe(0)
    })
  })

  describe('performance metrics', () => {
    it('should track collision statistics', () => {
      const obstacles = [
        createMockObstacle(100, 100),
        createMockObstacle(200, 200)
      ]
      const items = [
        createMockItem(150, 150)
      ]

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      const result = collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      expect(result.checksPerformed).toBeGreaterThanOrEqual(0)
      expect(result.checksSkipped).toBeGreaterThanOrEqual(0)
      expect(result.spatialCellsChecked).toBeGreaterThan(0)

      const stats = collisionSystem.getStats()
      expect(stats.spatialCells).toBeGreaterThanOrEqual(0)
      expect(stats.averageObjectsPerCell).toBeGreaterThanOrEqual(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty groups', () => {
      const obstacleGroup = createMockGroup([])
      const itemGroup = createMockGroup([])
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      expect(() => {
        collisionSystem.checkCollisions(
          player,
          obstacleGroup,
          itemGroup,
          onObstacleHit,
          onItemCollect
        )
      }).not.toThrow()

      expect(onObstacleHit).not.toHaveBeenCalled()
      expect(onItemCollect).not.toHaveBeenCalled()
    })

    it('should handle inactive objects', () => {
      const obstacles = [createMockObstacle(100, 100, false)] // Inactive
      const items = [createMockItem(100, 100, false)] // Inactive

      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      expect(onObstacleHit).not.toHaveBeenCalled()
      expect(onItemCollect).not.toHaveBeenCalled()
    })

    it('should handle objects without bounds', () => {
      const obstacle = {
        x: 100,
        y: 100,
        active: true,
        scene: {} as Phaser.Scene
        // No getBounds method
      } as unknown as Phaser.GameObjects.Sprite

      const obstacleGroup = createMockGroup([obstacle])
      const itemGroup = createMockGroup([])
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      expect(() => {
        collisionSystem.checkCollisions(
          player,
          obstacleGroup,
          itemGroup,
          onObstacleHit,
          onItemCollect
        )
      }).not.toThrow()
    })
  })

  describe('configuration updates', () => {
    it('should allow configuration updates', () => {
      collisionSystem.updateConfig({
        spatialGridSize: 256,
        enableEarlyExit: false
      })

      // Test that new configuration is applied
      const obstacles = [createMockObstacle(100, 100)]
      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup([])
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      expect(() => {
        collisionSystem.checkCollisions(
          player,
          obstacleGroup,
          itemGroup,
          onObstacleHit,
          onItemCollect
        )
      }).not.toThrow()
    })
  })

  describe('spatial grid management', () => {
    it('should clear spatial grid', () => {
      const obstacles = [createMockObstacle(100, 100)]
      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup([])
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      // First check to populate grid
      collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      let stats = collisionSystem.getStats()
      expect(stats.spatialCells).toBeGreaterThan(0)

      // Clear grid
      collisionSystem.clearSpatialGrid()

      stats = collisionSystem.getStats()
      expect(stats.spatialCells).toBe(0)
    })
  })
})