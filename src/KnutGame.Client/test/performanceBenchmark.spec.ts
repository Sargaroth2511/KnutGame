import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceBenchmark, performanceBenchmark } from '../src/utils/performanceBenchmark';

// Mock performance.now
const mockPerformanceNow = vi.fn();
Object.defineProperty(performance, 'now', {
  value: mockPerformanceNow
});

// Mock canvas and context
const mockCanvas = {
  width: 800,
  height: 600,
  getContext: vi.fn()
};

const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  textAlign: '',
  textBaseline: '',
  shadowColor: '',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    return {};
  })
});

// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('PerformanceBenchmark', () => {
  let benchmark: PerformanceBenchmark;
  let timeCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    benchmark = new PerformanceBenchmark();
    timeCounter = 0;
    
    // Mock performance.now to return incrementing values
    mockPerformanceNow.mockImplementation(() => {
      timeCounter += 1;
      return timeCounter;
    });
  });

  describe('Basic Benchmarking', () => {
    it('should run a simple benchmark and return results', async () => {
      const testFunction = vi.fn();
      
      const result = await benchmark.benchmark('test-function', testFunction, {
        iterations: 10,
        warmupIterations: 2
      });

      expect(result.name).toBe('test-function');
      expect(result.iterations).toBe(10);
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.averageTime).toBeGreaterThan(0);
      expect(result.operationsPerSecond).toBeGreaterThan(0);
      expect(testFunction).toHaveBeenCalledTimes(12); // 2 warmup + 10 benchmark
    });

    it('should handle async functions', async () => {
      const asyncFunction = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
      });

      const result = await benchmark.benchmark('async-test', asyncFunction, {
        iterations: 5,
        warmupIterations: 1
      });

      expect(result.name).toBe('async-test');
      expect(result.iterations).toBe(5);
      expect(asyncFunction).toHaveBeenCalledTimes(6); // 1 warmup + 5 benchmark
    });

    it('should calculate statistics correctly', async () => {
      // Mock performance.now to return predictable values
      const times = [0, 1, 2, 4, 5, 9, 10, 14, 15, 19, 20]; // Warmup: 0-1, Benchmark: 2-20
      let callIndex = 0;
      mockPerformanceNow.mockImplementation(() => times[callIndex++] || 20);

      const result = await benchmark.benchmark('stats-test', () => {}, {
        iterations: 5,
        warmupIterations: 1
      });

      expect(result.iterations).toBe(5);
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.averageTime).toBeGreaterThan(0);
      expect(result.minTime).toBeGreaterThanOrEqual(0);
      expect(result.maxTime).toBeGreaterThanOrEqual(result.minTime);
    });
  });

  describe('Text Rendering Benchmarks', () => {
    it('should benchmark text rendering operations', async () => {
      const textBenchmark = {
        textContent: 'Hello World',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        strokeEnabled: false,
        shadowEnabled: false,
        backgroundEnabled: false
      };

      const result = await benchmark.benchmarkTextRendering('text-render-test', textBenchmark, {
        iterations: 5,
        warmupIterations: 1
      });

      expect(result.name).toBe('text-render-test');
      expect(result.iterations).toBe(5);
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.font).toBe('16px Arial');
      expect(mockContext.fillStyle).toBe('#000000');
    });

    it('should render text with stroke when enabled', async () => {
      const textBenchmark = {
        textContent: 'Stroked Text',
        fontSize: 18,
        fontFamily: 'Helvetica',
        color: '#ffffff',
        strokeEnabled: true,
        shadowEnabled: false,
        backgroundEnabled: false
      };

      await benchmark.benchmarkTextRendering('stroke-test', textBenchmark, {
        iterations: 3,
        warmupIterations: 1
      });

      expect(mockContext.strokeText).toHaveBeenCalled();
      expect(mockContext.strokeStyle).toBe('#000000');
      expect(mockContext.lineWidth).toBe(2);
    });

    it('should render text with shadow when enabled', async () => {
      const textBenchmark = {
        textContent: 'Shadow Text',
        fontSize: 20,
        fontFamily: 'Arial',
        color: '#000000',
        strokeEnabled: false,
        shadowEnabled: true,
        backgroundEnabled: false
      };

      await benchmark.benchmarkTextRendering('shadow-test', textBenchmark, {
        iterations: 3,
        warmupIterations: 1
      });

      // Shadow is reset after rendering, so we check that it was set and then reset
      expect(mockContext.shadowColor).toBe('transparent');
      expect(mockContext.shadowOffsetX).toBe(0);
      expect(mockContext.shadowOffsetY).toBe(0);
      expect(mockContext.shadowBlur).toBe(0);
    });

    it('should render background when enabled', async () => {
      const textBenchmark = {
        textContent: 'Background Text',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        strokeEnabled: false,
        shadowEnabled: false,
        backgroundEnabled: true
      };

      await benchmark.benchmarkTextRendering('background-test', textBenchmark, {
        iterations: 3,
        warmupIterations: 1
      });

      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('Contrast Calculation Benchmarks', () => {
    it('should benchmark contrast ratio calculations', async () => {
      const colorPairs = [
        { text: '#000000', background: '#ffffff' },
        { text: '#333333', background: '#f0f0f0' },
        { text: '#666666', background: '#cccccc' }
      ];

      const result = await benchmark.benchmarkContrastCalculation('contrast-test', colorPairs, {
        iterations: 10,
        warmupIterations: 2
      });

      expect(result.name).toBe('contrast-test');
      expect(result.iterations).toBe(10);
      expect(result.averageTime).toBeGreaterThan(0);
    });
  });

  describe('Font Scaling Benchmarks', () => {
    it('should benchmark font scaling calculations', async () => {
      const viewportSizes = [
        { width: 320, height: 568 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 }
      ];

      const result = await benchmark.benchmarkFontScaling('scaling-test', viewportSizes, 16, {
        iterations: 10,
        warmupIterations: 2
      });

      expect(result.name).toBe('scaling-test');
      expect(result.iterations).toBe(10);
      expect(result.averageTime).toBeGreaterThan(0);
    });
  });

  describe('Result Management', () => {
    it('should store and retrieve benchmark results', async () => {
      await benchmark.benchmark('storage-test-1', () => {}, { iterations: 3 });
      await benchmark.benchmark('storage-test-2', () => {}, { iterations: 3 });

      const results1 = benchmark.getResults('storage-test-1');
      const results2 = benchmark.getResults('storage-test-2');

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].name).toBe('storage-test-1');
      expect(results2[0].name).toBe('storage-test-2');
    });

    it('should get latest result for a benchmark', async () => {
      await benchmark.benchmark('latest-test', () => {}, { iterations: 3 });
      await benchmark.benchmark('latest-test', () => {}, { iterations: 5 });

      const latest = benchmark.getLatestResult('latest-test');
      const allResults = benchmark.getResults('latest-test');

      expect(allResults).toHaveLength(2);
      expect(latest).toBe(allResults[1]);
      expect(latest?.iterations).toBe(5);
    });

    it('should return null for non-existent benchmark', () => {
      const result = benchmark.getLatestResult('non-existent');
      expect(result).toBeNull();
    });

    it('should clear all results', async () => {
      await benchmark.benchmark('clear-test-1', () => {}, { iterations: 3 });
      await benchmark.benchmark('clear-test-2', () => {}, { iterations: 3 });

      expect(benchmark.getResults('clear-test-1')).toHaveLength(1);
      expect(benchmark.getResults('clear-test-2')).toHaveLength(1);

      benchmark.clearResults();

      expect(benchmark.getResults('clear-test-1')).toHaveLength(0);
      expect(benchmark.getResults('clear-test-2')).toHaveLength(0);
    });
  });

  describe('Result Comparison', () => {
    it('should compare benchmark results and provide recommendations', async () => {
      // Create two benchmarks with different performance characteristics
      let fastCallCount = 0;
      let slowCallCount = 0;

      mockPerformanceNow.mockImplementation(() => {
        if (fastCallCount < 10) {
          fastCallCount++;
          return fastCallCount; // Fast: 1ms per operation
        } else {
          slowCallCount++;
          return 10 + (slowCallCount * 2); // Slow: 2ms per operation
        }
      });

      await benchmark.benchmark('fast-operation', () => {}, { iterations: 5, warmupIterations: 0 });
      await benchmark.benchmark('slow-operation', () => {}, { iterations: 5, warmupIterations: 0 });

      const comparison = benchmark.compareResults('slow-operation', 'fast-operation');

      expect(comparison).toBeDefined();
      expect(comparison!.speedImprovement).toBeGreaterThan(0);
      expect(comparison!.recommendation).toContain('fast-operation');
    });

    it('should return null when comparing non-existent benchmarks', () => {
      const comparison = benchmark.compareResults('non-existent-1', 'non-existent-2');
      expect(comparison).toBeNull();
    });
  });

  describe('Data Export/Import', () => {
    it('should export and import results', async () => {
      await benchmark.benchmark('export-test', () => {}, { iterations: 3 });

      const exported = benchmark.exportResults();
      expect(typeof exported).toBe('string');

      benchmark.clearResults();
      expect(benchmark.getResults('export-test')).toHaveLength(0);

      benchmark.importResults(exported);
      expect(benchmark.getResults('export-test')).toHaveLength(1);
    });
  });

  describe('Memory Measurement', () => {
    it('should measure memory usage when available', async () => {
      // Mock performance.memory
      const mockMemory = {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      };

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true
      });

      const result = await benchmark.benchmark('memory-test', () => {}, {
        iterations: 3,
        measureMemory: true
      });

      expect(result.memoryUsage).toBeDefined();
      expect(result.memoryUsage?.totalJSHeapSize).toBe(2000000);
    });

    it('should handle missing memory API gracefully', async () => {
      // Remove memory property
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true
      });

      const result = await benchmark.benchmark('no-memory-test', () => {}, {
        iterations: 3,
        measureMemory: true
      });

      expect(result.memoryUsage).toBeUndefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should handle timeout during benchmark', async () => {
      let callCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) return 0; // Start time
        return 35000; // Exceed 30s timeout
      });

      const result = await benchmark.benchmark('timeout-test', () => {}, {
        iterations: 1000,
        timeout: 30000
      });

      expect(result.iterations).toBeLessThan(1000);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      );
    });
  });

  describe('Singleton Instance', () => {
    it('should provide global benchmark instance', () => {
      expect(performanceBenchmark).toBeInstanceOf(PerformanceBenchmark);
    });
  });
});