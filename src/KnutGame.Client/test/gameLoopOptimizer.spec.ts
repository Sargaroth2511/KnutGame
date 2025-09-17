import { describe, it, expect, beforeEach, vi } from 'vitest'
import Phaser from 'phaser'
import { GameLoopOptimizer } from '../src/systems/GameLoopOptimizer'
import { createScoreState } from '../src/systems/scoring'

// Mock Phaser scene
const createMockScene = () => ({
  cameras: {
    main: {
      width: 800,
      height: 600,
      scrollX: 0,
      scrollY: 0
    }
  },
  physics: {
    add: {
      group: () => ({
        children: {
          each: vi.fn()
        },
        countActive: vi.fn().mockReturnValue(0)
      })
    }
  }
}) as unknown as Phaser.Scene

// Mock game objects
const createMockObstacle = (x: number, y: number, active: boolean = true) => ({
  x,
  y,
  active,
  angle: 0,
  body: {
    setVelocityY: vi.fn(),
    setVelocityX: vi.fn()
  },
  getData: vi.fn((key: string) => {
    switch (key) {
      case 'speed': return 150
      case 'vx': return 0
      case 'omega': return 0
      case 'swayPhase': return 0
      default: return undefined
    }
  }),
  setData: vi.fn(),
  setAngle: vi.fn()
}) as unknown as Phaser.GameObjects.Sprite

const createMockItem = (x: number, y: number, active: boolean = true) => ({
  x,
  y,
  active,
  body: {
    setVelocityY: vi.fn()
  },
  getData: vi.fn((key: string) => {
    switch (key) {
      case 'speed': return 150
      default: return undefined
    }
  })
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

describe('GameLoopOptimizer', () => {
  let optimizer: GameLoopOptimizer
  let mockScene: Phaser.Scene
  let scoreState: any

  beforeEach(() => {
    mockScene = createMockScene()
    optimizer = new GameLoopOptimizer(mockScene, {
      enableCulling: true,
      enableBatching: true,
      batchSize: 5
    })
    scoreState = createScoreState()
  })

  describe('obstacle updates', () => {
    it('should update obstacles in batches', () => {
      const obstacles = [
        createMockObstacle(100, 100),
        createMockObstacle(200, 200),
        createMockObstacle(300, 300),
        createMockObstacle(400, 400),
        createMockObstacle(500, 500)
      ]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)

      // Verify all obstacles were processed
      obstacles.forEach(obstacle => {
        expect(obstacle.body.setVelocityY).toHaveBeenCalled()
      })
    })

    it('should cull off-screen obstacles', () => {
      const obstacles = [
        createMockObstacle(100, -200), // Off-screen above
        createMockObstacle(200, 200),  // On-screen
        createMockObstacle(300, 1000)  // Off-screen below
      ]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)

      const metrics = optimizer.getMetrics()
      expect(metrics.obstaclesCulled).toBeGreaterThan(0)
      expect(metrics.obstaclesProcessed).toBeLessThan(obstacles.length)
    })

    it('should remove obstacles that fall off screen', () => {
      const obstacles = [
        createMockObstacle(100, 700) // Below screen
      ]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)

      expect(onRemove).toHaveBeenCalledWith(obstacles[0])
    })

    it('should handle empty obstacle group', () => {
      const mockGroup = createMockGroup([])
      const onRemove = vi.fn()

      expect(() => {
        optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)
      }).not.toThrow()

      const metrics = optimizer.getMetrics()
      expect(metrics.obstaclesProcessed).toBe(0)
    })
  })

  describe('item updates', () => {
    it('should update items in batches', () => {
      const items = [
        createMockItem(100, 100),
        createMockItem(200, 200),
        createMockItem(300, 300)
      ]
      const mockGroup = createMockGroup(items)
      const onRemove = vi.fn()

      optimizer.updateItems(mockGroup, scoreState, onRemove)

      // Verify all items were processed
      items.forEach(item => {
        expect(item.body.setVelocityY).toHaveBeenCalled()
      })
    })

    it('should cull off-screen items', () => {
      const items = [
        createMockItem(100, -200), // Off-screen above
        createMockItem(200, 200),  // On-screen
        createMockItem(300, 1000)  // Off-screen below
      ]
      const mockGroup = createMockGroup(items)
      const onRemove = vi.fn()

      optimizer.updateItems(mockGroup, scoreState, onRemove)

      const metrics = optimizer.getMetrics()
      expect(metrics.itemsCulled).toBeGreaterThan(0)
      expect(metrics.itemsProcessed).toBeLessThan(items.length)
    })

    it('should remove items that fall off screen', () => {
      const items = [
        createMockItem(100, 700) // Below screen
      ]
      const mockGroup = createMockGroup(items)
      const onRemove = vi.fn()

      optimizer.updateItems(mockGroup, scoreState, onRemove)

      expect(onRemove).toHaveBeenCalledWith(items[0])
    })
  })

  describe('performance metrics', () => {
    it('should track processing times', () => {
      const obstacles = [createMockObstacle(100, 100)]
      const items = [createMockItem(200, 200)]
      const mockObstacleGroup = createMockGroup(obstacles)
      const mockItemGroup = createMockGroup(items)
      const onRemove = vi.fn()

      optimizer.updateObstacles(mockObstacleGroup, scoreState, 1000, 16, onRemove)
      optimizer.updateItems(mockItemGroup, scoreState, onRemove)

      const metrics = optimizer.getMetrics()
      expect(metrics.obstacleUpdateTime).toBeGreaterThanOrEqual(0)
      expect(metrics.itemUpdateTime).toBeGreaterThanOrEqual(0)
      expect(metrics.obstaclesProcessed).toBe(1)
      expect(metrics.itemsProcessed).toBe(1)
    })

    it('should reset metrics', () => {
      const obstacles = [createMockObstacle(100, 100)]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)
      
      let metrics = optimizer.getMetrics()
      expect(metrics.obstaclesProcessed).toBe(1)

      optimizer.resetMetrics()
      
      metrics = optimizer.getMetrics()
      expect(metrics.obstaclesProcessed).toBe(0)
    })
  })

  describe('configuration', () => {
    it('should respect culling configuration', () => {
      const optimizerNoCulling = new GameLoopOptimizer(mockScene, {
        enableCulling: false
      })

      const obstacles = [
        createMockObstacle(100, -200) // Off-screen
      ]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizerNoCulling.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)

      const metrics = optimizerNoCulling.getMetrics()
      expect(metrics.obstaclesCulled).toBe(0) // No culling when disabled
    })

    it('should respect batching configuration', () => {
      const optimizerNoBatching = new GameLoopOptimizer(mockScene, {
        enableBatching: false
      })

      const obstacles = [createMockObstacle(100, 100)]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      expect(() => {
        optimizerNoBatching.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)
      }).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle inactive objects', () => {
      const obstacles = [
        createMockObstacle(100, 100, false) // Inactive
      ]
      const mockGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)

      const metrics = optimizer.getMetrics()
      expect(metrics.obstaclesProcessed).toBe(0)
    })

    it('should handle objects without required data', () => {
      const obstacle = createMockObstacle(100, 100)
      obstacle.getData = vi.fn().mockReturnValue(undefined) // No speed data

      const mockGroup = createMockGroup([obstacle])
      const onRemove = vi.fn()

      expect(() => {
        optimizer.updateObstacles(mockGroup, scoreState, 1000, 16, onRemove)
      }).not.toThrow()
    })
  })
})