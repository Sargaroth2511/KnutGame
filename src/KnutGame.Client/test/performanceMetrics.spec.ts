/**
 * Tests for performance metrics collection system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PerformanceMetrics, 
  PerformanceIssue, 
  PerformanceThresholds, 
  FrameTimeEntry, 
  PerformanceWindow 
} from '../src/systems/PerformanceMetrics';

describe('PerformanceMetrics', () => {
  describe('PerformanceThresholds', () => {
    it('should create with default values', () => {
      const thresholds = new PerformanceThresholds();
      
      expect(thresholds.minFPS).toBe(30);
      expect(thresholds.maxFrameTime).toBe(33.33);
      expect(thresholds.stutterThreshold).toBe(100);
      expect(thresholds.memoryPressureThreshold).toBe(0.8);
      expect(thresholds.performanceIssueWindow).toBe(5000);
    });

    it('should create with custom values', () => {
      const config = {
        minFPS: 60,
        stutterThreshold: 50,
        memoryPressureThreshold: 0.9
      };
      
      const thresholds = new PerformanceThresholds(config);
      
      expect(thresholds.minFPS).toBe(60);
      expect(thresholds.stutterThreshold).toBe(50);
      expect(thresholds.memoryPressureThreshold).toBe(0.9);
      expect(thresholds.maxFrameTime).toBe(33.33); // Should keep default
    });

    it('should update thresholds', () => {
      const thresholds = new PerformanceThresholds();
      
      thresholds.updateThresholds({ minFPS: 45, stutterThreshold: 75 });
      
      expect(thresholds.minFPS).toBe(45);
      expect(thresholds.stutterThreshold).toBe(75);
      expect(thresholds.maxFrameTime).toBe(33.33); // Should remain unchanged
    });
  });

  describe('FrameTimeEntry', () => {
    it('should create with correct properties', () => {
      const entry = new FrameTimeEntry(1000, 16.67, 16.67, 60);
      
      expect(entry.timestamp).toBe(1000);
      expect(entry.frameTime).toBe(16.67);
      expect(entry.deltaTime).toBe(16.67);
      expect(entry.fps).toBe(60);
    });
  });

  describe('PerformanceWindow', () => {
    let window: PerformanceWindow;

    beforeEach(() => {
      window = new PerformanceWindow(5); // Small window for testing
    });

    it('should create with default window size', () => {
      const defaultWindow = new PerformanceWindow();
      expect(defaultWindow.windowSize).toBe(60);
    });

    it('should add entries and maintain window size', () => {
      // Add 7 entries to a window of size 5
      for (let i = 0; i < 7; i++) {
        const entry = new FrameTimeEntry(i * 100, 16.67, 16.67, 60);
        window.addEntry(entry);
      }
      
      expect(window.entries.length).toBe(5);
      expect(window.entries[0].timestamp).toBe(200); // First two should be removed
    });

    it('should calculate average frame time', () => {
      window.addEntry(new FrameTimeEntry(100, 10, 10, 100));
      window.addEntry(new FrameTimeEntry(200, 20, 20, 50));
      window.addEntry(new FrameTimeEntry(300, 30, 30, 33.33));
      
      expect(window.averageFrameTime).toBe(20); // (10 + 20 + 30) / 3
    });

    it('should calculate average FPS', () => {
      window.addEntry(new FrameTimeEntry(100, 16.67, 16.67, 60));
      window.addEntry(new FrameTimeEntry(200, 33.33, 33.33, 30));
      
      expect(window.getAverageFPS()).toBe(45); // (60 + 30) / 2
    });

    it('should clear all data', () => {
      window.addEntry(new FrameTimeEntry(100, 16.67, 16.67, 60));
      window.stutterCount = 5;
      
      window.clear();
      
      expect(window.entries.length).toBe(0);
      expect(window.averageFrameTime).toBe(0);
      expect(window.stutterCount).toBe(0);
    });

    it('should handle empty window gracefully', () => {
      expect(window.getAverageFPS()).toBe(0);
      expect(window.averageFrameTime).toBe(0);
    });
  });
});