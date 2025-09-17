import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnhancedObjectPool, DEFAULT_POOL_CONFIG } from '../src/systems/EnhancedObjectPool'

// Mock object for testing
interface MockObject {
  id: number
  active: boolean
  destroyed: boolean
}

describe('EnhancedObjectPool', () => {
  let objectIdCounter = 0
  let pool: EnhancedObjectPool<MockObject>
  let createdObjects: MockObject[] = []
  let resetObjects: MockObject[] = []
  let destroyedObjects: MockObject[] = []

  const createMockObject = (): MockObject => {
    const obj = {
      id: ++objectIdCounter,
      active: false,
      destroyed: false
    }
    createdObjects.push(obj)
    return obj
  }

  const resetMockObject = (obj: MockObject): void => {
    obj.active = false
    resetObjects.push(obj)
  }

  const destroyMockObject = (obj: MockObject): void => {
    obj.destroyed = true
    destroyedObjects.push(obj)
  }

  beforeEach(() => {
    objectIdCounter = 0
    createdObjects = []
    resetObjects = []
    destroyedObjects = []
    
    pool = new EnhancedObjectPool(
      createMockObject,
      resetMockObject,
      destroyMockObject,
      {
        ...DEFAULT_POOL_CONFIG,
        initialSize: 5,
        maxSize: 10,
        minSize: 2
      }
    )
  })

  describe('initialization', () => {
    it('should pre-allocate initial pool size', () => {
      expect(createdObjects).toHaveLength(5)
      
      const stats = pool.getStats()
      expect(stats.poolSize).toBe(5)
      expect(stats.totalCreated).toBe(5)
    })

    it('should use custom configuration', () => {
      const customPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        destroyMockObject,
        {
          initialSize: 3,
          maxSize: 8,
          minSize: 1,
          autoAdjust: false,
          usageTrackingWindow: 5000,
          growthFactor: 2.0,
          shrinkFactor: 0.5
        }
      )

      const stats = customPool.getStats()
      expect(stats.poolSize).toBe(3)
      expect(stats.totalCreated).toBe(3)
    })
  })

  describe('object acquisition and release', () => {
    it('should acquire objects from pool when available', () => {
      const obj1 = pool.acquire()
      const obj2 = pool.acquire()

      expect(obj1).toBeDefined()
      expect(obj2).toBeDefined()
      expect(obj1.id).toBeLessThanOrEqual(5) // From pre-allocated pool
      expect(obj2.id).toBeLessThanOrEqual(5)
      expect(resetObjects).toHaveLength(2)

      const stats = pool.getStats()
      expect(stats.activeCount).toBe(2)
      expect(stats.poolSize).toBe(3) // 5 - 2 acquired
      expect(stats.totalReused).toBe(2)
    })

    it('should create new objects when pool is empty', () => {
      // Acquire all pre-allocated objects
      const objects = []
      for (let i = 0; i < 5; i++) {
        objects.push(pool.acquire())
      }

      // This should create a new object
      const newObj = pool.acquire()
      expect(newObj.id).toBe(6) // New object beyond pre-allocated
      expect(createdObjects).toHaveLength(6)

      const stats = pool.getStats()
      expect(stats.totalCreated).toBe(6)
      expect(stats.totalReused).toBe(5)
    })

    it('should release objects back to pool', () => {
      const obj1 = pool.acquire()
      const obj2 = pool.acquire()

      pool.release(obj1)
      pool.release(obj2)

      const stats = pool.getStats()
      expect(stats.activeCount).toBe(0)
      expect(stats.poolSize).toBe(5) // Back to original size
    })

    it('should destroy objects when pool exceeds max size', () => {
      const config = {
        ...DEFAULT_POOL_CONFIG,
        initialSize: 2,
        maxSize: 3,
        minSize: 1
      }

      const smallPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        destroyMockObject,
        config
      )

      // Acquire and release objects to fill pool beyond max
      const objects = []
      for (let i = 0; i < 5; i++) {
        objects.push(smallPool.acquire())
      }

      // Release all objects - some should be destroyed
      objects.forEach(obj => smallPool.release(obj))

      expect(destroyedObjects.length).toBeGreaterThan(0)
    })

    it('should warn when releasing non-acquired objects', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const foreignObject = createMockObject()

      pool.release(foreignObject)

      expect(consoleSpy).toHaveBeenCalledWith('Attempted to release object not acquired from this pool')
      consoleSpy.mockRestore()
    })
  })

  describe('statistics tracking', () => {
    it('should track pool statistics accurately', () => {
      const obj1 = pool.acquire()
      const obj2 = pool.acquire()
      pool.release(obj1)

      const stats = pool.getStats()
      expect(stats.poolSize).toBe(4) // 5 - 2 + 1 released
      expect(stats.activeCount).toBe(1) // obj2 still active
      expect(stats.totalCreated).toBe(5) // Pre-allocated
      expect(stats.totalReused).toBe(2) // Both objects were reused
      expect(stats.utilizationRatio).toBeCloseTo(0.1) // 1/10 max size
    })

    it('should track peak active count', () => {
      const objects = []
      
      // Acquire objects to create peak
      for (let i = 0; i < 7; i++) {
        objects.push(pool.acquire())
      }

      const stats = pool.getStats()
      expect(stats.peakActiveCount).toBe(7)

      // Release some objects
      pool.release(objects[0])
      pool.release(objects[1])

      const newStats = pool.getStats()
      expect(newStats.peakActiveCount).toBe(7) // Peak should remain
      expect(newStats.activeCount).toBe(5) // Current active reduced
    })

    it('should calculate memory pressure', () => {
      // Create scenario with high creation rate
      for (let i = 0; i < 15; i++) {
        const obj = pool.acquire()
        if (i % 3 === 0) {
          pool.release(obj) // Release some to create mixed pattern
        }
      }

      const stats = pool.getStats()
      expect(stats.memoryPressure).toBeGreaterThan(0)
      expect(stats.memoryPressure).toBeLessThanOrEqual(1)
    })
  })

  describe('automatic pool adjustment', () => {
    it('should adjust pool size when auto-adjust is enabled', () => {
      const autoPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        destroyMockObject,
        {
          ...DEFAULT_POOL_CONFIG,
          initialSize: 2,
          maxSize: 20,
          minSize: 1,
          autoAdjust: true
        }
      )

      // Create high utilization scenario
      const objects = []
      for (let i = 0; i < 15; i++) {
        objects.push(autoPool.acquire())
      }

      // Force adjustment
      autoPool.adjustPoolSize()

      // Release objects and check if pool grew
      objects.forEach(obj => autoPool.release(obj))
      
      const stats = autoPool.getStats()
      expect(stats.poolSize).toBeGreaterThan(2) // Should have grown
    })

    it('should shrink pool when utilization is low', () => {
      const shrinkPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        destroyMockObject,
        {
          ...DEFAULT_POOL_CONFIG,
          initialSize: 10,
          maxSize: 20,
          minSize: 3,
          autoAdjust: true
        }
      )

      // Use very few objects to create low utilization
      const obj = shrinkPool.acquire()
      shrinkPool.release(obj)

      // Force adjustment
      shrinkPool.adjustPoolSize()

      const stats = shrinkPool.getStats()
      expect(stats.poolSize).toBeLessThan(10) // Should have shrunk
      expect(stats.poolSize).toBeGreaterThanOrEqual(3) // But not below min
    })

    it('should respect min and max size limits during adjustment', () => {
      const limitedPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        destroyMockObject,
        {
          ...DEFAULT_POOL_CONFIG,
          initialSize: 5,
          maxSize: 8,
          minSize: 3,
          autoAdjust: true
        }
      )

      // Try to force growth beyond max
      const objects = []
      for (let i = 0; i < 20; i++) {
        objects.push(limitedPool.acquire())
      }

      limitedPool.adjustPoolSize()
      objects.forEach(obj => limitedPool.release(obj))

      const stats = limitedPool.getStats()
      expect(stats.poolSize).toBeLessThanOrEqual(8) // Should not exceed max

      // Try to force shrink below min
      limitedPool.adjustPoolSize()
      
      const finalStats = limitedPool.getStats()
      expect(finalStats.poolSize).toBeGreaterThanOrEqual(3) // Should not go below min
    })
  })

  describe('memory management', () => {
    it('should destroy all objects on pool destruction', () => {
      const obj1 = pool.acquire()
      const obj2 = pool.acquire()

      pool.destroy()

      // All objects should be destroyed (pooled + active)
      expect(destroyedObjects.length).toBeGreaterThanOrEqual(5) // At least the pre-allocated ones
      
      const stats = pool.getStats()
      expect(stats.poolSize).toBe(0)
      expect(stats.activeCount).toBe(0)
    })

    it('should handle destroy errors gracefully', () => {
      const errorPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        (obj) => {
          throw new Error('Destroy failed')
        }
      )

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(() => errorPool.destroy()).not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('usage tracking', () => {
    it('should track request rate over time', () => {
      // Simulate requests over time
      for (let i = 0; i < 10; i++) {
        const obj = pool.acquire()
        pool.release(obj)
      }

      const stats = pool.getStats()
      expect(stats.requestRate).toBeGreaterThan(0)
    })

    it('should clean old usage entries', () => {
      const shortWindowPool = new EnhancedObjectPool(
        createMockObject,
        resetMockObject,
        destroyMockObject,
        {
          ...DEFAULT_POOL_CONFIG,
          usageTrackingWindow: 100 // Very short window
        }
      )

      // Make some requests
      for (let i = 0; i < 5; i++) {
        const obj = shortWindowPool.acquire()
        shortWindowPool.release(obj)
      }

      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Make new request to trigger cleanup
          const obj = shortWindowPool.acquire()
          shortWindowPool.release(obj)

          const stats = shortWindowPool.getStats()
          // Request rate should be lower due to old entries being cleaned
          expect(stats.requestRate).toBeLessThan(50) // Much less than 5 requests per 100ms

          resolve(undefined)
        }, 150)
      })
    })
  })

  describe('performance characteristics', () => {
    it('should handle high-frequency acquire/release cycles', () => {
      const startTime = performance.now()
      
      // Perform many acquire/release cycles
      for (let i = 0; i < 1000; i++) {
        const obj = pool.acquire()
        pool.release(obj)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly (less than 100ms for 1000 cycles)
      expect(duration).toBeLessThan(100)

      const stats = pool.getStats()
      expect(stats.totalReused).toBe(1000)
      expect(stats.activeCount).toBe(0)
    })

    it('should maintain consistent performance under load', () => {
      const times: number[] = []

      // Measure time for batches of operations
      for (let batch = 0; batch < 10; batch++) {
        const batchStart = performance.now()
        
        const objects = []
        for (let i = 0; i < 100; i++) {
          objects.push(pool.acquire())
        }
        
        objects.forEach(obj => pool.release(obj))
        
        const batchEnd = performance.now()
        times.push(batchEnd - batchStart)
      }

      // Performance should be consistent (coefficient of variation < 0.5)
      const mean = times.reduce((sum, time) => sum + time, 0) / times.length
      const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = stdDev / mean

      expect(coefficientOfVariation).toBeLessThan(0.5)
    })
  })
})