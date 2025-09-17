/**
 * Performance benchmarking system for measuring optimization impact
 */

/**
 * Represents a single benchmark measurement
 */
interface BenchmarkMeasurement {
  /** Name of the benchmark */
  name: string
  /** Start time in milliseconds */
  startTime: number
  /** End time in milliseconds */
  endTime: number
  /** Duration in milliseconds */
  duration: number
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Represents benchmark statistics over multiple runs
 */
interface BenchmarkStats {
  /** Name of the benchmark */
  name: string
  /** Number of measurements */
  count: number
  /** Average duration in milliseconds */
  average: number
  /** Minimum duration in milliseconds */
  min: number
  /** Maximum duration in milliseconds */
  max: number
  /** Standard deviation */
  stdDev: number
  /** 95th percentile */
  p95: number
  /** 99th percentile */
  p99: number
  /** Total time spent */
  total: number
}

/**
 * Configuration for performance benchmarking
 */
interface BenchmarkConfig {
  /** Maximum number of measurements to keep in memory */
  maxMeasurements: number
  /** Whether to log measurements to console */
  logToConsole: boolean
  /** Whether to track detailed statistics */
  trackStats: boolean
  /** Minimum duration to consider significant (ms) */
  significanceThreshold: number
}

/**
 * Performance benchmark system for measuring and analyzing optimization impact
 */
export class PerformanceBenchmark {
  private measurements: Map<string, BenchmarkMeasurement[]> = new Map()
  private activeBenchmarks: Map<string, number> = new Map()
  private config: BenchmarkConfig

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      maxMeasurements: 1000,
      logToConsole: false,
      trackStats: true,
      significanceThreshold: 0.1,
      ...config
    }
  }

  /**
   * Starts a benchmark measurement
   */
  start(name: string, metadata?: Record<string, any>): void {
    const startTime = performance.now()
    this.activeBenchmarks.set(name, startTime)
    
    if (metadata) {
      // Store metadata for when we end the benchmark
      this.activeBenchmarks.set(`${name}_metadata`, metadata as any)
    }
  }

  /**
   * Ends a benchmark measurement and records the result
   */
  end(name: string): BenchmarkMeasurement | null {
    const endTime = performance.now()
    const startTime = this.activeBenchmarks.get(name)
    
    if (startTime === undefined) {
      console.warn(`Benchmark '${name}' was not started`)
      return null
    }

    const duration = endTime - startTime
    const metadata = this.activeBenchmarks.get(`${name}_metadata`) as Record<string, any> | undefined

    const measurement: BenchmarkMeasurement = {
      name,
      startTime,
      endTime,
      duration,
      metadata
    }

    // Store the measurement
    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }

    const measurements = this.measurements.get(name)!
    measurements.push(measurement)

    // Limit memory usage
    if (measurements.length > this.config.maxMeasurements) {
      measurements.shift()
    }

    // Clean up active benchmarks
    this.activeBenchmarks.delete(name)
    this.activeBenchmarks.delete(`${name}_metadata`)

    if (this.config.logToConsole && duration >= this.config.significanceThreshold) {
      console.log(`Benchmark '${name}': ${duration.toFixed(3)}ms`, metadata || '')
    }

    return measurement
  }

  /**
   * Measures a synchronous function
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.start(name, metadata)
    try {
      const result = fn()
      return result
    } finally {
      this.end(name)
    }
  }

  /**
   * Measures an asynchronous function
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    this.start(name, metadata)
    try {
      const result = await fn()
      return result
    } finally {
      this.end(name)
    }
  }

  /**
   * Gets statistics for a benchmark
   */
  getStats(name: string): BenchmarkStats | null {
    const measurements = this.measurements.get(name)
    if (!measurements || measurements.length === 0) {
      return null
    }

    const durations = measurements.map(m => m.duration).sort((a, b) => a - b)
    const count = durations.length
    const total = durations.reduce((sum, d) => sum + d, 0)
    const average = total / count
    const min = durations[0]
    const max = durations[count - 1]

    // Calculate standard deviation
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / count
    const stdDev = Math.sqrt(variance)

    // Calculate percentiles
    const p95Index = Math.floor(count * 0.95)
    const p99Index = Math.floor(count * 0.99)
    const p95 = durations[Math.min(p95Index, count - 1)]
    const p99 = durations[Math.min(p99Index, count - 1)]

    return {
      name,
      count,
      average,
      min,
      max,
      stdDev,
      p95,
      p99,
      total
    }
  }

  /**
   * Gets all available benchmark names
   */
  getBenchmarkNames(): string[] {
    return Array.from(this.measurements.keys())
  }

  /**
   * Gets recent measurements for a benchmark
   */
  getRecentMeasurements(name: string, count: number = 10): BenchmarkMeasurement[] {
    const measurements = this.measurements.get(name)
    if (!measurements) {
      return []
    }
    return measurements.slice(-count)
  }

  /**
   * Compares two benchmarks and returns the performance difference
   */
  compare(nameA: string, nameB: string): {
    benchmarkA: BenchmarkStats | null
    benchmarkB: BenchmarkStats | null
    improvement: number | null
    significantDifference: boolean
  } {
    const statsA = this.getStats(nameA)
    const statsB = this.getStats(nameB)

    if (!statsA || !statsB) {
      return {
        benchmarkA: statsA,
        benchmarkB: statsB,
        improvement: null,
        significantDifference: false
      }
    }

    const improvement = ((statsA.average - statsB.average) / statsA.average) * 100
    const significantDifference = Math.abs(improvement) > 5 // 5% threshold

    return {
      benchmarkA: statsA,
      benchmarkB: statsB,
      improvement,
      significantDifference
    }
  }

  /**
   * Generates a performance report
   */
  generateReport(): string {
    const names = this.getBenchmarkNames()
    if (names.length === 0) {
      return 'No benchmark data available'
    }

    let report = 'Performance Benchmark Report\n'
    report += '================================\n\n'

    for (const name of names) {
      const stats = this.getStats(name)
      if (!stats) continue

      report += `Benchmark: ${name}\n`
      report += `  Count: ${stats.count}\n`
      report += `  Average: ${stats.average.toFixed(3)}ms\n`
      report += `  Min: ${stats.min.toFixed(3)}ms\n`
      report += `  Max: ${stats.max.toFixed(3)}ms\n`
      report += `  Std Dev: ${stats.stdDev.toFixed(3)}ms\n`
      report += `  95th %ile: ${stats.p95.toFixed(3)}ms\n`
      report += `  99th %ile: ${stats.p99.toFixed(3)}ms\n`
      report += `  Total: ${stats.total.toFixed(3)}ms\n\n`
    }

    return report
  }

  /**
   * Clears all benchmark data
   */
  clear(): void {
    this.measurements.clear()
    this.activeBenchmarks.clear()
  }

  /**
   * Clears data for a specific benchmark
   */
  clearBenchmark(name: string): void {
    this.measurements.delete(name)
    this.activeBenchmarks.delete(name)
    this.activeBenchmarks.delete(`${name}_metadata`)
  }

  /**
   * Exports benchmark data as JSON
   */
  exportData(): string {
    const data = {
      config: this.config,
      measurements: Object.fromEntries(this.measurements),
      timestamp: new Date().toISOString()
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Imports benchmark data from JSON
   */
  importData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData)
      if (data.measurements) {
        this.measurements = new Map(Object.entries(data.measurements))
      }
    } catch (error) {
      console.error('Failed to import benchmark data:', error)
    }
  }

  /**
   * Creates a benchmark suite for systematic testing
   */
  createSuite(name: string): BenchmarkSuite {
    return new BenchmarkSuite(name, this)
  }
}

/**
 * Benchmark suite for organizing related benchmarks
 */
export class BenchmarkSuite {
  private name: string
  private benchmark: PerformanceBenchmark
  private tests: Array<{ name: string; fn: () => void; metadata?: Record<string, any> }> = []

  constructor(name: string, benchmark: PerformanceBenchmark) {
    this.name = name
    this.benchmark = benchmark
  }

  /**
   * Adds a test to the suite
   */
  add(testName: string, fn: () => void, metadata?: Record<string, any>): this {
    this.tests.push({ name: `${this.name}.${testName}`, fn, metadata })
    return this
  }

  /**
   * Runs all tests in the suite
   */
  run(iterations: number = 1): void {
    console.log(`Running benchmark suite: ${this.name}`)
    
    for (const test of this.tests) {
      console.log(`  Running ${test.name}...`)
      
      for (let i = 0; i < iterations; i++) {
        this.benchmark.measure(test.name, test.fn, {
          ...test.metadata,
          iteration: i,
          suite: this.name
        })
      }
      
      const stats = this.benchmark.getStats(test.name)
      if (stats) {
        console.log(`    Average: ${stats.average.toFixed(3)}ms (${stats.count} runs)`)
      }
    }
  }

  /**
   * Runs tests and compares with baseline
   */
  runWithBaseline(baselineName: string, iterations: number = 1): void {
    this.run(iterations)
    
    console.log(`\nComparison with baseline (${baselineName}):`)
    for (const test of this.tests) {
      const comparison = this.benchmark.compare(baselineName, test.name)
      if (comparison.improvement !== null) {
        const sign = comparison.improvement > 0 ? '+' : ''
        console.log(`  ${test.name}: ${sign}${comparison.improvement.toFixed(1)}% ${comparison.improvement > 0 ? 'slower' : 'faster'}`)
      }
    }
  }
}

// Create a global benchmark instance
export const globalBenchmark = new PerformanceBenchmark({
  logToConsole: false,
  trackStats: true,
  maxMeasurements: 500
})

// Convenience functions
export const startBenchmark = (name: string, metadata?: Record<string, any>) => globalBenchmark.start(name, metadata)
export const endBenchmark = (name: string) => globalBenchmark.end(name)
export const measureSync = <T>(name: string, fn: () => T, metadata?: Record<string, any>) => globalBenchmark.measure(name, fn, metadata)
export const measureAsync = <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>) => globalBenchmark.measureAsync(name, fn, metadata)