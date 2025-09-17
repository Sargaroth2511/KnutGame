/**
 * Performance data aggregation and analysis system
 */

import { PerformanceMetrics, PerformanceIssue, FrameTimeEntry, PerformanceWindow } from './PerformanceMetrics';

export interface PerformanceAnalysis {
  overallScore: number;
  stability: number;
  averagePerformance: number;
  issueFrequency: number;
  recommendations: string[];
}

export interface PerformanceSummary {
  timeWindow: number;
  totalFrames: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  stutterEvents: number;
  lowFPSEvents: number;
  memoryPressureEvents: number;
  performanceScore: number;
}

export class PerformanceAnalyzer {
  private performanceHistory: PerformanceMetrics[] = [];
  private issueHistory: PerformanceIssue[] = [];
  private maxHistorySize: number = 1000;

  public addMetrics(metrics: PerformanceMetrics): void {
    this.performanceHistory.push({ ...metrics });
    
    // Keep history size manageable
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  public addIssues(issues: PerformanceIssue[]): void {
    this.issueHistory.push(...issues);
    
    // Keep issue history size manageable
    if (this.issueHistory.length > this.maxHistorySize) {
      this.issueHistory.splice(0, this.issueHistory.length - this.maxHistorySize);
    }
  }

  public calculatePerformanceScore(window: PerformanceWindow): number {
    if (window.entries.length === 0) return 100;

    const avgFPS = window.getAverageFPS();
    const stutterPenalty = Math.min(window.stutterCount * 5, 30);
    
    // Base score from FPS (0-70 points)
    let fpsScore = Math.max(0, Math.min(70, (avgFPS / 60) * 70));
    
    // Stability bonus (0-30 points)
    const stabilityScore = this.calculateStabilityScore(window);
    
    // Apply stutter penalty
    const finalScore = Math.max(0, fpsScore + stabilityScore - stutterPenalty);
    
    return Math.round(finalScore);
  }

  private calculateStabilityScore(window: PerformanceWindow): number {
    if (window.entries.length < 2) return 30;

    // Calculate frame time variance
    const frameTimes = window.entries.map(e => e.frameTime);
    const mean = frameTimes.reduce((sum, ft) => sum + ft, 0) / frameTimes.length;
    const variance = frameTimes.reduce((sum, ft) => sum + Math.pow(ft - mean, 2), 0) / frameTimes.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower standard deviation = higher stability score
    const maxStdDev = 20; // ms
    const stabilityRatio = Math.max(0, 1 - (standardDeviation / maxStdDev));
    
    return Math.round(stabilityRatio * 30);
  }

  public analyzePerformance(timeWindowMs: number = 30000): PerformanceAnalysis {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentMetrics = this.performanceHistory.filter(m => m.lastStutterTime > cutoffTime);
    const recentIssues = this.issueHistory.filter(i => i.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        overallScore: 100,
        stability: 100,
        averagePerformance: 100,
        issueFrequency: 0,
        recommendations: []
      };
    }

    const avgScore = recentMetrics.reduce((sum, m) => sum + m.performanceScore, 0) / recentMetrics.length;
    const avgFPS = recentMetrics.reduce((sum, m) => sum + m.currentFPS, 0) / recentMetrics.length;
    
    const stability = this.calculateStabilityFromMetrics(recentMetrics);
    const issueFrequency = recentIssues.length / (timeWindowMs / 1000); // issues per second

    const recommendations = this.generateRecommendations(recentMetrics, recentIssues);

    return {
      overallScore: Math.round(avgScore),
      stability: Math.round(stability),
      averagePerformance: Math.round((avgFPS / 60) * 100),
      issueFrequency: Math.round(issueFrequency * 100) / 100,
      recommendations
    };
  }

  private calculateStabilityFromMetrics(metrics: PerformanceMetrics[]): number {
    if (metrics.length < 2) return 100;

    const fpsList = metrics.map(m => m.currentFPS);
    const mean = fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length;
    const variance = fpsList.reduce((sum, fps) => sum + Math.pow(fps - mean, 2), 0) / fpsList.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    // Lower coefficient of variation = higher stability
    return Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));
  }

  public generateSummary(timeWindowMs: number = 60000): PerformanceSummary {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentMetrics = this.performanceHistory.filter(m => m.lastStutterTime > cutoffTime);
    const recentIssues = this.issueHistory.filter(i => i.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        timeWindow: timeWindowMs,
        totalFrames: 0,
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        stutterEvents: 0,
        lowFPSEvents: 0,
        memoryPressureEvents: 0,
        performanceScore: 100
      };
    }

    const fpsList = recentMetrics.map(m => m.currentFPS);
    const avgFPS = fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length;
    const minFPS = Math.min(...fpsList);
    const maxFPS = Math.max(...fpsList);

    const stutterEvents = recentIssues.filter(i => i.type === 'stutter').length;
    const lowFPSEvents = recentIssues.filter(i => i.type === 'low_fps').length;
    const memoryPressureEvents = recentIssues.filter(i => i.type === 'memory_pressure').length;

    const avgScore = recentMetrics.reduce((sum, m) => sum + m.performanceScore, 0) / recentMetrics.length;

    return {
      timeWindow: timeWindowMs,
      totalFrames: recentMetrics.length,
      averageFPS: Math.round(avgFPS * 100) / 100,
      minFPS: Math.round(minFPS * 100) / 100,
      maxFPS: Math.round(maxFPS * 100) / 100,
      stutterEvents,
      lowFPSEvents,
      memoryPressureEvents,
      performanceScore: Math.round(avgScore)
    };
  }

  private generateRecommendations(metrics: PerformanceMetrics[], issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];

    const avgFPS = metrics.reduce((sum, m) => sum + m.currentFPS, 0) / metrics.length;
    const stutterCount = issues.filter(i => i.type === 'stutter').length;
    const memoryIssues = issues.filter(i => i.type === 'memory_pressure').length;

    if (avgFPS < 30) {
      recommendations.push('Consider reducing visual effects to improve frame rate');
    }

    if (stutterCount > 5) {
      recommendations.push('Frequent stutters detected - check for background processes or optimize game loop');
    }

    if (memoryIssues > 0) {
      recommendations.push('Memory pressure detected - consider enabling object pooling or reducing memory usage');
    }

    const highSeverityIssues = issues.filter(i => i.severity === 'high').length;
    if (highSeverityIssues > 0) {
      recommendations.push('Critical performance issues detected - consider emergency performance mode');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is stable - no immediate optimizations needed');
    }

    return recommendations;
  }

  public clearHistory(): void {
    this.performanceHistory = [];
    this.issueHistory = [];
  }

  public getHistorySize(): number {
    return this.performanceHistory.length;
  }

  public getIssueHistorySize(): number {
    return this.issueHistory.length;
  }
}