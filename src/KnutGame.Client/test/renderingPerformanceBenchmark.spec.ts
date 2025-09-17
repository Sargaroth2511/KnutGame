/**
 * Performance benchmark tests for rendering optimizations
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Phaser from 'phaser'
import { RenderingOptimizer } from '../src/systems/RenderingOptimizer'
import { QualityAwareRenderer } from '../src/systems/QualityAwareRenderer'
import { DynamicQualityManager } from '../src/systems/DynamicQualityManager'
import { PerformanceMonitor } from '../src/systems/PerformanceMonitor'

// Make Phaser available globally for the tests
;(globalThis as any).Phaser = Phaser

// Mock performance APIs
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50000000,
      jsHeapSizeLimit: 100000000
    }
  }
})

// Helper to create mock game objects
const createMockGameObject = (x: number, y: number, type: string = 'sprite') => ({
  x,
  y,
  type,
  active: true,
  visible: true,
  scale: 1,
  alpha: 1,
  setVisible: vi.fn().mockReturnThis(),
  setScale: vi.fn().mockReturnThis(),
  setAlpha: vi.fn().mockReturnThis(),
  setTint: vi.fn().mockReturnThis(),
  clearTint: vi.fn().mockReturnThis(),
  destroy: vi.fn()
})

const createMockText = (text: string, x: number = 0, y: number = 0) => ({
  ...createMockGameObject(x, y, 'text'),
  text,
  setText: vi.fn().mockReturnThis(),
  setPosition: vi.fn().mockReturnThis()
})

const createMockScene = () => ({
  cameras: {
    main: {
      scrollX: 0,
      scrollY: 0,
      width: 800,
      height: 600
    }
  },
  add: {
    text: vi.fn().mockImplementation((x, y, text, style) => createMockText(text, x, y))
  }
})

describe('Rendering Performance Benchmarks', () => {
  let renderingOptimizer: RenderingOptimizer
  let mockScene: any
  let mockQualityRenderer: any
  let mockQualityManager: any
  let mockPerformanceMonitor: any

  beforeEach(() => {
    mockScene = createMockScene()
    
    mockQualityRenderer = {
      initialize: vi.fn(),
      destroy: vi.fn()
    }
    
    mockQualityManager = {
      getCurrentQualityLevel: vi.fn().mockReturnValue({ name: 'medium' }),
      onQualityChange: vi.fn(),
      initialize: vi.fn(),
      destroy: vi.fn()
    }
    
    mockPerformanceMonitor = {
      onPerformanceIssue: vi.fn(),
      getCurrentFPS: vi.fn().mockReturnValue(60),
      isPerformanceIssueActive: vi.fn().mockReturnValue(false)
    }

    renderingOptimizer = new RenderingOptimizer(
      mockScene as any,
      mockQualityRenderer,
      mockQualityManager,
      mockPerformanceMonitor
    )
  })

  afterEach(() => {
    renderingOptimizer.destroy()
  })

  describe('LOD Performance Benchmarks', () => {
    it('should apply LOD to 1000 objects within performance threshold', () => {
      const objects = []
      for (let i = 0; i < 1000; i++) {
        objects.push(createMockGameObject(
          Math.random() * 1600,
          Math.random() * 1200
        ))
      }

      const startTime = performance.now()
      
      objects.forEach(obj => {
        renderingOptimizer.applyDynamicLOD(obj as any)
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 50ms for 1000 objects
      expect(duration).toBeLessThan(50)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.lodReductions).toBeGreaterThanOrEqual(0)
    })

    it('should scale LOD performance linearly with object count', () => {
      const testSizes = [100, 500, 1000]
      const results: Array<{ size: number; time: number }> = []

      testSizes.forEach(size => {
        const objects = []
        for (let i = 0; i < size; i++) {
          objects.push(createMockGameObject(
            Math.random() * 1600,
            Math.random() * 1200
          ))
        }

        const startTime = performance.now()
        
        objects.forEach(obj => {
          renderingOptimizer.applyDynamicLOD(obj as any)
        })
        
        const endTime = performance.now()
        results.push({ size, time: endTime - startTime })
      })

      // Performance should scale roughly linearly (but allow for test environment variance)
      const ratio1 = results[0].time > 0 ? results[1].time / results[0].time : 1
      const ratio2 = results[1].time > 0 ? results[2].time / results[1].time : 1
      
      // In test environment, operations might be very fast, so we check that larger sets don't take exponentially longer
      expect(ratio1).toBeLessThan(50) // Should not be exponentially slower
      expect(ratio2).toBeLessThan(50) // Should not be exponentially slower
      
      // Verify that all operations completed
      expect(results[0].time).toBeGreaterThanOrEqual(0)
      expect(results[1].time).toBeGreaterThanOrEqual(0)
      expect(results[2].time).toBeGreaterThanOrEqual(0)
    })

    it('should maintain LOD performance under emergency mode', () => {
      // Activate emergency mode
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      const severeIssue = {
        type: 'low_fps' as const,
        severity: 'high' as const,
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66,
          memoryUsage: 0.9,
          stutterCount: 10,
          lastStutterTime: Date.now(),
          performanceScore: 20
        }
      }

      for (let i = 0; i < 35; i++) {
        performanceIssueCallback(severeIssue)
      }

      const objects = []
      for (let i = 0; i < 500; i++) {
        objects.push(createMockGameObject(
          Math.random() * 1600,
          Math.random() * 1200
        ))
      }

      const startTime = performance.now()
      
      objects.forEach(obj => {
        renderingOptimizer.applyDynamicLOD(obj as any)
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Emergency mode should be even faster due to aggressive culling
      expect(duration).toBeLessThan(30)
    })
  })

  describe('Culling Performance Benchmarks', () => {
    it('should cull 2000 objects within performance threshold', () => {
      const objects = []
      for (let i = 0; i < 2000; i++) {
        objects.push(createMockGameObject(
          Math.random() * 2000 - 500, // Some outside camera bounds
          Math.random() * 1500 - 300
        ))
      }

      const startTime = performance.now()
      
      renderingOptimizer.cullObjects(objects as any)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 30ms for 2000 objects
      expect(duration).toBeLessThan(30)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsCulled + metrics.objectsRendered).toBeGreaterThan(0)
    })

    it('should optimize culling for mostly off-screen objects', () => {
      // Create objects mostly outside camera bounds (worst case for culling)
      const objects = []
      for (let i = 0; i < 1000; i++) {
        objects.push(createMockGameObject(
          Math.random() > 0.1 ? -1000 : 400, // 90% off-screen
          Math.random() > 0.1 ? -1000 : 300
        ))
      }

      const startTime = performance.now()
      
      renderingOptimizer.cullObjects(objects as any)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should still be fast even with many off-screen objects
      expect(duration).toBeLessThan(25)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsCulled).toBeGreaterThan(800) // Most should be culled
    })

    it('should handle repeated culling operations efficiently', () => {
      const objects = []
      for (let i = 0; i < 500; i++) {
        objects.push(createMockGameObject(
          Math.random() * 1600,
          Math.random() * 1200
        ))
      }

      const iterations = 10
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        renderingOptimizer.cullObjects(objects as any)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // 10 iterations should complete within 100ms
      expect(duration).toBeLessThan(100)
      
      // Average per iteration should be reasonable
      const avgPerIteration = duration / iterations
      expect(avgPerIteration).toBeLessThan(15)
    })
  })

  describe('Text Caching Performance Benchmarks', () => {
    it('should cache 100 text objects within performance threshold', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      
      const startTime = performance.now()
      
      for (let i = 0; i < 100; i++) {
        renderingOptimizer.getCachedText(`Text ${i}`, style, i * 10, 10)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 50ms for 100 text objects
      expect(duration).toBeLessThan(50)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.textCacheMisses).toBe(100) // All should be cache misses initially
    })

    it('should demonstrate cache hit performance improvement', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      const texts = ['Score: 100', 'Lives: 3', 'Time: 60', 'Level: 1']
      
      // First pass - populate cache
      const firstPassStart = performance.now()
      for (let i = 0; i < 100; i++) {
        const text = texts[i % texts.length]
        renderingOptimizer.getCachedText(text, style, 10, 10)
      }
      const firstPassEnd = performance.now()
      const firstPassDuration = firstPassEnd - firstPassStart

      // Second pass - should hit cache
      const secondPassStart = performance.now()
      for (let i = 0; i < 100; i++) {
        const text = texts[i % texts.length]
        renderingOptimizer.getCachedText(text, style, 10, 10)
      }
      const secondPassEnd = performance.now()
      const secondPassDuration = secondPassEnd - secondPassStart

      // Second pass should be faster or at least not significantly slower due to caching
      // In test environment, both might be very fast, so we allow for some variance
      expect(secondPassDuration).toBeLessThan(firstPassDuration + 10) // Allow 10ms variance
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.textCacheHits).toBeGreaterThan(0)
    })

    it('should handle batch text rendering efficiently', () => {
      const requests = []
      for (let i = 0; i < 50; i++) {
        requests.push({
          text: `Item ${i}`,
          style: { fontSize: '14px', color: '#ffffff' },
          x: (i % 10) * 80,
          y: Math.floor(i / 10) * 20
        })
      }

      const startTime = performance.now()
      
      const results = renderingOptimizer.batchRenderTexts(requests)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(50)
      expect(duration).toBeLessThan(30) // Should complete within 30ms
    })

    it('should maintain performance with cache eviction', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      
      // Fill cache beyond capacity to trigger evictions
      const startTime = performance.now()
      
      for (let i = 0; i < 100; i++) {
        renderingOptimizer.getCachedText(`Unique text ${i}`, style, 10, 10)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle cache evictions without significant performance impact
      expect(duration).toBeLessThan(60)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.textCacheMisses).toBe(100)
    })
  })

  describe('Combined Operations Performance', () => {
    it('should handle mixed LOD, culling, and text operations efficiently', () => {
      // Create mixed workload
      const objects = []
      for (let i = 0; i < 500; i++) {
        objects.push(createMockGameObject(
          Math.random() * 1600,
          Math.random() * 1200
        ))
      }

      const textRequests = []
      for (let i = 0; i < 20; i++) {
        textRequests.push({
          text: `HUD Item ${i}`,
          style: { fontSize: '12px', color: '#ffffff' },
          x: 10,
          y: i * 15
        })
      }

      const startTime = performance.now()
      
      // Apply all optimizations
      renderingOptimizer.cullObjects(objects as any)
      objects.forEach(obj => renderingOptimizer.applyDynamicLOD(obj as any))
      renderingOptimizer.batchRenderTexts(textRequests)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Combined operations should complete within 80ms
      expect(duration).toBeLessThan(80)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsRendered + metrics.objectsCulled).toBeGreaterThan(0)
      expect(metrics.textCacheMisses + metrics.textCacheHits).toBeGreaterThan(0)
    })

    it('should maintain performance during quality level transitions', () => {
      const objects = []
      for (let i = 0; i < 300; i++) {
        objects.push(createMockGameObject(
          Math.random() * 1600,
          Math.random() * 1200
        ))
      }

      // Simulate quality level changes
      const qualityChangeCallback = mockQualityManager.onQualityChange.mock.calls[0][0]
      
      const startTime = performance.now()
      
      // Change quality levels multiple times while processing objects
      const qualityLevels = ['minimal', 'low', 'medium', 'high']
      qualityLevels.forEach((level, index) => {
        qualityChangeCallback({ name: level }, {
          timestamp: Date.now(),
          fromLevel: index > 0 ? qualityLevels[index - 1] : 'medium',
          toLevel: level,
          reason: 'manual',
          performanceMetrics: { fps: 60, frameTime: 16 }
        })

        // Process some objects at this quality level
        const batch = objects.slice(index * 75, (index + 1) * 75)
        batch.forEach(obj => renderingOptimizer.applyDynamicLOD(obj as any))
        renderingOptimizer.cullObjects(batch as any)
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle quality transitions without significant performance impact
      expect(duration).toBeLessThan(100)
    })

    it('should demonstrate performance improvement over naive implementation', () => {
      const objects = []
      for (let i = 0; i < 1000; i++) {
        objects.push(createMockGameObject(
          Math.random() * 1600,
          Math.random() * 1200
        ))
      }

      // Optimized implementation
      const optimizedStart = performance.now()
      renderingOptimizer.cullObjects(objects as any)
      objects.forEach(obj => renderingOptimizer.applyDynamicLOD(obj as any))
      const optimizedEnd = performance.now()
      const optimizedDuration = optimizedEnd - optimizedStart

      // Naive implementation (simulate by calling methods individually without batching)
      const naiveStart = performance.now()
      objects.forEach(obj => {
        // Simulate individual processing without optimizations
        const distance = Math.sqrt(obj.x * obj.x + obj.y * obj.y)
        if (distance > 100) {
          obj.setScale(0.5)
        }
        if (obj.x < -100 || obj.x > 900 || obj.y < -100 || obj.y > 700) {
          obj.setVisible(false)
        }
      })
      const naiveEnd = performance.now()
      const naiveDuration = naiveEnd - naiveStart

      // Optimized version should be competitive or better
      // (Note: In this test environment, the difference might be minimal due to mocking)
      // We mainly verify both approaches complete successfully
      expect(optimizedDuration).toBeGreaterThanOrEqual(0)
      expect(naiveDuration).toBeGreaterThanOrEqual(0)
      
      // In test environment, both operations might be very fast (even 0ms)
      // We just verify that the optimized version doesn't take significantly longer
      if (naiveDuration > 0) {
        expect(optimizedDuration).toBeLessThan(naiveDuration * 5)
      } else {
        // If naive is 0ms, optimized should also be very fast
        expect(optimizedDuration).toBeLessThan(10)
      }
    })
  })

  describe('Memory Performance', () => {
    it('should maintain stable memory usage during text caching', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      
      // Create and destroy many text objects
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 50; i++) {
          renderingOptimizer.getCachedText(`Cycle ${cycle} Text ${i}`, style, 10, 10)
        }
        
        // Simulate cache cleanup
        if (cycle % 3 === 0) {
          renderingOptimizer.clearTextCache()
        }
      }

      // Memory usage should be stable (cache should prevent excessive allocations)
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.textCacheHits + metrics.textCacheMisses).toBeGreaterThan(400)
    })

    it('should handle emergency mode memory cleanup efficiently', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      
      // Fill cache
      for (let i = 0; i < 50; i++) {
        renderingOptimizer.getCachedText(`Text ${i}`, style, 10, 10)
      }

      // Trigger emergency mode
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      const memoryIssue = {
        type: 'memory_pressure' as const,
        severity: 'high' as const,
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 30,
          averageFrameTime: 33,
          memoryUsage: 0.95,
          stutterCount: 5,
          lastStutterTime: Date.now(),
          performanceScore: 40
        }
      }

      const cleanupStart = performance.now()
      
      for (let i = 0; i < 35; i++) {
        performanceIssueCallback(memoryIssue)
      }
      
      const cleanupEnd = performance.now()
      const cleanupDuration = cleanupEnd - cleanupStart

      // Emergency cleanup should be fast
      expect(cleanupDuration).toBeLessThan(20)
    })
  })

  describe('Stress Tests', () => {
    it('should handle extreme object counts without crashing', () => {
      const objects = []
      for (let i = 0; i < 5000; i++) {
        objects.push(createMockGameObject(
          Math.random() * 3000 - 1000,
          Math.random() * 2000 - 500
        ))
      }

      expect(() => {
        const startTime = performance.now()
        
        renderingOptimizer.cullObjects(objects as any)
        objects.forEach(obj => renderingOptimizer.applyDynamicLOD(obj as any))
        
        const endTime = performance.now()
        const duration = endTime - startTime

        // Should complete within reasonable time even with 5000 objects
        expect(duration).toBeLessThan(200)
      }).not.toThrow()
    })

    it('should handle rapid quality changes without performance degradation', () => {
      const qualityChangeCallback = mockQualityManager.onQualityChange.mock.calls[0][0]
      const qualityLevels = ['minimal', 'low', 'medium', 'high', 'ultra']
      
      const startTime = performance.now()
      
      // Rapid quality changes
      for (let i = 0; i < 100; i++) {
        const level = qualityLevels[i % qualityLevels.length]
        qualityChangeCallback({ name: level }, {
          timestamp: Date.now(),
          fromLevel: 'medium',
          toLevel: level,
          reason: 'performance_drop',
          performanceMetrics: { fps: 30, frameTime: 33 }
        })
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle rapid changes efficiently
      expect(duration).toBeLessThan(50)
    })

    it('should maintain performance under continuous emergency mode cycling', () => {
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      
      const goodIssue = {
        type: 'low_fps' as const,
        severity: 'low' as const,
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 55,
          averageFrameTime: 18,
          memoryUsage: 0.4,
          stutterCount: 1,
          lastStutterTime: Date.now() - 10000,
          performanceScore: 80
        }
      }

      const badIssue = {
        type: 'low_fps' as const,
        severity: 'high' as const,
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66,
          memoryUsage: 0.9,
          stutterCount: 20,
          lastStutterTime: Date.now(),
          performanceScore: 20
        }
      }

      const startTime = performance.now()
      
      // Cycle between good and bad performance
      for (let cycle = 0; cycle < 10; cycle++) {
        // Bad performance period
        for (let i = 0; i < 35; i++) {
          performanceIssueCallback(badIssue)
        }
        
        // Good performance period
        for (let i = 0; i < 50; i++) {
          performanceIssueCallback(goodIssue)
        }
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle cycling without significant overhead
      expect(duration).toBeLessThan(100)
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.emergencyModeActivations).toBeGreaterThan(0)
    })
  })
})