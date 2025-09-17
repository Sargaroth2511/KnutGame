import Phaser from 'phaser'

/**
 * Configuration options for enhanced object pooling.
 */
export interface PoolConfig {
  /** Initial pool size to pre-allocate */
  initialSize: number
  /** Maximum pool size before objects are destroyed instead of pooled */
  maxSize: number
  /** Minimum pool size to maintain (will create objects if below this) */
  minSize: number
  /** Enable automatic pool size adjustment based on usage patterns */
  autoAdjust: boolean
  /** Time window for usage tracking (milliseconds) */
  usageTrackingWindow: number
  /** Growth factor when expanding pool (1.5 = 50% increase) */
  growthFactor: number
  /** Shrink factor when reducing pool (0.8 = 20% decrease) */
  shrinkFactor: number
}

/**
 * Default pool configuration with conservative settings.
 */
export const DEFAULT_POOL_CONFIG: PoolConfig = {
  initialSize: 10,
  maxSize: 100,
  minSize: 5,
  autoAdjust: true,
  usageTrackingWindow: 10000, // 10 seconds
  growthFactor: 1.5,
  shrinkFactor: 0.8
}

/**
 * Pool usage statistics for monitoring and optimization.
 */
export interface PoolStats {
  /** Current number of objects in the pool */
  poolSize: number
  /** Current number of active (in-use) objects */
  activeCount: number
  /** Total objects created since pool creation */
  totalCreated: number
  /** Total objects destroyed since pool creation */
  totalDestroyed: number
  /** Total objects reused from pool */
  totalReused: number
  /** Current pool utilization ratio (0-1) */
  utilizationRatio: number
  /** Average objects requested per second */
  requestRate: number
  /** Peak active count in current tracking window */
  peakActiveCount: number
  /** Memory pressure indicator (0-1, higher = more pressure) */
  memoryPressure: number
}

/**
 * Usage tracking entry for pool optimization.
 */
interface UsageEntry {
  timestamp: number
  activeCount: number
  requestCount: number
}

/**
 * Factory function type for creating new objects.
 */
export type ObjectFactory<T> = () => T

/**
 * Reset function type for preparing objects for reuse.
 */
export type ObjectReset<T> = (obj: T) => void

/**
 * Destroy function type for cleaning up objects.
 */
export type ObjectDestroy<T> = (obj: T) => void

/**
 * Enhanced object pool with automatic size management and performance monitoring.
 * Provides intelligent pooling with usage tracking and memory pressure awareness.
 */
export class EnhancedObjectPool<T> {
  private readonly config: PoolConfig
  private readonly factory: ObjectFactory<T>
  private readonly resetFn: ObjectReset<T>
  private readonly destroyFn: ObjectDestroy<T>
  
  private readonly pool: T[] = []
  private readonly activeObjects = new Set<T>()
  private readonly usageHistory: UsageEntry[] = []
  
  private totalCreated = 0
  private totalDestroyed = 0
  private totalReused = 0
  private peakActiveCount = 0
  private lastAdjustmentTime = 0
  private requestCount = 0

  /**
   * Creates a new enhanced object pool.
   * @param factory - Function to create new objects
   * @param resetFn - Function to reset objects for reuse
   * @param destroyFn - Function to destroy objects
   * @param config - Pool configuration options
   */
  constructor(
    factory: ObjectFactory<T>,
    resetFn: ObjectReset<T>,
    destroyFn: ObjectDestroy<T>,
    config: Partial<PoolConfig> = {}
  ) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config }
    this.factory = factory
    this.resetFn = resetFn
    this.destroyFn = destroyFn
    
    this.preAllocate()
  }

  /**
   * Acquires an object from the pool or creates a new one.
   * Tracks usage for automatic pool adjustment.
   * @returns An object ready for use
   */
  acquire(): T {
    this.requestCount++
    this.trackUsage()
    
    let obj = this.pool.pop()
    
    if (obj) {
      this.totalReused++
    } else {
      obj = this.factory()
      this.totalCreated++
    }
    
    this.resetFn(obj)
    this.activeObjects.add(obj)
    
    // Update peak tracking
    if (this.activeObjects.size > this.peakActiveCount) {
      this.peakActiveCount = this.activeObjects.size
    }
    
    // Trigger adjustment if needed
    if (this.config.autoAdjust) {
      this.considerAdjustment()
    }
    
    return obj
  }

  /**
   * Releases an object back to the pool.
   * @param obj - The object to release
   */
  release(obj: T): void {
    if (!this.activeObjects.has(obj)) {
      console.warn('Attempted to release object not acquired from this pool')
      return
    }
    
    this.activeObjects.delete(obj)
    
    if (this.pool.length < this.config.maxSize) {
      this.pool.push(obj)
    } else {
      // Pool is full, destroy the object
      this.destroyFn(obj)
      this.totalDestroyed++
    }
  }

  /**
   * Gets current pool statistics.
   * @returns Pool usage and performance statistics
   */
  getStats(): PoolStats {
    const now = Date.now()
    const recentEntries = this.usageHistory.filter(
      entry => now - entry.timestamp <= this.config.usageTrackingWindow
    )
    
    const requestRate = recentEntries.length > 0 
      ? recentEntries.reduce((sum, entry) => sum + entry.requestCount, 0) / (this.config.usageTrackingWindow / 1000)
      : 0
    
    const utilizationRatio = this.config.maxSize > 0 
      ? this.activeObjects.size / this.config.maxSize 
      : 0
    
    const memoryPressure = this.calculateMemoryPressure()
    
    return {
      poolSize: this.pool.length,
      activeCount: this.activeObjects.size,
      totalCreated: this.totalCreated,
      totalDestroyed: this.totalDestroyed,
      totalReused: this.totalReused,
      utilizationRatio,
      requestRate,
      peakActiveCount: this.peakActiveCount,
      memoryPressure
    }
  }

  /**
   * Forces pool size adjustment based on current usage patterns.
   */
  adjustPoolSize(): void {
    const stats = this.getStats()
    const targetSize = this.calculateOptimalPoolSize(stats)
    
    if (targetSize > this.pool.length) {
      // Grow pool
      const toCreate = Math.min(targetSize - this.pool.length, this.config.maxSize - this.pool.length)
      for (let i = 0; i < toCreate; i++) {
        const obj = this.factory()
        this.pool.push(obj)
        this.totalCreated++
      }
    } else if (targetSize < this.pool.length && this.pool.length > this.config.minSize) {
      // Shrink pool
      const toRemove = Math.min(this.pool.length - targetSize, this.pool.length - this.config.minSize)
      for (let i = 0; i < toRemove; i++) {
        const obj = this.pool.pop()
        if (obj) {
          this.destroyFn(obj)
          this.totalDestroyed++
        }
      }
    }
    
    this.lastAdjustmentTime = Date.now()
  }

  /**
   * Destroys all objects and clears the pool.
   */
  destroy(): void {
    // Destroy pooled objects
    for (const obj of this.pool) {
      try {
        this.destroyFn(obj)
      } catch (error) {
        console.warn('Failed to destroy pooled object:', error)
      }
    }
    
    // Destroy active objects (they should be released first, but safety cleanup)
    for (const obj of this.activeObjects) {
      try {
        this.destroyFn(obj)
      } catch (error) {
        console.warn('Failed to destroy active object:', error)
      }
    }
    
    this.pool.length = 0
    this.activeObjects.clear()
    this.usageHistory.length = 0
  }

  /**
   * Pre-allocates initial pool objects.
   * @private
   */
  private preAllocate(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      const obj = this.factory()
      this.pool.push(obj)
      this.totalCreated++
    }
  }

  /**
   * Tracks usage patterns for pool optimization.
   * @private
   */
  private trackUsage(): void {
    const now = Date.now()
    
    // Add current usage entry
    this.usageHistory.push({
      timestamp: now,
      activeCount: this.activeObjects.size,
      requestCount: this.requestCount
    })
    
    // Clean old entries
    const cutoff = now - this.config.usageTrackingWindow
    while (this.usageHistory.length > 0 && this.usageHistory[0].timestamp < cutoff) {
      this.usageHistory.shift()
    }
    
    // Reset request count periodically
    if (this.usageHistory.length > 100) {
      this.requestCount = 0
    }
  }

  /**
   * Considers whether pool adjustment is needed.
   * @private
   */
  private considerAdjustment(): void {
    const now = Date.now()
    const timeSinceLastAdjustment = now - this.lastAdjustmentTime
    
    // Only adjust every few seconds to avoid thrashing
    if (timeSinceLastAdjustment < 5000) {
      return
    }
    
    const stats = this.getStats()
    
    // Adjust if utilization is very high or very low
    if (stats.utilizationRatio > 0.8 || stats.utilizationRatio < 0.2) {
      this.adjustPoolSize()
    }
  }

  /**
   * Calculates optimal pool size based on usage patterns.
   * @param stats - Current pool statistics
   * @returns Recommended pool size
   * @private
   */
  private calculateOptimalPoolSize(stats: PoolStats): number {
    // Base size on peak usage with some buffer
    const baseSize = Math.ceil(stats.peakActiveCount * 1.2)
    
    // Adjust based on request rate
    const rateAdjustment = Math.ceil(stats.requestRate * 0.1)
    
    // Adjust based on memory pressure
    const memoryAdjustment = stats.memoryPressure > 0.7 ? -Math.ceil(baseSize * 0.2) : 0
    
    const targetSize = baseSize + rateAdjustment + memoryAdjustment
    
    return Math.max(this.config.minSize, Math.min(targetSize, this.config.maxSize))
  }

  /**
   * Calculates memory pressure indicator.
   * @returns Memory pressure value (0-1)
   * @private
   */
  private calculateMemoryPressure(): number {
    // Simple heuristic based on pool utilization and creation rate
    const creationRate = this.totalCreated / Math.max(1, this.totalReused + this.totalCreated)
    const utilizationPressure = this.config.maxSize > 0 
      ? this.activeObjects.size / this.config.maxSize 
      : 0
    
    return Math.min(1, (creationRate * 0.6) + (utilizationPressure * 0.4))
  }
}