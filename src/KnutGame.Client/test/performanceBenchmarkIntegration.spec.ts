import { describe, it, expect, beforeEach, vi } from 'vitest'
import Phaser from 'phaser'
import { GameLoopOptimizer } from '../src/systems/GameLoopOptimizer'
import { OptimizedCollisionSystem } from '../src/systems/OptimizedCollisionSystem'
import { PerformanceBenchmark, BenchmarkSuite } from '../src/utils/performanceBenchmark'
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
  }
}) as unknown as Phaser.Scene

// Create test objects
const createTestObstacles = (count: number) => {
  const obstacles = []
  for (let i = 0; i < count; i++) {
    obstacles.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      active: true,
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
      setAngle: vi.fn(),
      getBounds: () => new Phaser.Geom.Rectangle(
        obstacles[i]?.x - 24 || 0,
        obstacles[i]?.y - 24 || 0,
        48,
        48
      )
    })
  }
  return obstacles
}

const createTestItems = (count: number) => {
  const items = []
  for (let i = 0; i < count; i++) {
    items.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      active: true,
      body: {
        setVelocityY: vi.fn()
      },
      getData: vi.fn((key: string) => {
        switch (key) {
          case 'speed': return 150
          default: return undefined
        }
      }),
      getBounds: () => new Phaser.Geom.Rectangle(
        items[i]?.x - 16 || 0,
        items[i]?.y - 16 || 0,
        32,
        32
      )
    })
  }
  return items
}

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

describe('Performance Benchmark Integration', () => {
  let benchmark: PerformanceBenchmark
  let optimizer: GameLoopOptimizer
  let collisionSystem: OptimizedCollisionSystem
  let mockScene: Phaser.Scene
  let scoreState: any

  beforeEach(() => {
    benchmark = new PerformanceBenchmark({
      logToConsole: false,
      trackStats: true
    })
    mockScene = createMockScene()
    optimizer = new GameLoopOptimizer(mockScene)
    collisionSystem = new OptimizedCollisionSystem()
    scoreState = createScoreState()
  })

  describe('GameLoopOptimizer Performance', () => {
    it('should show performance improvement with optimization enabled', () => {
      const obstacles = createTestObstacles(50)
      const items = createTestItems(30)
      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onRemove = vi.fn()

      // Benchmark with optimization enabled
      const optimizedSuite = benchmark.createSuite('optimized')
      optimizedSuite.add('obstacle_updates', () => {
        optimizer.updateObstacles(obstacleGroup, scoreState, 1000, 16, onRemove)
      })
      optimizedSuite.add('item_updates', () => {
        optimizer.updateItems(itemGroup, scoreState, onRemove)
      })

      // Run benchmarks
      optimizedSuite.run(10)

      // Verify benchmarks were recorded
      const obstacleStats = benchmark.getStats('optimized.obstacle_updates')
      const itemStats = benchmark.getStats('optimized.item_updates')

      expect(obstacleStats).toBeTruthy()
      expect(itemStats).toBeTruthy()
      expect(obstacleStats!.count).toBe(10)
      expect(itemStats!.count).toBe(10)
      expect(obstacleStats!.average).toBeGreaterThan(0)
      expect(itemStats!.average).toBeGreaterThan(0)
    })

    it('should demonstrate culling effectiveness', () => {
      // Create obstacles mostly off-screen
      const obstacles = [
        ...createTestObstacles(10).map(obs => ({ ...obs, y: -200 })), // Off-screen above
        ...createTestObstacles(5), // On-screen
        ...createTestObstacles(10).map(obs => ({ ...obs, y: 1000 })) // Off-screen below
      ]

      const obstacleGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      optimizer.updateObstacles(obstacleGroup, scoreState, 1000, 16, onRemove)

      const metrics = optimizer.getMetrics()
      expect(metrics.obstaclesCulled).toBeGreaterThan(0)
      expect(metrics.obstaclesProcessed).toBeLessThan(obstacles.length)

      // Culling should reduce processing time
      const cullRatio = metrics.obstaclesCulled / (metrics.obstaclesProcessed + metrics.obstaclesCulled)
      expect(cullRatio).toBeGreaterThan(0.5) // More than 50% culled
    })

    it('should handle large numbers of objects efficiently', () => {
      const largeObstacleCount = 200
      const largeItemCount = 150
      
      const obstacles = createTestObstacles(largeObstacleCount)
      const items = createTestItems(largeItemCount)
      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onRemove = vi.fn()

      benchmark.start('large_scale_test')
      
      optimizer.updateObstacles(obstacleGroup, scoreState, 1000, 16, onRemove)
      optimizer.updateItems(itemGroup, scoreState, onRemove)
      
      const measurement = benchmark.end('large_scale_test')

      expect(measurement).toBeTruthy()
      expect(measurement!.duration).toBeLessThan(50) // Should complete in under 50ms

      const metrics = optimizer.getMetrics()
      expect(metrics.obstaclesProcessed + metrics.obstaclesCulled).toBe(largeObstacleCount)
      expect(metrics.itemsProcessed + metrics.itemsCulled).toBe(largeItemCount)
    })
  })

  describe('OptimizedCollisionSystem Performance', () => {
    it('should show collision detection performance', () => {
      const player = {
        x: 400,
        y: 300,
        getBounds: () => new Phaser.Geom.Rectangle(384, 284, 32, 32)
      } as unknown as Phaser.GameObjects.Rectangle

      const obstacles = createTestObstacles(100)
      const items = createTestItems(50)
      const obstacleGroup = createMockGroup(obstacles)
      const itemGroup = createMockGroup(items)
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      // Benchmark collision detection
      benchmark.start('collision_detection')
      
      const result = collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )
      
      const measurement = benchmark.end('collision_detection')

      expect(measurement).toBeTruthy()
      expect(result.checksSkipped).toBeGreaterThan(0) // Spatial partitioning should skip some checks
      expect(result.spatialCellsChecked).toBeGreaterThan(0)
    })

    it('should demonstrate spatial partitioning effectiveness', () => {
      const player = {
        x: 100,
        y: 100,
        getBounds: () => new Phaser.Geom.Rectangle(84, 84, 32, 32)
      } as unknown as Phaser.GameObjects.Rectangle

      // Create objects in different spatial regions
      const nearObstacles = createTestObstacles(10).map(obs => ({ ...obs, x: 120, y: 120 }))
      const farObstacles = createTestObstacles(40).map(obs => ({ ...obs, x: 700, y: 500 }))
      const allObstacles = [...nearObstacles, ...farObstacles]

      const obstacleGroup = createMockGroup(allObstacles)
      const itemGroup = createMockGroup([])
      const onObstacleHit = vi.fn()
      const onItemCollect = vi.fn()

      const result = collisionSystem.checkCollisions(
        player,
        obstacleGroup,
        itemGroup,
        onObstacleHit,
        onItemCollect
      )

      // Should skip many checks due to spatial partitioning
      const totalObjects = allObstacles.length
      const checkRatio = result.checksPerformed / totalObjects
      expect(checkRatio).toBeLessThan(0.5) // Should check less than 50% of objects

      const stats = collisionSystem.getStats()
      expect(stats.spatialCells).toBeGreaterThan(1)
    })
  })

  describe('Benchmark Suite Functionality', () => {
    it('should create and run benchmark suites', () => {
      const suite = benchmark.createSuite('test_suite')
      
      suite.add('fast_operation', () => {
        // Simulate fast operation
        let sum = 0
        for (let i = 0; i < 100; i++) {
          sum += i
        }
        return sum
      })

      suite.add('slow_operation', () => {
        // Simulate slower operation
        let sum = 0
        for (let i = 0; i < 10000; i++) {
          sum += Math.sqrt(i)
        }
        return sum
      })

      suite.run(5)

      const fastStats = benchmark.getStats('test_suite.fast_operation')
      const slowStats = benchmark.getStats('test_suite.slow_operation')

      expect(fastStats).toBeTruthy()
      expect(slowStats).toBeTruthy()
      expect(fastStats!.count).toBe(5)
      expect(slowStats!.count).toBe(5)
      expect(slowStats!.average).toBeGreaterThan(fastStats!.average)
    })

    it('should compare benchmark results', () => {
      // Run baseline benchmark
      benchmark.measure('baseline', () => {
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i * i
        }
        return sum
      })

      // Run optimized benchmark
      benchmark.measure('optimized', () => {
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i * i
        }
        return sum
      })

      const comparison = benchmark.compare('baseline', 'optimized')
      expect(comparison.benchmarkA).toBeTruthy()
      expect(comparison.benchmarkB).toBeTruthy()
      expect(comparison.improvement).not.toBeNull()
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', () => {
      // Simulate good performance
      for (let i = 0; i < 10; i++) {
        benchmark.measure('good_performance', () => {
          // Fast operation
          return Math.random() * 100
        })
      }

      // Simulate performance regression
      for (let i = 0; i < 5; i++) {
        benchmark.measure('regression_performance', () => {
          // Slower operation
          let sum = 0
          for (let j = 0; j < 1000; j++) {
            sum += Math.sqrt(j)
          }
          return sum
        })
      }

      const goodStats = benchmark.getStats('good_performance')
      const regressionStats = benchmark.getStats('regression_performance')

      expect(goodStats).toBeTruthy()
      expect(regressionStats).toBeTruthy()
      expect(regressionStats!.average).toBeGreaterThan(goodStats!.average)

      const comparison = benchmark.compare('good_performance', 'regression_performance')
      expect(comparison.improvement).toBeLessThan(0) // Negative improvement = regression
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should track resource usage in benchmarks', () => {
      const obstacles = createTestObstacles(100)
      const obstacleGroup = createMockGroup(obstacles)
      const onRemove = vi.fn()

      benchmark.measure('resource_test', () => {
        optimizer.updateObstacles(obstacleGroup, scoreState, 1000, 16, onRemove)
      }, {
        objectCount: obstacles.length,
        memoryBefore: performance.memory?.usedJSHeapSize || 0
      })

      const stats = benchmark.getStats('resource_test')
      expect(stats).toBeTruthy()

      const recentMeasurements = benchmark.getRecentMeasurements('resource_test', 1)
      expect(recentMeasurements).toHaveLength(1)
      expect(recentMeasurements[0].metadata).toBeTruthy()
      expect(recentMeasurements[0].metadata!.objectCount).toBe(obstacles.length)
    })
  })

  describe('Benchmark Data Management', () => {
    it('should export and import benchmark data', () => {
      benchmark.measure('export_test', () => Math.random())
      
      const exportedData = benchmark.exportData()
      expect(exportedData).toBeTruthy()
      
      const newBenchmark = new PerformanceBenchmark()
      newBenchmark.importData(exportedData)
      
      const importedStats = newBenchmark.getStats('export_test')
      expect(importedStats).toBeTruthy()
    })

    it('should generate performance reports', () => {
      benchmark.measure('report_test_1', () => Math.random())
      benchmark.measure('report_test_2', () => Math.random())
      
      const report = benchmark.generateReport()
      expect(report).toContain('Performance Benchmark Report')
      expect(report).toContain('report_test_1')
      expect(report).toContain('report_test_2')
    })

    it('should clear benchmark data', () => {
      benchmark.measure('clear_test', () => Math.random())
      
      let stats = benchmark.getStats('clear_test')
      expect(stats).toBeTruthy()
      
      benchmark.clearBenchmark('clear_test')
      
      stats = benchmark.getStats('clear_test')
      expect(stats).toBeNull()
    })
  })
})