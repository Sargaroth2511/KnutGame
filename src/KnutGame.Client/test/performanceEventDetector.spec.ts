/**
 * Tests for performance event detection system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceEventDetector } from '../src/systems/PerformanceEventDetector';
import { PerformanceThresholds, FrameTimeEntry, PerformanceMetrics } from '../src/systems/PerformanceMetrics';

describe('PerformanceEventDetector', () => {
  let detector: PerformanceEventDetector;
  let mockMetrics: PerformanceMetrics;

  beforeEach(() => {
    const thresholds = new PerformanceThresholds({
      stutterThreshold: 100,
      minFPS: 30,
      lowFPSThreshold: 25,
      criticalFPSThreshold: 15,
      memoryPressureThreshold: 0.8
    });
    
    detector = new PerformanceEventDetector(thresholds);
    
    mockMetrics = {
      currentFPS: 60,
      averageFrameTime: 16.67,
      memoryUsage: 0.5,
      stutterCount: 0,
      lastStutterTime: 0,
      performanceScore: 100
    };

    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockReturnValue(1000);
  });

  describe('Stutter Detection', () => {
    it('should detect stutter when frame time exceeds threshold', () => {
      const frameEntry = new FrameTimeEntry(1000, 150, 150, 6.67); // 150ms frame time
      
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('stutter');
      expect(issues[0].severity).toBe('low'); // 150ms is between 100-200ms, so 'low'
      expect(issues[0].duration).toBe(150);
    });

    it('should classify stutter severity correctly', () => {
      // Low severity stutter
      let frameEntry = new FrameTimeEntry(1000, 120, 120, 8.33);
      let issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('low');

      // Medium severity stutter
      frameEntry = new FrameTimeEntry(1000, 250, 250, 4);
      issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('medium');

      // High severity stutter
      frameEntry = new FrameTimeEntry(1000, 600, 600, 1.67);
      issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('high');
    });

    it('should not detect stutter when frame time is normal', () => {
      const frameEntry = new FrameTimeEntry(1000, 16.67, 16.67, 60);
      
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(0);
    });

    it('should track stutter count and last stutter time', () => {
      const frameEntry = new FrameTimeEntry(1000, 150, 150, 6.67);
      
      detector.detectIssues(mockMetrics, frameEntry);
      
      expect(detector.getStutterCount()).toBe(1);
      expect(detector.getLastStutterTime()).toBe(1000);
    });
  });

  describe('Low FPS Detection', () => {
    it('should detect low FPS when below threshold', () => {
      mockMetrics.currentFPS = 20;
      const frameEntry = new FrameTimeEntry(1000, 50, 50, 20);
      
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('low_fps');
    });

    it('should classify FPS severity correctly', () => {
      const frameEntry = new FrameTimeEntry(1000, 50, 50, 20);

      // Low severity (between minFPS and lowFPSThreshold)
      mockMetrics.currentFPS = 28;
      let issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('low');

      // Medium severity (between lowFPSThreshold and criticalFPSThreshold)
      mockMetrics.currentFPS = 20;
      issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('medium');

      // High severity (below criticalFPSThreshold)
      mockMetrics.currentFPS = 10;
      issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('high');
    });

    it('should not detect low FPS when above threshold', () => {
      mockMetrics.currentFPS = 45;
      const frameEntry = new FrameTimeEntry(1000, 22.22, 22.22, 45);
      
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(0);
    });
  });

  describe('Memory Pressure Detection', () => {
    it('should detect memory pressure when above threshold', () => {
      mockMetrics.memoryUsage = 0.85;
      const frameEntry = new FrameTimeEntry(1000, 16.67, 16.67, 60);
      
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('memory_pressure');
      expect(issues[0].severity).toBe('low'); // 0.85 is between 0.8-0.85, so 'low'
    });

    it('should classify memory pressure severity correctly', () => {
      const frameEntry = new FrameTimeEntry(1000, 16.67, 16.67, 60);

      // Low severity
      mockMetrics.memoryUsage = 0.82;
      let issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('low');

      // Medium severity
      mockMetrics.memoryUsage = 0.88;
      issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('medium');

      // High severity
      mockMetrics.memoryUsage = 0.97;
      issues = detector.detectIssues(mockMetrics, frameEntry);
      expect(issues[0].severity).toBe('high');
    });

    it('should not detect memory pressure when below threshold', () => {
      mockMetrics.memoryUsage = 0.7;
      const frameEntry = new FrameTimeEntry(1000, 16.67, 16.67, 60);
      
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(0);
    });
  });

  describe('Issue Management', () => {
    it('should track recent issues', () => {
      const frameEntry = new FrameTimeEntry(1000, 150, 150, 6.67);
      
      detector.detectIssues(mockMetrics, frameEntry);
      
      const recentIssues = detector.getRecentIssues();
      expect(recentIssues).toHaveLength(1);
      expect(recentIssues[0].type).toBe('stutter');
    });

    it('should clean up old issues', () => {
      // Add an issue
      const frameEntry = new FrameTimeEntry(1000, 150, 150, 6.67);
      detector.detectIssues(mockMetrics, frameEntry);
      
      // Move time forward beyond the issue window (5000ms)
      vi.spyOn(Date, 'now').mockReturnValue(7000);
      
      // Trigger cleanup by detecting new issues
      detector.detectIssues(mockMetrics, new FrameTimeEntry(7000, 16.67, 16.67, 60));
      
      const recentIssues = detector.getRecentIssues();
      expect(recentIssues).toHaveLength(0);
    });

    it('should detect active performance issues', () => {
      // No issues initially
      expect(detector.isPerformanceIssueActive()).toBe(false);
      
      // Add a high severity issue
      mockMetrics.currentFPS = 10;
      const frameEntry = new FrameTimeEntry(1000, 100, 100, 10);
      detector.detectIssues(mockMetrics, frameEntry);
      
      expect(detector.isPerformanceIssueActive()).toBe(true);
    });

    it('should reset all tracking data', () => {
      // Add some issues
      const frameEntry = new FrameTimeEntry(1000, 150, 150, 6.67);
      detector.detectIssues(mockMetrics, frameEntry);
      
      detector.reset();
      
      expect(detector.getRecentIssues()).toHaveLength(0);
      expect(detector.getStutterCount()).toBe(0);
      expect(detector.getLastStutterTime()).toBe(0);
      expect(detector.isPerformanceIssueActive()).toBe(false);
    });
  });

  describe('Threshold Configuration', () => {
    it('should update thresholds', () => {
      const newThresholds = new PerformanceThresholds({
        stutterThreshold: 50,
        minFPS: 45
      });
      
      detector.setThresholds(newThresholds);
      
      // Test with new stutter threshold
      const frameEntry = new FrameTimeEntry(1000, 75, 75, 13.33);
      const issues = detector.detectIssues(mockMetrics, frameEntry);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('stutter');
    });
  });
});