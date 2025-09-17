/**
 * Performance event detection and classification system
 */

import { PerformanceMetrics, PerformanceIssue, PerformanceThresholds, FrameTimeEntry } from './PerformanceMetrics';

export class PerformanceEventDetector {
  private thresholds: PerformanceThresholds;
  private recentIssues: PerformanceIssue[] = [];
  private lastStutterTime: number = 0;
  private stutterCount: number = 0;

  constructor(thresholds?: PerformanceThresholds) {
    this.thresholds = thresholds || new PerformanceThresholds();
  }

  public setThresholds(thresholds: PerformanceThresholds): void {
    this.thresholds = thresholds;
  }

  public detectIssues(currentMetrics: PerformanceMetrics, frameEntry: FrameTimeEntry): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const now = Date.now();

    // Detect stutter events
    const stutterIssue = this.detectStutter(frameEntry, currentMetrics, now);
    if (stutterIssue) {
      issues.push(stutterIssue);
    }

    // Detect low FPS events
    const lowFPSIssue = this.detectLowFPS(currentMetrics, now);
    if (lowFPSIssue) {
      issues.push(lowFPSIssue);
    }

    // Detect memory pressure events
    const memoryIssue = this.detectMemoryPressure(currentMetrics, now);
    if (memoryIssue) {
      issues.push(memoryIssue);
    }

    // Add to recent issues and clean up old ones
    issues.forEach(issue => this.addRecentIssue(issue));
    this.cleanupOldIssues(now);

    return issues;
  }

  private detectStutter(frameEntry: FrameTimeEntry, metrics: PerformanceMetrics, timestamp: number): PerformanceIssue | null {
    if (frameEntry.frameTime > this.thresholds.stutterThreshold) {
      this.stutterCount++;
      this.lastStutterTime = timestamp;

      const severity = this.classifyStutterSeverity(frameEntry.frameTime);
      
      return {
        type: 'stutter',
        severity,
        timestamp,
        duration: frameEntry.frameTime,
        metrics: { ...metrics }
      };
    }
    return null;
  }

  private detectLowFPS(metrics: PerformanceMetrics, timestamp: number): PerformanceIssue | null {
    if (metrics.currentFPS < this.thresholds.minFPS) {
      const severity = this.classifyFPSSeverity(metrics.currentFPS);
      
      return {
        type: 'low_fps',
        severity,
        timestamp,
        duration: 0, // Duration will be calculated by aggregating consecutive low FPS events
        metrics: { ...metrics }
      };
    }
    return null;
  }

  private detectMemoryPressure(metrics: PerformanceMetrics, timestamp: number): PerformanceIssue | null {
    if (metrics.memoryUsage > this.thresholds.memoryPressureThreshold) {
      const severity = this.classifyMemorySeverity(metrics.memoryUsage);
      
      return {
        type: 'memory_pressure',
        severity,
        timestamp,
        duration: 0,
        metrics: { ...metrics }
      };
    }
    return null;
  }

  private classifyStutterSeverity(frameTime: number): 'low' | 'medium' | 'high' {
    if (frameTime > 500) return 'high';
    if (frameTime > 200) return 'medium';
    return 'low';
  }

  private classifyFPSSeverity(fps: number): 'low' | 'medium' | 'high' {
    if (fps < this.thresholds.criticalFPSThreshold) return 'high';
    if (fps < this.thresholds.lowFPSThreshold) return 'medium';
    return 'low';
  }

  private classifyMemorySeverity(memoryUsage: number): 'low' | 'medium' | 'high' {
    if (memoryUsage > 0.95) return 'high';
    if (memoryUsage > 0.85) return 'medium';
    return 'low';
  }

  private addRecentIssue(issue: PerformanceIssue): void {
    this.recentIssues.push(issue);
  }

  private cleanupOldIssues(currentTime: number): void {
    const cutoffTime = currentTime - this.thresholds.performanceIssueWindow;
    this.recentIssues = this.recentIssues.filter(issue => issue.timestamp > cutoffTime);
  }

  public getRecentIssues(): PerformanceIssue[] {
    return [...this.recentIssues];
  }

  public getStutterCount(): number {
    return this.stutterCount;
  }

  public getLastStutterTime(): number {
    return this.lastStutterTime;
  }

  public isPerformanceIssueActive(): boolean {
    const now = Date.now();
    const recentCutoff = now - 1000; // Last 1 second
    
    return this.recentIssues.some(issue => 
      issue.timestamp > recentCutoff && 
      (issue.severity === 'medium' || issue.severity === 'high')
    );
  }

  public reset(): void {
    this.recentIssues = [];
    this.stutterCount = 0;
    this.lastStutterTime = 0;
  }
}