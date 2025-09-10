import Phaser from 'phaser'
import { MAX_PARTICLES } from '../gameConfig'

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
 */
export class ParticlePool {
  private readonly scene: Phaser.Scene;
  private readonly rectanglePool: Phaser.GameObjects.Rectangle[] = [];
  private readonly ellipsePool: Phaser.GameObjects.Ellipse[] = [];
  private readonly extraPool: Phaser.GameObjects.GameObject[] = [];
  private activeParticleCount = 0;

  /**
   * Creates a new ParticlePool instance
   * @param scene - The Phaser scene this pool belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
   * Acquires a rectangle from the pool or creates a new one.
   * Reuses existing rectangles when available to improve performance.
   * @returns A rectangle particle ready for use
   */
  private acquireRectangle(): Phaser.GameObjects.Rectangle {
    const pooledRectangle = this.rectanglePool.pop();
    if (pooledRectangle) {
      return pooledRectangle;
    }

    const newRectangle = this.scene.add.rectangle(0, 0, 2, 2, 0xffffff, 1);
    newRectangle.setDepth(900);
    return newRectangle;
  }

  /**
   * Acquires an ellipse from the pool or creates a new one.
   * Reuses existing ellipses when available to improve performance.
   * @returns An ellipse particle ready for use
   */
  private acquireEllipse(): Phaser.GameObjects.Ellipse {
    const pooledEllipse = this.ellipsePool.pop();
    if (pooledEllipse) {
      return pooledEllipse;
    }

    const newEllipse = this.scene.add.ellipse(0, 0, 4, 4, 0xffffff, 1);
    newEllipse.setDepth(900);
    return newEllipse;
  }

  /**
   * Releases a particle back to the appropriate pool.
   * Resets the particle state and makes it available for reuse.
   * @param particle - The particle to release back to the pool
   */
  private releaseParticle(particle: Phaser.GameObjects.GameObject): void {
    this.activeParticleCount = Math.max(0, this.activeParticleCount - 1);
    particle.setActive(false);
    (particle as any).visible = false;

    if (particle instanceof Phaser.GameObjects.Rectangle) {
      this.rectanglePool.push(particle);
    } else if (particle instanceof Phaser.GameObjects.Ellipse) {
      this.ellipsePool.push(particle);
    } else {
      // Fallback for unknown particle types
      particle.destroy();
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
    return {
      rectangles: this.rectanglePool.length,
      ellipses: this.ellipsePool.length,
      extra: this.extraPool.length
    };
  }

  /**
   * Destroys all pooled objects and resets counters.
   * Should be called when the scene is shutting down to prevent memory leaks.
   * Safely handles tween cleanup and error conditions.
   */
  destroy(): void {
    this.destroyPool(this.rectanglePool);
    this.destroyPool(this.ellipsePool);
    this.destroyPool(this.extraPool);

    this.rectanglePool.length = 0;
    this.ellipsePool.length = 0;
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

