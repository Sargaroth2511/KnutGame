/**
 * Tests for performance data aggregation and analysis system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceAnalyzer } from '../src/systems/PerformanceAnalyzer';
import { PerformanceMetrics, PerformanceIssue, PerformanceWindow, FrameTimeEntry } from '../src/systems/PerformanceMetrics';

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;
  let mockMetrics: PerformanceMetrics;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
    
    mockMetrics = {
      currentFPS: 60,
      averageFrameTime: 16.67,
      memoryUsage: 0.5,
      stutterCount: 0,
      lastStutterTime: Date.now(),
      performanceScore: 100
    };

    vi.spyOn(Date, 'now').mockReturnValue(10000);
  });

  describe('Performance Score Calculation', () => {
    it('should calculate perfect score for optimal performance', () => {
      const window = new PerformanceWindow(10);
      
      // Add 10 perfect frames at 60 FPS
      for (let i = 0; i < 10; i++) {
        window.addEntry(new FrameTimeEntry(i * 16.67, 16.67, 16.67, 60));
      }
      
      const score = analyzer.calculatePerformanceScore(window);
      expect(score).toBe(100);
    });

    it('should penalize low FPS', () => {
      const window = new PerformanceWindow(10);
      
      // Add frames at 30 FPS
      for (let i = 0; i < 10; i++) {
        window.addEntry(new FrameTimeEntry(i * 33.33, 33.33, 33.33, 30));
      }
      
      const score = analyzer.calculatePerformanceScore(window);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });

    it('should penalize stutters', () => {
      const window = new PerformanceWindow(10);
      window.stutterCount = 5;
      
      // Add good frames but with stutter penalty
      for (let i = 0; i < 10; i++) {
        window.addEntry(new FrameTimeEntry(i * 16.67, 16.67, 16.67, 60));
      }
      
      const score = analyzer.calculatePerformanceScore(window);
      expect(score).toBeLessThan(100);
    });

    it('should handle empty window', () => {
      const window = new PerformanceWindow(10);
      
      const score = analyzer.calculatePerformanceScore(window);
      expect(score).toBe(100);
    });

    it('should reward stability', () => {
      const stableWindow = new PerformanceWindow(10);
      const unstableWindow = new PerformanceWindow(10);
      
      // Stable performance
      for (let i = 0; i < 10; i++) {
        stableWindow.addEntry(new FrameTimeEntry(i * 16.67, 16.67, 16.67, 60));
      }
      
      // Unstable performance (same average but high variance)
      const frameTimes = [10, 25, 15, 30, 12, 28, 14, 32, 16, 24];
      for (let i = 0; i < 10; i++) {
        const fps = 1000 / frameTimes[i];
        unstableWindow.addEntry(new FrameTimeEntry(i * frameTimes[i], frameTimes[i], frameTimes[i], fps));
      }
      
      const stableScore = analyzer.calculatePerformanceScore(stableWindow);
      const unstableScore = analyzer.calculatePerformanceScore(unstableWindow);
      
      expect(stableScore).toBeGreaterThan(unstableScore);
    });
  });

  describe('Metrics and Issues Tracking', () => {
    it('should add and track metrics', () => {
      analyzer.addMetrics(mockMetrics);
      
      expect(analyzer.getHistorySize()).toBe(1);
    });

    it('should add and track issues', () => {
      const issues: PerformanceIssue[] = [
        {
          type: 'stutter',
          severity: 'medium',
          timestamp: Date.now(),
          duration: 150,
          metrics: mockMetrics
        }
      ];
      
      analyzer.addIssues(issues);
      
      expect(analyzer.getIssueHistorySize()).toBe(1);
    });

    it('should limit history size', () => {
      // Add more than max history size (1000)
      for (let i = 0; i < 1100; i++) {
        analyzer.addMetrics({ ...mockMetrics, currentFPS: i });
      }
      
      expect(analyzer.getHistorySize()).toBe(1000);
    });

    it('should clear all history', () => {
      analyzer.addMetrics(mockMetrics);
      analyzer.addIssues([{
        type: 'stutter',
        severity: 'low',
        timestamp: Date.now(),
        duration: 100,
        metrics: mockMetrics
      }]);
      
      analyzer.clearHistory();
      
      expect(analyzer.getHistorySize()).toBe(0);
      expect(analyzer.getIssueHistorySize()).toBe(0);
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(() => {
      // Add some sample data
      for (let i = 0; i < 10; i++) {
        const metrics = {
          ...mockMetrics,
          currentFPS: 50 + i,
          performanceScore: 80 + i,
          lastStutterTime: Date.now() - (i * 1000) // Recent timestamps
        };
        analyzer.addMetrics(metrics);
      }
    });

    it('should analyze performance with recent data', () => {
      const analysis = analyzer.analyzePerformance(30000);
      
      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.stability).toBeGreaterThan(0);
      expect(analysis.averagePerformance).toBeGreaterThan(0);
      expect(analysis.issueFrequency).toBeGreaterThanOrEqual(0);
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it('should handle empty data gracefully', () => {
      analyzer.clearHistory();
      
      const analysis = analyzer.analyzePerformance(30000);
      
      expect(analysis.overallScore).toBe(100);
      expect(analysis.stability).toBe(100);
      expect(analysis.averagePerformance).toBe(100);
      expect(analysis.issueFrequency).toBe(0);
    });

    it('should generate appropriate recommendations', () => {
      analyzer.clearHistory();
      
      // Add low FPS metrics
      for (let i = 0; i < 5; i++) {
        const metrics = {
          ...mockMetrics,
          currentFPS: 20,
          lastStutterTime: Date.now() - (i * 1000)
        };
        analyzer.addMetrics(metrics);
      }
      
      // Add stutter issues
      const stutterIssues: PerformanceIssue[] = [];
      for (let i = 0; i < 10; i++) {
        stutterIssues.push({
          type: 'stutter',
          severity: 'medium',
          timestamp: Date.now() - (i * 1000),
          duration: 150,
          metrics: mockMetrics
        });
      }
      analyzer.addIssues(stutterIssues);
      
      const analysis = analyzer.analyzePerformance(30000);
      
      expect(analysis.recommendations).toContain('Consider reducing visual effects to improve frame rate');
      expect(analysis.recommendations).toContain('Frequent stutters detected - check for background processes or optimize game loop');
    });
  });

  describe('Performance Summary', () => {
    beforeEach(() => {
      // Add sample data with varying performance
      const fpsList = [60, 45, 30, 55, 40, 35, 50, 25, 60, 45];
      for (let i = 0; i < fpsList.length; i++) {
        const metrics = {
          ...mockMetrics,
          currentFPS: fpsList[i],
          performanceScore: fpsList[i] + 20,
          lastStutterTime: Date.now() - (i * 1000)
        };
        analyzer.addMetrics(metrics);
      }

      // Add various issues
      const issues: PerformanceIssue[] = [
        { type: 'stutter', severity: 'medium', timestamp: Date.now() - 1000, duration: 150, metrics: mockMetrics },
        { type: 'stutter', severity: 'low', timestamp: Date.now() - 2000, duration: 120, metrics: mockMetrics },
        { type: 'low_fps', severity: 'medium', timestamp: Date.now() - 3000, duration: 0, metrics: mockMetrics },
        { type: 'memory_pressure', severity: 'low', timestamp: Date.now() - 4000, duration: 0, metrics: mockMetrics }
      ];
      analyzer.addIssues(issues);
    });

    it('should generate comprehensive summary', () => {
      const summary = analyzer.generateSummary(60000);
      
      expect(summary.timeWindow).toBe(60000);
      expect(summary.totalFrames).toBe(10);
      expect(summary.averageFPS).toBeCloseTo(44.5, 1);
      expect(summary.minFPS).toBe(25);
      expect(summary.maxFPS).toBe(60);
      expect(summary.stutterEvents).toBe(2);
      expect(summary.lowFPSEvents).toBe(1);
      expect(summary.memoryPressureEvents).toBe(1);
      expect(summary.performanceScore).toBeGreaterThan(0);
    });

    it('should handle empty data in summary', () => {
      analyzer.clearHistory();
      
      const summary = analyzer.generateSummary(60000);
      
      expect(summary.totalFrames).toBe(0);
      expect(summary.averageFPS).toBe(0);
      expect(summary.stutterEvents).toBe(0);
      expect(summary.performanceScore).toBe(100);
    });

    it('should filter by time window correctly', () => {
      // Request summary for only last 5 seconds
      const summary = analyzer.generateSummary(5000);
      
      // Should have fewer frames than total
      expect(summary.totalFrames).toBeLessThanOrEqual(10);
      expect(summary.totalFrames).toBeGreaterThan(0);
    });
  });
});