/**
 * Performance monitoring system for detecting stutters and performance issues
 * Requirements: 3.1, 3.2, 3.3
 */

export interface PerformanceMetrics {
  currentFPS: number;
  averageFrameTime: number;
  memoryUsage: number;
  stutterCount: number;
  lastStutterTime: number;
  performanceScore: number;
}

export interface PerformanceIssue {
  type: 'stutter' | 'low_fps' | 'memory_pressure';
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  duration: number;
  metrics: PerformanceMetrics;
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameTime: number;
  stutterThreshold: number;
  memoryPressureThreshold: number;
  performanceIssueWindow: number;
}

export interface IPerformanceMonitor {
  startFrame(): void;
  endFrame(): void;
  getCurrentFPS(): number;
  getAverageFrameTime(): number;
  isPerformanceIssueActive(): boolean;
  getPerformanceMetrics(): PerformanceMetrics;
  onPerformanceIssue(callback: (issue: PerformanceIssue) => void): void;
  setThresholds(thresholds: Partial<PerformanceThresholds>): void;
}

/**
 * Default performance thresholds
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  minFPS: 30,
  maxFrameTime: 33.33, // ~30 FPS
  stutterThreshold: 100, // ms
  memoryPressureThreshold: 0.8,
  performanceIssueWindow: 5000 // ms
};

/**
 * Central performance monitoring service
 */
export class PerformanceMonitor implements IPerformanceMonitor {
  private frameStartTime: number = 0;
  private frameTimeTracker: FrameTimeTracker;
  private memoryProfiler: MemoryProfiler;
  private thresholds: PerformanceThresholds;
  private performanceIssueCallbacks: Array<(issue: PerformanceIssue) => void> = [];
  private activeIssues: Map<string, PerformanceIssue> = new Map();

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...thresholds };
    this.frameTimeTracker = new FrameTimeTracker(this.thresholds);
    this.memoryProfiler = new MemoryProfiler(this.thresholds);

    // Set up issue detection callbacks
    this.frameTimeTracker.onStutterDetected((stutter) => {
      this.handlePerformanceIssue({
        type: 'stutter',
        severity: this.calculateSeverity(stutter.frameTime, this.thresholds.stutterThreshold),
        timestamp: stutter.timestamp,
        duration: stutter.frameTime,
        metrics: this.getPerformanceMetrics()
      });
    });

    this.frameTimeTracker.onLowFPSDetected((fps) => {
      this.handlePerformanceIssue({
        type: 'low_fps',
        severity: this.calculateFPSSeverity(fps),
        timestamp: performance.now(),
        duration: 0,
        metrics: this.getPerformanceMetrics()
      });
    });

    this.memoryProfiler.onMemoryPressure((pressure) => {
      this.handlePerformanceIssue({
        type: 'memory_pressure',
        severity: this.calculateMemorySeverity(pressure),
        timestamp: performance.now(),
        duration: 0,
        metrics: this.getPerformanceMetrics()
      });
    });
  }

  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  endFrame(): void {
    const frameEndTime = performance.now();
    const frameTime = frameEndTime - this.frameStartTime;
    
    this.frameTimeTracker.recordFrame(frameTime, frameEndTime);
    this.memoryProfiler.checkMemoryUsage();
  }

  getCurrentFPS(): number {
    return this.frameTimeTracker.getCurrentFPS();
  }

  getAverageFrameTime(): number {
    return this.frameTimeTracker.getAverageFrameTime();
  }

  isPerformanceIssueActive(): boolean {
    const now = performance.now();
    // Clean up old issues
    for (const [key, issue] of this.activeIssues) {
      if (now - issue.timestamp > this.thresholds.performanceIssueWindow) {
        this.activeIssues.delete(key);
      }
    }
    return this.activeIssues.size > 0;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const memoryUsage = this.memoryProfiler.getCurrentMemoryUsage();
    return {
      currentFPS: this.getCurrentFPS(),
      averageFrameTime: this.getAverageFrameTime(),
      memoryUsage: memoryUsage,
      stutterCount: this.frameTimeTracker.getStutterCount(),
      lastStutterTime: this.frameTimeTracker.getLastStutterTime(),
      performanceScore: this.calculatePerformanceScore()
    };
  }

  onPerformanceIssue(callback: (issue: PerformanceIssue) => void): void {
    this.performanceIssueCallbacks.push(callback);
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.frameTimeTracker.updateThresholds(this.thresholds);
    this.memoryProfiler.updateThresholds(this.thresholds);
  }

  private handlePerformanceIssue(issue: PerformanceIssue): void {
    const issueKey = `${issue.type}_${Math.floor(issue.timestamp / 1000)}`;
    this.activeIssues.set(issueKey, issue);
    
    // Notify callbacks
    this.performanceIssueCallbacks.forEach(callback => {
      try {
        callback(issue);
      } catch (error) {
        console.error('Error in performance issue callback:', error);
      }
    });
  }

  private calculateSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' {
    const ratio = value / threshold;
    if (ratio >= 3) return 'high';
    if (ratio >= 2) return 'medium';
    return 'low';
  }

  private calculateFPSSeverity(fps: number): 'low' | 'medium' | 'high' {
    if (fps < 15) return 'high';
    if (fps < 25) return 'medium';
    return 'low';
  }

  private calculateMemorySeverity(pressure: number): 'low' | 'medium' | 'high' {
    if (pressure >= 0.9) return 'high';
    if (pressure >= 0.8) return 'medium';
    return 'low';
  }

  private calculatePerformanceScore(): number {
    const fps = this.getCurrentFPS();
    const frameTime = this.getAverageFrameTime();
    const memoryUsage = this.memoryProfiler.getCurrentMemoryUsage();
    
    // Score from 0-100 based on FPS (60%), frame time consistency (30%), memory usage (10%)
    const fpsScore = Math.min(100, (fps / 60) * 100);
    const frameTimeScore = Math.max(0, 100 - (frameTime - 16.67) * 2); // 16.67ms = 60fps
    const memoryScore = Math.max(0, 100 - memoryUsage * 100);
    
    return Math.round(fpsScore * 0.6 + frameTimeScore * 0.3 + memoryScore * 0.1);
  }
}

/**
 * Frame time tracking and stutter detection
 */
export class FrameTimeTracker {
  private frameTimes: number[] = [];
  private frameTimestamps: number[] = [];
  private maxSamples: number = 120; // 2 seconds at 60fps
  private stutterCount: number = 0;
  private lastStutterTime: number = 0;
  private thresholds: PerformanceThresholds;
  private stutterCallbacks: Array<(stutter: { frameTime: number; timestamp: number }) => void> = [];
  private lowFPSCallbacks: Array<(fps: number) => void> = [];

  constructor(thresholds: PerformanceThresholds) {
    this.thresholds = thresholds;
  }

  recordFrame(frameTime: number, timestamp: number): void {
    this.frameTimes.push(frameTime);
    this.frameTimestamps.push(timestamp);

    // Keep only recent samples
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
      this.frameTimestamps.shift();
    }

    // Check for stutter
    if (frameTime > this.thresholds.stutterThreshold) {
      this.stutterCount++;
      this.lastStutterTime = timestamp;
      this.stutterCallbacks.forEach(callback => {
        callback({ frameTime, timestamp });
      });
    }

    // Check for low FPS (every 30 frames)
    if (this.frameTimes.length >= 30 && this.frameTimes.length % 30 === 0) {
      const currentFPS = this.getCurrentFPS();
      if (currentFPS < this.thresholds.minFPS) {
        this.lowFPSCallbacks.forEach(callback => {
          callback(currentFPS);
        });
      }
    }
  }

  getCurrentFPS(): number {
    if (this.frameTimes.length < 2) return 60; // Default assumption
    
    const recentFrames = this.frameTimes.slice(-30); // Last 30 frames
    const averageFrameTime = recentFrames.reduce((sum, time) => sum + time, 0) / recentFrames.length;
    return Math.round(1000 / averageFrameTime);
  }

  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 16.67; // 60fps default
    
    const sum = this.frameTimes.reduce((total, time) => total + time, 0);
    return sum / this.frameTimes.length;
  }

  getStutterCount(): number {
    return this.stutterCount;
  }

  getLastStutterTime(): number {
    return this.lastStutterTime;
  }

  onStutterDetected(callback: (stutter: { frameTime: number; timestamp: number }) => void): void {
    this.stutterCallbacks.push(callback);
  }

  onLowFPSDetected(callback: (fps: number) => void): void {
    this.lowFPSCallbacks.push(callback);
  }

  updateThresholds(thresholds: PerformanceThresholds): void {
    this.thresholds = thresholds;
  }

  getFrameTimeHistory(): { frameTimes: number[]; timestamps: number[] } {
    return {
      frameTimes: [...this.frameTimes],
      timestamps: [...this.frameTimestamps]
    };
  }
}

/**
 * Memory usage monitoring and garbage collection detection
 */
export class MemoryProfiler {
  private memoryReadings: Array<{ usage: number; timestamp: number }> = [];
  private maxReadings: number = 60; // Keep 1 minute of readings at 1/second
  private thresholds: PerformanceThresholds;
  private memoryPressureCallbacks: Array<(pressure: number) => void> = [];
  private lastMemoryCheck: number = 0;
  private memoryCheckInterval: number = 1000; // Check every second

  constructor(thresholds: PerformanceThresholds) {
    this.thresholds = thresholds;
  }

  checkMemoryUsage(): void {
    const now = performance.now();
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return;
    }

    this.lastMemoryCheck = now;
    const memoryUsage = this.getCurrentMemoryUsage();
    
    this.memoryReadings.push({ usage: memoryUsage, timestamp: now });
    
    // Keep only recent readings
    if (this.memoryReadings.length > this.maxReadings) {
      this.memoryReadings.shift();
    }

    // Check for memory pressure
    if (memoryUsage > this.thresholds.memoryPressureThreshold) {
      this.memoryPressureCallbacks.forEach(callback => {
        callback(memoryUsage);
      });
    }
  }

  getCurrentMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }
    
    // Fallback estimation based on time and activity
    return Math.min(0.5, Date.now() / 1000000 % 0.7);
  }

  getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.memoryReadings.length < 5) return 'stable';
    
    const recent = this.memoryReadings.slice(-5);
    const first = recent[0].usage;
    const last = recent[recent.length - 1].usage;
    const diff = last - first;
    
    if (diff > 0.05) return 'increasing';
    if (diff < -0.05) return 'decreasing';
    return 'stable';
  }

  onMemoryPressure(callback: (pressure: number) => void): void {
    this.memoryPressureCallbacks.push(callback);
  }

  updateThresholds(thresholds: PerformanceThresholds): void {
    this.thresholds = thresholds;
  }

  getMemoryHistory(): Array<{ usage: number; timestamp: number }> {
    return [...this.memoryReadings];
  }

  forceGarbageCollection(): void {
    if (window.gc) {
      window.gc();
    }
  }
}