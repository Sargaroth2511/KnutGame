/**
 * Unit tests for performance monitoring infrastructure
 * Requirements: 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PerformanceMonitor,
  FrameTimeTracker,
  MemoryProfiler,
  DEFAULT_PERFORMANCE_THRESHOLDS,
  type PerformanceIssue,
  type PerformanceMetrics
} from '../src/systems/PerformanceMonitor';

// Mock performance.now()
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
    }
  },
  writable: true
});

// Mock window.gc
Object.defineProperty(global, 'window', {
  value: {
    gc: vi.fn()
  },
  writable: true
});

describe('FrameTimeTracker', () => {
  let frameTimeTracker: FrameTimeTracker;
  let stutterCallback: ReturnType<typeof vi.fn>;
  let lowFPSCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    frameTimeTracker = new FrameTimeTracker(DEFAULT_PERFORMANCE_THRESHOLDS);
    stutterCallback = vi.fn();
    lowFPSCallback = vi.fn();
    frameTimeTracker.onStutterDetected(stutterCallback);
    frameTimeTracker.onLowFPSDetected(lowFPSCallback);
    mockPerformanceNow.mockReturnValue(1000);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should record frame times correctly', () => {
    frameTimeTracker.recordFrame(16.67, 1000);
    frameTimeTracker.recordFrame(16.67, 1016.67);
    
    expect(frameTimeTracker.getAverageFrameTime()).toBeCloseTo(16.67, 1);
    expect(frameTimeTracker.getCurrentFPS()).toBe(60);
  });

  it('should detect stutters when frame time exceeds threshold', () => {
    const stutterFrameTime = 150; // Above 100ms threshold
    frameTimeTracker.recordFrame(stutterFrameTime, 1000);
    
    expect(stutterCallback).toHaveBeenCalledWith({
      frameTime: stutterFrameTime,
      timestamp: 1000
    });
    expect(frameTimeTracker.getStutterCount()).toBe(1);
    expect(frameTimeTracker.getLastStutterTime()).toBe(1000);
  });

  it('should not detect stutters for normal frame times', () => {
    frameTimeTracker.recordFrame(16.67, 1000);
    frameTimeTracker.recordFrame(20, 1020);
    
    expect(stutterCallback).not.toHaveBeenCalled();
    expect(frameTimeTracker.getStutterCount()).toBe(0);
  });

  it('should detect low FPS after sufficient samples', () => {
    // Record 30 frames with high frame times (low FPS)
    for (let i = 0; i < 30; i++) {
      frameTimeTracker.recordFrame(50, 1000 + i * 50); // 20 FPS
    }
    
    expect(lowFPSCallback).toHaveBeenCalledWith(20);
  });

  it('should maintain frame time history with maximum samples', () => {
    // Record more than maxSamples (120) frames
    for (let i = 0; i < 150; i++) {
      frameTimeTracker.recordFrame(16.67, 1000 + i * 16.67);
    }
    
    const history = frameTimeTracker.getFrameTimeHistory();
    expect(history.frameTimes.length).toBe(120);
    expect(history.timestamps.length).toBe(120);
  });

  it('should calculate FPS correctly for various frame times', () => {
    // 30 FPS scenario
    for (let i = 0; i < 30; i++) {
      frameTimeTracker.recordFrame(33.33, 1000 + i * 33.33);
    }
    expect(frameTimeTracker.getCurrentFPS()).toBe(30);
    
    // Reset and test 120 FPS scenario
    frameTimeTracker = new FrameTimeTracker(DEFAULT_PERFORMANCE_THRESHOLDS);
    for (let i = 0; i < 30; i++) {
      frameTimeTracker.recordFrame(8.33, 1000 + i * 8.33);
    }
    expect(frameTimeTracker.getCurrentFPS()).toBe(120);
  });
});

describe('MemoryProfiler', () => {
  let memoryProfiler: MemoryProfiler;
  let memoryPressureCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    memoryProfiler = new MemoryProfiler(DEFAULT_PERFORMANCE_THRESHOLDS);
    memoryPressureCallback = vi.fn();
    memoryProfiler.onMemoryPressure(memoryPressureCallback);
    mockPerformanceNow.mockReturnValue(1000);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate memory usage correctly when performance.memory is available', () => {
    const memoryUsage = memoryProfiler.getCurrentMemoryUsage();
    // 50MB used / 200MB limit = 0.25
    expect(memoryUsage).toBe(0.25);
  });

  it('should use fallback memory calculation when performance.memory is not available', () => {
    // Temporarily remove performance.memory
    const originalMemory = (global.performance as any).memory;
    delete (global.performance as any).memory;
    
    const memoryUsage = memoryProfiler.getCurrentMemoryUsage();
    expect(memoryUsage).toBeGreaterThanOrEqual(0);
    expect(memoryUsage).toBeLessThanOrEqual(0.7);
    
    // Restore performance.memory
    (global.performance as any).memory = originalMemory;
  });

  it('should detect memory pressure when usage exceeds threshold', () => {
    // Mock high memory usage (90% of limit)
    (global.performance as any).memory.usedJSHeapSize = 180 * 1024 * 1024;
    
    memoryProfiler.checkMemoryUsage();
    
    expect(memoryPressureCallback).toHaveBeenCalledWith(0.9);
  });

  it('should not trigger memory pressure for normal usage', () => {
    // Normal memory usage (25% of limit)
    (global.performance as any).memory.usedJSHeapSize = 50 * 1024 * 1024;
    
    memoryProfiler.checkMemoryUsage();
    
    expect(memoryPressureCallback).not.toHaveBeenCalled();
  });

  it('should track memory trend correctly', () => {
    // Start with low memory usage
    (global.performance as any).memory.usedJSHeapSize = 20 * 1024 * 1024;
    
    // Record several readings with increasing memory
    for (let i = 0; i < 5; i++) {
      mockPerformanceNow.mockReturnValue(1000 + i * 1000);
      (global.performance as any).memory.usedJSHeapSize = (20 + i * 10) * 1024 * 1024;
      memoryProfiler.checkMemoryUsage();
    }
    
    expect(memoryProfiler.getMemoryTrend()).toBe('increasing');
  });

  it('should maintain memory history with maximum readings', () => {
    // Record more than maxReadings (60) samples
    for (let i = 0; i < 70; i++) {
      mockPerformanceNow.mockReturnValue(1000 + i * 1000);
      memoryProfiler.checkMemoryUsage();
    }
    
    const history = memoryProfiler.getMemoryHistory();
    expect(history.length).toBe(60);
  });

  it('should respect memory check interval', () => {
    memoryProfiler.checkMemoryUsage();
    
    // Try to check again immediately (should be ignored)
    mockPerformanceNow.mockReturnValue(1500); // 500ms later
    memoryProfiler.checkMemoryUsage();
    
    const history = memoryProfiler.getMemoryHistory();
    expect(history.length).toBe(1); // Only first check recorded
    
    // Check after interval (should be recorded)
    mockPerformanceNow.mockReturnValue(2100); // 1100ms later
    memoryProfiler.checkMemoryUsage();
    
    const updatedHistory = memoryProfiler.getMemoryHistory();
    expect(updatedHistory.length).toBe(2);
  });
});

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let performanceIssueCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    performanceIssueCallback = vi.fn();
    performanceMonitor.onPerformanceIssue(performanceIssueCallback);
    mockPerformanceNow.mockReturnValue(1000);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should track frame timing correctly', () => {
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    
    mockPerformanceNow.mockReturnValue(1016.67);
    performanceMonitor.endFrame();
    
    expect(performanceMonitor.getCurrentFPS()).toBe(60);
    expect(performanceMonitor.getAverageFrameTime()).toBeCloseTo(16.67, 1);
  });

  it('should detect and report stutter issues', () => {
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    
    mockPerformanceNow.mockReturnValue(1150); // 150ms frame time (stutter)
    performanceMonitor.endFrame();
    
    expect(performanceIssueCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'stutter',
        severity: 'low',
        duration: 150
      })
    );
  });

  it('should detect and report low FPS issues', () => {
    // Simulate 30 frames with low FPS
    for (let i = 0; i < 30; i++) {
      mockPerformanceNow.mockReturnValue(1000 + i * 50);
      performanceMonitor.startFrame();
      
      mockPerformanceNow.mockReturnValue(1000 + (i + 1) * 50);
      performanceMonitor.endFrame();
    }
    
    expect(performanceIssueCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'low_fps',
        severity: expect.any(String)
      })
    );
  });

  it('should detect and report memory pressure issues', () => {
    // Mock high memory usage
    (global.performance as any).memory.usedJSHeapSize = 180 * 1024 * 1024; // 90%
    
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    
    mockPerformanceNow.mockReturnValue(1016.67);
    performanceMonitor.endFrame();
    
    expect(performanceIssueCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'memory_pressure',
        severity: 'high'
      })
    );
  });

  it('should calculate performance score correctly', () => {
    // Simulate good performance
    for (let i = 0; i < 10; i++) {
      mockPerformanceNow.mockReturnValue(1000 + i * 16.67);
      performanceMonitor.startFrame();
      
      mockPerformanceNow.mockReturnValue(1000 + (i + 1) * 16.67);
      performanceMonitor.endFrame();
    }
    
    const metrics = performanceMonitor.getPerformanceMetrics();
    expect(metrics.performanceScore).toBeGreaterThan(80); // Good performance
  });

  it('should track active performance issues', () => {
    expect(performanceMonitor.isPerformanceIssueActive()).toBe(false);
    
    // Trigger a stutter
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    
    mockPerformanceNow.mockReturnValue(1150);
    performanceMonitor.endFrame();
    
    expect(performanceMonitor.isPerformanceIssueActive()).toBe(true);
  });

  it('should clean up old performance issues', () => {
    // Trigger a stutter
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    
    mockPerformanceNow.mockReturnValue(1150);
    performanceMonitor.endFrame();
    
    expect(performanceMonitor.isPerformanceIssueActive()).toBe(true);
    
    // Move time forward beyond issue window
    mockPerformanceNow.mockReturnValue(7000); // 6 seconds later
    expect(performanceMonitor.isPerformanceIssueActive()).toBe(false);
  });

  it('should allow threshold customization', () => {
    const customThresholds = {
      stutterThreshold: 200, // Higher threshold
      minFPS: 20
    };
    
    performanceMonitor.setThresholds(customThresholds);
    
    // Frame time that would normally trigger stutter (150ms) should not trigger with 200ms threshold
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    
    mockPerformanceNow.mockReturnValue(1150);
    performanceMonitor.endFrame();
    
    expect(performanceIssueCallback).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stutter' })
    );
  });

  it('should provide comprehensive performance metrics', () => {
    // Simulate some performance activity
    for (let i = 0; i < 5; i++) {
      mockPerformanceNow.mockReturnValue(1000 + i * 20);
      performanceMonitor.startFrame();
      
      mockPerformanceNow.mockReturnValue(1000 + (i + 1) * 20);
      performanceMonitor.endFrame();
    }
    
    const metrics = performanceMonitor.getPerformanceMetrics();
    
    expect(metrics).toMatchObject({
      currentFPS: expect.any(Number),
      averageFrameTime: expect.any(Number),
      memoryUsage: expect.any(Number),
      stutterCount: expect.any(Number),
      lastStutterTime: expect.any(Number),
      performanceScore: expect.any(Number)
    });
    
    expect(metrics.currentFPS).toBeGreaterThan(0);
    expect(metrics.averageFrameTime).toBeGreaterThan(0);
    expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
    expect(metrics.memoryUsage).toBeLessThanOrEqual(1);
    expect(metrics.performanceScore).toBeGreaterThanOrEqual(0);
    expect(metrics.performanceScore).toBeLessThanOrEqual(100);
  });

  it('should handle callback errors gracefully', () => {
    const errorCallback = vi.fn().mockImplementation(() => {
      throw new Error('Callback error');
    });
    
    performanceMonitor.onPerformanceIssue(errorCallback);
    
    // Should not throw when callback errors
    expect(() => {
      mockPerformanceNow.mockReturnValue(1000);
      performanceMonitor.startFrame();
      
      mockPerformanceNow.mockReturnValue(1150);
      performanceMonitor.endFrame();
    }).not.toThrow();
    
    expect(errorCallback).toHaveBeenCalled();
  });
});

describe('Performance Severity Calculations', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    mockPerformanceNow.mockReturnValue(1000);
  });

  it('should calculate stutter severity correctly', () => {
    const performanceIssueCallback = vi.fn();
    performanceMonitor.onPerformanceIssue(performanceIssueCallback);
    
    // Low severity stutter (150ms, 1.5x threshold)
    mockPerformanceNow.mockReturnValue(1000);
    performanceMonitor.startFrame();
    mockPerformanceNow.mockReturnValue(1150);
    performanceMonitor.endFrame();
    
    expect(performanceIssueCallback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'low' })
    );
    
    performanceIssueCallback.mockClear();
    
    // Medium severity stutter (200ms, 2x threshold)
    mockPerformanceNow.mockReturnValue(2000);
    performanceMonitor.startFrame();
    mockPerformanceNow.mockReturnValue(2200);
    performanceMonitor.endFrame();
    
    expect(performanceIssueCallback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'medium' })
    );
    
    performanceIssueCallback.mockClear();
    
    // High severity stutter (300ms, 3x threshold)
    mockPerformanceNow.mockReturnValue(3000);
    performanceMonitor.startFrame();
    mockPerformanceNow.mockReturnValue(3300);
    performanceMonitor.endFrame();
    
    expect(performanceIssueCallback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'high' })
    );
  });
});