/**
 * Simple integration tests for Device Capability Detection and Adaptation system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceCapabilityDetector } from '../src/systems/DeviceCapabilityDetector';
import { DynamicQualityManager } from '../src/systems/DynamicQualityManager';
import { QualityAwareRenderer } from '../src/systems/QualityAwareRenderer';
import { PerformanceMonitor } from '../src/systems/PerformanceMonitor';

// Mock Phaser
(global as any).Phaser = {
  Math: {
    Distance: {
      Between: vi.fn((x1: number, y1: number, x2: number, y2: number) => 
        Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      )
    }
  }
};

// Mock Phaser scene
const mockScene = {
  add: {
    sprite: vi.fn(() => ({
      setScale: vi.fn(),
      destroy: vi.fn(),
      x: 0,
      y: 0,
      rotation: 0
    })),
    text: vi.fn(() => ({
      setText: vi.fn(),
      destroy: vi.fn()
    }))
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

describe('Device Adaptation Simple Integration', () => {
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
  });

  afterEach(() => {
    qualityManager.destroy();
    renderer.destroy();
  });

  describe('basic functionality', () => {
    it('should detect device capabilities', async () => {
      const capabilities = await detector.detectCapabilities(mockScene);

      expect(capabilities).toBeDefined();
      expect(capabilities.performanceScore).toBeGreaterThan(0);
      expect(capabilities.recommendedQuality).toBeDefined();
      expect(['minimal', 'low', 'medium', 'high', 'ultra']).toContain(capabilities.recommendedQuality.name);
    });

    it('should initialize quality manager with minimal settings', () => {
      const settings = qualityManager.getCurrentSettings();
      
      expect(settings.currentLevel.name).toBe('minimal');
      expect(settings.adaptiveMode).toBe(true);
      expect(settings.autoReduction).toBe(true);
    });

    it('should initialize renderer with default options', () => {
      const options = renderer.getRenderingOptions();
      
      expect(options.enableCulling).toBe(true);
      expect(options.enableLOD).toBe(true);
      expect(options.enableTextCaching).toBe(true);
      expect(options.emergencyMode).toBe(false);
    });
  });

  describe('quality management', () => {
    it('should allow manual quality level changes', async () => {
      const result = await qualityManager.setQualityLevel('high');
      
      expect(result).toBe(true);
      expect(qualityManager.getCurrentQualityLevel().name).toBe('high');
    });

    it('should reject invalid quality level names', async () => {
      const result = await qualityManager.setQualityLevel('invalid');
      expect(result).toBe(false);
    });

    it('should track adjustment history', async () => {
      await qualityManager.setQualityLevel('high');
      await qualityManager.setQualityLevel('low');
      
      const history = qualityManager.getAdjustmentHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const manualAdjustments = history.filter(adj => adj.reason === 'manual');
      expect(manualAdjustments.length).toBe(2);
    });
  });

  describe('renderer integration', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, qualityManager);
    });

    it('should respond to quality changes', async () => {
      const initialOptions = renderer.getRenderingOptions();
      
      await qualityManager.setQualityLevel('high');
      
      const newOptions = renderer.getRenderingOptions();
      expect(newOptions.cullDistance).toBeGreaterThan(initialOptions.cullDistance);
    });

    it('should apply LOD to game objects', () => {
      const mockObject = {
        x: 500,
        y: 500,
        setVisible: vi.fn(),
        setScale: vi.fn()
      };

      renderer.applyLOD(mockObject, 0, 0);
      
      expect(mockObject.setScale).toHaveBeenCalled();
    });

    it('should cull objects outside camera bounds', () => {
      const mockObjects = [
        { x: 100, y: 100, setVisible: vi.fn() },
        { x: 1000, y: 1000, setVisible: vi.fn() }
      ];
      
      const mockCamera = {
        scrollX: 0,
        scrollY: 0,
        width: 800,
        height: 600
      };

      renderer.cullObjects(mockObjects, mockCamera);
      
      expect(mockObjects[1].setVisible).toHaveBeenCalledWith(false); // Out of bounds
    });

    it('should cache text objects when enabled', () => {
      const style = { fontSize: '16px', fill: '#ffffff' };
      
      const text1 = renderer.getCachedText(mockScene, 'Test', style);
      const text2 = renderer.getCachedText(mockScene, 'Test', style);
      
      expect(text1).toBe(text2); // Should be cached
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    });
  });

  describe('device-specific behavior', () => {
    it('should detect low-end mobile devices', async () => {
      // Mock mobile device
      (global as any).navigator = {
        hardwareConcurrency: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
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

      const capabilities = await detector.detectCapabilities(mockScene);
      
      expect(capabilities.performanceScore).toBeLessThan(65);
      expect(capabilities.memoryLevel).toBe('low');
      expect(capabilities.recommendedQuality.name).toMatch(/minimal|low/);
    });

    it('should handle missing performance API gracefully', async () => {
      (global as any).performance = {
        now: vi.fn(() => Date.now())
        // No memory property
      };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      const capabilities = await detector.detectCapabilities(mockScene);
      expect(capabilities).toBeDefined();
      expect(capabilities.performanceScore).toBeGreaterThan(0);
    });
  });

  describe('emergency mode', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, qualityManager);
    });

    it('should activate emergency mode on performance drop to minimal', async () => {
      // Simulate quality change callback for performance drop to minimal
      const callback = (renderer as any).qualityManager.onQualityChange.mock.calls[0][0];
      
      callback(detector.getQualityLevel('minimal'), {
        timestamp: Date.now(),
        fromLevel: 'low',
        toLevel: 'minimal',
        reason: 'performance_drop',
        performanceMetrics: { fps: 15, frameTime: 66.67 }
      });
      
      expect(renderer.isEmergencyModeActive()).toBe(true);
      
      const options = renderer.getRenderingOptions();
      expect(options.emergencyMode).toBe(true);
      expect(options.cullDistance).toBe(300); // More aggressive than normal minimal
    });

    it('should deactivate emergency mode when quality improves', async () => {
      // First activate emergency mode
      const callback = (renderer as any).qualityManager.onQualityChange.mock.calls[0][0];
      
      callback(detector.getQualityLevel('minimal'), {
        timestamp: Date.now(),
        fromLevel: 'low',
        toLevel: 'minimal',
        reason: 'performance_drop',
        performanceMetrics: { fps: 15, frameTime: 66.67 }
      });
      
      expect(renderer.isEmergencyModeActive()).toBe(true);
      
      // Then improve quality
      callback(detector.getQualityLevel('low'), {
        timestamp: Date.now(),
        fromLevel: 'minimal',
        toLevel: 'low',
        reason: 'performance_recovery',
        performanceMetrics: { fps: 35, frameTime: 28.57 }
      });
      
      expect(renderer.isEmergencyModeActive()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      renderer.initialize(mockScene, qualityManager);
      
      // Add some cached data
      const style = { fontSize: '16px', fill: '#ffffff' };
      renderer.getCachedText(mockScene, 'Test', style);
      
      qualityManager.destroy();
      renderer.destroy();
      
      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(0);
      expect(stats.culledObjectsCount).toBe(0);
    });
  });
});