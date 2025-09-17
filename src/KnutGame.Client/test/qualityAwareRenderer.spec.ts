/**
 * Tests for QualityAwareRenderer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QualityAwareRenderer, RenderingOptions } from '../src/systems/QualityAwareRenderer';
import { DynamicQualityManager, QualityAdjustment } from '../src/systems/DynamicQualityManager';
import { QualityLevel } from '../src/systems/DeviceCapabilityDetector';

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

// Mock dependencies
vi.mock('../src/systems/DynamicQualityManager');

const mockScene = {
  textures: {},
  add: {
    text: vi.fn(() => ({
      setText: vi.fn(),
      destroy: vi.fn()
    }))
  }
} as any;

const mockQualityManager = {
  onQualityChange: vi.fn(),
  getCurrentQualityLevel: vi.fn()
} as any;

const mockQualityLevels: Record<string, QualityLevel> = {
  minimal: { name: 'minimal', particleCount: 10, effectsEnabled: false, textureQuality: 0.5, shadowsEnabled: false, antialiasing: false, maxFPS: 30 },
  low: { name: 'low', particleCount: 25, effectsEnabled: false, textureQuality: 0.7, shadowsEnabled: false, antialiasing: false, maxFPS: 45 },
  medium: { name: 'medium', particleCount: 50, effectsEnabled: true, textureQuality: 0.8, shadowsEnabled: false, antialiasing: true, maxFPS: 60 },
  high: { name: 'high', particleCount: 100, effectsEnabled: true, textureQuality: 1.0, shadowsEnabled: true, antialiasing: true, maxFPS: 60 },
  ultra: { name: 'ultra', particleCount: 200, effectsEnabled: true, textureQuality: 1.0, shadowsEnabled: true, antialiasing: true, maxFPS: 120 }
};

describe('QualityAwareRenderer', () => {
  let renderer: QualityAwareRenderer;

  beforeEach(() => {
    // Reset singleton
    (QualityAwareRenderer as any).instance = null;
    renderer = QualityAwareRenderer.getInstance();

    mockQualityManager.getCurrentQualityLevel.mockReturnValue(mockQualityLevels.medium);

    vi.clearAllMocks();
  });

  afterEach(() => {
    renderer.destroy();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QualityAwareRenderer.getInstance();
      const instance2 = QualityAwareRenderer.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize with default rendering options', () => {
      const options = renderer.getRenderingOptions();
      
      expect(options.enableCulling).toBe(true);
      expect(options.enableLOD).toBe(true);
      expect(options.enableTextCaching).toBe(true);
      expect(options.emergencyMode).toBe(false);
    });

    it('should register quality change callback', () => {
      renderer.initialize(mockScene, mockQualityManager);
      
      expect(mockQualityManager.onQualityChange).toHaveBeenCalled();
    });

    it('should apply initial quality settings', () => {
      renderer.initialize(mockScene, mockQualityManager);
      
      const options = renderer.getRenderingOptions();
      expect(options.cullDistance).toBe(800); // Medium quality setting
    });
  });

  describe('quality level application', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
    });

    it('should apply minimal quality settings correctly', () => {
      const callback = mockQualityManager.onQualityChange.mock.calls[0][0];
      const adjustment: QualityAdjustment = {
        timestamp: Date.now(),
        fromLevel: 'medium',
        toLevel: 'minimal',
        reason: 'performance_drop',
        performanceMetrics: { fps: 25, frameTime: 40 }
      };
      
      callback(mockQualityLevels.minimal, adjustment);
      
      const options = renderer.getRenderingOptions();
      expect(options.cullDistance).toBe(300); // Emergency mode is active
      expect(options.enableBatching).toBe(true);
      expect(options.maxCachedTexts).toBe(10); // Emergency mode reduces cache size
    });

    it('should apply high quality settings correctly', () => {
      const callback = mockQualityManager.onQualityChange.mock.calls[0][0];
      const adjustment: QualityAdjustment = {
        timestamp: Date.now(),
        fromLevel: 'medium',
        toLevel: 'high',
        reason: 'performance_recovery',
        performanceMetrics: { fps: 60, frameTime: 16.67 }
      };
      
      callback(mockQualityLevels.high, adjustment);
      
      const options = renderer.getRenderingOptions();
      expect(options.cullDistance).toBe(1000);
      expect(options.enableLOD).toBe(false);
      expect(options.enableBatching).toBe(false);
    });

    it('should apply ultra quality settings correctly', () => {
      const callback = mockQualityManager.onQualityChange.mock.calls[0][0];
      const adjustment: QualityAdjustment = {
        timestamp: Date.now(),
        fromLevel: 'high',
        toLevel: 'ultra',
        reason: 'manual',
        performanceMetrics: { fps: 120, frameTime: 8.33 }
      };
      
      callback(mockQualityLevels.ultra, adjustment);
      
      const options = renderer.getRenderingOptions();
      expect(options.enableCulling).toBe(false);
      expect(options.enableTextCaching).toBe(false);
      expect(options.cullDistance).toBe(1500);
    });
  });

  describe('emergency mode', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
    });

    it('should activate emergency mode on minimal quality with performance drop', () => {
      const callback = mockQualityManager.onQualityChange.mock.calls[0][0];
      const adjustment: QualityAdjustment = {
        timestamp: Date.now(),
        fromLevel: 'low',
        toLevel: 'minimal',
        reason: 'performance_drop',
        performanceMetrics: { fps: 15, frameTime: 66.67 }
      };
      
      callback(mockQualityLevels.minimal, adjustment);
      
      expect(renderer.isEmergencyModeActive()).toBe(true);
      
      const options = renderer.getRenderingOptions();
      expect(options.emergencyMode).toBe(true);
      expect(options.cullDistance).toBe(300); // More aggressive than normal minimal
    });

    it('should deactivate emergency mode when quality improves', () => {
      // First activate emergency mode
      const callback = mockQualityManager.onQualityChange.mock.calls[0][0];
      callback(mockQualityLevels.minimal, {
        timestamp: Date.now(),
        fromLevel: 'low',
        toLevel: 'minimal',
        reason: 'performance_drop',
        performanceMetrics: { fps: 15, frameTime: 66.67 }
      });
      
      expect(renderer.isEmergencyModeActive()).toBe(true);
      
      // Then improve quality
      callback(mockQualityLevels.low, {
        timestamp: Date.now(),
        fromLevel: 'minimal',
        toLevel: 'low',
        reason: 'performance_recovery',
        performanceMetrics: { fps: 35, frameTime: 28.57 }
      });
      
      expect(renderer.isEmergencyModeActive()).toBe(false);
    });

    it('should not activate emergency mode for manual minimal setting', () => {
      const callback = mockQualityManager.onQualityChange.mock.calls[0][0];
      const adjustment: QualityAdjustment = {
        timestamp: Date.now(),
        fromLevel: 'medium',
        toLevel: 'minimal',
        reason: 'manual',
        performanceMetrics: { fps: 45, frameTime: 22.22 }
      };
      
      callback(mockQualityLevels.minimal, adjustment);
      
      expect(renderer.isEmergencyModeActive()).toBe(false);
    });
  });

  describe('LOD (Level of Detail)', () => {
    let mockObject: any;

    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
      mockObject = {
        x: 100,
        y: 100,
        setVisible: vi.fn(),
        setScale: vi.fn(),
        setTint: vi.fn()
      };
    });

    it('should apply appropriate LOD based on distance', () => {
      // Close object
      renderer.applyLOD(mockObject, 50, 50);
      expect(mockObject.setVisible).toHaveBeenCalledWith(true);
      expect(mockObject.setScale).toHaveBeenCalledWith(1.0);

      // Far object (distance ~707, which is > 600, so scale should be 0.4)
      mockObject.x = 500;
      mockObject.y = 500;
      renderer.applyLOD(mockObject, 0, 0);
      expect(mockObject.setScale).toHaveBeenCalledWith(0.4);

      // Very far object
      mockObject.x = 1000;
      mockObject.y = 1000;
      renderer.applyLOD(mockObject, 0, 0);
      expect(mockObject.setVisible).toHaveBeenCalledWith(false);
    });

    it('should skip LOD for objects without position', () => {
      const objectWithoutPosition = { setVisible: vi.fn() };
      
      renderer.applyLOD(objectWithoutPosition, 0, 0);
      
      expect(objectWithoutPosition.setVisible).not.toHaveBeenCalled();
    });

    it('should respect LOD enable/disable setting', () => {
      renderer.updateRenderingOption('enableLOD', false);
      
      renderer.applyLOD(mockObject, 1000, 1000);
      
      expect(mockObject.setVisible).not.toHaveBeenCalled();
      expect(mockObject.setScale).not.toHaveBeenCalled();
    });
  });

  describe('frustum culling', () => {
    let mockObjects: any[];
    let mockCamera: any;

    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
      
      mockObjects = [
        { x: 100, y: 100, setVisible: vi.fn() },
        { x: 1000, y: 1000, setVisible: vi.fn() },
        { x: 400, y: 300, setVisible: vi.fn() }
      ];
      
      mockCamera = {
        scrollX: 0,
        scrollY: 0,
        width: 800,
        height: 600
      };
    });

    it('should cull objects outside camera bounds', () => {
      renderer.cullObjects(mockObjects, mockCamera);
      
      // In bounds objects don't get setVisible(true) called unless they were previously culled
      expect(mockObjects[0].setVisible).not.toHaveBeenCalled(); // In bounds, never culled
      expect(mockObjects[1].setVisible).toHaveBeenCalledWith(false); // Out of bounds
      expect(mockObjects[2].setVisible).not.toHaveBeenCalled(); // In bounds, never culled
    });

    it('should restore visibility when objects come back into bounds', () => {
      // First cull
      renderer.cullObjects(mockObjects, mockCamera);
      expect(mockObjects[1].setVisible).toHaveBeenCalledWith(false);
      
      // Move camera to include previously culled object
      mockCamera.scrollX = 500;
      mockCamera.scrollY = 500;
      
      renderer.cullObjects(mockObjects, mockCamera);
      expect(mockObjects[1].setVisible).toHaveBeenCalledWith(true);
    });

    it('should respect culling enable/disable setting', () => {
      renderer.updateRenderingOption('enableCulling', false);
      
      renderer.cullObjects(mockObjects, mockCamera);
      
      mockObjects.forEach(obj => {
        expect(obj.setVisible).not.toHaveBeenCalled();
      });
    });

    it('should handle objects without position gracefully', () => {
      const objectsWithoutPosition = [{ setVisible: vi.fn() }];
      
      expect(() => {
        renderer.cullObjects(objectsWithoutPosition, mockCamera);
      }).not.toThrow();
    });
  });

  describe('text caching', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
    });

    it('should cache text objects when enabled', () => {
      const style = { fontSize: '16px', fill: '#ffffff' };
      
      const text1 = renderer.getCachedText(mockScene, 'Hello', style);
      const text2 = renderer.getCachedText(mockScene, 'Hello', style);
      
      expect(text1).toBe(text2); // Should return cached instance
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    });

    it('should create new text when caching is disabled', () => {
      renderer.updateRenderingOption('enableTextCaching', false);
      
      const style = { fontSize: '16px', fill: '#ffffff' };
      
      const text1 = renderer.getCachedText(mockScene, 'Hello', style);
      const text2 = renderer.getCachedText(mockScene, 'Hello', style);
      
      expect(text1).not.toBe(text2);
      expect(mockScene.add.text).toHaveBeenCalledTimes(2);
    });

    it('should respect cache size limit', () => {
      renderer.updateRenderingOption('maxCachedTexts', 2);
      
      const style = { fontSize: '16px', fill: '#ffffff' };
      
      // Create 3 different texts (exceeds limit)
      renderer.getCachedText(mockScene, 'Text1', style);
      renderer.getCachedText(mockScene, 'Text2', style);
      renderer.getCachedText(mockScene, 'Text3', style);
      
      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(2);
    });

    it('should clear cache correctly', () => {
      const style = { fontSize: '16px', fill: '#ffffff' };
      renderer.getCachedText(mockScene, 'Hello', style);
      
      renderer.clearTextCache();
      
      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(0);
    });
  });

  describe('batch rendering', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
    });

    it('should batch render objects when enabled', () => {
      const renderFunction = vi.fn();
      const objects = [
        { type: 'Sprite' },
        { type: 'Sprite' },
        { type: 'Text' }
      ] as any[];
      
      renderer.batchRender(objects, renderFunction);
      
      expect(renderFunction).toHaveBeenCalledTimes(3);
    });

    it('should render individually when batching is disabled', () => {
      renderer.updateRenderingOption('enableBatching', false);
      
      const renderFunction = vi.fn();
      const objects = [{ type: 'Sprite' }, { type: 'Text' }] as any[];
      
      renderer.batchRender(objects, renderFunction);
      
      expect(renderFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('rendering options management', () => {
    it('should update individual rendering options', () => {
      renderer.updateRenderingOption('cullDistance', 1200);
      
      const options = renderer.getRenderingOptions();
      expect(options.cullDistance).toBe(1200);
    });

    it('should return copy of rendering options', () => {
      const options1 = renderer.getRenderingOptions();
      const options2 = renderer.getRenderingOptions();
      
      expect(options1).not.toBe(options2);
      expect(options1).toEqual(options2);
    });
  });

  describe('cache statistics', () => {
    beforeEach(() => {
      renderer.initialize(mockScene, mockQualityManager);
    });

    it('should provide accurate cache statistics', () => {
      // Add some cached text
      const style = { fontSize: '16px', fill: '#ffffff' };
      renderer.getCachedText(mockScene, 'Test1', style);
      renderer.getCachedText(mockScene, 'Test2', style);
      
      // Add some culled objects
      const mockObjects = [
        { x: 1000, y: 1000, setVisible: vi.fn() }
      ];
      const mockCamera = { scrollX: 0, scrollY: 0, width: 800, height: 600 };
      renderer.cullObjects(mockObjects, mockCamera);
      
      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(2);
      expect(stats.culledObjectsCount).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      renderer.initialize(mockScene, mockQualityManager);
      
      // Add some cached data
      const style = { fontSize: '16px', fill: '#ffffff' };
      renderer.getCachedText(mockScene, 'Test', style);
      
      renderer.destroy();
      
      const stats = renderer.getCacheStats();
      expect(stats.textCacheSize).toBe(0);
      expect(stats.culledObjectsCount).toBe(0);
    });
  });
});