/**
 * Simplified Performance-Aware Validation Tests
 * Requirements: 2.1, 2.2, 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SmartAntiCheatService,
  PerformanceContextBuilder,
  type MovementValidation,
  type AntiCheatOptions
} from '../src/systems/SmartAntiCheat';
import type { PerformanceIssue } from '../src/systems/PerformanceMonitor';

describe('Performance-Aware Validation - Simplified Tests', () => {
  let antiCheat: SmartAntiCheatService;
  let contextBuilder: PerformanceContextBuilder;

  beforeEach(() => {
    // Use more lenient options for testing
    const lenientOptions: Partial<AntiCheatOptions> = {
      baseSpeedTolerance: 2.0, // Very lenient
      baseProximityTolerance: 100, // Very lenient
      confidenceThreshold: 0.5, // Lower threshold
      stutterToleranceMs: 300, // Longer tolerance
      performanceAdjustmentEnabled: true
    };
    antiCheat = new SmartAntiCheatService(lenientOptions);
    contextBuilder = new PerformanceContextBuilder();
  });

  describe('Basic Performance Adjustment', () => {
    it('should provide performance adjustments when performance is poor', () => {
      // Create poor performance context
      contextBuilder.setCurrentMetrics({
        currentFPS: 15, // Low FPS
        averageFrameTime: 66.67,
        memoryUsage: 0.8,
        stutterCount: 3,
        lastStutterTime: 1000,
        performanceScore: 25 // Poor performance
      });

      // Add stutter events
      contextBuilder.addPerformanceIssue({
        type: 'stutter',
        severity: 'high',
        timestamp: 1000,
        duration: 200,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66.67,
          memoryUsage: 0.8,
          stutterCount: 3,
          lastStutterTime: 1000,
          performanceScore: 25
        }
      });

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);

      // Should provide significant adjustments
      expect(adjustment.speedToleranceMultiplier).toBeGreaterThan(1.5);
      expect(adjustment.proximityToleranceMultiplier).toBeGreaterThan(1.3);
      expect(adjustment.stutterTolerance).toBeGreaterThan(300);
    });

    it('should validate normal movement with good performance', () => {
      // Good performance context
      contextBuilder.setCurrentMetrics({
        currentFPS: 60,
        averageFrameTime: 16.67,
        memoryUsage: 0.3,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 95
      });

      // Small deviation movement
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 105, y: 200 }, // 5px deviation - very small
          deviation: 5,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should be more lenient during performance issues', () => {
      // Poor performance context with stutters
      contextBuilder.setCurrentMetrics({
        currentFPS: 20,
        averageFrameTime: 50,
        memoryUsage: 0.7,
        stutterCount: 2,
        lastStutterTime: 1000,
        performanceScore: 30
      });

      contextBuilder.addPerformanceIssue({
        type: 'stutter',
        severity: 'high',
        timestamp: 1000,
        duration: 200,
        metrics: {
          currentFPS: 20,
          averageFrameTime: 50,
          memoryUsage: 0.7,
          stutterCount: 2,
          lastStutterTime: 1000,
          performanceScore: 30
        }
      });

      // Moderate deviation that might fail with good performance
      const movements: MovementValidation[] = [
        {
          timestamp: 1100, // During stutter
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 130, y: 200 }, // 30px deviation
          deviation: 30,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should still detect obvious cheating during performance issues', () => {
      // Poor performance context
      contextBuilder.setCurrentMetrics({
        currentFPS: 15,
        averageFrameTime: 66.67,
        memoryUsage: 0.9,
        stutterCount: 5,
        lastStutterTime: 1000,
        performanceScore: 20
      });

      contextBuilder.addPerformanceIssue({
        type: 'stutter',
        severity: 'high',
        timestamp: 1000,
        duration: 300,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66.67,
          memoryUsage: 0.9,
          stutterCount: 5,
          lastStutterTime: 1000,
          performanceScore: 20
        }
      });

      // Extreme deviation that should fail even with performance issues
      const movements: MovementValidation[] = [
        {
          timestamp: 1100,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 500, y: 200 }, // 400px deviation - teleportation
          deviation: 400,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      // Should still detect this as invalid
      expect(result.isValid).toBe(false);
      expect(result.performanceAdjusted).toBe(true);
    });
  });

  describe('Performance Adjustment Calculation', () => {
    it('should scale adjustments based on performance score', () => {
      const scores = [90, 60, 30, 10];
      const adjustments = [];

      for (const score of scores) {
        contextBuilder.clear();
        contextBuilder.setCurrentMetrics({
          currentFPS: 30,
          averageFrameTime: 33,
          memoryUsage: 0.5,
          stutterCount: 1,
          lastStutterTime: 1000,
          performanceScore: score
        });

        const context = contextBuilder.build();
        const adjustment = antiCheat.getPerformanceAdjustment(context);
        adjustments.push(adjustment.speedToleranceMultiplier);
      }

      // Lower performance scores should have higher tolerance multipliers
      for (let i = 1; i < adjustments.length; i++) {
        expect(adjustments[i]).toBeGreaterThanOrEqual(adjustments[i - 1]);
      }
    });

    it('should increase tolerance for low FPS', () => {
      const fpsValues = [60, 40, 25, 15];
      const adjustments = [];

      for (const fps of fpsValues) {
        contextBuilder.clear();
        contextBuilder.setCurrentMetrics({
          currentFPS: fps,
          averageFrameTime: 1000 / fps,
          memoryUsage: 0.5,
          stutterCount: 0,
          lastStutterTime: 0,
          performanceScore: 50
        });

        const context = contextBuilder.build();
        const adjustment = antiCheat.getPerformanceAdjustment(context);
        adjustments.push(adjustment.speedToleranceMultiplier);
      }

      // Lower FPS should have higher tolerance multipliers
      for (let i = 1; i < adjustments.length; i++) {
        expect(adjustments[i]).toBeGreaterThanOrEqual(adjustments[i - 1]);
      }
    });

    it('should increase tolerance for stutter events', () => {
      // Context without stutters
      contextBuilder.setCurrentMetrics({
        currentFPS: 30,
        averageFrameTime: 33,
        memoryUsage: 0.5,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 50
      });

      const contextWithoutStutters = contextBuilder.build();
      const adjustmentWithoutStutters = antiCheat.getPerformanceAdjustment(contextWithoutStutters);

      // Context with stutters
      contextBuilder.clear();
      contextBuilder.setCurrentMetrics({
        currentFPS: 30,
        averageFrameTime: 33,
        memoryUsage: 0.5,
        stutterCount: 2,
        lastStutterTime: 1000,
        performanceScore: 50
      });

      contextBuilder.addPerformanceIssue({
        type: 'stutter',
        severity: 'high',
        timestamp: 1000,
        duration: 150,
        metrics: {
          currentFPS: 30,
          averageFrameTime: 33,
          memoryUsage: 0.5,
          stutterCount: 2,
          lastStutterTime: 1000,
          performanceScore: 50
        }
      });

      const contextWithStutters = contextBuilder.build();
      const adjustmentWithStutters = antiCheat.getPerformanceAdjustment(contextWithStutters);

      // Stutters should increase tolerance
      expect(adjustmentWithStutters.speedToleranceMultiplier).toBeGreaterThan(adjustmentWithoutStutters.speedToleranceMultiplier);
      expect(adjustmentWithStutters.proximityToleranceMultiplier).toBeGreaterThan(adjustmentWithoutStutters.proximityToleranceMultiplier);
      expect(adjustmentWithStutters.stutterTolerance).toBeGreaterThan(adjustmentWithoutStutters.stutterTolerance);
    });
  });

  describe('Configuration', () => {
    it('should allow disabling performance adjustments', () => {
      const options: Partial<AntiCheatOptions> = {
        performanceAdjustmentEnabled: false
      };
      const strictAntiCheat = new SmartAntiCheatService(options);

      contextBuilder.setCurrentMetrics({
        currentFPS: 15,
        averageFrameTime: 66.67,
        memoryUsage: 0.9,
        stutterCount: 5,
        lastStutterTime: 1000,
        performanceScore: 20
      });

      const context = contextBuilder.build();
      const adjustment = strictAntiCheat.getPerformanceAdjustment(context);

      // Should not apply any adjustments
      expect(adjustment.speedToleranceMultiplier).toBe(1.0);
      expect(adjustment.proximityToleranceMultiplier).toBe(1.0);
      expect(adjustment.timeWindowExtension).toBe(0);
      expect(adjustment.stutterTolerance).toBe(0);
    });

    it('should use custom thresholds', () => {
      const customOptions: Partial<AntiCheatOptions> = {
        baseSpeedTolerance: 3.0, // Very lenient
        baseProximityTolerance: 150, // Very lenient
        confidenceThreshold: 0.3, // Very low
        stutterToleranceMs: 500 // Very long
      };
      const customAntiCheat = new SmartAntiCheatService(customOptions);

      const options = customAntiCheat.getOptions();
      expect(options.baseSpeedTolerance).toBe(3.0);
      expect(options.baseProximityTolerance).toBe(150);
      expect(options.confidenceThreshold).toBe(0.3);
      expect(options.stutterToleranceMs).toBe(500);
    });
  });
});