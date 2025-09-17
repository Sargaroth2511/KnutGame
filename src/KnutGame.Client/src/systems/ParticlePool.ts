import Phaser from 'phaser'
import { MAX_PARTICLES } from '../gameConfig'
import { EnhancedObjectPool, PoolStats, DEFAULT_POOL_CONFIG } from './EnhancedObjectPool'

/**
 * Base configuration options for spawning particles.
 * Defines common properties shared by all particle types.
 */
interface ParticleSpawnOptions {
  /** X coordinate where the particle should spawn */
  x: number;
  /** Y coordinate where the particle should spawn */
  y: number;
  /** Color of the particle (hex value) */
  color?: number;
  /** Alpha transparency of the particle (0-1) */
  alpha?: number;
  /** Rendering depth/layer of the particle */
  depth?: number;
  /** Horizontal velocity for particle movement */
  velocityX?: number;
  /** Vertical velocity for particle movement */
  velocityY?: number;
  /** Duration of the particle animation in milliseconds */
  duration?: number;
}

/**
 * Configuration options for spawning rectangle particles.
 * Extends base particle options with rectangle-specific properties.
 */
interface RectangleSpawnOptions extends ParticleSpawnOptions {
  /** Width of the rectangle particle */
  width?: number;
  /** Height of the rectangle particle */
  height?: number;
}

/**
 * Configuration options for spawning ellipse particles.
 * Extends base particle options with ellipse-specific properties.
 */
interface EllipseSpawnOptions extends ParticleSpawnOptions {
  /** Horizontal radius of the ellipse particle */
  radiusX?: number;
  /** Vertical radius of the ellipse particle */
  radiusY?: number;
}

/**
 * Counts of objects in different particle pools.
 * Used for monitoring pool usage and performance.
 */
interface PoolCounts {
  /** Number of rectangle particles in the pool */
  rectangles: number;
  /** Number of ellipse particles in the pool */
  ellipses: number;
  /** Number of extra registered objects in the pool */
  extra: number;
}

/**
 * Manages object pooling for particle effects to improve performance.
 * Reuses particle objects instead of creating/destroying them frequently.
 * Supports rectangle and ellipse particles with customizable animations.
 * Enhanced with intelligent pool management and memory optimization.
 */
export class ParticlePool {
  private readonly scene: Phaser.Scene;
  private readonly rectanglePool: EnhancedObjectPool<Phaser.GameObjects.Rectangle>;
  private readonly ellipsePool: EnhancedObjectPool<Phaser.GameObjects.Ellipse>;
  private readonly extraPool: Phaser.GameObjects.GameObject[] = [];
  private activeParticleCount = 0;

  /**
   * Creates a new ParticlePool instance
   * @param scene - The Phaser scene this pool belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Initialize enhanced pools for rectangles and ellipses
    this.rectanglePool = new EnhancedObjectPool(
      () => this.createRectangle(),
      (rect) => this.resetRectangle(rect),
      (rect) => this.destroyRectangle(rect),
      {
        ...DEFAULT_POOL_CONFIG,
        initialSize: 20,
        maxSize: Math.floor(MAX_PARTICLES * 0.7), // 70% for rectangles
        minSize: 10
      }
    );
    
    this.ellipsePool = new EnhancedObjectPool(
      () => this.createEllipse(),
      (ellipse) => this.resetEllipse(ellipse),
      (ellipse) => this.destroyEllipse(ellipse),
      {
        ...DEFAULT_POOL_CONFIG,
        initialSize: 10,
        maxSize: Math.floor(MAX_PARTICLES * 0.3), // 30% for ellipses
        minSize: 5
      }
    );
  }

  /**
   * Checks if we can spawn the specified number of particles.
   * Respects the MAX_PARTICLES limit to prevent performance issues.
   * @param requestedCount - Number of particles to check for (defaults to 1)
   * @returns True if spawning is allowed, false if it would exceed limits
   */
  private canSpawn(requestedCount = 1): boolean {
    return this.activeParticleCount + requestedCount <= MAX_PARTICLES;
  }

  /**
   * Creates a new rectangle particle.
   * @returns A new rectangle particle
   * @private
   */
  private createRectangle(): Phaser.GameObjects.Rectangle {
    const rectangle = this.scene.add.rectangle(0, 0, 2, 2, 0xffffff, 1);
    rectangle.setDepth(900);
    return rectangle;
  }

  /**
   * Creates a new ellipse particle.
   * @returns A new ellipse particle
   * @private
   */
  private createEllipse(): Phaser.GameObjects.Ellipse {
    const ellipse = this.scene.add.ellipse(0, 0, 4, 4, 0xffffff, 1);
    ellipse.setDepth(900);
    return ellipse;
  }

  /**
   * Resets a rectangle particle for reuse.
   * @param rectangle - The rectangle to reset
   * @private
   */
  private resetRectangle(rectangle: Phaser.GameObjects.Rectangle): void {
    rectangle.setActive(false);
    rectangle.setVisible(false);
    rectangle.setAlpha(1);
    rectangle.setPosition(0, 0);
    rectangle.setSize(2, 2);
    rectangle.setFillStyle(0xffffff, 1);
    
    // Kill any existing tweens
    try {
      this.scene.tweens?.killTweensOf?.(rectangle);
    } catch (error) {
      console.warn('Failed to kill tweens for rectangle particle:', error);
    }
  }

  /**
   * Resets an ellipse particle for reuse.
   * @param ellipse - The ellipse to reset
   * @private
   */
  private resetEllipse(ellipse: Phaser.GameObjects.Ellipse): void {
    ellipse.setActive(false);
    ellipse.setVisible(false);
    ellipse.setAlpha(1);
    ellipse.setPosition(0, 0);
    ellipse.setSize(4, 4);
    ellipse.setFillStyle(0xffffff, 1);
    
    // Kill any existing tweens
    try {
      this.scene.tweens?.killTweensOf?.(ellipse);
    } catch (error) {
      console.warn('Failed to kill tweens for ellipse particle:', error);
    }
  }

  /**
   * Destroys a rectangle particle.
   * @param rectangle - The rectangle to destroy
   * @private
   */
  private destroyRectangle(rectangle: Phaser.GameObjects.Rectangle): void {
    try {
      this.scene.tweens?.killTweensOf?.(rectangle);
      rectangle.destroy?.();
    } catch (error) {
      console.warn('Failed to destroy rectangle particle:', error);
    }
  }

  /**
   * Destroys an ellipse particle.
   * @param ellipse - The ellipse to destroy
   * @private
   */
  private destroyEllipse(ellipse: Phaser.GameObjects.Ellipse): void {
    try {
      this.scene.tweens?.killTweensOf?.(ellipse);
      ellipse.destroy?.();
    } catch (error) {
      console.warn('Failed to destroy ellipse particle:', error);
    }
  }

  /**
   * Acquires a rectangle from the enhanced pool.
   * @returns A rectangle particle ready for use
   * @private
   */
  private acquireRectangle(): Phaser.GameObjects.Rectangle {
    return this.rectanglePool.acquire();
  }

  /**
   * Acquires an ellipse from the enhanced pool.
   * @returns An ellipse particle ready for use
   * @private
   */
  private acquireEllipse(): Phaser.GameObjects.Ellipse {
    return this.ellipsePool.acquire();
  }

  /**
   * Releases a particle back to the appropriate enhanced pool.
   * @param particle - The particle to release back to the pool
   * @private
   */
  private releaseParticle(particle: Phaser.GameObjects.GameObject): void {
    this.activeParticleCount = Math.max(0, this.activeParticleCount - 1);

    if (particle instanceof Phaser.GameObjects.Rectangle) {
      this.rectanglePool.release(particle);
    } else if (particle instanceof Phaser.GameObjects.Ellipse) {
      this.ellipsePool.release(particle);
    } else {
      // Fallback for unknown particle types
      try {
        this.scene.tweens?.killTweensOf?.(particle);
        particle.destroy?.();
      } catch (error) {
        console.warn('Failed to destroy unknown particle type:', error);
      }
    }
  }

  /**
   * Spawns a rectangle particle with animation.
   * Creates a rectangle particle at the specified position with customizable properties.
   * @param options - Configuration options for the rectangle particle
   */
  spawnRectangle(options: RectangleSpawnOptions): void {
    if (!this.canSpawn()) {
      return;
    }

    const rectangle = this.acquireRectangle();
    this.initializeParticle(rectangle, options);

    rectangle.setSize(options.width ?? 3, options.height ?? 3);
    rectangle.setFillStyle(options.color ?? 0xffffff, options.alpha ?? 1);

    this.animateParticle(rectangle, options, 200, 400);
  }

  /**
   * Spawns a rectangle particle with animation (legacy method for backward compatibility).
   * @deprecated Use spawnRectangle() instead for better type safety
   * @param opts - Legacy configuration options with abbreviated property names
   */
  spawnRect(opts: { x: number, y: number, w?: number, h?: number, color?: number, alpha?: number, depth?: number, dx?: number, dy?: number, duration?: number }): void {
    this.spawnRectangle({
      x: opts.x,
      y: opts.y,
      width: opts.w,
      height: opts.h,
      color: opts.color,
      alpha: opts.alpha,
      depth: opts.depth,
      velocityX: opts.dx,
      velocityY: opts.dy,
      duration: opts.duration
    });
  }

  /**
   * Spawns an ellipse particle with animation (legacy method for backward compatibility).
   * @deprecated Use spawnEllipse() instead for better type safety
   * @param opts - Legacy configuration options with abbreviated property names
   */
  spawnEllipse(opts: { x: number, y: number, rx?: number, ry?: number, color?: number, alpha?: number, depth?: number, dx?: number, dy?: number, duration?: number }): void {
    this.spawnEllipseInternal({
      x: opts.x,
      y: opts.y,
      radiusX: opts.rx,
      radiusY: opts.ry,
      color: opts.color,
      alpha: opts.alpha,
      depth: opts.depth,
      velocityX: opts.dx,
      velocityY: opts.dy,
      duration: opts.duration
    });
  }

  /**
   * Internal method to spawn ellipse particles.
   * Creates an ellipse particle at the specified position with customizable properties.
   * @param options - Configuration options for the ellipse particle
   */
  private spawnEllipseInternal(options: EllipseSpawnOptions): void {
    if (!this.canSpawn()) {
      return;
    }

    const ellipse = this.acquireEllipse();
    this.initializeParticle(ellipse, options);

    ellipse.setSize(options.radiusX ?? 6, options.radiusY ?? 6);
    ellipse.setFillStyle(options.color ?? 0xffffff, options.alpha ?? 1);

    this.animateParticle(ellipse, options, 300, 600);
  }

  /**
   * Initializes common particle properties.
   * Sets up position, visibility, depth, and alpha for a newly spawned particle.
   * @param particle - The particle to initialize
   * @param options - Configuration options containing initial properties
   */
  private initializeParticle(
    particle: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse,
    options: ParticleSpawnOptions
  ): void {
    particle.setActive(true).setVisible(true);
    particle.setPosition(options.x, options.y);

    if (options.depth !== undefined) {
      particle.setDepth(options.depth);
    }

    particle.setAlpha(options.alpha ?? 1);
  }

  /**
   * Animates a particle with tween.
   * Creates a movement and fade animation that automatically releases the particle when complete.
   * @param particle - The particle to animate
   * @param options - Configuration options for animation properties
   * @param minDuration - Minimum animation duration in milliseconds
   * @param maxDuration - Maximum animation duration in milliseconds
   */
  private animateParticle(
    particle: Phaser.GameObjects.GameObject,
    options: ParticleSpawnOptions,
    minDuration: number,
    maxDuration: number
  ): void {
    const velocityX = options.velocityX ?? Phaser.Math.Between(-20, 20);
    const velocityY = options.velocityY ?? Phaser.Math.Between(-20, 20);
    const duration = options.duration ?? Phaser.Math.Between(minDuration, maxDuration);

    this.activeParticleCount++;

    const spriteParticle = particle as Phaser.GameObjects.Sprite;

    this.scene.tweens.add({
      targets: spriteParticle,
      x: spriteParticle.x + velocityX,
      y: spriteParticle.y + velocityY,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.releaseParticle(particle)
    });
  }

  /**
   * Registers an additional particle-like object for cleanup.
   * Allows external objects to be managed by the pool's destroy method.
   * @param additionalObject - The object to register for cleanup
   */
  register(additionalObject: Phaser.GameObjects.GameObject): void {
    this.extraPool.push(additionalObject);
  }

  /**
   * Gets the current count of active particles.
   * Useful for performance monitoring and debugging.
   * @returns Number of currently active particles
   */
  getActiveCount(): number {
    return this.activeParticleCount;
  }

  /**
   * Gets the counts of pooled objects.
   * Provides insight into pool utilization for optimization.
   * @returns Object containing counts for each pool type
   */
  getPooledCounts(): PoolCounts {
    const rectStats = this.rectanglePool.getStats();
    const ellipseStats = this.ellipsePool.getStats();
    
    return {
      rectangles: rectStats.poolSize,
      ellipses: ellipseStats.poolSize,
      extra: this.extraPool.length
    };
  }

  /**
   * Gets detailed performance statistics for all pools.
   * @returns Comprehensive pool performance data
   */
  getPoolStats(): {
    rectangles: PoolStats;
    ellipses: PoolStats;
    totalActive: number;
    memoryEfficiency: number;
  } {
    const rectStats = this.rectanglePool.getStats();
    const ellipseStats = this.ellipsePool.getStats();
    
    const totalReused = rectStats.totalReused + ellipseStats.totalReused;
    const totalCreated = rectStats.totalCreated + ellipseStats.totalCreated;
    const memoryEfficiency = totalCreated > 0 ? totalReused / totalCreated : 1;
    
    return {
      rectangles: rectStats,
      ellipses: ellipseStats,
      totalActive: this.activeParticleCount,
      memoryEfficiency
    };
  }

  /**
   * Forces optimization of pool sizes based on usage patterns.
   */
  optimizePools(): void {
    this.rectanglePool.adjustPoolSize();
    this.ellipsePool.adjustPoolSize();
  }

  /**
   * Gets memory pressure indicator for the particle system.
   * @returns Memory pressure value (0-1, higher = more pressure)
   */
  getMemoryPressure(): number {
    const rectStats = this.rectanglePool.getStats();
    const ellipseStats = this.ellipsePool.getStats();
    
    return Math.max(rectStats.memoryPressure, ellipseStats.memoryPressure);
  }

  /**
   * Destroys all pooled objects and resets counters.
   * Should be called when the scene is shutting down to prevent memory leaks.
   * Safely handles tween cleanup and error conditions.
   */
  destroy(): void {
    this.rectanglePool.destroy();
    this.ellipsePool.destroy();
    this.destroyPool(this.extraPool);

    this.extraPool.length = 0;
    this.activeParticleCount = 0;
  }

  /**
   * Safely destroys a pool of objects.
   * Handles tween cleanup and error conditions gracefully.
   * @param pool - Array of game objects to destroy
   */
  private destroyPool(pool: Phaser.GameObjects.GameObject[]): void {
    for (const gameObject of pool) {
      try {
        // Kill any active tweens
        (this.scene as any).tweens?.killTweensOf?.(gameObject);
      } catch (error) {
        console.warn('Failed to kill tweens for particle:', error);
      }

      try {
        // Destroy the object
        (gameObject as any).destroy?.();
      } catch (error) {
        console.warn('Failed to destroy particle:', error);
      }
    }
  }
}

