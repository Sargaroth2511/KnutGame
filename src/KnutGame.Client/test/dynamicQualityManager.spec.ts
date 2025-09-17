/**
 * Tests for DynamicQualityManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamicQualityManager, QualitySettings, QualityAdjustment } from '../src/systems/DynamicQualityManager';
import { DeviceCapabilityDetector, QualityLevel } from '../src/systems/DeviceCapabilityDetector';
import { PerformanceMonitor } from '../src/systems/PerformanceMonitor';

// Mock dependencies
vi.mock('../src/systems/DeviceCapabilityDetector', () => ({
  DeviceCapabilityDetector: {
    getInstance: vi.fn()
  }
}));
vi.mock('../src/systems/PerformanceMonitor');

const mockScene = {
  textures: {},
  game: { loop: {} }
} as any;

const mockPerformanceMonitor = {
  getCurrentFPS: vi.fn(() => 60),
  getAverageFrameTime: vi.fn(() => 16.67)
} as any;

const mockDetector = {
  detectCapabilities: vi.fn(),
  getQualityLevel: vi.fn(),
  getAllQualityLevels: vi.fn(),
  getInstance: vi.fn()
} as any;

const mockQualityLevels: QualityLevel[] = [
  { name: 'minimal', particleCount: 10, effectsEnabled: false, textureQuality: 0.5, shadowsEnabled: false, antialiasing: false, maxFPS: 30 },
  { name: 'low', particleCount: 25, effectsEnabled: false, textureQuality: 0.7, shadowsEnabled: false, antialiasing: false, maxFPS: 45 },
  { name: 'medium', particleCount: 50, effectsEnabled: true, textureQuality: 0.8, shadowsEnabled: false, antialiasing: true, maxFPS: 60 },
  { name: 'high', particleCount: 100, effectsEnabled: true, textureQuality: 1.0, shadowsEnabled: true, antialiasing: true, maxFPS: 60 }
];

describe('DynamicQualityManager', () => {
  let qualityManager: DynamicQualityManager;

  beforeEach(() => {
    // Reset singleton
    (DynamicQualityManager as any).instance = null;
    qualityManager = DynamicQualityManager.getInstance();

    // Setup mocks
    (DeviceCapabilityDetector.getInstance as any).mockReturnValue(mockDetector);
    mockDetector.getQualityLevel.mockImplementation((name: string) => 
      mockQualityLevels.find(level => level.name === name) || null
    );
    mockDetector.getAllQualityLevels.mockReturnValue(mockQualityLevels);
    mockDetector.detectCapabilities.mockResolvedValue({
      performanceScore: 70,
      memoryLevel: 'medium' as const,
      renderingCapability: 'standard' as const,
      recommendedQuality: mockQualityLevels[2], // medium
      maxParticles: 50,
      maxObjects: 100,
      canHandleEffects: true
    });

    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DynamicQualityManager.getInstance();
      const instance2 = DynamicQualityManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize with minimal quality level', () => {
      const settings = qualityManager.getCurrentSettings();
      expect(settings.currentLevel.name).toBe('minimal');
      expect(settings.adaptiveMode).toBe(true);
      expect(settings.autoReduction).toBe(true);
    });

    it('should detect capabilities and apply progressive enhancement', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);

      expect(mockDetector.detectCapabilities).toHaveBeenCalledWith(mockScene);
      
      // Should start with minimal and progress
      const history = qualityManager.getAdjustmentHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].toLevel).toBe('minimal');
    });

    it('should start performance monitoring when adaptive mode is enabled', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      
      // Fast-forward to trigger performance checks
      vi.advanceTimersByTime(3000);
      
      expect(mockPerformanceMonitor.getCurrentFPS).toHaveBeenCalled();
    });
  });

  describe('progressive enhancement', () => {
    it('should gradually enhance quality based on performance', async () => {
      // Mock good performance
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(60);
      
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      
      // Fast-forward through enhancement process
      vi.advanceTimersByTime(10000);
      
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).not.toBe('minimal');
    });

    it('should stop enhancement if performance drops', async () => {
      // Mock performance that drops during enhancement
      let callCount = 0;
      mockPerformanceMonitor.getCurrentFPS.mockImplementation(() => {
        callCount++;
        return callCount > 2 ? 25 : 60; // Good initially, then drops
      });
      
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      
      vi.advanceTimersByTime(15000);
      
      const history = qualityManager.getAdjustmentHistory();
      const reductionAdjustments = history.filter(adj => adj.reason === 'performance_drop');
      expect(reductionAdjustments.length).toBeGreaterThan(0);
    });
  });

  describe('automatic quality adjustment', () => {
    beforeEach(async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      // Set to medium quality for testing adjustments
      await qualityManager.setQualityLevel('medium');
    });

    it('should reduce quality when FPS drops below threshold', async () => {
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(30); // Below reduction threshold
      
      vi.advanceTimersByTime(6000); // Trigger performance check after cooldown
      
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toBe('low'); // Should reduce from medium to low
    });

    it('should increase quality when FPS is above recovery threshold', async () => {
      // Start with low quality
      await qualityManager.setQualityLevel('low');
      
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(55); // Above recovery threshold
      
      vi.advanceTimersByTime(35000); // Wait for stability period
      
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toBe('medium'); // Should increase from low to medium
    });

    it('should respect adjustment cooldown', async () => {
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(30);
      
      // First adjustment
      vi.advanceTimersByTime(3000);
      const firstLevel = qualityManager.getCurrentQualityLevel();
      
      // Try to adjust again immediately
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(25);
      vi.advanceTimersByTime(1000); // Less than cooldown period
      
      const secondLevel = qualityManager.getCurrentQualityLevel();
      expect(secondLevel).toBe(firstLevel); // Should not change due to cooldown
    });

    it('should not increase quality if recent performance drops occurred', async () => {
      // Simulate recent performance drop
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(30);
      vi.advanceTimersByTime(6000); // Cause reduction
      
      // Now simulate good performance
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(55);
      vi.advanceTimersByTime(10000); // Less than 30 second stability period
      
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toBe('low'); // Should not increase yet
    });
  });

  describe('manual quality control', () => {
    beforeEach(async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
    });

    it('should allow manual quality level setting', async () => {
      const result = await qualityManager.setQualityLevel('high');
      
      expect(result).toBe(true);
      expect(qualityManager.getCurrentQualityLevel().name).toBe('high');
      
      const history = qualityManager.getAdjustmentHistory();
      const manualAdjustment = history.find(adj => adj.reason === 'manual');
      expect(manualAdjustment).toBeDefined();
    });

    it('should reject invalid quality level names', async () => {
      const result = await qualityManager.setQualityLevel('invalid');
      expect(result).toBe(false);
    });
  });

  describe('settings management', () => {
    it('should update settings correctly', () => {
      const newSettings: Partial<QualitySettings> = {
        adaptiveMode: false,
        performanceTarget: 30,
        reductionThreshold: 25
      };
      
      qualityManager.updateSettings(newSettings);
      
      const currentSettings = qualityManager.getCurrentSettings();
      expect(currentSettings.adaptiveMode).toBe(false);
      expect(currentSettings.performanceTarget).toBe(30);
      expect(currentSettings.reductionThreshold).toBe(25);
    });

    it('should stop performance monitoring when adaptive mode is disabled', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      
      qualityManager.updateSettings({ adaptiveMode: false });
      
      // Performance monitoring should stop
      vi.advanceTimersByTime(10000);
      const callCount = mockPerformanceMonitor.getCurrentFPS.mock.calls.length;
      
      vi.advanceTimersByTime(10000);
      expect(mockPerformanceMonitor.getCurrentFPS.mock.calls.length).toBe(callCount);
    });
  });

  describe('callbacks and events', () => {
    it('should notify callbacks on quality changes', async () => {
      const callback = vi.fn();
      qualityManager.onQualityChange(callback);
      
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      await qualityManager.setQualityLevel('high');
      
      expect(callback).toHaveBeenCalled();
      const [newLevel, adjustment] = callback.mock.calls[callback.mock.calls.length - 1];
      expect(newLevel.name).toBe('high');
      expect(adjustment.reason).toBe('manual');
    });

    it('should remove callbacks correctly', async () => {
      const callback = vi.fn();
      qualityManager.onQualityChange(callback);
      qualityManager.removeQualityChangeCallback(callback);
      
      await qualityManager.setQualityLevel('high');
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = vi.fn();
      
      qualityManager.onQualityChange(errorCallback);
      qualityManager.onQualityChange(goodCallback);
      
      await qualityManager.setQualityLevel('high');
      
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('adjustment history', () => {
    it('should track adjustment history', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      await qualityManager.setQualityLevel('high');
      await qualityManager.setQualityLevel('low');
      
      const history = qualityManager.getAdjustmentHistory();
      expect(history.length).toBeGreaterThan(2);
      
      const manualAdjustments = history.filter(adj => adj.reason === 'manual');
      expect(manualAdjustments.length).toBe(2);
    });

    it('should include performance metrics in adjustments', async () => {
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(45);
      mockPerformanceMonitor.getAverageFrameTime.mockReturnValue(22.2);
      
      await qualityManager.setQualityLevel('medium');
      
      const history = qualityManager.getAdjustmentHistory();
      const lastAdjustment = history[history.length - 1];
      
      expect(lastAdjustment.performanceMetrics.fps).toBe(45);
      expect(lastAdjustment.performanceMetrics.frameTime).toBe(22.2);
    });
  });

  describe('force performance check', () => {
    it('should allow forcing immediate performance check', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      await qualityManager.setQualityLevel('medium');
      
      mockPerformanceMonitor.getCurrentFPS.mockReturnValue(25);
      
      qualityManager.forcePerformanceCheck();
      
      const currentLevel = qualityManager.getCurrentQualityLevel();
      expect(currentLevel.name).toBe('low');
    });
  });

  describe('recommended quality', () => {
    it('should return recommended quality level from device capabilities', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      
      const recommended = qualityManager.getRecommendedQualityLevel();
      expect(recommended?.name).toBe('medium');
    });

    it('should return null if capabilities not detected', () => {
      const recommended = qualityManager.getRecommendedQualityLevel();
      expect(recommended).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await qualityManager.initialize(mockScene, mockPerformanceMonitor);
      
      qualityManager.destroy();
      
      // Should stop performance monitoring
      vi.advanceTimersByTime(10000);
      const callCount = mockPerformanceMonitor.getCurrentFPS.mock.calls.length;
      
      vi.advanceTimersByTime(10000);
      expect(mockPerformanceMonitor.getCurrentFPS.mock.calls.length).toBe(callCount);
    });
  });
});