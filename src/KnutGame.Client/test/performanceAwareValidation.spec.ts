/**
 * Unit tests for Performance-Aware Validation Rules
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

describe('Performance-Aware Validation Rules', () => {
  let antiCheat: SmartAntiCheatService;
  let contextBuilder: PerformanceContextBuilder;

  beforeEach(() => {
    antiCheat = new SmartAntiCheatService();
    contextBuilder = new PerformanceContextBuilder();
  });

  describe('Stutter Tolerance in Movement Validation', () => {
    it('should allow larger deviations during stutter events', () => {
      // Create a high-severity stutter event
      const stutterIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'high',
        timestamp: 1000,
        duration: 200,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66.67,
          memoryUsage: 0.6,
          stutterCount: 1,
          lastStutterTime: 1000,
          performanceScore: 40
        }
      };

      contextBuilder.addPerformanceIssue(stutterIssue);
      contextBuilder.setCurrentMetrics(stutterIssue.metrics);

      // Movement with large deviation during stutter
      const movements: MovementValidation[] = [
        {
          timestamp: 1100, // During stutter event
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 170, y: 200 }, // 70px deviation - normally would fail
          deviation: 70,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
      expect(result.adjustmentDetails).toBeDefined();
      expect(result.confidence).toBeLessThan(1.0); // Reduced confidence due to stutter
    });

    it('should reject extreme deviations even during stutters', () => {
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
          performanceScore: 50
        }
      };

      contextBuilder.addPerformanceIssue(stutterIssue);
      contextBuilder.setCurrentMetrics(stutterIssue.metrics);

      // Movement with extreme deviation that should fail even with stutter tolerance
      const movements: MovementValidation[] = [
        {
          timestamp: 1050,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 300, y: 200 }, // 200px deviation - too extreme
          deviation: 200,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('DespiteStutter');
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should handle multiple overlapping stutters', () => {
      // Add multiple stutter events
      const stutters: PerformanceIssue[] = [
        {
          type: 'stutter',
          severity: 'high',
          timestamp: 1000,
          duration: 150,
          metrics: {
            currentFPS: 20,
            averageFrameTime: 50,
            memoryUsage: 0.6,
            stutterCount: 2,
            lastStutterTime: 1000,
            performanceScore: 30
          }
        },
        {
          type: 'stutter',
          severity: 'medium',
          timestamp: 1100,
          duration: 100,
          metrics: {
            currentFPS: 25,
            averageFrameTime: 40,
            memoryUsage: 0.6,
            stutterCount: 2,
            lastStutterTime: 1100,
            performanceScore: 35
          }
        }
      ];

      stutters.forEach(stutter => contextBuilder.addPerformanceIssue(stutter));
      contextBuilder.setCurrentMetrics(stutters[1].metrics);

      const movements: MovementValidation[] = [
        {
          timestamp: 1120, // During overlapping stutters
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 180, y: 200 }, // 80px deviation
          deviation: 80,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
      expect(result.confidence).toBeLessThan(0.8); // Lower confidence due to multiple stutters
    });
  });

  describe('Dynamic Speed Tolerance Based on Performance Metrics', () => {
    it('should increase speed tolerance for consistently low FPS', () => {
      contextBuilder.setCurrentMetrics({
        currentFPS: 20, // Consistently low FPS
        averageFrameTime: 50,
        memoryUsage: 0.4,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 40
      });

      // Movement with moderate speed that would normally be borderline
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 115, y: 200 }, // 15px deviation = 150 speed
          deviation: 15,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);
      
      // Should have increased speed tolerance due to low FPS
      expect(adjustment.speedToleranceMultiplier).toBeGreaterThan(1.2);

      const result = antiCheat.validateWithContext(movements, context);
      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should be more strict with good performance', () => {
      contextBuilder.setCurrentMetrics({
        currentFPS: 60, // Good FPS
        averageFrameTime: 16.67,
        memoryUsage: 0.2,
        stutterCount: 0,
        lastStutterTime: 0,
        performanceScore: 95
      });

      // Same movement as above but with good performance
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 115, y: 200 }, // 15px deviation = 150 speed
          deviation: 15,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      // Should be more strict and potentially reject this movement
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('DynamicSpeedExceeded');
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should scale tolerance based on performance score', () => {
      const performanceScores = [95, 70, 40, 15];
      const tolerances: number[] = [];

      performanceScores.forEach(score => {
        contextBuilder.clear();
        contextBuilder.setCurrentMetrics({
          currentFPS: 30,
          averageFrameTime: 33,
          memoryUsage: 0.5,
          stutterCount: 0,
          lastStutterTime: 0,
          performanceScore: score
        });

        const context = contextBuilder.build();
        const adjustment = antiCheat.getPerformanceAdjustment(context);
        tolerances.push(adjustment.speedToleranceMultiplier);
      });

      // Tolerance should increase as performance score decreases
      for (let i = 1; i < tolerances.length; i++) {
        expect(tolerances[i]).toBeGreaterThan(tolerances[i - 1]);
      }
    });
  });

  describe('Time Window Extensions During Performance Issues', () => {
    it('should extend time windows during performance issues', () => {
      const performanceIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'high',
        timestamp: 1000,
        duration: 300,
        metrics: {
          currentFPS: 15,
          averageFrameTime: 66.67,
          memoryUsage: 0.7,
          stutterCount: 1,
          lastStutterTime: 1000,
          performanceScore: 25
        }
      };

      contextBuilder.addPerformanceIssue(performanceIssue);
      contextBuilder.setCurrentMetrics(performanceIssue.metrics);

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);

      // Should have time window extension
      expect(adjustment.timeWindowExtension).toBeGreaterThan(0);
      expect(adjustment.timeWindowExtension).toBeLessThanOrEqual(500); // Capped at 500ms
    });

    it('should handle movements near performance issue boundaries', () => {
      const performanceIssue: PerformanceIssue = {
        type: 'memory_pressure',
        severity: 'high',
        timestamp: 1000,
        duration: 200,
        metrics: {
          currentFPS: 35,
          averageFrameTime: 28.57,
          memoryUsage: 0.9,
          stutterCount: 0,
          lastStutterTime: 0,
          performanceScore: 30
        }
      };

      contextBuilder.addPerformanceIssue(performanceIssue);
      contextBuilder.setCurrentMetrics(performanceIssue.metrics);

      // Movement just after the performance issue ends
      const movements: MovementValidation[] = [
        {
          timestamp: 1250, // 50ms after issue ends
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 140, y: 200 }, // 40px deviation
          deviation: 40,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      // Should still be lenient due to proximity to performance issue
      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should cap time extensions at maximum values', () => {
      // Create extreme performance context
      const extremeIssues: PerformanceIssue[] = [];
      for (let i = 0; i < 5; i++) {
        extremeIssues.push({
          type: 'stutter',
          severity: 'high',
          timestamp: 1000 + (i * 100),
          duration: 400,
          metrics: {
            currentFPS: 5,
            averageFrameTime: 200,
            memoryUsage: 0.95,
            stutterCount: 10,
            lastStutterTime: 1000 + (i * 100),
            performanceScore: 5
          }
        });
      }

      extremeIssues.forEach(issue => contextBuilder.addPerformanceIssue(issue));
      contextBuilder.setCurrentMetrics(extremeIssues[0].metrics);

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);

      // Should be capped at maximum values
      expect(adjustment.timeWindowExtension).toBeLessThanOrEqual(500);
    });
  });

  describe('Proximity Tolerance Adjustments', () => {
    it('should increase proximity tolerance during memory pressure', () => {
      const memoryPressureIssue: PerformanceIssue = {
        type: 'memory_pressure',
        severity: 'high',
        timestamp: 1000,
        duration: 0,
        metrics: {
          currentFPS: 40,
          averageFrameTime: 25,
          memoryUsage: 0.9,
          stutterCount: 0,
          lastStutterTime: 0,
          performanceScore: 35
        }
      };

      contextBuilder.addPerformanceIssue(memoryPressureIssue);
      contextBuilder.setCurrentMetrics(memoryPressureIssue.metrics);

      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 155, y: 200 }, // 55px deviation - normally would fail
          deviation: 55,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const adjustment = antiCheat.getPerformanceAdjustment(context);
      
      // Should have increased proximity tolerance
      expect(adjustment.proximityToleranceMultiplier).toBeGreaterThan(1.1);

      const result = antiCheat.validateWithContext(movements, context);
      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should adjust tolerance based on nearby performance issues', () => {
      // Add performance issue close to movement timestamp
      const nearbyIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'medium',
        timestamp: 1200, // Close to movement at 1250
        duration: 100,
        metrics: {
          currentFPS: 25,
          averageFrameTime: 40,
          memoryUsage: 0.5,
          stutterCount: 1,
          lastStutterTime: 1200,
          performanceScore: 50
        }
      };

      contextBuilder.addPerformanceIssue(nearbyIssue);
      contextBuilder.setCurrentMetrics(nearbyIssue.metrics);

      const movements: MovementValidation[] = [
        {
          timestamp: 1250, // 50ms after nearby issue
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 150, y: 200 }, // 50px deviation
          deviation: 50,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
    });

    it('should reject extreme proximity deviations even with adjustments', () => {
      // Even with maximum adjustments, extreme deviations should fail
      const extremeContext = createExtremePerformanceContext();
      
      const movements: MovementValidation[] = [
        {
          timestamp: 1000,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 400, y: 200 }, // 300px deviation - extreme
          deviation: 300,
          performanceAdjustment: 0
        }
      ];

      const result = antiCheat.validateWithContext(movements, extremeContext);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('DynamicProximityExceeded');
      expect(result.performanceAdjusted).toBe(true);
    });
  });

  describe('Integrated Performance-Aware Validation', () => {
    it('should combine all validation rules for complex scenarios', () => {
      // Create a complex performance scenario
      const complexIssues: PerformanceIssue[] = [
        {
          type: 'stutter',
          severity: 'high',
          timestamp: 1000,
          duration: 200,
          metrics: {
            currentFPS: 18,
            averageFrameTime: 55.56,
            memoryUsage: 0.7,
            stutterCount: 2,
            lastStutterTime: 1000,
            performanceScore: 30
          }
        },
        {
          type: 'memory_pressure',
          severity: 'medium',
          timestamp: 1100,
          duration: 0,
          metrics: {
            currentFPS: 22,
            averageFrameTime: 45.45,
            memoryUsage: 0.85,
            stutterCount: 2,
            lastStutterTime: 1000,
            performanceScore: 35
          }
        }
      ];

      complexIssues.forEach(issue => contextBuilder.addPerformanceIssue(issue));
      contextBuilder.setCurrentMetrics(complexIssues[1].metrics);

      // Multiple movements with various issues
      const movements: MovementValidation[] = [
        {
          timestamp: 1050, // During stutter
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 145, y: 200 }, // 45px deviation
          deviation: 45,
          performanceAdjustment: 0
        },
        {
          timestamp: 1150, // After memory pressure
          playerPosition: { x: 145, y: 200 },
          expectedPosition: { x: 155, y: 200 }, // 10px deviation - normal
          deviation: 10,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      expect(result.isValid).toBe(true);
      expect(result.performanceAdjusted).toBe(true);
      expect(result.adjustmentDetails).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8); // Reduced due to performance issues
    });

    it('should maintain security while being performance-aware', () => {
      // Even with performance issues, obvious cheating should still be detected
      const performanceIssue: PerformanceIssue = {
        type: 'stutter',
        severity: 'medium',
        timestamp: 1000,
        duration: 150,
        metrics: {
          currentFPS: 25,
          averageFrameTime: 40,
          memoryUsage: 0.6,
          stutterCount: 1,
          lastStutterTime: 1000,
          performanceScore: 50
        }
      };

      contextBuilder.addPerformanceIssue(performanceIssue);
      contextBuilder.setCurrentMetrics(performanceIssue.metrics);

      // Obvious cheating attempt (teleportation)
      const movements: MovementValidation[] = [
        {
          timestamp: 1050,
          playerPosition: { x: 100, y: 200 },
          expectedPosition: { x: 800, y: 200 }, // 700px deviation - teleportation
          deviation: 700,
          performanceAdjustment: 0
        }
      ];

      const context = contextBuilder.build();
      const result = antiCheat.validateWithContext(movements, context);

      // Should still detect this as cheating despite performance issues
      expect(result.isValid).toBe(false);
      expect(result.performanceAdjusted).toBe(true);
    });
  });

});

// Helper function to create extreme performance context
function createExtremePerformanceContext() {
    const builder = new PerformanceContextBuilder();
    
    // Add multiple severe performance issues
    for (let i = 0; i < 5; i++) {
      builder.addPerformanceIssue({
        type: 'stutter',
        severity: 'high',
        timestamp: performance.now() - (i * 200),
        duration: 300,
        metrics: {
          currentFPS: 8,
          averageFrameTime: 125,
          memoryUsage: 0.95,
          stutterCount: 10,
          lastStutterTime: performance.now() - (i * 200),
          performanceScore: 10
        }
      });
    }

    builder.setCurrentMetrics({
      currentFPS: 8,
      averageFrameTime: 125,
      memoryUsage: 0.95,
      stutterCount: 10,
      lastStutterTime: performance.now(),
      performanceScore: 10
    });

    return builder.build();
}

describe('Performance-Aware Validation Configuration', () => {
  let antiCheat: SmartAntiCheatService;

  beforeEach(() => {
    antiCheat = new SmartAntiCheatService();
  });

  it('should allow disabling performance adjustments', () => {
    const options: Partial<AntiCheatOptions> = {
      performanceAdjustmentEnabled: false
    };
    antiCheat.setOptions(options);

    const contextBuilder = new PerformanceContextBuilder();
    contextBuilder.setCurrentMetrics({
      currentFPS: 15, // Very low FPS
      averageFrameTime: 66.67,
      memoryUsage: 0.9,
      stutterCount: 5,
      lastStutterTime: 1000,
      performanceScore: 20
    });

    const context = contextBuilder.build();
    const adjustment = antiCheat.getPerformanceAdjustment(context);

    // Should not apply any adjustments
    expect(adjustment.speedToleranceMultiplier).toBe(1.0);
    expect(adjustment.proximityToleranceMultiplier).toBe(1.0);
    expect(adjustment.timeWindowExtension).toBe(0);
    expect(adjustment.stutterTolerance).toBe(0);
  });

  it('should allow customizing performance thresholds', () => {
    const customOptions: Partial<AntiCheatOptions> = {
      stutterToleranceMs: 200,
      lowFPSThreshold: 25,
      memoryPressureThreshold: 0.9,
      confidenceThreshold: 0.6
    };
    antiCheat.setOptions(customOptions);

    const options = antiCheat.getOptions();
    expect(options.stutterToleranceMs).toBe(200);
    expect(options.lowFPSThreshold).toBe(25);
    expect(options.memoryPressureThreshold).toBe(0.9);
    expect(options.confidenceThreshold).toBe(0.6);
  });

  it('should validate with custom thresholds', () => {
    const lenientOptions: Partial<AntiCheatOptions> = {
      baseSpeedTolerance: 2.0, // Very lenient
      baseProximityTolerance: 100, // Very lenient
      confidenceThreshold: 0.3 // Low confidence threshold
    };
    antiCheat.setOptions(lenientOptions);

    const contextBuilder = new PerformanceContextBuilder();
    const movements: MovementValidation[] = [
      {
        timestamp: 1000,
        playerPosition: { x: 100, y: 200 },
        expectedPosition: { x: 180, y: 200 }, // 80px deviation
        deviation: 80,
        performanceAdjustment: 0
      }
    ];

    const context = contextBuilder.build();
    const result = antiCheat.validateWithContext(movements, context);

    // Should pass with lenient settings
    expect(result.isValid).toBe(true);
  });
});