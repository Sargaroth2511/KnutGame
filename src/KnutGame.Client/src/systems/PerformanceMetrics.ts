/**
 * Performance metrics data models and collection system
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

export class PerformanceThresholds {
  public minFPS: number = 30;
  public maxFrameTime: number = 33.33; // ~30 FPS
  public stutterThreshold: number = 100; // ms
  public memoryPressureThreshold: number = 0.8;
  public performanceIssueWindow: number = 5000; // ms
  public lowFPSThreshold: number = 25;
  public criticalFPSThreshold: number = 15;

  constructor(config?: Partial<PerformanceThresholds>) {
    if (config) {
      Object.assign(this, config);
    }
  }

  public updateThresholds(config: Partial<PerformanceThresholds>): void {
    Object.assign(this, config);
  }
}

export class FrameTimeEntry {
  constructor(
    public timestamp: number,
    public frameTime: number,
    public deltaTime: number,
    public fps: number
  ) {}
}

export class PerformanceWindow {
  public entries: FrameTimeEntry[] = [];
  public averageFrameTime: number = 0;
  public stutterCount: number = 0;

  constructor(public windowSize: number = 60) {} // Default 60 frames

  public addEntry(entry: FrameTimeEntry): void {
    this.entries.push(entry);
    
    // Keep only the last windowSize entries
    if (this.entries.length > this.windowSize) {
      this.entries.shift();
    }

    this.updateAverages();
  }

  private updateAverages(): void {
    if (this.entries.length === 0) return;

    const totalFrameTime = this.entries.reduce((sum, entry) => sum + entry.frameTime, 0);
    this.averageFrameTime = totalFrameTime / this.entries.length;
  }

  public getAverageFPS(): number {
    if (this.entries.length === 0) return 0;
    
    const totalFPS = this.entries.reduce((sum, entry) => sum + entry.fps, 0);
    return totalFPS / this.entries.length;
  }

  public clear(): void {
    this.entries = [];
    this.averageFrameTime = 0;
    this.stutterCount = 0;
  }
}