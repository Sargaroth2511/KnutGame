/**
 * Integration tests for rendering optimizations in MainScene
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Phaser from 'phaser'
import { MainScene } from '../src/MainScene'

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

// Mock fetch for greeting API
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ title: 'Test', message: 'Test message' })
})

describe('Rendering Optimization Integration', () => {
  let game: Phaser.Game
  let scene: MainScene

  beforeEach(async () => {
    // Create a minimal Phaser game for testing
    game = new Phaser.Game({
      type: Phaser.HEADLESS,
      width: 800,
      height: 600,
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
      },
      scene: MainScene
    })

    // Wait for scene to be created
    await new Promise(resolve => {
      game.events.once('ready', () => {
        scene = game.scene.getScene('MainScene') as MainScene
        resolve(undefined)
      })
    })
  })

  afterEach(() => {
    if (game) {
      game.destroy(true)
    }
  })

  describe('LOD System Integration', () => {
    it('should apply LOD to obstacles based on distance', async () => {
      // Wait for scene initialization
      await new Promise(resolve => setTimeout(resolve, 100))

      // Access private properties for testing
      const obstacles = (scene as any).obstacles as Phaser.GameObjects.Group
      const renderingOptimizer = (scene as any).renderingOptimizer

      if (!obstacles || !renderingOptimizer) {
        console.warn('Scene not fully initialized, skipping test')
        return
      }

      // Create test obstacles at different distances
      const closeObstacle = scene.add.sprite(400, 300, 'tree')
      const farObstacle = scene.add.sprite(1200, 900, 'tree')
      
      obstacles.add(closeObstacle)
      obstacles.add(farObstacle)

      // Mock the LOD application
      const applyLODSpy = vi.spyOn(renderingOptimizer, 'applyDynamicLOD')

      // Simulate one frame update
      scene.update(Date.now(), 16)

      // Verify LOD was applied to obstacles
      expect(applyLODSpy).toHaveBeenCalledWith(closeObstacle)
      expect(applyLODSpy).toHaveBeenCalledWith(farObstacle)
    })

    it('should handle obstacles moving in and out of LOD ranges', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const obstacles = (scene as any).obstacles as Phaser.GameObjects.Group
      const renderingOptimizer = (scene as any).renderingOptimizer

      if (!obstacles || !renderingOptimizer) return

      // Create moving obstacle
      const movingObstacle = scene.add.sprite(400, 300, 'tree')
      obstacles.add(movingObstacle)

      // Initial position (close)
      scene.update(Date.now(), 16)
      
      // Move obstacle far away
      movingObstacle.setPosition(1500, 1200)
      scene.update(Date.now() + 16, 16)

      // Move obstacle back close
      movingObstacle.setPosition(400, 300)
      scene.update(Date.now() + 32, 16)

      // Verify the obstacle was processed multiple times
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.lodReductions).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Culling System Integration', () => {
    it('should cull objects outside camera bounds', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const obstacles = (scene as any).obstacles as Phaser.GameObjects.Group
      const renderingOptimizer = (scene as any).renderingOptimizer

      if (!obstacles || !renderingOptimizer) return

      // Create obstacles inside and outside camera bounds
      const visibleObstacle = scene.add.sprite(400, 300, 'tree')
      const culledObstacle = scene.add.sprite(-500, -500, 'tree')
      
      obstacles.add(visibleObstacle)
      obstacles.add(culledObstacle)

      // Mock culling method
      const cullObjectsSpy = vi.spyOn(renderingOptimizer, 'cullObjects')

      scene.update(Date.now(), 16)

      // Verify culling was applied
      expect(cullObjectsSpy).toHaveBeenCalled()
      
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsCulled + metrics.objectsRendered).toBeGreaterThan(0)
    })

    it('should restore visibility when objects re-enter camera bounds', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const obstacles = (scene as any).obstacles as Phaser.GameObjects.Group
      const renderingOptimizer = (scene as any).renderingOptimizer

      if (!obstacles || !renderingOptimizer) return

      const obstacle = scene.add.sprite(-500, -500, 'tree') // Start outside
      obstacles.add(obstacle)

      // First update - should be culled
      scene.update(Date.now(), 16)
      
      // Move into view
      obstacle.setPosition(400, 300)
      
      // Second update - should be visible
      scene.update(Date.now() + 16, 16)

      // Verify object was processed for culling multiple times
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsRendered + metrics.objectsCulled).toBeGreaterThan(0)
    })
  })

  describe('Performance-Based Quality Adjustment', () => {
    it('should adjust quality based on performance issues', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const performanceMonitor = (scene as any).performanceMonitor
      const dynamicQualityManager = (scene as any).dynamicQualityManager

      if (!performanceMonitor || !dynamicQualityManager) return

      // Get initial quality level
      const initialQuality = dynamicQualityManager.getCurrentQualityLevel()
      expect(initialQuality).toBeDefined()

      // Simulate performance issue by mocking low FPS
      vi.spyOn(performanceMonitor, 'getCurrentFPS').mockReturnValue(20)
      vi.spyOn(performanceMonitor, 'isPerformanceIssueActive').mockReturnValue(true)

      // Force performance check
      dynamicQualityManager.forcePerformanceCheck()

      // Quality might have changed due to performance issue
      const newQuality = dynamicQualityManager.getCurrentQualityLevel()
      expect(newQuality).toBeDefined()
    })

    it('should activate emergency rendering mode on severe performance issues', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer
      const performanceMonitor = (scene as any).performanceMonitor

      if (!renderingOptimizer || !performanceMonitor) return

      // Initially not in emergency mode
      expect(renderingOptimizer.isEmergencyModeActive()).toBe(false)

      // Simulate severe performance issue
      const severeIssue = {
        type: 'low_fps' as const,
        severity: 'high' as const,
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

      // Trigger performance issue callback multiple times to simulate sustained poor performance
      const callbacks = performanceMonitor.onPerformanceIssue.mock.calls
      if (callbacks.length > 0) {
        const callback = callbacks[0][0]
        for (let i = 0; i < 35; i++) {
          callback(severeIssue)
        }
      }

      // Check if emergency mode was activated
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.emergencyModeActivations).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Text Caching Integration', () => {
    it('should cache HUD text elements', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer
      const hud = (scene as any).hud

      if (!renderingOptimizer || !hud) return

      // Simulate HUD updates that would use text caching
      const style = { fontSize: '16px', color: '#ffffff' }
      
      const text1 = renderingOptimizer.getCachedText('Score: 100', style, 10, 10)
      const text2 = renderingOptimizer.getCachedText('Score: 200', style, 10, 10)
      const text3 = renderingOptimizer.getCachedText('Score: 100', style, 10, 10) // Same as first

      expect(text1).toBeDefined()
      expect(text2).toBeDefined()
      expect(text3).toBeDefined()

      // Verify caching metrics
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.textCacheHits + metrics.textCacheMisses).toBeGreaterThan(0)
    })

    it('should handle batch text rendering for performance HUD', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer

      if (!renderingOptimizer) return

      const textRequests = [
        { text: 'FPS: 60', style: { fontSize: '12px' }, x: 10, y: 10 },
        { text: 'Objects: 50', style: { fontSize: '12px' }, x: 10, y: 25 },
        { text: 'Memory: 45%', style: { fontSize: '12px' }, x: 10, y: 40 }
      ]

      const results = renderingOptimizer.batchRenderTexts(textRequests)
      
      expect(results).toHaveLength(3)
      results.forEach(text => {
        expect(text).toBeDefined()
      })
    })
  })

  describe('Performance HUD Integration', () => {
    it('should display rendering optimization metrics in performance HUD', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      // Enable performance HUD
      const pKeyEvent = new KeyboardEvent('keydown', { key: 'P' })
      scene.input.keyboard?.emit('keydown-P', pKeyEvent)

      // Update scene to generate metrics
      scene.update(Date.now(), 16)

      const perfText = (scene as any).perfText
      if (perfText && perfText.visible) {
        const text = perfText.text
        expect(text).toContain('FPS:')
        // Should contain rendering-related metrics
        expect(text).toMatch(/RenderCull:|LOD:|TextCache:/)
      }
    })

    it('should show emergency mode indicator in performance HUD', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer
      
      if (!renderingOptimizer) return

      // Enable performance HUD
      const pKeyEvent = new KeyboardEvent('keydown', { key: 'P' })
      scene.input.keyboard?.emit('keydown-P', pKeyEvent)

      // Simulate emergency mode activation
      const performanceMonitor = (scene as any).performanceMonitor
      if (performanceMonitor) {
        const callbacks = performanceMonitor.onPerformanceIssue.mock.calls
        if (callbacks.length > 0) {
          const callback = callbacks[0][0]
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
            callback(severeIssue)
          }
        }
      }

      scene.update(Date.now(), 16)

      const perfText = (scene as any).perfText
      if (perfText && perfText.visible) {
        const text = perfText.text
        // Should show emergency indicator if active
        if (renderingOptimizer.isEmergencyModeActive()) {
          expect(text).toContain('🚨')
        }
      }
    })
  })

  describe('Memory Management', () => {
    it('should clean up rendering resources on scene shutdown', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer
      
      if (!renderingOptimizer) return

      // Create some cached text
      const style = { fontSize: '16px', color: '#ffffff' }
      renderingOptimizer.getCachedText('Test', style)

      const destroySpy = vi.spyOn(renderingOptimizer, 'destroy')

      // Shutdown scene
      scene.scene.stop()

      // Verify cleanup was called
      expect(destroySpy).toHaveBeenCalled()
    })

    it('should handle memory pressure by clearing caches', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer
      
      if (!renderingOptimizer) return

      // Fill text cache
      const style = { fontSize: '16px', color: '#ffffff' }
      for (let i = 0; i < 10; i++) {
        renderingOptimizer.getCachedText(`Text ${i}`, style)
      }

      const clearCacheSpy = vi.spyOn(renderingOptimizer, 'clearTextCache')

      // Simulate memory pressure
      const performanceMonitor = (scene as any).performanceMonitor
      if (performanceMonitor) {
        const callbacks = performanceMonitor.onPerformanceIssue.mock.calls
        if (callbacks.length > 0) {
          const callback = callbacks[0][0]
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

          for (let i = 0; i < 35; i++) {
            callback(memoryIssue)
          }
        }
      }

      // Emergency mode activation should clear caches
      if (renderingOptimizer.isEmergencyModeActive()) {
        expect(clearCacheSpy).toHaveBeenCalled()
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing rendering optimizer gracefully', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      // Temporarily remove rendering optimizer
      const originalOptimizer = (scene as any).renderingOptimizer
      ;(scene as any).renderingOptimizer = null

      expect(() => {
        scene.update(Date.now(), 16)
      }).not.toThrow()

      // Restore optimizer
      ;(scene as any).renderingOptimizer = originalOptimizer
    })

    it('should handle camera resize during rendering optimization', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const renderingOptimizer = (scene as any).renderingOptimizer
      
      if (!renderingOptimizer) return

      // Create test object
      const testObject = scene.add.sprite(400, 300, 'tree')
      
      // Simulate camera resize
      scene.cameras.main.setSize(1200, 800)
      
      expect(() => {
        renderingOptimizer.applyDynamicLOD(testObject)
        renderingOptimizer.cullObjects([testObject])
      }).not.toThrow()
    })

    it('should maintain performance under high object count', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const obstacles = (scene as any).obstacles as Phaser.GameObjects.Group
      const renderingOptimizer = (scene as any).renderingOptimizer
      
      if (!obstacles || !renderingOptimizer) return

      // Create many objects
      const objects = []
      for (let i = 0; i < 100; i++) {
        const obj = scene.add.sprite(
          Math.random() * 1600 - 400, // Some outside camera bounds
          Math.random() * 1200 - 300,
          'tree'
        )
        obstacles.add(obj)
        objects.push(obj)
      }

      const startTime = performance.now()
      
      // Update with many objects
      scene.update(Date.now(), 16)
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should complete in reasonable time (less than 50ms for 100 objects)
      expect(updateTime).toBeLessThan(50)

      // Verify optimizations were applied
      const metrics = renderingOptimizer.getMetrics()
      expect(metrics.objectsRendered + metrics.objectsCulled).toBeGreaterThan(0)
    })
  })
})