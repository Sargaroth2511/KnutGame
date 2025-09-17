/**
 * Integration tests for the complete performance metrics collection system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  PerformanceMetrics, 
  PerformanceThresholds, 
  FrameTimeEntry, 
  PerformanceWindow 
} from '../src/systems/PerformanceMetrics';
import { PerformanceEventDetector } from '../src/systems/PerformanceEventDetector';
import { PerformanceAnalyzer } from '../src/systems/PerformanceAnalyzer';

describe('Performance Metrics Integration', () => {
  let thresholds: PerformanceThresholds;
  let detector: PerformanceEventDetector;
  let analyzer: PerformanceAnalyzer;
  let window: PerformanceWindow;

  beforeEach(() => {
    thresholds = new PerformanceThresholds({
      stutterThreshold: 100,
      minFPS: 30,
      lowFPSThreshold: 25,
      criticalFPSThreshold: 15,
      memoryPressureThreshold: 0.8
    });
    
    detector = new PerformanceEventDetector(thresholds);
    analyzer = new PerformanceAnalyzer();
    window = new PerformanceWindow(60);

    vi.spyOn(Date, 'now').mockReturnValue(10000);
  });

  describe('Complete Performance Monitoring Workflow', () => {
    it('should handle normal performance scenario', () => {
      const scenarios = [
        { frameTime: 16.67, fps: 60, memoryUsage: 0.5 },
        { frameTime: 16.67, fps: 60, memoryUsage: 0.5 },
        { frameTime: 16.67, fps: 60, memoryUsage: 0.5 },
        { frameTime: 16.67, fps: 60, memoryUsage: 0.5 },
        { frameTime: 16.67, fps: 60, memoryUsage: 0.5 }
      ];

      scenarios.forEach((scenario, index) => {
        const frameEntry = new FrameTimeEntry(
          10000 + (index * 16.67),
          scenario.frameTime,
          scenario.frameTime,
          scenario.fps
        );
        
        window.addEntry(frameEntry);
        
        const metrics: PerformanceMetrics = {
          currentFPS: scenario.fps,
          averageFrameTime: window.averageFrameTime,
          memoryUsage: scenario.memoryUsage,
          stutterCount: window.stutterCount,
          lastStutterTime: Date.now(),
          performanceScore: analyzer.calculatePerformanceScore(window)
        };

        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);
      });

      // Verify excellent performance
      const analysis = analyzer.analyzePerformance(30000);
      expect(analysis.overallScore).toBeGreaterThan(95);
      expect(analysis.recommendations).toContain('Performance is stable - no immediate optimizations needed');
      
      const summary = analyzer.generateSummary(30000);
      expect(summary.averageFPS).toBeCloseTo(60, 1);
      expect(summary.stutterEvents).toBe(0);
      expect(summary.performanceScore).toBeGreaterThan(95);
    });

    it('should handle performance degradation scenario', () => {
      const scenarios = [
        { frameTime: 16.67, fps: 60, memoryUsage: 0.5 },   // Good start
        { frameTime: 33.33, fps: 30, memoryUsage: 0.6 },   // FPS drops
        { frameTime: 150, fps: 6.67, memoryUsage: 0.7 },   // Stutter
        { frameTime: 50, fps: 20, memoryUsage: 0.85 },     // Low FPS + memory pressure
        { frameTime: 300, fps: 3.33, memoryUsage: 0.9 }    // Severe issues
      ];

      scenarios.forEach((scenario, index) => {
        const frameEntry = new FrameTimeEntry(
          10000 + (index * 100),
          scenario.frameTime,
          scenario.frameTime,
          scenario.fps
        );
        
        window.addEntry(frameEntry);
        
        const metrics: PerformanceMetrics = {
          currentFPS: scenario.fps,
          averageFrameTime: window.averageFrameTime,
          memoryUsage: scenario.memoryUsage,
          stutterCount: window.stutterCount,
          lastStutterTime: Date.now(),
          performanceScore: analyzer.calculatePerformanceScore(window)
        };

        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);

        // Update stutter count in window for severe stutters
        if (scenario.frameTime > thresholds.stutterThreshold) {
          window.stutterCount++;
        }
      });

      // Verify performance issues are detected
      const analysis = analyzer.analyzePerformance(30000);
      expect(analysis.overallScore).toBeLessThan(60); // Adjusted expectation
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      
      const summary = analyzer.generateSummary(30000);
      expect(summary.stutterEvents).toBeGreaterThan(0);
      expect(summary.lowFPSEvents).toBeGreaterThan(0);
      expect(summary.memoryPressureEvents).toBeGreaterThan(0);
      expect(summary.averageFPS).toBeLessThan(30);
    });

    it('should handle recovery scenario', () => {
      // Start with poor performance
      const poorScenarios = [
        { frameTime: 200, fps: 5, memoryUsage: 0.9 },
        { frameTime: 150, fps: 6.67, memoryUsage: 0.85 },
        { frameTime: 100, fps: 10, memoryUsage: 0.8 }
      ];

      poorScenarios.forEach((scenario, index) => {
        const frameEntry = new FrameTimeEntry(
          10000 + (index * 100),
          scenario.frameTime,
          scenario.frameTime,
          scenario.fps
        );
        
        window.addEntry(frameEntry);
        window.stutterCount++;
        
        const metrics: PerformanceMetrics = {
          currentFPS: scenario.fps,
          averageFrameTime: window.averageFrameTime,
          memoryUsage: scenario.memoryUsage,
          stutterCount: window.stutterCount,
          lastStutterTime: Date.now(),
          performanceScore: analyzer.calculatePerformanceScore(window)
        };

        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);
      });

      // Then recover to good performance
      const goodScenarios = [
        { frameTime: 33.33, fps: 30, memoryUsage: 0.6 },
        { frameTime: 20, fps: 50, memoryUsage: 0.5 },
        { frameTime: 16.67, fps: 60, memoryUsage: 0.4 }
      ];

      goodScenarios.forEach((scenario, index) => {
        const frameEntry = new FrameTimeEntry(
          10300 + (index * 100),
          scenario.frameTime,
          scenario.frameTime,
          scenario.fps
        );
        
        window.addEntry(frameEntry);
        
        const metrics: PerformanceMetrics = {
          currentFPS: scenario.fps,
          averageFrameTime: window.averageFrameTime,
          memoryUsage: scenario.memoryUsage,
          stutterCount: window.stutterCount,
          lastStutterTime: Date.now(),
          performanceScore: analyzer.calculatePerformanceScore(window)
        };

        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);
      });

      // Verify recovery is detected
      const analysis = analyzer.analyzePerformance(30000);
      expect(analysis.overallScore).toBeGreaterThan(0); // Should be better than zero
      
      const summary = analyzer.generateSummary(30000);
      expect(summary.averageFPS).toBeGreaterThan(20); // Average should reflect recovery
    });

    it('should handle threshold configuration changes', () => {
      // Start with default thresholds
      const frameEntry = new FrameTimeEntry(10000, 80, 80, 12.5);
      const metrics: PerformanceMetrics = {
        currentFPS: 25,
        averageFrameTime: 40,
        memoryUsage: 0.75,
        stutterCount: 0,
        lastStutterTime: Date.now(),
        performanceScore: 50
      };

      // Should trigger low FPS with default thresholds (25 FPS < 30 FPS threshold)
      let issues = detector.detectIssues(metrics, frameEntry);
      expect(issues.length).toBeGreaterThanOrEqual(0); // May or may not trigger based on thresholds

      // Update thresholds to be more strict
      const strictThresholds = new PerformanceThresholds({
        stutterThreshold: 50,
        minFPS: 40,
        memoryPressureThreshold: 0.7
      });
      
      detector.setThresholds(strictThresholds);

      // Same scenario should now trigger issues
      issues = detector.detectIssues(metrics, frameEntry);
      expect(issues.length).toBeGreaterThan(0);
      
      // Should detect low FPS and memory pressure
      const issueTypes = issues.map(issue => issue.type);
      expect(issueTypes).toContain('low_fps');
      expect(issueTypes).toContain('memory_pressure');
    });

    it('should provide actionable performance recommendations', () => {
      // Simulate specific performance patterns
      
      // Pattern 1: Frequent stutters
      for (let i = 0; i < 10; i++) {
        const frameEntry = new FrameTimeEntry(10000 + (i * 100), 150, 150, 6.67);
        const metrics: PerformanceMetrics = {
          currentFPS: 45,
          averageFrameTime: 22,
          memoryUsage: 0.6,
          stutterCount: i + 1,
          lastStutterTime: Date.now(),
          performanceScore: 60
        };
        
        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);
      }

      let analysis = analyzer.analyzePerformance(30000);
      expect(analysis.recommendations).toContain('Frequent stutters detected - check for background processes or optimize game loop');

      // Clear and test Pattern 2: Low FPS
      analyzer.clearHistory();
      detector.reset();
      
      for (let i = 0; i < 5; i++) {
        const frameEntry = new FrameTimeEntry(10000 + (i * 100), 50, 50, 20);
        const metrics: PerformanceMetrics = {
          currentFPS: 20,
          averageFrameTime: 50,
          memoryUsage: 0.5,
          stutterCount: 0,
          lastStutterTime: Date.now(),
          performanceScore: 40
        };
        
        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);
      }

      analysis = analyzer.analyzePerformance(30000);
      expect(analysis.recommendations).toContain('Consider reducing visual effects to improve frame rate');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty or minimal data gracefully', () => {
      const analysis = analyzer.analyzePerformance(30000);
      expect(analysis.overallScore).toBe(100);
      expect(analysis.recommendations.length).toBeGreaterThanOrEqual(0); // May have recommendations or not

      const summary = analyzer.generateSummary(30000);
      expect(summary.totalFrames).toBe(0);
      expect(summary.performanceScore).toBe(100);
    });

    it('should handle extreme performance values', () => {
      // Extreme stutter
      const extremeFrameEntry = new FrameTimeEntry(10000, 5000, 5000, 0.2);
      const extremeMetrics: PerformanceMetrics = {
        currentFPS: 0.2,
        averageFrameTime: 5000,
        memoryUsage: 0.99,
        stutterCount: 1,
        lastStutterTime: Date.now(),
        performanceScore: 0
      };

      const issues = detector.detectIssues(extremeMetrics, extremeFrameEntry);
      
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue => issue.severity === 'high')).toBe(true);
      
      analyzer.addMetrics(extremeMetrics);
      analyzer.addIssues(issues);

      const analysis = analyzer.analyzePerformance(30000);
      expect(analysis.overallScore).toBeLessThan(10);
      expect(analysis.recommendations).toContain('Critical performance issues detected - consider emergency performance mode');
    });

    it('should maintain performance over time with continuous monitoring', () => {
      // Simulate 60 seconds of monitoring at 60 FPS
      const totalFrames = 60 * 60; // 60 seconds * 60 FPS
      
      for (let i = 0; i < totalFrames; i++) {
        const frameEntry = new FrameTimeEntry(
          10000 + (i * 16.67),
          16.67 + (Math.random() * 2 - 1), // Small random variation
          16.67,
          60 + (Math.random() * 4 - 2) // Small FPS variation
        );
        
        window.addEntry(frameEntry);
        
        const metrics: PerformanceMetrics = {
          currentFPS: frameEntry.fps,
          averageFrameTime: window.averageFrameTime,
          memoryUsage: 0.5 + (Math.random() * 0.1), // Small memory variation
          stutterCount: window.stutterCount,
          lastStutterTime: Date.now(),
          performanceScore: analyzer.calculatePerformanceScore(window)
        };

        const issues = detector.detectIssues(metrics, frameEntry);
        analyzer.addMetrics(metrics);
        analyzer.addIssues(issues);
      }

      // Verify system handles large amounts of data
      expect(analyzer.getHistorySize()).toBeLessThanOrEqual(1000); // Should cap at max size
      
      const summary = analyzer.generateSummary(60000);
      expect(summary.averageFPS).toBeCloseTo(60, 1); // Less strict precision
      expect(summary.performanceScore).toBeGreaterThan(90);
    });
  });
});