/**
 * Tests for DeviceCapabilityDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceCapabilityDetector, DeviceCapabilities, QualityLevel } from '../src/systems/DeviceCapabilityDetector';

// Mock Phaser scene
const mockScene = {
  add: {
    sprite: vi.fn().mockReturnValue({
      setScale: vi.fn(),
      destroy: vi.fn(),
      x: 0,
      y: 0,
      rotation: 0
    })
  },
  cameras: {
    main: {
      width: 800,
      height: 600
    }
  }
} as any;

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    jsHeapSizeLimit: 4 * 1024 * 1024 * 1024, // 4GB
    usedJSHeapSize: 100 * 1024 * 1024 // 100MB
  }
};

// Mock navigator
const mockNavigator = {
  hardwareConcurrency: 8,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

describe('DeviceCapabilityDetector', () => {
  let detector: DeviceCapabilityDetector;

  beforeEach(() => {
    // Reset singleton
    (DeviceCapabilityDetector as any).instance = null;
    detector = DeviceCapabilityDetector.getInstance();

    // Mock globals
    (global as any).performance = mockPerformance;
    (global as any).navigator = mockNavigator;
    (global as any).window = {
      devicePixelRatio: 1,
      screen: { width: 1920, height: 1080 },
      requestAnimationFrame: vi.fn((callback) => setTimeout(callback, 16))
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DeviceCapabilityDetector.getInstance();
      const instance2 = DeviceCapabilityDetector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('detectCapabilities', () => {
    it('should detect high-end device capabilities', async () => {
      const capabilities = await detector.detectCapabilities(mockScene);

      expect(capabilities).toBeDefined();
      expect(capabilities.performanceScore).toBeGreaterThan(50);
      expect(capabilities.memoryLevel).toMatch(/medium|high/);
      expect(capabilities.renderingCapability).toMatch(/standard|enhanced/);
      expect(capabilities.recommendedQuality.name).toMatch(/low|medium|high|ultra/);
    });

    it('should detect low-end device capabilities', async () => {
      // Mock low-end device
      (global as any).navigator = {
        hardwareConcurrency: 2,
        userAgent: 'Mozilla/5.0 (Linux; Android 8.0; SM-G950F) AppleWebKit/537.36'
      };
      (global as any).performance = {
        ...mockPerformance,
        memory: {
          jsHeapSizeLimit: 512 * 1024 * 1024, // 512MB
          usedJSHeapSize: 200 * 1024 * 1024
        }
      };

      // Reset detector to pick up new globals
      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      const capabilities = await detector.detectCapabilities(mockScene);

      expect(capabilities.performanceScore).toBeLessThan(50);
      expect(capabilities.memoryLevel).toBe('low');
      expect(capabilities.renderingCapability).toBe('basic');
      expect(capabilities.recommendedQuality.name).toMatch(/minimal|low/);
    });

    it('should return cached capabilities on subsequent calls', async () => {
      const capabilities1 = await detector.detectCapabilities(mockScene);
      const capabilities2 = await detector.detectCapabilities(mockScene);

      expect(capabilities1).toBe(capabilities2);
    });

    it('should work without scene parameter', async () => {
      const capabilities = await detector.detectCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.performanceScore).toBeGreaterThan(0);
    });
  });

  describe('getQualityLevel', () => {
    it('should return correct quality level by name', () => {
      const minimal = detector.getQualityLevel('minimal');
      const high = detector.getQualityLevel('high');

      expect(minimal).toBeDefined();
      expect(minimal!.name).toBe('minimal');
      expect(minimal!.particleCount).toBe(10);

      expect(high).toBeDefined();
      expect(high!.name).toBe('high');
      expect(high!.particleCount).toBe(100);
    });

    it('should return null for invalid quality level name', () => {
      const invalid = detector.getQualityLevel('invalid');
      expect(invalid).toBeNull();
    });
  });

  describe('getAllQualityLevels', () => {
    it('should return all available quality levels', () => {
      const levels = detector.getAllQualityLevels();

      expect(levels).toHaveLength(5);
      expect(levels.map(l => l.name)).toEqual(['minimal', 'low', 'medium', 'high', 'ultra']);
    });

    it('should return quality levels in ascending order', () => {
      const levels = detector.getAllQualityLevels();

      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].particleCount).toBeGreaterThan(levels[i - 1].particleCount);
      }
    });
  });

  describe('getCurrentCapabilities', () => {
    it('should return null before detection', () => {
      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities).toBeNull();
    });

    it('should return capabilities after detection', async () => {
      await detector.detectCapabilities(mockScene);
      const capabilities = detector.getCurrentCapabilities();
      expect(capabilities).toBeDefined();
    });
  });

  describe('redetectCapabilities', () => {
    it('should force re-detection of capabilities', async () => {
      const capabilities1 = await detector.detectCapabilities(mockScene);
      
      // Change mock conditions
      (global as any).navigator.hardwareConcurrency = 2;
      
      const capabilities2 = await detector.redetectCapabilities(mockScene);

      expect(capabilities2).not.toBe(capabilities1);
      expect(capabilities2.performanceScore).toBeLessThan(capabilities1.performanceScore);
    });
  });

  describe('hardware analysis', () => {
    it('should score high-end hardware correctly', async () => {
      // High-end setup
      (global as any).navigator = {
        hardwareConcurrency: 16,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      (global as any).performance = {
        ...mockPerformance,
        memory: {
          jsHeapSizeLimit: 8 * 1024 * 1024 * 1024, // 8GB
          usedJSHeapSize: 100 * 1024 * 1024
        }
      };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      const capabilities = await detector.detectCapabilities();
      expect(capabilities.performanceScore).toBeGreaterThan(70);
    });

    it('should score mobile devices lower', async () => {
      (global as any).navigator = {
        hardwareConcurrency: 4,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      const capabilities = await detector.detectCapabilities();
      expect(capabilities.performanceScore).toBeLessThan(65);
    });

    it('should handle missing performance.memory gracefully', async () => {
      (global as any).performance = {
        now: vi.fn(() => Date.now())
        // No memory property
      };

      (DeviceCapabilityDetector as any).instance = null;
      detector = DeviceCapabilityDetector.getInstance();

      const capabilities = await detector.detectCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities.performanceScore).toBeGreaterThan(0);
    });
  });

  describe('performance benchmark', () => {
    it('should handle benchmark errors gracefully', async () => {
      // Mock scene that throws errors
      const errorScene = {
        add: {
          sprite: vi.fn().mockImplementation(() => {
            throw new Error('Sprite creation failed');
          })
        },
        cameras: {
          main: { width: 800, height: 600 }
        }
      } as any;

      const capabilities = await detector.detectCapabilities(errorScene);
      expect(capabilities).toBeDefined();
      expect(capabilities.performanceScore).toBeGreaterThan(0);
    });

    it('should complete benchmark successfully with valid scene', async () => {
      let frameCount = 0;
      (global as any).window.requestAnimationFrame = vi.fn((callback) => {
        frameCount++;
        if (frameCount <= 60) {
          setTimeout(callback, 16);
        }
      });

      const capabilities = await detector.detectCapabilities(mockScene);
      expect(capabilities).toBeDefined();
      expect(mockScene.add.sprite).toHaveBeenCalled();
    });
  });

  describe('quality level mapping', () => {
    it('should map performance scores to appropriate quality levels', async () => {
      // Test that different performance scores map to expected quality levels
      // We'll test this by checking the score ranges in the actual implementation
      const capabilities = await detector.detectCapabilities();
      expect(capabilities.recommendedQuality).toBeDefined();
      expect(['minimal', 'low', 'medium', 'high', 'ultra']).toContain(capabilities.recommendedQuality.name);
    });
  });
});