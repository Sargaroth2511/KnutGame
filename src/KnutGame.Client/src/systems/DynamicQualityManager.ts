/**
 * DynamicQualityManager - Manages dynamic quality settings that adjust based on performance
 * Implements progressive enhancement and automatic quality reduction
 */

import { DeviceCapabilityDetector, QualityLevel, DeviceCapabilities } from './DeviceCapabilityDetector';
import { PerformanceMonitor } from './PerformanceMonitor';

export interface QualitySettings {
  currentLevel: QualityLevel;
  adaptiveMode: boolean;
  autoReduction: boolean;
  performanceTarget: number; // Target FPS
  reductionThreshold: number; // FPS threshold for quality reduction
  recoveryThreshold: number; // FPS threshold for quality recovery
}

export interface QualityAdjustment {
  timestamp: number;
  fromLevel: string;
  toLevel: string;
  reason: 'performance_drop' | 'performance_recovery' | 'manual' | 'startup';
  performanceMetrics: {
    fps: number;
    frameTime: number;
    memoryUsage?: number;
  };
}

export class DynamicQualityManager {
  private static instance: DynamicQualityManager;
  private currentSettings: QualitySettings;
  private scene: Phaser.Scene | null = null;
  private deviceCapabilities: DeviceCapabilities | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private adjustmentHistory: QualityAdjustment[] = [];
  private lastAdjustmentTime = 0;
  private adjustmentCooldown = 5000; // 5 seconds between adjustments
  private performanceCheckInterval: number | null = null;

  // Quality adjustment callbacks
  private onQualityChangeCallbacks: Array<(newLevel: QualityLevel, adjustment: QualityAdjustment) => void> = [];

  public static getInstance(): DynamicQualityManager {
    if (!DynamicQualityManager.instance) {
      DynamicQualityManager.instance = new DynamicQualityManager();
    }
    return DynamicQualityManager.instance;
  }

  constructor() {
    // Initialize with minimal settings for progressive enhancement
    const detector = DeviceCapabilityDetector.getInstance();
    const minimalLevel = detector.getQualityLevel('minimal')!;
    
    this.currentSettings = {
      currentLevel: minimalLevel,
      adaptiveMode: true,
      autoReduction: true,
      performanceTarget: 45, // Target 45 FPS for smooth gameplay
      reductionThreshold: 35, // Reduce quality if FPS drops below 35
      recoveryThreshold: 50   // Increase quality if FPS is above 50
    };
  }

  /**
   * Initialize the quality manager with scene and performance monitor
   */
  public async initialize(scene: Phaser.Scene, performanceMonitor: PerformanceMonitor): Promise<void> {
    this.scene = scene;
    this.performanceMonitor = performanceMonitor;

    // Detect device capabilities
    const detector = DeviceCapabilityDetector.getInstance();
    this.deviceCapabilities = await detector.detectCapabilities(scene);

    // Start with progressive enhancement
    await this.applyProgressiveEnhancement();

    // Start performance monitoring for adaptive adjustments
    if (this.currentSettings.adaptiveMode) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Apply progressive enhancement starting from minimal settings
   */
  private async applyProgressiveEnhancement(): Promise<void> {
    if (!this.deviceCapabilities || !this.scene) return;

    // Start with minimal quality
    const minimalLevel = DeviceCapabilityDetector.getInstance().getQualityLevel('minimal')!;
    await this.applyQualityLevel(minimalLevel, 'startup');

    // Wait a moment for initial rendering to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Gradually enhance based on device capabilities
    const targetLevel = this.deviceCapabilities.recommendedQuality;
    if (targetLevel.name !== 'minimal') {
      await this.graduallyEnhanceToLevel(targetLevel);
    }
  }

  /**
   * Gradually enhance quality to target level with performance monitoring
   */
  private async graduallyEnhanceToLevel(targetLevel: QualityLevel): Promise<void> {
    const detector = DeviceCapabilityDetector.getInstance();
    const allLevels = detector.getAllQualityLevels();
    const currentIndex = allLevels.findIndex(level => level.name === this.currentSettings.currentLevel.name);
    const targetIndex = allLevels.findIndex(level => level.name === targetLevel.name);

    if (currentIndex >= targetIndex) return;

    // Enhance one level at a time
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      const nextLevel = allLevels[i];
      
      // Apply the next quality level
      await this.applyQualityLevel(nextLevel, 'startup');
      
      // Wait and monitor performance
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if performance is acceptable
      if (this.performanceMonitor) {
        const currentFPS = this.performanceMonitor.getCurrentFPS();
        if (currentFPS < this.currentSettings.reductionThreshold) {
          // Performance not acceptable, revert to previous level
          if (i > 0) {
            await this.applyQualityLevel(allLevels[i - 1], 'performance_drop');
          }
          break;
        }
      }
    }
  }

  /**
   * Apply a specific quality level to the game
   */
  private async applyQualityLevel(level: QualityLevel, reason: QualityAdjustment['reason']): Promise<void> {
    if (!this.scene) return;

    const previousLevel = this.currentSettings.currentLevel;
    this.currentSettings.currentLevel = level;

    // Create adjustment record
    const adjustment: QualityAdjustment = {
      timestamp: Date.now(),
      fromLevel: previousLevel.name,
      toLevel: level.name,
      reason,
      performanceMetrics: {
        fps: this.performanceMonitor?.getCurrentFPS() || 0,
        frameTime: this.performanceMonitor?.getAverageFrameTime() || 0
      }
    };

    this.adjustmentHistory.push(adjustment);
    this.lastAdjustmentTime = Date.now();

    // Apply quality settings to the scene
    await this.applyQualityToScene(level);

    // Notify callbacks
    this.onQualityChangeCallbacks.forEach(callback => {
      try {
        callback(level, adjustment);
      } catch (error) {
        console.warn('Error in quality change callback:', error);
      }
    });

    console.log(`Quality adjusted from ${previousLevel.name} to ${level.name} (${reason})`);
  }

  /**
   * Apply quality settings to the actual scene
   */
  private async applyQualityToScene(level: QualityLevel): Promise<void> {
    if (!this.scene) return;

    // Apply texture quality (if supported)
    if (this.scene.textures) {
      // Note: Phaser doesn't have built-in texture quality scaling
      // This would need to be implemented with asset management
    }

    // Apply particle count limits
    // This would be handled by the particle systems when they check current quality

    // Apply FPS limit
    if (this.scene.game.loop) {
      // Phaser doesn't have direct FPS limiting, but we can track this for other systems
    }

    // Apply antialiasing (this would typically be set at game creation)
    // For runtime changes, we'd need to recreate the renderer

    // Store quality level for other systems to reference
    (this.scene as any).currentQualityLevel = level;
  }

  /**
   * Start monitoring performance for automatic quality adjustments
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceCheckInterval) {
      clearInterval(this.performanceCheckInterval);
    }

    this.performanceCheckInterval = window.setInterval(() => {
      this.checkPerformanceAndAdjust();
    }, 2000); // Check every 2 seconds
  }

  /**
   * Check current performance and adjust quality if needed
   */
  private checkPerformanceAndAdjust(): void {
    if (!this.performanceMonitor || !this.currentSettings.autoReduction) return;

    const now = Date.now();
    if (now - this.lastAdjustmentTime < this.adjustmentCooldown) return;

    const currentFPS = this.performanceMonitor.getCurrentFPS();
    const detector = DeviceCapabilityDetector.getInstance();
    const allLevels = detector.getAllQualityLevels();
    const currentIndex = allLevels.findIndex(level => level.name === this.currentSettings.currentLevel.name);

    // Check if we need to reduce quality
    if (currentFPS < this.currentSettings.reductionThreshold && currentIndex > 0) {
      const lowerLevel = allLevels[currentIndex - 1];
      this.applyQualityLevel(lowerLevel, 'performance_drop');
    }
    // Check if we can increase quality
    else if (currentFPS > this.currentSettings.recoveryThreshold && currentIndex < allLevels.length - 1) {
      // Only increase if we've been stable for a while
      const recentAdjustments = this.adjustmentHistory.filter(adj => 
        now - adj.timestamp < 30000 && adj.reason === 'performance_drop'
      );
      
      if (recentAdjustments.length === 0) {
        const higherLevel = allLevels[currentIndex + 1];
        this.applyQualityLevel(higherLevel, 'performance_recovery');
      }
    }
  }

  /**
   * Manually set quality level
   */
  public async setQualityLevel(levelName: string): Promise<boolean> {
    const detector = DeviceCapabilityDetector.getInstance();
    const level = detector.getQualityLevel(levelName);
    
    if (!level) return false;

    await this.applyQualityLevel(level, 'manual');
    return true;
  }

  /**
   * Get current quality settings
   */
  public getCurrentSettings(): QualitySettings {
    return { ...this.currentSettings };
  }

  /**
   * Get current quality level
   */
  public getCurrentQualityLevel(): QualityLevel {
    return this.currentSettings.currentLevel;
  }

  /**
   * Update quality manager settings
   */
  public updateSettings(settings: Partial<QualitySettings>): void {
    this.currentSettings = { ...this.currentSettings, ...settings };

    if (settings.adaptiveMode !== undefined) {
      if (settings.adaptiveMode) {
        this.startPerformanceMonitoring();
      } else if (this.performanceCheckInterval) {
        clearInterval(this.performanceCheckInterval);
        this.performanceCheckInterval = null;
      }
    }
  }

  /**
   * Register callback for quality changes
   */
  public onQualityChange(callback: (newLevel: QualityLevel, adjustment: QualityAdjustment) => void): void {
    this.onQualityChangeCallbacks.push(callback);
  }

  /**
   * Remove quality change callback
   */
  public removeQualityChangeCallback(callback: (newLevel: QualityLevel, adjustment: QualityAdjustment) => void): void {
    const index = this.onQualityChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.onQualityChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Get adjustment history
   */
  public getAdjustmentHistory(): QualityAdjustment[] {
    return [...this.adjustmentHistory];
  }

  /**
   * Force immediate performance check and adjustment
   */
  public forcePerformanceCheck(): void {
    this.checkPerformanceAndAdjust();
  }

  /**
   * Get recommended quality level based on current device capabilities
   */
  public getRecommendedQualityLevel(): QualityLevel | null {
    return this.deviceCapabilities?.recommendedQuality || null;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.performanceCheckInterval) {
      clearInterval(this.performanceCheckInterval);
      this.performanceCheckInterval = null;
    }
    this.onQualityChangeCallbacks = [];
    this.scene = null;
    this.performanceMonitor = null;
  }
}