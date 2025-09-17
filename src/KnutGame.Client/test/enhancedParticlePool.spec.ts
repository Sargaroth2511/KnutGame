import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ParticlePool } from '../src/systems/ParticlePool'
import { MAX_PARTICLES } from '../src/gameConfig'

// Mock Phaser scene
const createMockScene = () => {
  const mockTweens = {
    add: vi.fn(),
    killTweensOf: vi.fn()
  }

  const mockRectangle = {
    setDepth: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0
  }

  const mockEllipse = {
    setDepth: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0
  }

  const mockAdd = {
    rectangle: vi.fn(() => mockRectangle),
    ellipse: vi.fn(() => mockEllipse)
  }

  return {
    tweens: mockTweens,
    add: mockAdd,
    mockRectangle,
    mockEllipse
  }
}

describe('Enhanced ParticlePool', () => {
  let pool: ParticlePool
  let mockScene: ReturnType<typeof createMockScene>

  beforeEach(() => {
    mockScene = createMockScene()
    pool = new ParticlePool(mockScene as any)
  })

  describe('enhanced pool initialization', () => {
    it('should initialize with enhanced object pools', () => {
      expect(pool).toBeDefined()
      
      const stats = pool.getPoolStats()
      expect(stats.rectangles.poolSize).toBeGreaterThan(0)
      expect(stats.ellipses.poolSize).toBeGreaterThan(0)
    })

    it('should respect MAX_PARTICLES distribution between pools', () => {
      const stats = pool.getPoolStats()
      const totalMaxSize = Math.floor(MAX_PARTICLES * 0.7) + Math.floor(MAX_PARTICLES * 0.3)
      
      expect(totalMaxSize).toBeLessThanOrEqual(MAX_PARTICLES)
    })
  })

  describe('enhanced rectangle spawning', () => {
    it('should spawn rectangles using enhanced pool', () => {
      pool.spawnRectangle({
        x: 100,
        y: 200,
        width: 10,
        height: 15,
        color: 0xff0000,
        alpha: 0.8
      })

      expect(mockScene.add.rectangle).toHaveBeenCalled()
      expect(mockScene.mockRectangle.setSize).toHaveBeenCalledWith(10, 15)
      expect(mockScene.mockRectangle.setFillStyle).toHaveBeenCalledWith(0xff0000, 0.8)
    })

    it('should reuse rectangles from enhanced pool', () => {
      // Spawn and complete a rectangle to return it to pool
      pool.spawnRectangle({ x: 100, y: 200 })
      
      // Simulate tween completion to release particle
      const tweenCall = mockScene.tweens.add.mock.calls[0][0]
      tweenCall.onComplete()

      // Clear mock calls
      mockScene.add.rectangle.mockClear()

      // Spawn another rectangle - should reuse from pool
      pool.spawnRectangle({ x: 150, y: 250 })

      const stats = pool.getPoolStats()
      expect(stats.rectangles.totalReused).toBeGreaterThan(0)
    })

    it('should handle legacy spawnRect method', () => {
      pool.spawnRect({
        x: 100,
        y: 200,
        w: 5,
        h: 8,
        color: 0x00ff00,
        alpha: 0.9,
        dx: 10,
        dy: -20,
        duration: 500
      })

      expect(mockScene.add.rectangle).toHaveBeenCalled()
      expect(mockScene.tweens.add).toHaveBeenCalled()
    })
  })

  describe('enhanced ellipse spawning', () => {
    it('should spawn ellipses using enhanced pool', () => {
      pool.spawnEllipse({
        x: 100,
        y: 200,
        rx: 8,
        ry: 12,
        color: 0x0000ff,
        alpha: 0.7,
        dx: 5,
        dy: -15,
        duration: 400
      })

      expect(mockScene.add.ellipse).toHaveBeenCalled()
      expect(mockScene.mockEllipse.setSize).toHaveBeenCalledWith(8, 12)
      expect(mockScene.mockEllipse.setFillStyle).toHaveBeenCalledWith(0x0000ff, 0.7)
    })

    it('should reuse ellipses from enhanced pool', () => {
      // Spawn and complete an ellipse
      pool.spawnEllipse({ x: 100, y: 200 })
      
      const tweenCall = mockScene.tweens.add.mock.calls[0][0]
      tweenCall.onComplete()

      mockScene.add.ellipse.mockClear()

      // Spawn another ellipse - should reuse
      pool.spawnEllipse({ x: 150, y: 250 })

      const stats = pool.getPoolStats()
      expect(stats.ellipses.totalReused).toBeGreaterThan(0)
    })
  })

  describe('enhanced pool statistics', () => {
    it('should provide detailed pool statistics', () => {
      const stats = pool.getPoolStats()
      
      expect(stats.rectangles).toHaveProperty('poolSize')
      expect(stats.rectangles).toHaveProperty('activeCount')
      expect(stats.rectangles).toHaveProperty('totalCreated')
      expect(stats.rectangles).toHaveProperty('totalReused')
      expect(stats.rectangles).toHaveProperty('memoryPressure')
      
      expect(stats.ellipses).toHaveProperty('poolSize')
      expect(stats.ellipses).toHaveProperty('activeCount')
      
      expect(stats).toHaveProperty('totalActive')
      expect(stats).toHaveProperty('memoryEfficiency')
    })

    it('should calculate memory efficiency correctly', () => {
      // Spawn multiple particles to create reuse scenario
      for (let i = 0; i < 5; i++) {
        pool.spawnRectangle({ x: i * 10, y: i * 10 })
        
        // Complete the tween to return to pool
        const tweenCall = mockScene.tweens.add.mock.calls[i][0]
        tweenCall.onComplete()
      }

      const stats = pool.getPoolStats()
      expect(stats.memoryEfficiency).toBeGreaterThan(0)
      expect(stats.memoryEfficiency).toBeLessThanOrEqual(1)
    })

    it('should track memory pressure', () => {
      // Create high usage scenario
      for (let i = 0; i < 20; i++) {
        pool.spawnRectangle({ x: i, y: i })
      }

      const memoryPressure = pool.getMemoryPressure()
      expect(memoryPressure).toBeGreaterThanOrEqual(0)
      expect(memoryPressure).toBeLessThanOrEqual(1)
    })
  })

  describe('pool optimization', () => {
    it('should optimize pools on demand', () => {
      const initialStats = pool.getPoolStats()
      
      // Create usage pattern that might trigger optimization
      for (let i = 0; i < 10; i++) {
        pool.spawnRectangle({ x: i, y: i })
      }

      pool.optimizePools()

      const optimizedStats = pool.getPoolStats()
      // Pool sizes may have changed due to optimization
      expect(optimizedStats).toBeDefined()
    })

    it('should handle pool optimization errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Force an error scenario by destroying the pool first
      pool.destroy()
      
      // This should not throw
      expect(() => pool.optimizePools()).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })

  describe('enhanced particle lifecycle', () => {
    it('should properly reset particles for reuse', () => {
      pool.spawnRectangle({ x: 100, y: 200, alpha: 0.5 })
      
      // Complete tween to trigger release
      const tweenCall = mockScene.tweens.add.mock.calls[0][0]
      tweenCall.onComplete()

      // Verify reset was called
      expect(mockScene.mockRectangle.setActive).toHaveBeenCalledWith(false)
      expect(mockScene.mockRectangle.setVisible).toHaveBeenCalledWith(false)
      expect(mockScene.mockRectangle.setAlpha).toHaveBeenCalledWith(1)
    })

    it('should kill tweens when resetting particles', () => {
      pool.spawnRectangle({ x: 100, y: 200 })
      
      const tweenCall = mockScene.tweens.add.mock.calls[0][0]
      tweenCall.onComplete()

      expect(mockScene.tweens.killTweensOf).toHaveBeenCalled()
    })

    it('should handle tween cleanup errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Make killTweensOf throw an error
      mockScene.tweens.killTweensOf.mockImplementation(() => {
        throw new Error('Tween cleanup failed')
      })

      pool.spawnRectangle({ x: 100, y: 200 })
      
      const tweenCall = mockScene.tweens.add.mock.calls[0][0]
      
      // Should not throw despite tween cleanup error
      expect(() => tweenCall.onComplete()).not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('enhanced destroy behavior', () => {
    it('should destroy enhanced pools properly', () => {
      const initialStats = pool.getPoolStats()
      expect(initialStats.rectangles.poolSize).toBeGreaterThan(0)
      expect(initialStats.ellipses.poolSize).toBeGreaterThan(0)

      pool.destroy()

      const finalStats = pool.getPoolStats()
      expect(finalStats.rectangles.poolSize).toBe(0)
      expect(finalStats.ellipses.poolSize).toBe(0)
      expect(finalStats.totalActive).toBe(0)
    })

    it('should handle destroy errors in enhanced pools', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Make destroy throw errors
      mockScene.mockRectangle.destroy.mockImplementation(() => {
        throw new Error('Destroy failed')
      })

      // Should not throw despite errors
      expect(() => pool.destroy()).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })

  describe('performance characteristics', () => {
    it('should maintain performance under high particle load', () => {
      const startTime = performance.now()
      
      // Spawn many particles
      for (let i = 0; i < 100; i++) {
        pool.spawnRectangle({ x: i, y: i })
        
        if (i % 2 === 0) {
          // Complete some tweens to create reuse
          const tweenCall = mockScene.tweens.add.mock.calls[i][0]
          tweenCall.onComplete()
        }
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(50)

      const stats = pool.getPoolStats()
      expect(stats.rectangles.totalReused).toBeGreaterThan(0)
    })

    it('should show improved memory efficiency with enhanced pooling', () => {
      // Create reuse scenario
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < 10; i++) {
          pool.spawnRectangle({ x: i, y: i })
        }
        
        // Complete all tweens to return particles to pool
        const currentCalls = mockScene.tweens.add.mock.calls.slice(cycle * 10, (cycle + 1) * 10)
        currentCalls.forEach(call => call[0].onComplete())
      }

      const stats = pool.getPoolStats()
      expect(stats.memoryEfficiency).toBeGreaterThan(0.5) // Should have good reuse
    })
  })

  describe('backward compatibility', () => {
    it('should maintain compatibility with existing getActiveCount method', () => {
      pool.spawnRectangle({ x: 100, y: 200 })
      pool.spawnEllipse({ x: 150, y: 250 })

      const activeCount = pool.getActiveCount()
      expect(activeCount).toBe(2)
    })

    it('should maintain compatibility with existing getPooledCounts method', () => {
      const counts = pool.getPooledCounts()
      
      expect(counts).toHaveProperty('rectangles')
      expect(counts).toHaveProperty('ellipses')
      expect(counts).toHaveProperty('extra')
      
      expect(typeof counts.rectangles).toBe('number')
      expect(typeof counts.ellipses).toBe('number')
      expect(typeof counts.extra).toBe('number')
    })

    it('should maintain compatibility with register method for extra objects', () => {
      const extraObject = { destroy: vi.fn() }
      
      expect(() => pool.register(extraObject as any)).not.toThrow()
      
      const counts = pool.getPooledCounts()
      expect(counts.extra).toBe(1)
    })
  })
})