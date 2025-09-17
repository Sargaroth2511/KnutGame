/**
 * Integration tests for Device Capability Detection and Adaptation system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceCapabilityDetector } from '../src/systems/DeviceCapabilityDetector';
import { DynamicQualityManager } from '../src/systems/DynamicQualityManager';
import { QualityAwareRenderer } from '../src/systems/QualityAwareRenderer';
import { PerformanceMonitor } from '../src/systems/PerformanceMonitor';

// Mock Phaser scene
const mockScene = {
  add: {
    sprite: vi.fn().mockReturnValue({
      setScale: vi.fn(),
      destroy: vi.fn(),
      x: 0,
      y: 0,
      rotation: 0
    }),
    text: vi.fn().mockReturnValue({
      setText: vi.fn(),
      destroy: vi.fn()
    })
  },
  cameras: {
    main: {
      width: 800,
      height: 600
    }
  },
  textures: {},
  game: { loop: {} }
} as any;

// Mock performance monitor
const mockPerformanceMonitor = {
  getCurrentFPS: vi.fn(() => 60),
  getAverageFrameTime: vi.fn(() => 16.67),
  startFrame: vi.fn(),
  endFrame: vi.fn(),
  isPerformanceIssueActive: vi.fn(() => false),
  getPerformanceMetrics: vi.fn(() => ({
    currentFPS: 60,
    averageFrameTime: 16.67,
    memoryUsage: 100,
    stutterCount: 0,
    lastStutterTime: 0,
    performanceScore: 85
  })),
  onPerformanceIssue: vi.fn()
} as any;

describe('Device Adaptation Integration', () => {
  let detector: DeviceCapabilityDetector;
  let qualityManager: DynamicQualityManager;
  let renderer: QualityAwareRenderer;

  beforeEach(() => {
    // Reset singletons
    (DeviceCapabilityDetector as any).instance = null;
    (DynamicQualityManager as any).instance = null;
    (QualityAwareRenderer as any).instance = null;

    detector = DeviceCapabilityDetector.getInstance();
    qualityManager = DynamicQualityManager.getInstance();
    renderer = QualityAwareRenderer.getInstance();

    // Mock globals for high-end device
    (global as any).performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        jsHeapSizeLimit: 4 * 1024 * 1024 * 1024, // 4GB
        usedJSHeapSize: 100 * 1024 * 1024 // 100MB
      }
    };
    (global as any).navigator = {
      hardwareConcurrency: 8,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    (global as any).window = {
      devicePixelRatio: 1,
      screen: { width: 1920, height: 1080 },
      requestAnimationFrame: vi.fn((callback) => setTimeout(callback, 16))
    };

    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    qualityManager.destroy();
    renderer.destroy();
  });

  describe('complete system initialization', () => {
    it('should initialize all components and detect high-end device', async () => {
      // Initialize the complete system
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      // Verify device capabilities were detected
      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities!.performanceScore).toBeGreaterThan(60);
      expect(capabilities!.renderingCapability).toBe('enhanced');

      // Verify quality manager started with progressive enhancement
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel).toBeDefined();

      // Verify renderer applied appropriate settings
      const renderingOptions = renderer.getRenderingOptions();
      expect(renderingOptions).toBeDefined();
      expect(renderingOptions.enableCulling).toBeDefined();
    });

    it('should adapt to low-end device characteristics', async () => {
      // Mock low-end device
      (global as any).navigator = {
        hardwareConcurrency: 2,
        userAgent: 'Mozilla/5.0 (Linux; Android 8.0; SM-G950F) AppleWebKit/537.36'
      };
      (global as any).performance = {
        now: vi.fn(() => Date.now()),
        memory: {
          jsHeapSizeLimit: 512 * 1024 * 1024, // 512MB
          usedJSHeapSize: 200 * 1024 * 1024
        }
      };

      // Reset detector to pick up new device characteristics
      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities!.performanceScore).toBeLessThan(50);
      expect(capabilities!.memoryLevel).toBe('low');
      expect(capabilities!.recommendedQuality.name).toMatch(/minimal|low/);

      const renderingOptions = renderer.getRenderingOptions();
      expect(renderingOptions.cullDistance).toBeLessThan(800); // More aggressive culling
    });
  });

  describe('progressive enhancement workflow', () => {
    it('should gradually enhance quality based on performance feedback', async () => {
      // Start with good performance
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(60);

      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      // Track quality changes
      const qualityChanges: string[] = [];
      qualityManager.onQualityChange((level) => {
        qualityChanges.push(level.name);
      });

      // Fast-forward through enhancement process
      vi.advanceTimersByTime(15000);

      // Should have progressed through quality levels
      expect(qualityChanges.length).toBeGreaterThan(1);
      expect(qualityChanges[0]).toBe('minimal'); // Should start minimal
      
      const finalLevel = qualityManager.getCurrentQualityLevel();
      expect(finalLevel.name).not.toBe('minimal'); // Should have enhanced
    });

    it('should stop enhancement when performance degrades', async () => {
      let callCount = 0;
      mockPerformanceMonitor.getCurrentFPS.mockImplementation(() => {
        callCount++;
        return callCount > 3 ? 25 : 60; // Good initially, then drops
      });

      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      vi.advanceTimersByTime(20000);

      const history = qualityManager.getAdjustmentHistory();
      const reductions = history.filter(adj => adj.reason === 'performance_drop');
      expect(reductions.length).toBeGreaterThan(0);
    });
  });

  describe('automatic quality adjustment', () => {
    beforeEach(async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);
      await qualityManager.setQualityLevel('medium'); // Start at medium
    });

    it('should reduce quality and activate emergency mode on severe performance drop', async () => {
      // Simulate severe performance drop
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(15);

      vi.advanceTimersByTime(6000); // Trigger performance check

      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toBe('low');

      // Continue dropping performance
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(10);
      vi.advanceTimersByTime(6000);

      const finalLevel = qualityManager.getCurrentQualityLevel();
      expect(finalLevel.name).toBe('minimal');

      // Emergency mode should be activated
      expect(renderer.isEmergencyModeActive()).toBe(true);

      const renderingOptions = renderer.getRenderingOptions();
      expect(renderingOptions.emergencyMode).toBe(true);
      expect(renderingOptions.cullDistance).toBe(300); // Very aggressive
    });

    it('should recover quality when performance improves', async () => {
      // First cause quality reduction
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(25);
      vi.advanceTimersByTime(6000);

      expect(qualityManager.getCurrentQualityLevel().name).toBe('low');

      // Then improve performance
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(55);
      vi.advanceTimersByTime(35000); // Wait for stability period

      const recoveredLevel = qualityManager.getCurrentQualityLevel();
      expect(recoveredLevel.name).toBe('medium');
    });
  });

  describe('renderer integration with quality changes', () => {
    beforeEach(async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);
    });

    it('should update rendering options when quality changes', async () => {
      const initialOptions = renderer.getRenderingOptions();
      
      await qualityManager.setQualityLevel('high');
      
      const newOptions = renderer.getRenderingOptions();
      expect(newOptions.cullDistance).toBeGreaterThan(initialOptions.cullDistance);
      expect(newOptions.enableLOD).toBe(false); // High quality disables LOD
    });

    it('should apply LOD and culling based on current quality', async () => {
      await qualityManager.setQualityLevel('low');

      const mockObject = {
        x: 500,
        y: 500,
        setVisible: vi.fn(),
        setScale: vi.fn()
      };

      const mockCamera = {
        scrollX: 0,
        scrollY: 0,
        width: 800,
        height: 600
      };

      // Test LOD application
      renderer.applyLOD(mockObject, 0, 0);
      expect(mockObject.setScale).toHaveBeenCalled();

      // Test culling
      renderer.cullObjects([mockObject], mockCamera);
      expect(mockObject.setVisible).toHaveBeenCalledWith(false); // Should be culled
    });

    it('should cache text appropriately based on quality settings', async () => {
      await qualityManager.setQualityLevel('minimal');

      const style = { fontSize: '16px', fill: '#ffffff' };
      
      const text1 = renderer.getCachedText(mockScene, 'Test', style);
      const text2 = renderer.getCachedText(mockScene, 'Test', style);
      
      expect(text1).toBe(text2); // Should be cached
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);

      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(1);
    });
  });

  describe('device-specific optimizations', () => {
    it('should apply mobile-specific optimizations', async () => {
      // Mock mobile device
      (global as any).navigator = {
        hardwareConcurrency: 4,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities!.performanceScore).toBeLessThan(60); // Mobile penalty applied

      const renderingOptions = renderer.getRenderingOptions();
      expect(renderingOptions.enableCulling).toBe(true);
      expect(renderingOptions.enableLOD).toBe(true);
    });

    it('should handle high-DPI displays appropriately', async () => {
      // Mock high-DPI display
      (global as any).window.devicePixelRatio = 3;
      (global as any).window.screen = { width: 2560, height: 1440 };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      await qualityManager.initialize(mockScene, mockPerformanceMonitor);

      const capabilities = detector.getCurrentCapabilities();
      // High resolution should reduce performance score due to rendering demands
      expect(capabilities!.performanceScore).toBeLessThan(80);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle missing performance API gracefully', async () => {
      (global as any).performance = {
        now: vi.fn(() => Date.now())
        // No memory property
      };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities!.performanceScore).toBeGreaterThan(0);
    });

    it('should handle benchmark failures gracefully', async () => {
      // Mock scene that throws errors
      const errorScene = {
        ...mockScene,
        add: {
          sprite: vi.fn().mockImplementation(() => {
            throw new Error('Sprite creation failed');
          })
        }
      };

      await qualityManager.initialize(errorScene, mockPerformanceMonitor);
      renderer.initialize(errorScene, qualityManager);

      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities).toBeDefined();
    });

    it('should handle rapid quality changes without issues', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      // Rapidly change quality levels
      await qualityManager.setQualityLevel('high');
      await qualityManager.setQualityLevel('low');
      await qualityManager.setQualityLevel('medium');
      await qualityManager.setQualityLevel('minimal');

      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toBe('minimal');

      const history = qualityManager.getAdjustmentHistory();
      expect(history.length).toBeGreaterThan(4);
    });
  });

  describe('performance monitoring integration', () => {
    it('should respond to performance monitor events', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      // Simulate performance issue callback
      const performanceIssueCallback = mockPerformanceMonitor.onPerformanceIssue.mock.calls[0]?.[0];
      
      if (performanceIssueCallback) {
        performanceIssueCallback({
          type: 'stutter',
          severity: 'high',
          timestamp: Date.now(),
          duration: 200,
          metrics: {
            currentFPS: 15,
            averageFrameTime: 66.67,
            memoryUsage: 500,
            stutterCount: 5,
            lastStutterTime: Date.now(),
            performanceScore: 25
          }
        });
      }

      // Should trigger quality adjustment
      vi.advanceTimersByTime(1000);
      
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toMatch(/minimal|low/);
    });
  });

  describe('system cleanup', () => {
    it('should cleanup all components properly', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      renderer.initialize(mockScene, qualityManager);

      // Add some cached data
      const style = { fontSize: '16px', fill: '#ffffff' };
      renderer.getCachedText(mockScene, 'Test', style);

      // Cleanup
      qualityManager.destroy();
      renderer.destroy();

      // Verify cleanup
      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(0);
      expect(stats.culledObjectsCount).toBe(0);

      // Performance monitoring should stop
      vi.advanceTimersByTime(10000);
      const callCount = mockPerformanceMonitor.getCurrentFPS.mock.calls.length;
      
      vi.advanceTimersByTime(10000);
      expect(mockPerformanceMonitor.getCurrentFPS.mock.calls.length).toBe(callCount);
    });
  });
});