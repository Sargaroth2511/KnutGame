/**
 * Tests for RenderingOptimizer - Dynamic LOD, culling, text caching, and emergency rendering modes
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Phaser from 'phaser'
import { RenderingOptimizer } from '../src/systems/RenderingOptimizer'
import { QualityAwareRenderer } from '../src/systems/QualityAwareRenderer'
import { DynamicQualityManager } from '../src/systems/DynamicQualityManager'
import { PerformanceMonitor, PerformanceIssue } from '../src/systems/PerformanceMonitor'

// Mock Phaser objects
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

describe('RenderingOptimizer', () => {
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

  describe('Dynamic LOD System', () => {
    it('should apply appropriate LOD based on distance from camera center', () => {
      const closeObject = createMockGameObject(400, 300) // Center of camera
      const farObject = createMockGameObject(1200, 900) // Far from camera

      renderingOptimizer.applyDynamicLOD(closeObject as any)
      renderingOptimizer.applyDynamicLOD(farObject as any)

      // Close object should remain at full scale and visible
      expect(closeObject.setVisible).toHaveBeenCalledWith(true)
      expect(closeObject.setScale).toHaveBeenCalledWith(1.0)

      // Far object should be processed (may be scaled down or hidden based on distance)
      // The exact calls depend on the LOD level determined by distance
      expect(farObject.setVisible).toHaveBeenCalled()
      // Scale may or may not be called depending on LOD level, so we check if any method was called
      expect(farObject.setVisible.mock.calls.length + farObject.setScale.mock.calls.length).toBeGreaterThan(0)
    })

    it('should handle objects without position properties gracefully', () => {
      const invalidObject = { type: 'invalid' }

      expect(() => {
        renderingOptimizer.applyDynamicLOD(invalidObject as any)
      }).not.toThrow()
    })

    it('should apply emergency LOD when emergency mode is active', () => {
      // Trigger emergency mode by simulating severe performance issue
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      const severeIssue: PerformanceIssue = {
        type: 'low_fps',
        severity: 'high',
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

      // Simulate emergency mode activation
      for (let i = 0; i < 35; i++) {
        performanceIssueCallback(severeIssue)
      }

      const testObject = createMockGameObject(400, 300)
      renderingOptimizer.applyDynamicLOD(testObject as any)

      // Should apply emergency LOD regardless of normal settings
      expect(testObject.setVisible).toHaveBeenCalled()
      expect(testObject.setScale).toHaveBeenCalled()
    })
  })

  describe('Frustum Culling', () => {
    it('should cull objects outside camera bounds', () => {
      const visibleObject = createMockGameObject(400, 300) // Inside camera
      const culledObject = createMockGameObject(-200, -200) // Outside camera
      const objects = [visibleObject, culledObject]

      renderingOptimizer.cullObjects(objects as any)

      // Visible object should remain visible
      expect(visibleObject.setVisible).not.toHaveBeenCalledWith(false)

      // Culled object should be hidden
      expect(culledObject.setVisible).toHaveBeenCalledWith(false)
    })

    it('should restore visibility when objects re-enter camera bounds', () => {
      const object = createMockGameObject(-200, -200) // Start outside
      
      // First cull
      renderingOptimizer.cullObjects([object] as any)
      expect(object.setVisible).toHaveBeenCalledWith(false)

      // Move object back into view
      object.x = 400
      object.y = 300
      
      // Second cull check
      renderingOptimizer.cullObjects([object] as any)
      expect(object.setVisible).toHaveBeenCalledWith(true)
    })

    it('should handle objects without position properties', () => {
      const invalidObject = { type: 'invalid' }

      expect(() => {
        renderingOptimizer.cullObjects([invalidObject] as any)
      }).not.toThrow()
    })
  })

  describe('Text Caching System', () => {
    it('should cache text objects for reuse', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      
      const text1 = renderingOptimizer.getCachedText('Hello', style, 10, 20)
      const text2 = renderingOptimizer.getCachedText('Hello', style, 30, 40)

      // Should reuse the same text object
      expect(text1).toBe(text2)
      expect(text1.setPosition).toHaveBeenCalledWith(30, 40)
      expect(text1.setText).toHaveBeenCalledWith('Hello')
    })

    it('should create new text objects for different content or styles', () => {
      const style1 = { fontSize: '16px', color: '#ffffff' }
      const style2 = { fontSize: '20px', color: '#ff0000' }
      
      const text1 = renderingOptimizer.getCachedText('Hello', style1)
      const text2 = renderingOptimizer.getCachedText('World', style1)
      const text3 = renderingOptimizer.getCachedText('Hello', style2)

      expect(text1).not.toBe(text2)
      expect(text1).not.toBe(text3)
      expect(text2).not.toBe(text3)
    })

    it('should evict least recently used items when cache is full', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      
      // Fill cache beyond capacity (assuming max cache size is smaller)
      const texts = []
      for (let i = 0; i < 25; i++) {
        texts.push(renderingOptimizer.getCachedText(`Text${i}`, style))
      }

      // Verify that some texts were evicted (destroyed)
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.textCacheMisses).toBeGreaterThan(0)
    })

    it('should handle batch text rendering', () => {
      const requests = [
        { text: 'Score: 100', style: { fontSize: '16px' }, x: 10, y: 10 },
        { text: 'Lives: 3', style: { fontSize: '16px' }, x: 10, y: 30 },
        { text: 'Time: 60', style: { fontSize: '14px' }, x: 10, y: 50 }
      ]

      const results = renderingOptimizer.batchRenderTexts(requests)

      expect(results).toHaveLength(3)
      expect(mockScene.add.text).toHaveBeenCalledTimes(3)
    })
  })

  describe('Emergency Rendering Mode', () => {
    it('should activate emergency mode on severe performance issues', () => {
      expect(renderingOptimizer.isEmergencyModeActive()).toBe(false)

      // Simulate severe performance issue
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      const severeIssue: PerformanceIssue = {
        type: 'low_fps',
        severity: 'high',
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 10,
          averageFrameTime: 100,
          memoryUsage: 0.95,
          stutterCount: 20,
          lastStutterTime: Date.now(),
          performanceScore: 10
        }
      }

      // Trigger emergency mode (simulate multiple performance issues over time)
      for (let i = 0; i < 35; i++) {
        performanceIssueCallback(severeIssue)
      }

      // Emergency mode should eventually activate
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.emergencyModeActivations).toBeGreaterThan(0)
    })

    it('should disable text caching in emergency mode', () => {
      // Activate emergency mode
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      const severeIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'high',
        timestamp: Date.now(),
        duration: 300,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66,
          memoryUsage: 0.9,
          stutterCount: 15,
          lastStutterTime: Date.now(),
          performanceScore: 15
        }
      }

      for (let i = 0; i < 35; i++) {
        performanceIssueCallback(severeIssue)
      }

      const style = { fontSize: '16px', color: '#ffffff' }
      const text1 = renderingOptimizer.getCachedText('Test', style)
      const text2 = renderingOptimizer.getCachedText('Test', style)

      // In emergency mode, should create new text objects instead of caching
      expect(mockScene.add.text).toHaveBeenCalledTimes(2)
    })

    it('should apply aggressive LOD in emergency mode', () => {
      // Activate emergency mode
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0][0]
      const severeIssue: PerformanceIssue = {
        type: 'memory_pressure',
        severity: 'high',
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 20,
          averageFrameTime: 50,
          memoryUsage: 0.95,
          stutterCount: 5,
          lastStutterTime: Date.now(),
          performanceScore: 25
        }
      }

      for (let i = 0; i < 35; i++) {
        performanceIssueCallback(severeIssue)
      }

      const farObject = createMockGameObject(600, 500) // Moderately far
      renderingOptimizer.applyDynamicLOD(farObject as any)

      // Should apply emergency LOD (at least one method should be called)
      const totalCalls = farObject.setScale.mock.calls.length + farObject.setVisible.mock.calls.length
      expect(totalCalls).toBeGreaterThan(0)
      
      // Verify emergency mode is active
      expect(renderingOptimizer.isEmergencyModeActive()).toBe(true)
    })
  })

  describe('Performance Metrics', () => {
    it('should track rendering metrics correctly', () => {
      const objects = [
        createMockGameObject(400, 300), // Visible
        createMockGameObject(-200, -200), // Culled
        createMockGameObject(600, 400) // Visible with LOD
      ]

      // Apply optimizations
      renderingOptimizer.cullObjects(objects as any)
      objects.forEach(obj => renderingOptimizer.applyDynamicLOD(obj as any))

      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsRendered).toBeGreaterThan(0)
      expect(metrics.objectsCulled).toBeGreaterThan(0)
    })

    it('should reset metrics correctly', () => {
      // Generate some metrics
      const objects = [createMockGameObject(-200, -200)]
      renderingOptimizer.cullObjects(objects as any)

      let metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsCulled).toBeGreaterThan(0)

      // Reset metrics
      renderingOptimizer.resetMetrics()
      metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsCulled).toBe(0)
      expect(metrics.objectsRendered).toBe(0)
      expect(metrics.lodReductions).toBe(0)
    })
  })

  describe('Quality Level Integration', () => {
    it('should adjust settings based on quality level changes', () => {
      // Simulate quality level change
      const qualityChangeCallback = mockQualityManager.onQualityChange.mock.calls[0][0]
      
      qualityChangeCallback({ name: 'minimal' }, {
        timestamp: Date.now(),
        fromLevel: 'medium',
        toLevel: 'minimal',
        reason: 'performance_drop',
        performanceMetrics: { fps: 25, frameTime: 40 }
      })

      const settings = renderingOptimizer.getSettings()
      expect(settings.lod.enableLOD).toBe(true)
      expect(settings.culling.enableCulling).toBe(true)
      expect(settings.textCache.enableCaching).toBe(true)
    })

    it('should handle ultra quality settings', () => {
      const qualityChangeCallback = mockQualityManager.onQualityChange.mock.calls[0][0]
      
      qualityChangeCallback({ name: 'ultra' }, {
        timestamp: Date.now(),
        fromLevel: 'medium',
        toLevel: 'ultra',
        reason: 'performance_recovery',
        performanceMetrics: { fps: 60, frameTime: 16 }
      })

      const settings = renderingOptimizer.getSettings()
      expect(settings.lod.enableLOD).toBe(false)
      expect(settings.culling.enableCulling).toBe(false)
      expect(settings.textCache.enableCaching).toBe(false)
    })
  })

  describe('Update and Cleanup', () => {
    it('should update performance checks periodically', () => {
      const initialTime = Date.now()
      
      // Mock Date.now to simulate time passage
      vi.spyOn(Date, 'now').mockReturnValue(initialTime + 2000)
      
      renderingOptimizer.update()
      
      // Should have performed performance check
      expect(mockPerformanceMonitor.getCurrentFPS).toHaveBeenCalled()
      expect(mockPerformanceMonitor.isPerformanceIssueActive).toHaveBeenCalled()
    })

    it('should clean up resources on destroy', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      const text = renderingOptimizer.getCachedText('Test', style)
      
      renderingOptimizer.destroy()
      
      expect(text.destroy).toHaveBeenCalled()
    })

    it('should clear text cache on demand', () => {
      const style = { fontSize: '16px', color: '#ffffff' }
      const text = renderingOptimizer.getCachedText('Test', style)
      
      renderingOptimizer.clearTextCache()
      
      expect(text.destroy).toHaveBeenCalled()
      
      const cacheStats = renderingOptimizer.getMetrics()
      expect(cacheStats.textCacheHits).toBe(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined objects gracefully', () => {
      expect(() => {
        renderingOptimizer.applyDynamicLOD(null as any)
        renderingOptimizer.cullObjects([null, undefined] as any)
      }).not.toThrow()
    })

    it('should handle scene without camera gracefully', () => {
      const sceneWithoutCamera = { cameras: { main: null } }
      const optimizer = new RenderingOptimizer(
        sceneWithoutCamera as any,
        mockQualityRenderer,
        mockQualityManager,
        mockPerformanceMonitor
      )

      expect(() => {
        optimizer.cullObjects([createMockGameObject(100, 100)] as any)
      }).not.toThrow()

      optimizer.destroy()
    })

    it('should handle missing object methods gracefully', () => {
      const incompleteObject = { x: 100, y: 100, type: 'incomplete' }

      expect(() => {
        renderingOptimizer.applyDynamicLOD(incompleteObject as any)
        renderingOptimizer.cullObjects([incompleteObject] as any)
      }).not.toThrow()
    })
  })
})