import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ParticlePool } from '../src/systems/ParticlePool'
import { EnhancedObstacleSpawner, EnhancedItemSpawner } from '../src/systems/EnhancedSpawner'
import { PoolManager } from '../src/systems/PoolManager'
import { ItemType } from '../src/items'

// Mock Phaser scene
const createMockScene = () => {
  const mockGameObject = {
    setDepth: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    clearTint: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    setRotation: vi.fn().mockReturnThis(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 48, height: 96 })),
    destroy: vi.fn(),
    body: {
      setSize: vi.fn(),
      setOffset: vi.fn()
    },
    x: 0,
    y: 0,
    width: 48,
    height: 96,
    displayOriginX: 24,
    displayOriginY: 96
  }

  const mockGroup = {
    add: vi.fn(),
    remove: vi.fn(),
    destroy: vi.fn()
  }

  return {
    add: {
      rectangle: vi.fn(() => mockGameObject),
      ellipse: vi.fn(() => mockGameObject),
      sprite: vi.fn(() => mockGameObject)
    },
    physics: {
      add: {
        existing: vi.fn(),
        group: vi.fn(() => mockGroup)
      }
    },
    textures: {
      exists: vi.fn(() => true)
    },
    cameras: {
      main: {
        width: 800
      }
    },
    tweens: {
      add: vi.fn(),
      killTweensOf: vi.fn()
    },
    mockGameObject,
    mockGroup
  }
}

describe('Enhanced Pooling System Integration', () => {
  let mockScene: ReturnType<typeof createMockScene>
  let particlePool: ParticlePool
  let obstacleSpawner: EnhancedObstacleSpawner
  let itemSpawner: EnhancedItemSpawner
  let poolManager: PoolManager

  beforeEach(() => {
    mockScene = createMockScene()
    particlePool = new ParticlePool(mockScene as any)
    obstacleSpawner = new EnhancedObstacleSpawner(mockScene as any)
    itemSpawner = new EnhancedItemSpawner(mockScene as any)
    poolManager = new PoolManager()
  })

  describe('enhanced particle pool integration', () => {
    it('should initialize with enhanced pooling capabilities', () => {
      expect(particlePool).toBeDefined()
      
      const stats = particlePool.getPoolStats()
      expect(stats.rectangles.poolSize).toBeGreaterThan(0)
      expect(stats.ellipses.poolSize).toBeGreaterThan(0)
      expect(stats.memoryEfficiency).toBeGreaterThanOrEqual(0)
    })

    it('should spawn and manage particles efficiently', () => {
      // Spawn multiple particles
      particlePool.spawnRectangle({ x: 100, y: 200 })
      particlePool.spawnEllipse({ x: 150, y: 250 })
      
      const stats = particlePool.getPoolStats()
      expect(stats.totalActive).toBe(2)
      
      // Simulate particle completion to test reuse
      const tweenCalls = mockScene.tweens.add.mock.calls
      expect(tweenCalls.length).toBe(2)
      
      // Complete the first tween
      tweenCalls[0][0].onComplete()
      
      const updatedStats = particlePool.getPoolStats()
      expect(updatedStats.totalActive).toBe(1)
    })

    it('should provide memory pressure monitoring', () => {
      // Create some load
      for (let i = 0; i < 10; i++) {
        particlePool.spawnRectangle({ x: i * 10, y: i * 10 })
      }
      
      const memoryPressure = particlePool.getMemoryPressure()
      expect(memoryPressure).toBeGreaterThanOrEqual(0)
      expect(memoryPressure).toBeLessThanOrEqual(1)
    })
  })

  describe('enhanced obstacle spawner integration', () => {
    it('should spawn obstacles with enhanced pooling', () => {
      const obstacle = obstacleSpawner.spawn(1.0)
      
      expect(obstacle).toBeDefined()
      expect(mockScene.mockGroup.add).toHaveBeenCalled()
      
      const stats = obstacleSpawner.getPoolStats()
      expect(stats.activeCount).toBe(1)
      expect(stats.totalCreated).toBeGreaterThan(0)
    })

    it('should reuse obstacles efficiently', () => {
      const obstacle1 = obstacleSpawner.spawn()
      obstacleSpawner.remove(obstacle1)
      
      const obstacle2 = obstacleSpawner.spawn()
      
      const stats = obstacleSpawner.getPoolStats()
      expect(stats.totalReused).toBeGreaterThan(0)
    })

    it('should handle different difficulty levels', () => {
      const easyObstacle = obstacleSpawner.spawn(0.5)
      const hardObstacle = obstacleSpawner.spawn(2.0)
      
      expect(easyObstacle).toBeDefined()
      expect(hardObstacle).toBeDefined()
      
      const stats = obstacleSpawner.getPoolStats()
      expect(stats.activeCount).toBe(2)
    })
  })

  describe('enhanced item spawner integration', () => {
    it('should spawn items with enhanced pooling', () => {
      const item = itemSpawner.spawn()
      
      expect(item).toBeDefined()
      expect(mockScene.mockGroup.add).toHaveBeenCalled()
      
      const stats = itemSpawner.getPoolStats()
      expect(stats.activeCount).toBe(1)
    })

    it('should spawn different item types', () => {
      const coin = itemSpawner.spawnCoin()
      const powerup = itemSpawner.spawnPowerup()
      
      expect(coin).toBeDefined()
      expect(powerup).toBeDefined()
      
      const stats = itemSpawner.getPoolStats()
      expect(stats.activeCount).toBe(2)
    })

    it('should reuse items efficiently', () => {
      const item1 = itemSpawner.spawn()
      itemSpawner.remove(item1)
      
      const item2 = itemSpawner.spawn()
      
      const stats = itemSpawner.getPoolStats()
      expect(stats.totalReused).toBeGreaterThan(0)
    })
  })

  describe('pool manager integration', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(particlePool)
      poolManager.registerObstacleSpawner(obstacleSpawner)
      poolManager.registerItemSpawner(itemSpawner)
    })

    it('should provide system-wide statistics', () => {
      // Create some activity
      particlePool.spawnRectangle({ x: 100, y: 200 })
      obstacleSpawner.spawn()
      itemSpawner.spawn()
      
      const systemStats = poolManager.getSystemStats()
      
      expect(systemStats.overall.totalActiveObjects).toBe(3)
      expect(systemStats.overall.totalPooledObjects).toBeGreaterThan(0)
      expect(systemStats.overall.averageMemoryPressure).toBeGreaterThanOrEqual(0)
      expect(systemStats.overall.systemMemoryEfficiency).toBeGreaterThanOrEqual(0)
    })

    it('should provide optimization recommendations', () => {
      const recommendations = poolManager.getOptimizationRecommendations()
      
      expect(recommendations).toHaveProperty('shouldOptimizeParticles')
      expect(recommendations).toHaveProperty('shouldOptimizeObstacles')
      expect(recommendations).toHaveProperty('shouldOptimizeItems')
      expect(recommendations).toHaveProperty('memoryPressureLevel')
      expect(recommendations).toHaveProperty('recommendedActions')
      
      expect(['low', 'medium', 'high']).toContain(recommendations.memoryPressureLevel)
    })

    it('should perform system-wide optimization', () => {
      // Create some load to trigger optimization needs
      for (let i = 0; i < 5; i++) {
        particlePool.spawnRectangle({ x: i, y: i })
        obstacleSpawner.spawn()
        itemSpawner.spawn()
      }
      
      expect(() => poolManager.optimizeAllPools(true)).not.toThrow()
      
      const systemStats = poolManager.getSystemStats()
      expect(systemStats).toBeDefined()
    })

    it('should handle emergency cleanup', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      expect(() => poolManager.emergencyCleanup()).not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('performance characteristics', () => {
    it('should handle high-frequency operations efficiently', () => {
      const startTime = performance.now()
      
      // Perform many operations
      for (let i = 0; i < 50; i++) {
        particlePool.spawnRectangle({ x: i, y: i })
        
        if (i % 3 === 0) {
          const obstacle = obstacleSpawner.spawn()
          obstacleSpawner.remove(obstacle)
        }
        
        if (i % 5 === 0) {
          const item = itemSpawner.spawn()
          itemSpawner.remove(item)
        }
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete quickly
      expect(duration).toBeLessThan(100)
      
      // Verify pools are working
      const particleStats = particlePool.getPoolStats()
      const obstacleStats = obstacleSpawner.getPoolStats()
      const itemStats = itemSpawner.getPoolStats()
      
      expect(particleStats.rectangles.totalCreated).toBeGreaterThan(0)
      expect(obstacleStats.totalReused).toBeGreaterThan(0)
      expect(itemStats.totalReused).toBeGreaterThan(0)
    })

    it('should maintain memory efficiency under load', () => {
      // Create reuse scenario
      for (let cycle = 0; cycle < 3; cycle++) {
        // Spawn objects
        const obstacles = []
        const items = []
        
        for (let i = 0; i < 5; i++) {
          obstacles.push(obstacleSpawner.spawn())
          items.push(itemSpawner.spawn())
        }
        
        // Remove objects to return to pool
        obstacles.forEach(obs => obstacleSpawner.remove(obs))
        items.forEach(item => itemSpawner.remove(item))
      }
      
      const obstacleStats = obstacleSpawner.getPoolStats()
      const itemStats = itemSpawner.getPoolStats()
      
      // Should have good reuse ratios
      expect(obstacleStats.totalReused).toBeGreaterThan(0)
      expect(itemStats.totalReused).toBeGreaterThan(0)
    })
  })

  describe('error handling and robustness', () => {
    it('should handle pool destruction gracefully', () => {
      // Create some objects
      particlePool.spawnRectangle({ x: 100, y: 200 })
      obstacleSpawner.spawn()
      itemSpawner.spawn()
      
      // Destroy pools
      expect(() => {
        particlePool.destroy()
        obstacleSpawner.destroy()
        itemSpawner.destroy()
        poolManager.destroy()
      }).not.toThrow()
    })

    it('should handle object creation errors', () => {
      // Mock creation failure
      mockScene.add.rectangle.mockImplementation(() => {
        throw new Error('Creation failed')
      })
      
      // Should handle gracefully
      expect(() => particlePool.spawnRectangle({ x: 100, y: 200 })).toThrow()
      
      // Restore mock
      mockScene.add.rectangle.mockImplementation(() => mockScene.mockGameObject)
    })

    it('should provide consistent statistics even with errors', () => {
      // Create some valid objects first
      particlePool.spawnRectangle({ x: 100, y: 200 })
      
      // Mock destroy to fail
      mockScene.mockGameObject.destroy.mockImplementation(() => {
        throw new Error('Destroy failed')
      })
      
      // Statistics should still be accessible
      const stats = particlePool.getPoolStats()
      expect(stats).toBeDefined()
      expect(stats.rectangles.activeCount).toBeGreaterThanOrEqual(0)
    })
  })
})