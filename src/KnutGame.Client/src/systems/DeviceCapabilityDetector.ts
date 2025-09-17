/**
 * DeviceCapabilityDetector - Assesses device performance capabilities at startup
 * and provides recommendations for optimal quality settings
 */

export interface DeviceCapabilities {
  performanceScore: number; // 0-100 score based on device capabilities
  memoryLevel: 'low' | 'medium' | 'high';
  renderingCapability: 'basic' | 'standard' | 'enhanced';
  recommendedQuality: QualityLevel;
  maxParticles: number;
  maxObjects: number;
  canHandleEffects: boolean;
}

export interface QualityLevel {
  name: 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
  particleCount: number;
  effectsEnabled: boolean;
  textureQuality: number; // 0.5 to 1.0
  shadowsEnabled: boolean;
  antialiasing: boolean;
  maxFPS: number;
}

export interface BenchmarkResult {
  averageFPS: number;
  frameTimeVariance: number;
  memoryUsage: number;
  renderTime: number;
  completed: boolean;
}

export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private capabilities: DeviceCapabilities | null = null;
  private benchmarkInProgress = false;

  // Predefined quality levels
  private readonly qualityLevels: Record<string, QualityLevel> = {
    minimal: {
      name: 'minimal',
      particleCount: 10,
      effectsEnabled: false,
      textureQuality: 0.5,
      shadowsEnabled: false,
      antialiasing: false,
      maxFPS: 30
    },
    low: {
      name: 'low',
      particleCount: 25,
      effectsEnabled: false,
      textureQuality: 0.7,
      shadowsEnabled: false,
      antialiasing: false,
      maxFPS: 45
    },
    medium: {
      name: 'medium',
      particleCount: 50,
      effectsEnabled: true,
      textureQuality: 0.8,
      shadowsEnabled: false,
      antialiasing: true,
      maxFPS: 60
    },
    high: {
      name: 'high',
      particleCount: 100,
      effectsEnabled: true,
      textureQuality: 1.0,
      shadowsEnabled: true,
      antialiasing: true,
      maxFPS: 60
    },
    ultra: {
      name: 'ultra',
      particleCount: 200,
      effectsEnabled: true,
      textureQuality: 1.0,
      shadowsEnabled: true,
      antialiasing: true,
      maxFPS: 120
    }
  };

  public static getInstance(): DeviceCapabilityDetector {
    if (!DeviceCapabilityDetector.instance) {
      DeviceCapabilityDetector.instance = new DeviceCapabilityDetector();
    }
    return DeviceCapabilityDetector.instance;
  }

  /**
   * Detect device capabilities through hardware analysis and performance benchmarking
   */
  public async detectCapabilities(scene?: Phaser.Scene): Promise<DeviceCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    // Start with hardware-based detection
    const hardwareScore = this.analyzeHardware();
    
    // Run performance benchmark if scene is available
    let benchmarkScore = 50; // Default fallback
    if (scene && !this.benchmarkInProgress) {
      const benchmark = await this.runPerformanceBenchmark(scene);
      benchmarkScore = this.calculateBenchmarkScore(benchmark);
    }

    // Combine scores with hardware weighted more heavily for initial assessment
    const performanceScore = Math.round(hardwareScore * 0.7 + benchmarkScore * 0.3);
    
    this.capabilities = this.createCapabilitiesFromScore(performanceScore);
    return this.capabilities;
  }

  /**
   * Analyze hardware characteristics to estimate performance
   */
  private analyzeHardware(): number {
    let score = 50; // Base score

    // Check available memory
    if ('memory' in performance) {
      const memoryGB = (performance as any).memory.jsHeapSizeLimit / (1024 * 1024 * 1024);
      if (memoryGB > 4) score += 20;
      else if (memoryGB > 2) score += 10;
      else if (memoryGB < 1) score -= 20;
    }

    // Check CPU cores (rough estimate)
    const cores = navigator.hardwareConcurrency || 2;
    if (cores >= 8) score += 15;
    else if (cores >= 4) score += 10;
    else if (cores <= 2) score -= 10;

    // Check device type indicators
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mobile') || userAgent.includes('android')) {
      score -= 15; // Mobile devices typically have lower performance
    }
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      score -= 5; // iOS devices are generally well-optimized
    }

    // Check screen resolution as performance indicator
    const pixelRatio = window.devicePixelRatio || 1;
    const screenPixels = window.screen.width * window.screen.height * pixelRatio;
    if (screenPixels > 2073600) score -= 10; // 1080p+ requires more rendering power
    if (screenPixels > 8294400) score -= 20; // 4K+ significantly more demanding

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Run a quick performance benchmark to assess actual rendering capability
   */
  private async runPerformanceBenchmark(scene: Phaser.Scene): Promise<BenchmarkResult> {
    this.benchmarkInProgress = true;
    
    const startTime = performance.now();
    const frameData: number[] = [];
    let memoryStart = 0;
    
    if ('memory' in performance) {
      memoryStart = (performance as any).memory.usedJSHeapSize;
    }

    // Create test objects for benchmarking
    const testObjects: Phaser.GameObjects.Sprite[] = [];
    const testParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

    try {
      // Create test sprites
      for (let i = 0; i < 50; i++) {
        const sprite = scene.add.sprite(
          Math.random() * scene.cameras.main.width,
          Math.random() * scene.cameras.main.height,
          'player'
        );
        sprite.setScale(0.5);
        testObjects.push(sprite);
      }

      // Run benchmark for a short duration
      return new Promise((resolve) => {
        let frameCount = 0;
        const maxFrames = 60; // Test for ~1 second at 60fps

        const benchmarkUpdate = () => {
          const frameStart = performance.now();
          
          // Animate test objects
          testObjects.forEach((obj, index) => {
            obj.x += Math.sin(frameCount * 0.1 + index) * 2;
            obj.y += Math.cos(frameCount * 0.1 + index) * 2;
            obj.rotation += 0.02;
          });

          const frameEnd = performance.now();
          frameData.push(frameEnd - frameStart);
          frameCount++;

          if (frameCount < maxFrames) {
            requestAnimationFrame(benchmarkUpdate);
          } else {
            // Cleanup test objects
            testObjects.forEach(obj => obj.destroy());
            testParticles.forEach(emitter => emitter.destroy());

            const totalTime = performance.now() - startTime;
            const averageFPS = (frameCount / totalTime) * 1000;
            const frameTimeVariance = this.calculateVariance(frameData);
            
            let memoryUsage = 0;
            if ('memory' in performance) {
              memoryUsage = (performance as any).memory.usedJSHeapSize - memoryStart;
            }

            this.benchmarkInProgress = false;
            resolve({
              averageFPS,
              frameTimeVariance,
              memoryUsage,
              renderTime: frameData.reduce((a, b) => a + b, 0) / frameData.length,
              completed: true
            });
          }
        };

        requestAnimationFrame(benchmarkUpdate);
      });
    } catch (error) {
      // Cleanup on error
      testObjects.forEach(obj => obj.destroy());
      testParticles.forEach(emitter => emitter.destroy());
      this.benchmarkInProgress = false;
      
      return {
        averageFPS: 30,
        frameTimeVariance: 10,
        memoryUsage: 0,
        renderTime: 16,
        completed: false
      };
    }
  }

  private calculateVariance(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }

  private calculateBenchmarkScore(benchmark: BenchmarkResult): number {
    if (!benchmark.completed) return 30;

    let score = 50;

    // FPS scoring
    if (benchmark.averageFPS >= 60) score += 25;
    else if (benchmark.averageFPS >= 45) score += 15;
    else if (benchmark.averageFPS >= 30) score += 5;
    else score -= 20;

    // Frame time consistency scoring
    if (benchmark.frameTimeVariance < 2) score += 15;
    else if (benchmark.frameTimeVariance < 5) score += 5;
    else if (benchmark.frameTimeVariance > 10) score -= 15;

    // Render time scoring
    if (benchmark.renderTime < 8) score += 10;
    else if (benchmark.renderTime < 16) score += 5;
    else if (benchmark.renderTime > 25) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private createCapabilitiesFromScore(score: number): DeviceCapabilities {
    let recommendedQuality: QualityLevel;
    let memoryLevel: 'low' | 'medium' | 'high';
    let renderingCapability: 'basic' | 'standard' | 'enhanced';

    if (score >= 80) {
      recommendedQuality = this.qualityLevels.high;
      memoryLevel = 'high';
      renderingCapability = 'enhanced';
    } else if (score >= 60) {
      recommendedQuality = this.qualityLevels.medium;
      memoryLevel = 'medium';
      renderingCapability = 'standard';
    } else if (score >= 40) {
      recommendedQuality = this.qualityLevels.low;
      memoryLevel = 'medium';
      renderingCapability = 'standard';
    } else {
      recommendedQuality = this.qualityLevels.minimal;
      memoryLevel = 'low';
      renderingCapability = 'basic';
    }

    return {
      performanceScore: score,
      memoryLevel,
      renderingCapability,
      recommendedQuality,
      maxParticles: recommendedQuality.particleCount,
      maxObjects: Math.floor(recommendedQuality.particleCount * 2),
      canHandleEffects: recommendedQuality.effectsEnabled
    };
  }

  /**
   * Get quality level by name
   */
  public getQualityLevel(name: string): QualityLevel | null {
    return this.qualityLevels[name] || null;
  }

  /**
   * Get all available quality levels
   */
  public getAllQualityLevels(): QualityLevel[] {
    return Object.values(this.qualityLevels);
  }

  /**
   * Get current device capabilities (null if not yet detected)
   */
  public getCurrentCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  /**
   * Force re-detection of capabilities
   */
  public async redetectCapabilities(scene?: Phaser.Scene): Promise<DeviceCapabilities> {
    this.capabilities = null;
    return this.detectCapabilities(scene);
  }
}