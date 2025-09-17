/**
 * Unit tests for Smart Anti-Cheat System
 * Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SmartAntiCheatService,
  PerformanceContextBuilder,
  DEFAULT_ANTICHEAT_OPTIONS,
  type PerformanceContext,
  type MovementValidation,
  type PerformanceAdjustment,
  type AntiCheatOptions
} from '../src/systems/SmartAntiCheat';
import { PerformanceIssue } from '../src/systems/PerformanceMonitor';

describe('SmartAntiCheatService', () => {
  let antiCheat: SmartAntiCheatService;
  let contextBuilder: PerformanceContextBuilder;

  beforeEach(() => {
    antiCheat = new SmartAntiCheatService();
    contextBuilder = new PerformanceContextBuilder();
  });

  describe('Basic Validation', () => {
    it('should validate empty movement data', () => {
      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext([], context);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.performanceAdjusted).toBe(false);
    });

    it('should validate normal movement without performance issues', () => {
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 102, y: 200 },
          deviation: 2, // Small deviation, well within tolerance
          performanceAdjustment: 0
        }
      ];

      contextBuilder.setCurrentMetrics({
        currentFPS: 60,
        averageFrameTime: 16.67,
        memoryUsage: 0.3,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 95
      });

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.performanceAdjusted).toBe(false);
    });

    it('should reject excessive speed without performance issues', () => {
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 115, y: 200 }, // Moderate deviation that triggers speed check
          deviation: 15, // This will result in speed = 150, which exceeds base limit of 100 * 1.2 = 120
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('SpeedExceeded');
      expect(result.performanceAdjusted).toBe(false);
    });

    it('should reject excessive position deviation without performance issues', () => {
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 150, y: 200 }, // 50px deviation > default 48px tolerance
          deviation: 50,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('PositionDeviation');
      expect(result.performanceAdjusted).toBe(false);
    });
  });

  describe('Performance-Aware Validation', () => {
    it('should be more lenient during stutter events', () => {
      // Use a custom anti-cheat with lower confidence threshold for this test
      const customAntiCheat = new SmartAntiCheatService({
        confidenceThreshold: 0.5 // Lower threshold to account for performance impact
      });

      const stutterIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'medium',
        timestamp: 1000,
        duration: 150,
        metrics: {
          currentFPS: 25,
          averageFrameTime: 40,
          memoryUsage: 0.5,
          stutterCount: 1,
          lastStutterTime: 1000,
          performanceScore: 60 // Moderate performance to ensure confidence stays reasonable
        }
      };

      contextBuilder.addPerformanceIssue(stutterIssue);
      contextBuilder.setCurrentMetrics(stutterIssue.metrics);

      // Use a deviation that would normally fail but should pass with adjustment
      const movements: MovementValidation[] = [
        {
          timestamp: 1050, // During stutter event
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 150, y: 200 }, // Large deviation
          deviation: 50, // Exceeds normal tolerance of 48
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      
      // First check that the adjustment is calculated correctly
      const adjustment = customAntiCheat.getPerformanceAdjustment(context);
      expect(adjustment.proximityToleranceMultiplier).toBeGreaterThan(1.0);
      
      // The adjusted tolerance should allow the 50px deviation
      const adjustedTolerance = 48 * adjustment.proximityToleranceMultiplier;
      expect(adjustedTolerance).toBeGreaterThan(50);
      
      const result = customAntiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
      expect(result.adjustmentDetails).toBeDefined();
      expect(result.adjustmentDetails!.proximityToleranceMultiplier).toBeGreaterThan(1.0);
    });

    it('should adjust validation thresholds based on low FPS', () => {
      contextBuilder.setCurrentMetrics({
        currentFPS: 20, // Below threshold
        averageFrameTime: 50,
        memoryUsage: 0.4,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 40
      });

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);

      expect(adjustment.speedToleranceMultiplier).toBeGreaterThan(1.0);
      expect(adjustment.proximityToleranceMultiplier).toBeGreaterThan(1.0);
      expect(adjustment.timeWindowExtension).toBeGreaterThan(0);
    });

    it('should reduce confidence during memory pressure events', () => {
      const memoryPressureIssue: PerformanceIssue = {
        type: 'memory_pressure',
        severity: 'high',
        timestamp: 1000,
        duration: 0,
        metrics: {
          currentFPS: 45,
          averageFrameTime: 22,
          memoryUsage: 0.9,
          stutterCount: 0,
          lastStutterTime: 0,
          performanceScore: 30
        }
      };

      contextBuilder.addPerformanceIssue(memoryPressureIssue);
      contextBuilder.setCurrentMetrics(memoryPressureIssue.metrics);

      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 102, y: 200 },
          deviation: 2,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const confidence = antiCheat.calculateConfidence(movements[0], context);

      expect(confidence).toBeLessThan(0.8);
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate high confidence for good performance', () => {
      contextBuilder.setCurrentMetrics({
        currentFPS: 60,
        averageFrameTime: 16.67,
        memoryUsage: 0.2,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 95
      });

      const movement: MovementValidation = {
        timestamp: 1000,
        playerPosition: { x: 100, y: 200 },
        expectedPosition: { x: 101, y: 200 },
        deviation: 1,
        performanceAdjustment: 0
      };

      const context = contextBuilder.build();
      const confidence = antiCheat.calculateConfidence(movement, context);

      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should calculate lower confidence for poor performance', () => {
      contextBuilder.setCurrentMetrics({
        currentFPS: 15, // Very low
        averageFrameTime: 66.67,
        memoryUsage: 0.9, // High memory usage
        stutterCount: 5,
        lastStutterTime: 1000,
        performanceScore: 20 // Poor performance
      });

      // Add multiple stutter events
      for (let i = 0; i < 3; i++) {
        contextBuilder.addPerformanceIssue({
          type: 'stutter',
          severity: 'high',
          timestamp: 1000 + i * 100,
          duration: 200,
          metrics: {
            currentFPS: 15,
            averageFrameTime: 66.67,
            memoryUsage: 0.9,
            stutterCount: 5,
            lastStutterTime: 1000,
            performanceScore: 20
          }
        });
      }

      const movement: MovementValidation = {
        timestamp: 1000,
        playerPosition: { x: 100, y: 200 },
        expectedPosition: { x: 101, y: 200 },
        deviation: 1,
        performanceAdjustment: 0
      };

      const context = contextBuilder.build();
      const confidence = antiCheat.calculateConfidence(movement, context);

      expect(confidence).toBeLessThan(0.5);
    });
  });

  describe('Performance Adjustment Calculation', () => {
    it('should provide no adjustment when disabled', () => {
      const options: Partial<AntiCheatOptions> = {
        performanceAdjustmentEnabled: false
      };
      antiCheat.setOptions(options);

      contextBuilder.setCurrentMetrics({
        currentFPS: 15,
        averageFrameTime: 66.67,
        memoryUsage: 0.9,
        stutterCount: 5,
        lastStutterTime: 1000,
        performanceScore: 20
      });

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);

      expect(adjustment.speedToleranceMultiplier).toBe(1.0);
      expect(adjustment.proximityToleranceMultiplier).toBe(1.0);
      expect(adjustment.timeWindowExtension).toBe(0);
      expect(adjustment.stutterTolerance).toBe(0);
    });

    it('should cap adjustments at maximum values', () => {
      contextBuilder.setCurrentMetrics({
        currentFPS: 5, // Extremely low
        averageFrameTime: 200,
        memoryUsage: 0.95,
        stutterCount: 20,
        lastStutterTime: 1000,
        performanceScore: 5 // Extremely poor
      });

      // Add many performance issues
      for (let i = 0; i < 10; i++) {
        contextBuilder.addPerformanceIssue({
          type: 'stutter',
          severity: 'high',
          timestamp: 1000 + i * 50,
          duration: 300,
          metrics: {
            currentFPS: 5,
            averageFrameTime: 200,
            memoryUsage: 0.95,
            stutterCount: 20,
            lastStutterTime: 1000,
            performanceScore: 5
          }
        });
      }

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);

      // Should be capped at maximum values
      expect(adjustment.speedToleranceMultiplier).toBeLessThanOrEqual(2.0);
      expect(adjustment.proximityToleranceMultiplier).toBeLessThanOrEqual(1.8);
      expect(adjustment.timeWindowExtension).toBeLessThanOrEqual(500);
    });
  });

  describe('Options Management', () => {
    it('should update options correctly', () => {
      const newOptions: Partial<AntiCheatOptions> = {
        baseSpeedTolerance: 1.5,
        confidenceThreshold: 0.9,
        stutterToleranceMs: 150
      };

      antiCheat.setOptions(newOptions);
      const options = antiCheat.getOptions();

      expect(options.baseSpeedTolerance).toBe(1.5);
      expect(options.confidenceThreshold).toBe(0.9);
      expect(options.stutterToleranceMs).toBe(150);
      // Should preserve other defaults
      expect(options.baseProximityTolerance).toBe(DEFAULT_ANTICHEAT_OPTIONS.baseProximityTolerance);
    });

    it('should use default options when none provided', () => {
      const options = antiCheat.getOptions();
      expect(options).toEqual(DEFAULT_ANTICHEAT_OPTIONS);
    });
  });
});

describe('PerformanceContextBuilder', () => {
  let builder: PerformanceContextBuilder;

  beforeEach(() => {
    builder = new PerformanceContextBuilder(5000);
  });

  it('should build empty context initially', () => {
    const context = builder.build();

    expect(context.stutterEvents).toHaveLength(0);
    expect(context.averageFPS).toBe(60);
    expect(context.memoryPressureEvents).toBe(0);
    expect(context.performanceScore).toBe(100);
    expect(context.recentPerformanceWindow).toBe(5000);
    expect(context.performanceIssueTimestamps).toHaveLength(0);
  });

  it('should add and filter performance issues by time window', () => {
    const now = performance.now();
    
    // Add old issue (outside window)
    builder.addPerformanceIssue({
      type: 'stutter',
      severity: 'low',
      timestamp: now - 6000, // 6 seconds ago
      duration: 100,
      metrics: {
        currentFPS: 30,
        averageFrameTime: 33,
        memoryUsage: 0.5,
        stutterCount: 1,
        lastStutterTime: now - 6000,
        performanceScore: 70
      }
    });

    // Add recent issue (within window)
    builder.addPerformanceIssue({
      type: 'stutter',
      severity: 'medium',
      timestamp: now - 1000, // 1 second ago
      duration: 150,
      metrics: {
        currentFPS: 25,
        averageFrameTime: 40,
        memoryUsage: 0.6,
        stutterCount: 2,
        lastStutterTime: now - 1000,
        performanceScore: 60
      }
    });

    const context = builder.build();

    // Should only include the recent issue
    expect(context.stutterEvents).toHaveLength(1);
    expect(context.stutterEvents[0].timestamp).toBe(now - 1000);
  });

  it('should count memory pressure events correctly', () => {
    builder.addPerformanceIssue({
      type: 'memory_pressure',
      severity: 'high',
      timestamp: performance.now(),
      duration: 0,
      metrics: {
        currentFPS: 40,
        averageFrameTime: 25,
        memoryUsage: 0.9,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 40
      }
    });

    builder.addPerformanceIssue({
      type: 'memory_pressure',
      severity: 'medium',
      timestamp: performance.now(),
      duration: 0,
      metrics: {
        currentFPS: 45,
        averageFrameTime: 22,
        memoryUsage: 0.85,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 50
      }
    });

    const context = builder.build();
    expect(context.memoryPressureEvents).toBe(2);
  });

  it('should use current metrics when set', () => {
    const metrics = {
      currentFPS: 45,
      averageFrameTime: 22,
      memoryUsage: 0.7,
      stutterCount: 3,
      lastStutterTime: 1000,
      performanceScore: 75
    };

    builder.setCurrentMetrics(metrics);
    const context = builder.build();

    expect(context.averageFPS).toBe(45);
    expect(context.performanceScore).toBe(75);
  });

  it('should clear context correctly', () => {
    builder.addPerformanceIssue({
      type: 'stutter',
      severity: 'low',
      timestamp: performance.now(),
      duration: 100,
      metrics: {
        currentFPS: 30,
        averageFrameTime: 33,
        memoryUsage: 0.5,
        stutterCount: 1,
        lastStutterTime: performance.now(),
        performanceScore: 70
      }
    });

    builder.setCurrentMetrics({
      currentFPS: 45,
      averageFrameTime: 22,
      memoryUsage: 0.7,
      stutterCount: 3,
      lastStutterTime: 1000,
      performanceScore: 75
    });

    builder.clear();
    const context = builder.build();

    expect(context.stutterEvents).toHaveLength(0);
    expect(context.averageFPS).toBe(60); // Back to default
    expect(context.performanceScore).toBe(100); // Back to default
  });
});