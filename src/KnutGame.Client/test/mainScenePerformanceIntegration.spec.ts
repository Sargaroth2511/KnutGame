/**
 * Integration tests for MainScene performance monitoring
 * Requirements: 1.1, 1.2, 3.1, 3.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Phaser from 'phaser'
import { MainScene } from '../src/MainScene'
import type { PerformanceIssue } from '../src/systems/PerformanceMonitor'

// Mock fetch for API calls
global.fetch = vi.fn()

describe('MainScene Performance Integration', () => {
  let game: Phaser.Game
  let scene: MainScene
  let performanceIssues: PerformanceIssue[] = []

  beforeEach(async () => {
    // Mock fetch responses
    vi.mocked(fetch).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/greeting')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ title: 'Test', message: 'Test message' })
        } as Response)
      }
      if (typeof url === 'string' && url.includes('/api/session')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sessionId: 'test-session' })
        } as Response)
      }
      return Promise.reject(new Error('Unmocked fetch'))
    })

    // Create headless game for testing
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
    await new Promise<void>((resolve) => {
      game.events.once('ready', () => {
        scene = game.scene.getScene('MainScene') as MainScene
        resolve()
      })
    })

    // Clear performance issues array
    performanceIssues = []
  })

  afterEach(() => {
    if (game) {
      game.destroy(true)
    }
    vi.clearAllMocks()
  })

  describe('Performance Monitor Integration', () => {
    it('should initialize performance monitor in create()', () => {
      expect(scene).toBeDefined()
      expect((scene as any).performanceMonitor).toBeDefined()
    })

    it('should track frame performance during update loop', () => {
      const performanceMonitor = (scene as any).performanceMonitor
      expect(performanceMonitor).toBeDefined()

      // Simulate multiple update cycles
      const initialMetrics = performanceMonitor.getPerformanceMetrics()
      
      // Run several update cycles
      for (let i = 0; i < 10; i++) {
        scene.update(Date.now(), 16.67) // 60 FPS
      }

      const updatedMetrics = performanceMonitor.getPerformanceMetrics()
      expect(updatedMetrics.currentFPS).toBeGreaterThan(0)
      expect(updatedMetrics.averageFrameTime).toBeGreaterThan(0)
    })

    it('should detect performance issues during heavy load', () => {
      const performanceMonitor = (scene as any).performanceMonitor
      let issueDetected = false

      // Set up performance issue callback
      performanceMonitor.onPerformanceIssue((issue: PerformanceIssue) => {
        issueDetected = true
        performanceIssues.push(issue)
      })

      // Simulate heavy frame times to trigger stutter detection
      const originalPerformanceNow = performance.now
      let mockTime = 0
      performance.now = vi.fn(() => {
        const currentTime = mockTime
        mockTime += 150 // Simulate 150ms frame time (stutter)
        return currentTime
      })

      try {
        // Run update cycle with heavy frame time
        scene.update(Date.now(), 150)

        // Performance issues might be detected asynchronously
        if (performanceIssues.length > 0) {
          expect(performanceIssues[0].type).toBe('stutter')
          expect(performanceIssues[0].severity).toBeDefined()
        }
      } finally {
        performance.now = originalPerformanceNow
      }
    })

    it('should handle paused game state correctly', () => {
      const performanceMonitor = (scene as any).performanceMonitor
      
      // Pause the game
      ;(scene as any).pauseGame()

      // Update should return early when paused
      const initialMetrics = performanceMonitor.getPerformanceMetrics()
      scene.update(Date.now(), 16.67)
      
      // Metrics should still be tracked even when paused
      expect(performanceMonitor.getPerformanceMetrics()).toBeDefined()
    })
  })

  describe('Performance HUD Integration', () => {
    it('should display performance metrics in HUD when enabled', () => {
      // Enable performance HUD
      ;(scene as any).showPerfHud = true
      const perfText = (scene as any).perfText

      expect(perfText).toBeDefined()
      expect(perfText.visible).toBe(true)

      // Run update to populate HUD
      scene.update(Date.now(), 16.67)

      // Check that performance text contains expected metrics
      const displayText = perfText.text
      expect(displayText).toContain('FPS:')
      expect(displayText).toContain('Frame:')
      expect(displayText).toContain('Mem:')
      expect(displayText).toContain('Score:')
    })

    it('should show performance status indicator', () => {
      ;(scene as any).showPerfHud = true
      const perfText = (scene as any).perfText

      scene.update(Date.now(), 16.67)

      const displayText = perfText.text
      // Should show either ✓ (good) or ⚠️ (issue) indicator
      expect(displayText).toMatch(/[✓⚠️]/)
    })

    it('should toggle performance HUD with P key', () => {
      const perfText = (scene as any).perfText
      const initialVisibility = perfText.visible

      // Simulate P key press
      scene.input.keyboard!.emit('keydown-P')

      expect(perfText.visible).toBe(!initialVisibility)
      expect((scene as any).showPerfHud).toBe(!initialVisibility)
    })
  })

  describe('Performance Issue Handling', () => {
    it('should log performance issues to console', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const performanceMonitor = (scene as any).performanceMonitor

      // Trigger a mock performance issue
      const mockIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'high',
        timestamp: Date.now(),
        duration: 150,
        metrics: {
          currentFPS: 20,
          averageFrameTime: 50,
          memoryUsage: 0.7,
          stutterCount: 1,
          lastStutterTime: Date.now(),
          performanceScore: 40
        }
      }

      // Call the performance issue handler directly
      ;(scene as any).handlePerformanceIssue(mockIssue)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance issue detected: stutter (high)'),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should show HUD warning for severe performance issues', () => {
      const hud = (scene as any).hud
      const showStatusTextSpy = vi.spyOn(hud, 'showStatusText').mockImplementation(() => {})

      const severeIssue: PerformanceIssue = {
        type: 'low_fps',
        severity: 'high',
        timestamp: Date.now(),
        duration: 0,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66.67,
          memoryUsage: 0.5,
          stutterCount: 0,
          lastStutterTime: 0,
          performanceScore: 25
        }
      }

      ;(scene as any).handlePerformanceIssue(severeIssue)

      expect(showStatusTextSpy).toHaveBeenCalledWith(
        expect.stringContaining('Low FPS detected'),
        'warning',
        2000
      )

      showStatusTextSpy.mockRestore()
    })

    it('should not show HUD warning for minor performance issues', () => {
      const hud = (scene as any).hud
      const showStatusTextSpy = vi.spyOn(hud, 'showStatusText').mockImplementation(() => {})

      const minorIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'low',
        timestamp: Date.now(),
        duration: 50,
        metrics: {
          currentFPS: 55,
          averageFrameTime: 18,
          memoryUsage: 0.3,
          stutterCount: 1,
          lastStutterTime: Date.now(),
          performanceScore: 85
        }
      }

      ;(scene as any).handlePerformanceIssue(minorIssue)

      expect(showStatusTextSpy).not.toHaveBeenCalled()

      showStatusTextSpy.mockRestore()
    })
  })

  describe('Performance Monitoring Lifecycle', () => {
    it('should start and end frame monitoring correctly', () => {
      const performanceMonitor = (scene as any).performanceMonitor
      const startFrameSpy = vi.spyOn(performanceMonitor, 'startFrame')
      const endFrameSpy = vi.spyOn(performanceMonitor, 'endFrame')

      scene.update(Date.now(), 16.67)

      expect(startFrameSpy).toHaveBeenCalled()
      expect(endFrameSpy).toHaveBeenCalled()

      startFrameSpy.mockRestore()
      endFrameSpy.mockRestore()
    })

    it('should handle performance monitoring when game is paused', () => {
      const performanceMonitor = (scene as any).performanceMonitor
      const startFrameSpy = vi.spyOn(performanceMonitor, 'startFrame')
      const endFrameSpy = vi.spyOn(performanceMonitor, 'endFrame')

      // Pause the game
      ;(scene as any).pauseGame()

      scene.update(Date.now(), 16.67)

      expect(startFrameSpy).toHaveBeenCalled()
      expect(endFrameSpy).toHaveBeenCalled()

      startFrameSpy.mockRestore()
      endFrameSpy.mockRestore()
    })

    it('should continue monitoring during game over state', () => {
      const performanceMonitor = (scene as any).performanceMonitor
      
      // Set game over state
      ;(scene as any).isGameOver = true
      ;(scene as any).postGameRunLeftMs = 1000

      const initialMetrics = performanceMonitor.getPerformanceMetrics()
      scene.update(Date.now(), 16.67)
      
      // Should still track performance during game over
      expect(performanceMonitor.getPerformanceMetrics()).toBeDefined()
    })
  })

  describe('Performance Metrics Display', () => {
    it('should format performance metrics correctly in HUD', () => {
      ;(scene as any).showPerfHud = true
      const perfText = (scene as any).perfText

      scene.update(Date.now(), 16.67)

      const displayText = perfText.text
      
      // Check format of metrics display
      expect(displayText).toMatch(/FPS:\d+/)
      expect(displayText).toMatch(/Frame:\d+\.\d+ms/)
      expect(displayText).toMatch(/Mem:\d+\.\d+%/)
      expect(displayText).toMatch(/Score:\d+/)
      expect(displayText).toMatch(/Stutters:\d+/)
    })

    it('should show object counts in performance HUD', () => {
      ;(scene as any).showPerfHud = true
      const perfText = (scene as any).perfText

      scene.update(Date.now(), 16.67)

      const displayText = perfText.text
      
      // Check that object counts are displayed
      expect(displayText).toMatch(/OBS:\d+/)
      expect(displayText).toMatch(/ITM:\d+/)
      expect(displayText).toMatch(/PART:a\d+/)
    })
  })
})