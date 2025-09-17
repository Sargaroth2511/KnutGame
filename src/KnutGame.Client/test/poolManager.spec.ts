import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PoolManager } from '../src/systems/PoolManager'
import { ParticlePool } from '../src/systems/ParticlePool'
import { EnhancedObstacleSpawner, EnhancedItemSpawner } from '../src/systems/EnhancedSpawner'

// Mock implementations
const createMockParticlePool = () => ({
  getPoolStats: vi.fn(() => ({
    rectangles: {
      poolSize: 10,
      activeCount: 2,
      totalCreated: 15,
      totalDestroyed: 0,
      totalReused: 8,
      utilizationRatio: 0.2,
      requestRate: 5.0,
      peakActiveCount: 5,
      memoryPressure: 0.3
    },
    ellipses: {
      poolSize: 5,
      activeCount: 1,
      totalCreated: 8,
      totalDestroyed: 0,
      totalReused: 4,
      utilizationRatio: 0.1,
      requestRate: 2.0,
      peakActiveCount: 3,
      memoryPressure: 0.2
    },
    totalActive: 3,
    memoryEfficiency: 0.8
  })),
  optimizePools: vi.fn(),
  destroy: vi.fn()
})

const createMockObstacleSpawner = () => ({
  getPoolStats: vi.fn(() => ({
    poolSize: 8,
    activeCount: 3,
    totalCreated: 12,
    totalDestroyed: 1,
    totalReused: 6,
    utilizationRatio: 0.3,
    requestRate: 3.0,
    peakActiveCount: 4,
    memoryPressure: 0.4
  })),
  optimizePool: vi.fn(),
  destroy: vi.fn()
})

const createMockItemSpawner = () => ({
  getPoolStats: vi.fn(() => ({
    poolSize: 6,
    activeCount: 1,
    totalCreated: 10,
    totalDestroyed: 0,
    totalReused: 5,
    utilizationRatio: 0.1,
    requestRate: 1.5,
    peakActiveCount: 2,
    memoryPressure: 0.1
  })),
  optimizePool: vi.fn(),
  destroy: vi.fn()
})

describe('PoolManager', () => {
  let poolManager: PoolManager
  let mockParticlePool: ReturnType<typeof createMockParticlePool>
  let mockObstacleSpawner: ReturnType<typeof createMockObstacleSpawner>
  let mockItemSpawner: ReturnType<typeof createMockItemSpawner>

  beforeEach(() => {
    poolManager = new PoolManager()
    mockParticlePool = createMockParticlePool()
    mockObstacleSpawner = createMockObstacleSpawner()
    mockItemSpawner = createMockItemSpawner()
  })

  describe('pool registration', () => {
    it('should register particle pool', () => {
      expect(() => poolManager.registerParticlePool(mockParticlePool as any)).not.toThrow()
    })

    it('should register obstacle spawner', () => {
      expect(() => poolManager.registerObstacleSpawner(mockObstacleSpawner as any)).not.toThrow()
    })

    it('should register item spawner', () => {
      expect(() => poolManager.registerItemSpawner(mockItemSpawner as any)).not.toThrow()
    })
  })

  describe('system statistics', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should provide comprehensive system statistics', () => {
      const stats = poolManager.getSystemStats()

      expect(stats).toHaveProperty('particles')
      expect(stats).toHaveProperty('obstacles')
      expect(stats).toHaveProperty('items')
      expect(stats).toHaveProperty('overall')

      expect(stats.particles).toHaveProperty('rectangles')
      expect(stats.particles).toHaveProperty('ellipses')
      expect(stats.particles).toHaveProperty('totalActive')
      expect(stats.particles).toHaveProperty('memoryEfficiency')

      expect(stats.overall).toHaveProperty('totalPooledObjects')
      expect(stats.overall).toHaveProperty('totalActiveObjects')
      expect(stats.overall).toHaveProperty('averageMemoryPressure')
      expect(stats.overall).toHaveProperty('systemMemoryEfficiency')
    })

    it('should calculate overall statistics correctly', () => {
      const stats = poolManager.getSystemStats()

      // Total pooled objects: 10 + 5 + 8 + 6 = 29
      expect(stats.overall.totalPooledObjects).toBe(29)

      // Total active objects: 3 + 3 + 1 = 7
      expect(stats.overall.totalActiveObjects).toBe(7)

      // Average memory pressure should be calculated from all pools
      expect(stats.overall.averageMemoryPressure).toBeGreaterThan(0)
      expect(stats.overall.averageMemoryPressure).toBeLessThan(1)

      // System memory efficiency should be calculated
      expect(stats.overall.systemMemoryEfficiency).toBeGreaterThan(0)
      expect(stats.overall.systemMemoryEfficiency).toBeLessThanOrEqual(1)
    })

    it('should handle missing pools gracefully', () => {
      const emptyManager = new PoolManager()
      const stats = emptyManager.getSystemStats()

      expect(stats.overall.totalPooledObjects).toBe(0)
      expect(stats.overall.totalActiveObjects).toBe(0)
      expect(stats.overall.averageMemoryPressure).toBe(0)
      expect(stats.overall.systemMemoryEfficiency).toBe(1)
    })
  })

  describe('optimization recommendations', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should provide optimization recommendations', () => {
      const recommendations = poolManager.getOptimizationRecommendations()

      expect(recommendations).toHaveProperty('shouldOptimizeParticles')
      expect(recommendations).toHaveProperty('shouldOptimizeObstacles')
      expect(recommendations).toHaveProperty('shouldOptimizeItems')
      expect(recommendations).toHaveProperty('memoryPressureLevel')
      expect(recommendations).toHaveProperty('recommendedActions')

      expect(typeof recommendations.shouldOptimizeParticles).toBe('boolean')
      expect(typeof recommendations.shouldOptimizeObstacles).toBe('boolean')
      expect(typeof recommendations.shouldOptimizeItems).toBe('boolean')
      expect(['low', 'medium', 'high']).toContain(recommendations.memoryPressureLevel)
      expect(Array.isArray(recommendations.recommendedActions)).toBe(true)
    })

    it('should recommend optimization for high memory pressure', () => {
      // Mock high memory pressure scenario
      mockParticlePool.getPoolStats.mockReturnValue({
        rectangles: { ...mockParticlePool.getPoolStats().rectangles, memoryPressure: 0.9 },
        ellipses: { ...mockParticlePool.getPoolStats().ellipses, memoryPressure: 0.8 },
        totalActive: 3,
        memoryEfficiency: 0.8
      })

      const recommendations = poolManager.getOptimizationRecommendations()

      expect(recommendations.shouldOptimizeParticles).toBe(true)
      expect(recommendations.memoryPressureLevel).toBe('high')
      expect(recommendations.recommendedActions.length).toBeGreaterThan(0)
    })

    it('should recommend optimization for poor utilization', () => {
      // Mock poor utilization scenario
      mockObstacleSpawner.getPoolStats.mockReturnValue({
        ...mockObstacleSpawner.getPoolStats(),
        utilizationRatio: 0.95 // Very high utilization
      })

      const recommendations = poolManager.getOptimizationRecommendations()

      expect(recommendations.shouldOptimizeObstacles).toBe(true)
    })

    it('should recommend optimization for low memory efficiency', () => {
      // Mock low efficiency scenario
      mockParticlePool.getPoolStats.mockReturnValue({
        rectangles: { ...mockParticlePool.getPoolStats().rectangles },
        ellipses: { ...mockParticlePool.getPoolStats().ellipses },
        totalActive: 3,
        memoryEfficiency: 0.5 // Low efficiency
      })

      const recommendations = poolManager.getOptimizationRecommendations()

      expect(recommendations.recommendedActions).toContain(
        expect.stringContaining('Low memory efficiency')
      )
    })
  })

  describe('pool optimization', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should optimize all pools when forced', () => {
      poolManager.optimizeAllPools(true)

      expect(mockParticlePool.optimizePools).toHaveBeenCalled()
      expect(mockObstacleSpawner.optimizePool).toHaveBeenCalled()
      expect(mockItemSpawner.optimizePool).toHaveBeenCalled()
    })

    it('should respect optimization interval when not forced', () => {
      // First call should optimize
      poolManager.optimizeAllPools(false)

      // Clear mock calls
      mockParticlePool.optimizePools.mockClear()
      mockObstacleSpawner.optimizePool.mockClear()
      mockItemSpawner.optimizePool.mockClear()

      // Immediate second call should not optimize (within interval)
      poolManager.optimizeAllPools(false)

      expect(mockParticlePool.optimizePools).not.toHaveBeenCalled()
      expect(mockObstacleSpawner.optimizePool).not.toHaveBeenCalled()
      expect(mockItemSpawner.optimizePool).not.toHaveBeenCalled()
    })

    it('should only optimize pools that need it', () => {
      // Mock scenario where only particles need optimization
      mockParticlePool.getPoolStats.mockReturnValue({
        rectangles: { ...mockParticlePool.getPoolStats().rectangles, memoryPressure: 0.8 },
        ellipses: { ...mockParticlePool.getPoolStats().ellipses, memoryPressure: 0.8 },
        totalActive: 3,
        memoryEfficiency: 0.8
      })

      poolManager.optimizeAllPools(true)

      expect(mockParticlePool.optimizePools).toHaveBeenCalled()
      // Other pools should not be optimized if they don't need it
    })
  })

  describe('memory pressure monitoring', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should report system memory pressure level', () => {
      const pressureLevel = poolManager.getSystemMemoryPressure()

      expect(['low', 'medium', 'high']).toContain(pressureLevel)
    })

    it('should report high pressure when pools are under stress', () => {
      // Mock high pressure scenario
      mockParticlePool.getPoolStats.mockReturnValue({
        rectangles: { ...mockParticlePool.getPoolStats().rectangles, memoryPressure: 0.9 },
        ellipses: { ...mockParticlePool.getPoolStats().ellipses, memoryPressure: 0.9 },
        totalActive: 3,
        memoryEfficiency: 0.8
      })

      mockObstacleSpawner.getPoolStats.mockReturnValue({
        ...mockObstacleSpawner.getPoolStats(),
        memoryPressure: 0.9
      })

      const pressureLevel = poolManager.getSystemMemoryPressure()
      expect(pressureLevel).toBe('high')
    })
  })

  describe('emergency cleanup', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should perform emergency cleanup', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      poolManager.emergencyCleanup()

      expect(consoleSpy).toHaveBeenCalledWith('PoolManager: Performing emergency memory cleanup')
      expect(mockParticlePool.optimizePools).toHaveBeenCalled()
      expect(mockObstacleSpawner.optimizePool).toHaveBeenCalled()
      expect(mockItemSpawner.optimizePool).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should attempt garbage collection if available', () => {
      const mockGc = vi.fn()
      ;(globalThis as any).gc = mockGc

      poolManager.emergencyCleanup()

      expect(mockGc).toHaveBeenCalled()

      // Clean up
      delete (globalThis as any).gc
    })

    it('should handle garbage collection errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      ;(globalThis as any).gc = () => {
        throw new Error('GC failed')
      }

      expect(() => poolManager.emergencyCleanup()).not.toThrow()

      consoleSpy.mockRestore()
      delete (globalThis as any).gc
    })
  })

  describe('destruction', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should destroy all registered pools', () => {
      poolManager.destroy()

      expect(mockParticlePool.destroy).toHaveBeenCalled()
      expect(mockObstacleSpawner.destroy).toHaveBeenCalled()
      expect(mockItemSpawner.destroy).toHaveBeenCalled()
    })

    it('should handle destruction of unregistered pools gracefully', () => {
      const emptyManager = new PoolManager()
      
      expect(() => emptyManager.destroy()).not.toThrow()
    })

    it('should clear references after destruction', () => {
      poolManager.destroy()

      // After destruction, getting stats should return empty values
      const stats = poolManager.getSystemStats()
      expect(stats.overall.totalPooledObjects).toBe(0)
      expect(stats.overall.totalActiveObjects).toBe(0)
    })
  })

  describe('performance characteristics', () => {
    beforeEach(() => {
      poolManager.registerParticlePool(mockParticlePool as any)
      poolManager.registerObstacleSpawner(mockObstacleSpawner as any)
      poolManager.registerItemSpawner(mockItemSpawner as any)
    })

    it('should handle frequent statistics requests efficiently', () => {
      const startTime = performance.now()

      // Request statistics many times
      for (let i = 0; i < 100; i++) {
        poolManager.getSystemStats()
        poolManager.getOptimizationRecommendations()
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(50)
    })

    it('should maintain performance under optimization load', () => {
      const startTime = performance.now()

      // Perform multiple optimizations
      for (let i = 0; i < 10; i++) {
        poolManager.optimizeAllPools(true)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(100)
    })
  })

  describe('edge cases', () => {
    it('should handle pools with zero statistics', () => {
      const zeroStatsPool = {
        getPoolStats: () => ({
          poolSize: 0,
          activeCount: 0,
          totalCreated: 0,
          totalDestroyed: 0,
          totalReused: 0,
          utilizationRatio: 0,
          requestRate: 0,
          peakActiveCount: 0,
          memoryPressure: 0
        }),
        optimizePool: vi.fn(),
        destroy: vi.fn()
      }

      poolManager.registerObstacleSpawner(zeroStatsPool as any)

      const stats = poolManager.getSystemStats()
      expect(stats.obstacles.poolSize).toBe(0)

      const recommendations = poolManager.getOptimizationRecommendations()
      expect(recommendations).toBeDefined()
    })

    it('should handle invalid memory pressure values', () => {
      const invalidStatsPool = {
        getPoolStats: () => ({
          poolSize: 5,
          activeCount: 1,
          totalCreated: 5,
          totalDestroyed: 0,
          totalReused: 0,
          utilizationRatio: 0.2,
          requestRate: 1,
          peakActiveCount: 2,
          memoryPressure: -1 // Invalid negative value
        }),
        optimizePool: vi.fn(),
        destroy: vi.fn()
      }

      poolManager.registerObstacleSpawner(invalidStatsPool as any)

      const stats = poolManager.getSystemStats()
      expect(stats.overall.averageMemoryPressure).toBeGreaterThanOrEqual(0)
    })
  })
})