/**
 * RenderingOptimizer - Implements dynamic LOD, culling, text caching, and emergency rendering modes
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3
 */

import { QualityAwareRenderer } from './QualityAwareRenderer';
import { DynamicQualityManager } from './DynamicQualityManager';
import { PerformanceMonitor, PerformanceIssue } from './PerformanceMonitor';

export interface LODSettings {
  enableLOD: boolean;
  lodDistances: number[];
  scaleFactors: number[];
  visibilityThresholds: number[];
}

export interface CullingSettings {
  enableCulling: boolean;
  cullDistance: number;
  cullMargin: number;
  frustumCulling: boolean;
}

export interface TextCacheSettings {
  enableCaching: boolean;
  maxCacheSize: number;
  cacheTimeout: number; // ms
  batchRendering: boolean;
}

export interface EmergencyModeSettings {
  fpsThreshold: number;
  stutterThreshold: number;
  memoryThreshold: number;
  activationDelay: number; // ms
  deactivationDelay: number; // ms
}

export interface RenderingMetrics {
  objectsRendered: number;
  objectsCulled: number;
  lodReductions: number;
  textCacheHits: number;
  textCacheMisses: number;
  emergencyModeActivations: number;
  renderTime: number;
}

export interface LODLevel {
  distance: number;
  scale: number;
  visible: boolean;
  simplified: boolean;
  textureQuality: number;
}

export interface CachedText {
  text: Phaser.GameObjects.Text;
  lastUsed: number;
  useCount: number;
  key: string;
}

/**
 * Comprehensive rendering optimization system that provides dynamic LOD,
 * culling, text caching, and emergency rendering modes
 */
export class RenderingOptimizer {
  private scene: Phaser.Scene;
  private qualityRenderer: QualityAwareRenderer;
  private qualityManager: DynamicQualityManager;
  private performanceMonitor: PerformanceMonitor;

  // Settings
  private lodSettings: LODSettings;
  private cullingSettings: CullingSettings;
  private textCacheSettings: TextCacheSettings;
  private emergencySettings: EmergencyModeSettings;

  // State
  private emergencyModeActive = false;
  private emergencyModeTimer = 0;
  private lastPerformanceCheck = 0;
  private performanceCheckInterval = 1000; // Check every second

  // Caches and tracking
  private textCache = new Map<string, CachedText>();
  private culledObjects = new Set<Phaser.GameObjects.GameObject>();
  private lodObjects = new Map<Phaser.GameObjects.GameObject, LODLevel>();
  private renderingMetrics: RenderingMetrics;

  // LOD levels configuration
  private readonly lodLevels: LODLevel[] = [
    { distance: 0, scale: 1.0, visible: true, simplified: false, textureQuality: 1.0 },
    { distance: 150, scale: 0.9, visible: true, simplified: false, textureQuality: 0.9 },
    { distance: 300, scale: 0.7, visible: true, simplified: true, textureQuality: 0.7 },
    { distance: 500, scale: 0.5, visible: true, simplified: true, textureQuality: 0.5 },
    { distance: 700, scale: 0.3, visible: true, simplified: true, textureQuality: 0.3 },
    { distance: 1000, scale: 0.0, visible: false, simplified: true, textureQuality: 0.1 }
  ];

  constructor(
    scene: Phaser.Scene,
    qualityRenderer: QualityAwareRenderer,
    qualityManager: DynamicQualityManager,
    performanceMonitor: PerformanceMonitor
  ) {
    this.scene = scene;
    this.qualityRenderer = qualityRenderer;
    this.qualityManager = qualityManager;
    this.performanceMonitor = performanceMonitor;

    // Initialize settings based on current quality level
    this.initializeSettings();
    this.resetMetrics();

    // Listen for performance issues
    this.performanceMonitor.onPerformanceIssue((issue) => {
      this.handlePerformanceIssue(issue);
    });

    // Listen for quality changes
    this.qualityManager.onQualityChange((newLevel) => {
      this.updateSettingsForQuality(newLevel.name);
    });
  }

  /**
   * Initialize settings based on current quality level
   */
  private initializeSettings(): void {
    const currentLevel = this.qualityManager.getCurrentQualityLevel();
    this.updateSettingsForQuality(currentLevel.name);

    // Emergency mode settings (consistent across quality levels)
    this.emergencySettings = {
      fpsThreshold: 20,
      stutterThreshold: 200, // ms
      memoryThreshold: 0.9,
      activationDelay: 3000, // 3 seconds of poor performance
      deactivationDelay: 10000 // 10 seconds of good performance
    };
  }

  /**
   * Update settings based on quality level
   */
  private updateSettingsForQuality(qualityLevel: string): void {
    switch (qualityLevel) {
      case 'minimal':
        this.lodSettings = {
          enableLOD: true,
          lodDistances: [50, 100, 200, 300, 400],
          scaleFactors: [1.0, 0.8, 0.6, 0.4, 0.2],
          visibilityThresholds: [400]
        };
        this.cullingSettings = {
          enableCulling: true,
          cullDistance: 300,
          cullMargin: 50,
          frustumCulling: true
        };
        this.textCacheSettings = {
          enableCaching: true,
          maxCacheSize: 20,
          cacheTimeout: 30000,
          batchRendering: true
        };
        break;

      case 'low':
        this.lodSettings = {
          enableLOD: true,
          lodDistances: [100, 200, 400, 600, 800],
          scaleFactors: [1.0, 0.9, 0.7, 0.5, 0.3],
          visibilityThresholds: [800]
        };
        this.cullingSettings = {
          enableCulling: true,
          cullDistance: 500,
          cullMargin: 75,
          frustumCulling: true
        };
        this.textCacheSettings = {
          enableCaching: true,
          maxCacheSize: 30,
          cacheTimeout: 45000,
          batchRendering: true
        };
        break;

      case 'medium':
        this.lodSettings = {
          enableLOD: true,
          lodDistances: [150, 300, 500, 700, 1000],
          scaleFactors: [1.0, 0.9, 0.7, 0.5, 0.3],
          visibilityThresholds: [1000]
        };
        this.cullingSettings = {
          enableCulling: true,
          cullDistance: 700,
          cullMargin: 100,
          frustumCulling: true
        };
        this.textCacheSettings = {
          enableCaching: true,
          maxCacheSize: 40,
          cacheTimeout: 60000,
          batchRendering: false
        };
        break;

      case 'high':
        this.lodSettings = {
          enableLOD: false, // Disable LOD for high quality
          lodDistances: [200, 400, 600, 800, 1200],
          scaleFactors: [1.0, 0.95, 0.8, 0.6, 0.4],
          visibilityThresholds: [1200]
        };
        this.cullingSettings = {
          enableCulling: true,
          cullDistance: 1000,
          cullMargin: 150,
          frustumCulling: true
        };
        this.textCacheSettings = {
          enableCaching: true,
          maxCacheSize: 50,
          cacheTimeout: 90000,
          batchRendering: false
        };
        break;

      case 'ultra':
        this.lodSettings = {
          enableLOD: false,
          lodDistances: [300, 600, 900, 1200, 1500],
          scaleFactors: [1.0, 1.0, 0.9, 0.7, 0.5],
          visibilityThresholds: [1500]
        };
        this.cullingSettings = {
          enableCulling: false, // No culling for ultra quality
          cullDistance: 1500,
          cullMargin: 200,
          frustumCulling: false
        };
        this.textCacheSettings = {
          enableCaching: false, // No caching for ultra quality
          maxCacheSize: 100,
          cacheTimeout: 120000,
          batchRendering: false
        };
        break;
    }
  }

  /**
   * Apply dynamic LOD to a game object based on distance from camera center
   */
  public applyDynamicLOD(object: Phaser.GameObjects.GameObject): void {
    if (!object || !('x' in object) || !('y' in object)) return;

    if (this.emergencyModeActive) {
      // In emergency mode, use aggressive LOD regardless of settings
      this.applyEmergencyLOD(object);
      return;
    }

    if (!this.lodSettings.enableLOD) return;

    const camera = this.scene.cameras.main;
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    
    // Calculate distance (with fallback for test environments)
    const distance = this.calculateDistance(
      centerX, centerY,
      (object as any).x, (object as any).y
    );

    // Find appropriate LOD level
    let lodLevel = this.lodLevels[0];
    for (const level of this.lodLevels) {
      if (distance >= level.distance) {
        lodLevel = level;
      } else {
        break;
      }
    }

    // Apply LOD settings
    this.applyLODLevel(object, lodLevel);
    this.lodObjects.set(object, lodLevel);

    if (!lodLevel.visible || lodLevel.scale < 1.0) {
      this.renderingMetrics.lodReductions++;
    }
  }

  /**
   * Apply emergency LOD for severe performance issues
   */
  private applyEmergencyLOD(object: Phaser.GameObjects.GameObject): void {
    if (!object || !('x' in object) || !('y' in object)) return;

    const camera = this.scene.cameras.main;
    const distance = this.calculateDistance(
      camera.scrollX + camera.width / 2,
      camera.scrollY + camera.height / 2,
      (object as any).x, (object as any).y
    );

    // Very aggressive LOD for emergency mode
    if (distance > 200) {
      if ('setVisible' in object) {
        (object as any).setVisible(false);
      }
    } else if (distance > 100) {
      if ('setScale' in object) {
        (object as any).setScale(0.3);
      }
      if ('setVisible' in object) {
        (object as any).setVisible(true);
      }
    } else {
      if ('setScale' in object) {
        (object as any).setScale(0.7);
      }
      if ('setVisible' in object) {
        (object as any).setVisible(true);
      }
    }

    this.renderingMetrics.lodReductions++;
  }

  /**
   * Apply specific LOD level to an object
   */
  private applyLODLevel(object: Phaser.GameObjects.GameObject, lodLevel: LODLevel): void {
    // Apply visibility
    if ('setVisible' in object) {
      (object as any).setVisible(lodLevel.visible);
    }

    if (!lodLevel.visible) return;

    // Apply scale
    if ('setScale' in object) {
      (object as any).setScale(lodLevel.scale);
    }

    // Apply simplified rendering
    if (lodLevel.simplified) {
      // Reduce texture quality or apply simplified shading
      if ('setTint' in object) {
        // Could apply a slight tint to indicate simplified rendering
        // (object as any).setTint(0xf0f0f0);
      }
      
      // Disable certain visual effects for simplified objects
      if ('setAlpha' in object && lodLevel.textureQuality < 1.0) {
        (object as any).setAlpha(lodLevel.textureQuality);
      }
    } else {
      // Restore full quality
      if ('clearTint' in object) {
        (object as any).clearTint();
      }
      if ('setAlpha' in object) {
        (object as any).setAlpha(1.0);
      }
    }
  }

  /**
   * Perform frustum culling on objects
   */
  public cullObjects(objects: Phaser.GameObjects.GameObject[]): void {
    if (!this.cullingSettings.enableCulling && !this.emergencyModeActive) return;
    if (!objects || objects.length === 0) return;

    const camera = this.scene?.cameras?.main;
    if (!camera) return;

    const margin = this.emergencyModeActive ? 25 : this.cullingSettings.cullMargin;
    
    const cullBounds = {
      left: camera.scrollX - margin,
      right: camera.scrollX + camera.width + margin,
      top: camera.scrollY - margin,
      bottom: camera.scrollY + camera.height + margin
    };

    objects.forEach(object => {
      if (!object || !('x' in object) || !('y' in object)) return;

      const obj = object as any;
      const inBounds = obj.x >= cullBounds.left && 
                      obj.x <= cullBounds.right && 
                      obj.y >= cullBounds.top && 
                      obj.y <= cullBounds.bottom;

      if (!inBounds) {
        if (!this.culledObjects.has(object)) {
          if ('setVisible' in obj) {
            obj.setVisible(false);
          }
          this.culledObjects.add(object);
          this.renderingMetrics.objectsCulled++;
        }
      } else {
        if (this.culledObjects.has(object)) {
          if ('setVisible' in obj) {
            obj.setVisible(true);
          }
          this.culledObjects.delete(object);
        }
        this.renderingMetrics.objectsRendered++;
      }
    });
  }

  /**
   * Get or create cached text with optimized rendering
   */
  public getCachedText(
    text: string, 
    style: Phaser.Types.GameObjects.Text.TextStyle,
    x: number = 0,
    y: number = 0
  ): Phaser.GameObjects.Text {
    if (!this.textCacheSettings.enableCaching || this.emergencyModeActive) {
      // In emergency mode or when caching disabled, create simple text
      const textObj = this.scene.add.text(x, y, text, {
        ...style,
        resolution: this.emergencyModeActive ? 1 : (style.resolution || 2)
      });
      this.renderingMetrics.textCacheMisses++;
      return textObj;
    }

    const cacheKey = this.generateTextCacheKey(text, style);
    const now = Date.now();

    // Check if we have a cached version
    if (this.textCache.has(cacheKey)) {
      const cached = this.textCache.get(cacheKey)!;
      
      // Check if cache entry is still valid
      if (now - cached.lastUsed < this.textCacheSettings.cacheTimeout) {
        cached.lastUsed = now;
        cached.useCount++;
        cached.text.setPosition(x, y);
        cached.text.setText(text);
        this.renderingMetrics.textCacheHits++;
        return cached.text;
      } else {
        // Cache entry expired
        cached.text.destroy();
        this.textCache.delete(cacheKey);
      }
    }

    // Create new text object
    const textObj = this.scene.add.text(x, y, text, style);
    
    // Add to cache if there's room
    if (this.textCache.size < this.textCacheSettings.maxCacheSize) {
      this.textCache.set(cacheKey, {
        text: textObj,
        lastUsed: now,
        useCount: 1,
        key: cacheKey
      });
    } else {
      // Remove least recently used item
      this.evictLRUTextCache();
      this.textCache.set(cacheKey, {
        text: textObj,
        lastUsed: now,
        useCount: 1,
        key: cacheKey
      });
    }

    this.renderingMetrics.textCacheMisses++;
    return textObj;
  }

  /**
   * Batch render text objects for better performance
   */
  public batchRenderTexts(textRequests: Array<{
    text: string;
    style: Phaser.Types.GameObjects.Text.TextStyle;
    x: number;
    y: number;
  }>): Phaser.GameObjects.Text[] {
    if (!this.textCacheSettings.batchRendering) {
      return textRequests.map(req => this.getCachedText(req.text, req.style, req.x, req.y));
    }

    // Group by style for batched rendering
    const styleGroups = new Map<string, typeof textRequests>();
    
    textRequests.forEach(req => {
      const styleKey = JSON.stringify(req.style);
      if (!styleGroups.has(styleKey)) {
        styleGroups.set(styleKey, []);
      }
      styleGroups.get(styleKey)!.push(req);
    });

    const results: Phaser.GameObjects.Text[] = [];
    
    // Render each style group together
    styleGroups.forEach(group => {
      group.forEach(req => {
        results.push(this.getCachedText(req.text, req.style, req.x, req.y));
      });
    });

    return results;
  }

  /**
   * Handle performance issues and activate emergency mode if needed
   */
  private handlePerformanceIssue(issue: PerformanceIssue): void {
    const shouldActivateEmergency = 
      (issue.type === 'low_fps' && issue.metrics.currentFPS < this.emergencySettings.fpsThreshold) ||
      (issue.type === 'stutter' && issue.duration > this.emergencySettings.stutterThreshold) ||
      (issue.type === 'memory_pressure' && issue.metrics.memoryUsage > this.emergencySettings.memoryThreshold);

    if (shouldActivateEmergency && !this.emergencyModeActive) {
      this.emergencyModeTimer += 100; // Accumulate emergency conditions
      
      if (this.emergencyModeTimer >= this.emergencySettings.activationDelay) {
        this.activateEmergencyMode();
      }
    } else if (this.emergencyModeActive) {
      // Check if we can deactivate emergency mode
      const currentFPS = this.performanceMonitor.getCurrentFPS();
      if (currentFPS > this.emergencySettings.fpsThreshold * 1.5) {
        this.emergencyModeTimer -= 200; // Faster recovery
        
        if (this.emergencyModeTimer <= -this.emergencySettings.deactivationDelay) {
          this.deactivateEmergencyMode();
        }
      }
    }
  }

  /**
   * Activate emergency rendering mode
   */
  private activateEmergencyMode(): void {
    if (this.emergencyModeActive) return;

    this.emergencyModeActive = true;
    this.renderingMetrics.emergencyModeActivations++;

    console.log('Emergency rendering mode activated');

    // Apply emergency settings immediately to all tracked objects
    this.lodObjects.forEach((_, object) => {
      this.applyEmergencyLOD(object);
    });

    // Clear text cache to free memory
    this.clearTextCache();
  }

  /**
   * Deactivate emergency rendering mode
   */
  private deactivateEmergencyMode(): void {
    if (!this.emergencyModeActive) return;

    this.emergencyModeActive = false;
    this.emergencyModeTimer = 0;

    console.log('Emergency rendering mode deactivated');

    // Restore normal LOD for all objects
    this.lodObjects.forEach((lodLevel, object) => {
      this.applyLODLevel(object, lodLevel);
    });
  }

  /**
   * Generate cache key for text objects
   */
  private generateTextCacheKey(text: string, style: Phaser.Types.GameObjects.Text.TextStyle): string {
    const styleStr = JSON.stringify({
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      color: style.color,
      stroke: style.stroke,
      strokeThickness: style.strokeThickness
    });
    return `${text}_${styleStr}`;
  }

  /**
   * Evict least recently used text from cache
   */
  private evictLRUTextCache(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    this.textCache.forEach((cached, key) => {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      const cached = this.textCache.get(oldestKey);
      if (cached) {
        cached.text.destroy();
      }
      this.textCache.delete(oldestKey);
    }
  }

  /**
   * Clear text cache
   */
  public clearTextCache(): void {
    this.textCache.forEach(cached => {
      cached.text.destroy();
    });
    this.textCache.clear();
  }

  /**
   * Update rendering optimizations (call once per frame)
   */
  public update(): void {
    const now = Date.now();
    
    // Periodic performance check
    if (now - this.lastPerformanceCheck > this.performanceCheckInterval) {
      this.checkPerformanceAndAdjust();
      this.lastPerformanceCheck = now;
    }

    // Clean up expired cache entries
    if (this.textCacheSettings.enableCaching) {
      this.cleanupExpiredCache();
    }
  }

  /**
   * Check performance and adjust settings if needed
   */
  private checkPerformanceAndAdjust(): void {
    const currentFPS = this.performanceMonitor.getCurrentFPS();
    const isPerformanceIssueActive = this.performanceMonitor.isPerformanceIssueActive();

    // Adjust emergency mode timer based on current performance
    if (isPerformanceIssueActive && currentFPS < this.emergencySettings.fpsThreshold) {
      this.emergencyModeTimer += this.performanceCheckInterval;
    } else if (currentFPS > this.emergencySettings.fpsThreshold * 1.2) {
      this.emergencyModeTimer = Math.max(0, this.emergencyModeTimer - this.performanceCheckInterval);
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.textCache.forEach((cached, key) => {
      if (now - cached.lastUsed > this.textCacheSettings.cacheTimeout) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      const cached = this.textCache.get(key);
      if (cached) {
        cached.text.destroy();
      }
      this.textCache.delete(key);
    });
  }

  /**
   * Get current rendering metrics
   */
  public getMetrics(): RenderingMetrics {
    return { ...this.renderingMetrics };
  }

  /**
   * Reset rendering metrics
   */
  public resetMetrics(): void {
    this.renderingMetrics = {
      objectsRendered: 0,
      objectsCulled: 0,
      lodReductions: 0,
      textCacheHits: 0,
      textCacheMisses: 0,
      emergencyModeActivations: 0,
      renderTime: 0
    };
  }

  /**
   * Check if emergency mode is active
   */
  public isEmergencyModeActive(): boolean {
    return this.emergencyModeActive;
  }

  /**
   * Get current settings
   */
  public getSettings(): {
    lod: LODSettings;
    culling: CullingSettings;
    textCache: TextCacheSettings;
    emergency: EmergencyModeSettings;
  } {
    return {
      lod: { ...this.lodSettings },
      culling: { ...this.cullingSettings },
      textCache: { ...this.textCacheSettings },
      emergency: { ...this.emergencySettings }
    };
  }

  /**
   * Calculate distance between two points (with fallback for test environments)
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    // Use Phaser's distance calculation if available, otherwise use standard formula
    if (typeof Phaser !== 'undefined' && Phaser.Math?.Distance?.Between) {
      return Phaser.Math.Distance.Between(x1, y1, x2, y2);
    }
    
    // Fallback calculation
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.clearTextCache();
    this.culledObjects.clear();
    this.lodObjects.clear();
  }
}