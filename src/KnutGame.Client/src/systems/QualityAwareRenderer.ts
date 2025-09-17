/**
 * QualityAwareRenderer - Applies quality settings to rendering operations
 * Handles dynamic LOD, culling, and emergency rendering modes
 */

import { QualityLevel } from './DeviceCapabilityDetector';
import { DynamicQualityManager } from './DynamicQualityManager';

export interface RenderingOptions {
  enableCulling: boolean;
  cullDistance: number;
  enableLOD: boolean;
  lodDistances: number[];
  enableTextCaching: boolean;
  maxCachedTexts: number;
  enableBatching: boolean;
  emergencyMode: boolean;
}

export interface LODLevel {
  distance: number;
  scale: number;
  visible: boolean;
  simplified: boolean;
}

export class QualityAwareRenderer {
  private static instance: QualityAwareRenderer;
  private scene: Phaser.Scene | null = null;
  private qualityManager: DynamicQualityManager | null = null;
  private renderingOptions: RenderingOptions;
  private textCache = new Map<string, Phaser.GameObjects.Text>();
  private culledObjects = new Set<Phaser.GameObjects.GameObject>();
  private emergencyModeActive = false;

  // LOD levels for different distances
  private readonly lodLevels: LODLevel[] = [
    { distance: 0, scale: 1.0, visible: true, simplified: false },      // Close
    { distance: 200, scale: 0.8, visible: true, simplified: false },   // Medium
    { distance: 400, scale: 0.6, visible: true, simplified: true },    // Far
    { distance: 600, scale: 0.4, visible: true, simplified: true },    // Very far
    { distance: 800, scale: 0.0, visible: false, simplified: true }    // Too far
  ];

  public static getInstance(): QualityAwareRenderer {
    if (!QualityAwareRenderer.instance) {
      QualityAwareRenderer.instance = new QualityAwareRenderer();
    }
    return QualityAwareRenderer.instance;
  }

  constructor() {
    this.renderingOptions = {
      enableCulling: true,
      cullDistance: 1000,
      enableLOD: true,
      lodDistances: [200, 400, 600, 800],
      enableTextCaching: true,
      maxCachedTexts: 50,
      enableBatching: true,
      emergencyMode: false
    };
  }

  /**
   * Initialize the renderer with scene and quality manager
   */
  public initialize(scene: Phaser.Scene, qualityManager: DynamicQualityManager): void {
    this.scene = scene;
    this.qualityManager = qualityManager;

    // Listen for quality changes
    qualityManager.onQualityChange((newLevel, adjustment) => {
      this.applyQualityToRendering(newLevel);
      
      // Activate emergency mode if quality drops to minimal due to performance
      if (newLevel.name === 'minimal' && adjustment.reason === 'performance_drop') {
        this.activateEmergencyMode();
      } else if (this.emergencyModeActive && newLevel.name !== 'minimal') {
        this.deactivateEmergencyMode();
      }
    });

    // Apply initial quality settings
    const currentLevel = qualityManager.getCurrentQualityLevel();
    this.applyQualityToRendering(currentLevel);
  }

  /**
   * Apply quality level to rendering options
   */
  private applyQualityToRendering(level: QualityLevel): void {
    switch (level.name) {
      case 'minimal':
        this.renderingOptions = {
          enableCulling: true,
          cullDistance: 400,
          enableLOD: true,
          lodDistances: [100, 200, 300, 400],
          enableTextCaching: true,
          maxCachedTexts: 20,
          enableBatching: true,
          emergencyMode: false
        };
        break;

      case 'low':
        this.renderingOptions = {
          enableCulling: true,
          cullDistance: 600,
          enableLOD: true,
          lodDistances: [150, 300, 450, 600],
          enableTextCaching: true,
          maxCachedTexts: 30,
          enableBatching: true,
          emergencyMode: false
        };
        break;

      case 'medium':
        this.renderingOptions = {
          enableCulling: true,
          cullDistance: 800,
          enableLOD: true,
          lodDistances: [200, 400, 600, 800],
          enableTextCaching: true,
          maxCachedTexts: 40,
          enableBatching: false,
          emergencyMode: false
        };
        break;

      case 'high':
        this.renderingOptions = {
          enableCulling: true,
          cullDistance: 1000,
          enableLOD: false,
          lodDistances: [300, 600, 900, 1200],
          enableTextCaching: true,
          maxCachedTexts: 50,
          enableBatching: false,
          emergencyMode: false
        };
        break;

      case 'ultra':
        this.renderingOptions = {
          enableCulling: false,
          cullDistance: 1500,
          enableLOD: false,
          lodDistances: [400, 800, 1200, 1600],
          enableTextCaching: false,
          maxCachedTexts: 100,
          enableBatching: false,
          emergencyMode: false
        };
        break;
    }

    console.log(`Rendering options updated for quality level: ${level.name}`);
  }

  /**
   * Activate emergency rendering mode for severe performance issues
   */
  private activateEmergencyMode(): void {
    if (this.emergencyModeActive) return;

    this.emergencyModeActive = true;
    this.renderingOptions.emergencyMode = true;
    
    // Extremely aggressive culling and LOD
    this.renderingOptions.cullDistance = 300;
    this.renderingOptions.lodDistances = [50, 100, 150, 200];
    this.renderingOptions.enableCulling = true;
    this.renderingOptions.enableLOD = true;
    this.renderingOptions.enableBatching = true;
    this.renderingOptions.maxCachedTexts = 10;

    console.log('Emergency rendering mode activated');
  }

  /**
   * Deactivate emergency rendering mode
   */
  private deactivateEmergencyMode(): void {
    if (!this.emergencyModeActive) return;

    this.emergencyModeActive = false;
    this.renderingOptions.emergencyMode = false;

    // Restore normal rendering options based on current quality
    if (this.qualityManager) {
      const currentLevel = this.qualityManager.getCurrentQualityLevel();
      this.applyQualityToRendering(currentLevel);
    }

    console.log('Emergency rendering mode deactivated');
  }

  /**
   * Apply LOD (Level of Detail) to a game object based on distance from camera
   */
  public applyLOD(object: Phaser.GameObjects.GameObject, cameraX: number, cameraY: number): void {
    if (!this.renderingOptions.enableLOD || !('x' in object) || !('y' in object)) return;

    const distance = Phaser.Math.Distance.Between(
      cameraX, 
      cameraY, 
      (object as any).x, 
      (object as any).y
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
    if ('setVisible' in object) {
      (object as any).setVisible(lodLevel.visible);
    }

    if ('setScale' in object && lodLevel.visible) {
      (object as any).setScale(lodLevel.scale);
    }

    // For simplified rendering, reduce detail
    if (lodLevel.simplified && 'setTint' in object) {
      // Could apply simplified shading or reduce texture quality
    }
  }

  /**
   * Perform frustum culling on objects
   */
  public cullObjects(objects: Phaser.GameObjects.GameObject[], camera: Phaser.Cameras.Scene2D.Camera): void {
    if (!this.renderingOptions.enableCulling) return;

    const cullBounds = {
      left: camera.scrollX - 100,
      right: camera.scrollX + camera.width + 100,
      top: camera.scrollY - 100,
      bottom: camera.scrollY + camera.height + 100
    };

    objects.forEach(object => {
      if (!('x' in object) || !('y' in object)) return;

      const obj = object as any;
      const inBounds = obj.x >= cullBounds.left && 
                      obj.x <= cullBounds.right && 
                      obj.y >= cullBounds.top && 
                      obj.y <= cullBounds.bottom;

      if (!inBounds) {
        if (!this.culledObjects.has(object)) {
          obj.setVisible(false);
          this.culledObjects.add(object);
        }
      } else {
        if (this.culledObjects.has(object)) {
          obj.setVisible(true);
          this.culledObjects.delete(object);
        }
      }
    });
  }

  /**
   * Get or create cached text object
   */
  public getCachedText(scene: Phaser.Scene, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    if (!this.renderingOptions.enableTextCaching) {
      return scene.add.text(0, 0, text, style);
    }

    const cacheKey = `${text}_${JSON.stringify(style)}`;
    
    if (this.textCache.has(cacheKey)) {
      const cachedText = this.textCache.get(cacheKey)!;
      cachedText.setText(text);
      return cachedText;
    }

    // Check cache size limit
    if (this.textCache.size >= this.renderingOptions.maxCachedTexts) {
      // Remove oldest entry
      const firstKey = this.textCache.keys().next().value;
      const oldText = this.textCache.get(firstKey);
      if (oldText) {
        oldText.destroy();
      }
      this.textCache.delete(firstKey);
    }

    const newText = scene.add.text(0, 0, text, style);
    this.textCache.set(cacheKey, newText);
    return newText;
  }

  /**
   * Batch render multiple similar objects
   */
  public batchRender(objects: Phaser.GameObjects.GameObject[], renderFunction: (obj: Phaser.GameObjects.GameObject) => void): void {
    if (!this.renderingOptions.enableBatching) {
      objects.forEach(renderFunction);
      return;
    }

    // Group objects by type for batched rendering
    const batches = new Map<string, Phaser.GameObjects.GameObject[]>();
    
    objects.forEach(obj => {
      const type = obj.type;
      if (!batches.has(type)) {
        batches.set(type, []);
      }
      batches.get(type)!.push(obj);
    });

    // Render each batch
    batches.forEach(batch => {
      batch.forEach(renderFunction);
    });
  }

  /**
   * Check if emergency mode is active
   */
  public isEmergencyModeActive(): boolean {
    return this.emergencyModeActive;
  }

  /**
   * Get current rendering options
   */
  public getRenderingOptions(): RenderingOptions {
    return { ...this.renderingOptions };
  }

  /**
   * Update specific rendering option
   */
  public updateRenderingOption<K extends keyof RenderingOptions>(key: K, value: RenderingOptions[K]): void {
    this.renderingOptions[key] = value;
  }

  /**
   * Clear text cache
   */
  public clearTextCache(): void {
    this.textCache.forEach(text => text.destroy());
    this.textCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { textCacheSize: number; culledObjectsCount: number } {
    return {
      textCacheSize: this.textCache.size,
      culledObjectsCount: this.culledObjects.size
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.clearTextCache();
    this.culledObjects.clear();
    this.scene = null;
    this.qualityManager = null;
  }
}