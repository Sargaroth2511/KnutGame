import { PoolStats } from './EnhancedObjectPool'
import { ParticlePool } from './ParticlePool'
import { EnhancedObstacleSpawner, EnhancedItemSpawner } from './EnhancedSpawner'

/**
 * Comprehensive pool statistics for all managed pools.
 */
export interface SystemPoolStats {
  particles: {
    rectangles: PoolStats
    ellipses: PoolStats
    totalActive: number
    memoryEfficiency: number
  }
  obstacles: PoolStats
  items: PoolStats
  overall: {
    totalPooledObjects: number
    totalActiveObjects: number
    averageMemoryPressure: number
    systemMemoryEfficiency: number
  }
}

/**
 * Pool optimization recommendations based on usage analysis.
 */
export interface PoolOptimizationRecommendations {
  shouldOptimizeParticles: boolean
  shouldOptimizeObstacles: boolean
  shouldOptimizeItems: boolean
  memoryPressureLevel: 'low' | 'medium' | 'high'
  recommendedActions: string[]
}

/**
 * Centralized manager for all object pools in the game.
 * Provides system-wide pool monitoring, optimization, and memory management.
 */
export class PoolManager {
  private particlePool?: ParticlePool
  private obstacleSpawner?: EnhancedObstacleSpawner
  private itemSpawner?: EnhancedItemSpawner
  private lastOptimizationTime = 0
  private optimizationInterval = 10000 // 10 seconds

  /**
   * Registers the particle pool for management.
   * @param pool - The particle pool to manage
   */
  registerParticlePool(pool: ParticlePool): void {
    this.particlePool = pool
  }

  /**
   * Registers the obstacle spawner for management.
   * @param spawner - The obstacle spawner to manage
   */
  registerObstacleSpawner(spawner: EnhancedObstacleSpawner): void {
    this.obstacleSpawner = spawner
  }

  /**
   * Registers the item spawner for management.
   * @param spawner - The item spawner to manage
   */
  registerItemSpawner(spawner: EnhancedItemSpawner): void {
    this.itemSpawner = spawner
  }

  /**
   * Gets comprehensive statistics for all managed pools.
   * @returns System-wide pool statistics
   */
  getSystemStats(): SystemPoolStats {
    const particleStats = this.particlePool?.getPoolStats() || {
      rectangles: this.createEmptyStats(),
      ellipses: this.createEmptyStats(),
      totalActive: 0,
      memoryEfficiency: 1
    }

    const obstacleStats = this.obstacleSpawner?.getPoolStats() || this.createEmptyStats()
    const itemStats = this.itemSpawner?.getPoolStats() || this.createEmptyStats()

    const totalPooledObjects = 
      particleStats.rectangles.poolSize + 
      particleStats.ellipses.poolSize + 
      obstacleStats.poolSize + 
      itemStats.poolSize

    const totalActiveObjects = 
      particleStats.totalActive + 
      obstacleStats.activeCount + 
      itemStats.activeCount

    const averageMemoryPressure = this.calculateAverageMemoryPressure([
      particleStats.rectangles.memoryPressure,
      particleStats.ellipses.memoryPressure,
      obstacleStats.memoryPressure,
      itemStats.memoryPressure
    ])

    const systemMemoryEfficiency = this.calculateSystemMemoryEfficiency([
      particleStats.memoryEfficiency,
      this.calculateMemoryEfficiency(obstacleStats),
      this.calculateMemoryEfficiency(itemStats)
    ])

    return {
      particles: particleStats,
      obstacles: obstacleStats,
      items: itemStats,
      overall: {
        totalPooledObjects,
        totalActiveObjects,
        averageMemoryPressure,
        systemMemoryEfficiency
      }
    }
  }

  /**
   * Analyzes pool usage and provides optimization recommendations.
   * @returns Optimization recommendations
   */
  getOptimizationRecommendations(): PoolOptimizationRecommendations {
    const stats = this.getSystemStats()
    const recommendations: string[] = []
    
    const shouldOptimizeParticles = this.shouldOptimizePool(stats.particles.rectangles) || 
                                   this.shouldOptimizePool(stats.particles.ellipses)
    const shouldOptimizeObstacles = this.shouldOptimizePool(stats.obstacles)
    const shouldOptimizeItems = this.shouldOptimizePool(stats.items)

    if (shouldOptimizeParticles) {
      recommendations.push('Optimize particle pools - high memory pressure or poor utilization detected')
    }
    
    if (shouldOptimizeObstacles) {
      recommendations.push('Optimize obstacle pool - consider adjusting pool size based on usage patterns')
    }
    
    if (shouldOptimizeItems) {
      recommendations.push('Optimize item pool - pool size may need adjustment')
    }

    const memoryPressureLevel = this.getMemoryPressureLevel(stats.overall.averageMemoryPressure)
    
    if (memoryPressureLevel === 'high') {
      recommendations.push('High memory pressure detected - consider reducing pool sizes or triggering garbage collection')
    } else if (memoryPressureLevel === 'medium') {
      recommendations.push('Moderate memory pressure - monitor pool usage closely')
    }

    if (stats.overall.systemMemoryEfficiency < 0.7) {
      recommendations.push('Low memory efficiency - pools are creating too many new objects instead of reusing')
    }

    return {
      shouldOptimizeParticles,
      shouldOptimizeObstacles,
      shouldOptimizeItems,
      memoryPressureLevel,
      recommendedActions: recommendations
    }
  }

  /**
   * Performs system-wide pool optimization.
   * @param force - Force optimization even if not due
   */
  optimizeAllPools(force: boolean = false): void {
    const now = Date.now()
    
    if (!force && now - this.lastOptimizationTime < this.optimizationInterval) {
      return
    }

    const recommendations = this.getOptimizationRecommendations()
    
    if (recommendations.shouldOptimizeParticles) {
      this.particlePool?.optimizePools()
    }
    
    if (recommendations.shouldOptimizeObstacles) {
      this.obstacleSpawner?.optimizePool()
    }
    
    if (recommendations.shouldOptimizeItems) {
      this.itemSpawner?.optimizePool()
    }

    this.lastOptimizationTime = now
  }

  /**
   * Gets the current memory pressure level across all pools.
   * @returns Memory pressure level
   */
  getSystemMemoryPressure(): 'low' | 'medium' | 'high' {
    const stats = this.getSystemStats()
    return this.getMemoryPressureLevel(stats.overall.averageMemoryPressure)
  }

  /**
   * Triggers emergency memory cleanup when memory pressure is critical.
   */
  emergencyCleanup(): void {
    console.warn('PoolManager: Performing emergency memory cleanup')
    
    // Force optimization of all pools
    this.particlePool?.optimizePools()
    this.obstacleSpawner?.optimizePool()
    this.itemSpawner?.optimizePool()
    
    // Suggest garbage collection if available
    if ((globalThis as any).gc) {
      try {
        (globalThis as any).gc()
      } catch (error) {
        console.warn('Failed to trigger garbage collection:', error)
      }
    }
  }

  /**
   * Destroys all managed pools.
   */
  destroy(): void {
    this.particlePool?.destroy()
    this.obstacleSpawner?.destroy()
    this.itemSpawner?.destroy()
    
    this.particlePool = undefined
    this.obstacleSpawner = undefined
    this.itemSpawner = undefined
  }

  /**
   * Creates empty pool statistics for unregistered pools.
   * @returns Empty pool statistics
   * @private
   */
  private createEmptyStats(): PoolStats {
    return {
      poolSize: 0,
      activeCount: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalReused: 0,
      utilizationRatio: 0,
      requestRate: 0,
      peakActiveCount: 0,
      memoryPressure: 0
    }
  }

  /**
   * Calculates average memory pressure from multiple pools.
   * @param pressures - Array of memory pressure values
   * @returns Average memory pressure
   * @private
   */
  private calculateAverageMemoryPressure(pressures: number[]): number {
    const validPressures = pressures.filter(p => p >= 0)
    return validPressures.length > 0 
      ? validPressures.reduce((sum, p) => sum + p, 0) / validPressures.length 
      : 0
  }

  /**
   * Calculates system-wide memory efficiency.
   * @param efficiencies - Array of memory efficiency values
   * @returns System memory efficiency
   * @private
   */
  private calculateSystemMemoryEfficiency(efficiencies: number[]): number {
    const validEfficiencies = efficiencies.filter(e => e >= 0 && e <= 1)
    return validEfficiencies.length > 0 
      ? validEfficiencies.reduce((sum, e) => sum + e, 0) / validEfficiencies.length 
      : 1
  }

  /**
   * Calculates memory efficiency for a single pool.
   * @param stats - Pool statistics
   * @returns Memory efficiency ratio
   * @private
   */
  private calculateMemoryEfficiency(stats: PoolStats): number {
    const totalOperations = stats.totalCreated + stats.totalReused
    return totalOperations > 0 ? stats.totalReused / totalOperations : 1
  }

  /**
   * Determines if a pool should be optimized based on its statistics.
   * @param stats - Pool statistics
   * @returns True if optimization is recommended
   * @private
   */
  private shouldOptimizePool(stats: PoolStats): boolean {
    return stats.memoryPressure > 0.7 || 
           stats.utilizationRatio > 0.9 || 
           stats.utilizationRatio < 0.1 ||
           this.calculateMemoryEfficiency(stats) < 0.6
  }

  /**
   * Converts numeric memory pressure to level.
   * @param pressure - Memory pressure value (0-1)
   * @returns Memory pressure level
   * @private
   */
  private getMemoryPressureLevel(pressure: number): 'low' | 'medium' | 'high' {
    if (pressure > 0.8) return 'high'
    if (pressure > 0.5) return 'medium'
    return 'low'
  }
}