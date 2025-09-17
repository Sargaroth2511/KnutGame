import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessibilityValidator } from '../src/utils/accessibilityValidator';
import { VisualRegressionTester } from '../src/utils/visualRegressionTester';
import { PerformanceBenchmark } from '../src/utils/performanceBenchmark';

// Mock canvas and context for integration tests
const mockCanvas = {
  width: 800,
  height: 600,
  getContext: vi.fn(),
  toDataURL: vi.fn(() => 'data:image/png;base64,mockdata')
};

const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(800 * 600 * 4).fill(255)
  })),
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
  value: vi.fn(() => mockCanvas)
});

// Mock performance.now
let timeCounter = 0;
Object.defineProperty(performance, 'now', {
  value: vi.fn(() => ++timeCounter)
});

// Mock console methods
vi.spyOn(console, 'group').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Accessibility Validation Integration', () => {
  let validator: AccessibilityValidator;
  let visualTester: VisualRegressionTester;
  let benchmark: PerformanceBenchmark;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    timeCounter = 0;

    validator = AccessibilityValidator.getInstance();
    visualTester = new VisualRegressionTester();
    benchmark = new PerformanceBenchmark();

    validator.clearViolations();
    validator.setEnabled(true);
    visualTester.clearBaselines();
    benchmark.clearResults();
  });

  describe('Complete Text Accessibility Validation Workflow', () => {
    it('should validate text accessibility, create visual baseline, and benchmark performance', async () => {
      const textStyle = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#ffffff',
        strokeEnabled: false,
        shadowEnabled: false
      };

      // Step 1: Validate accessibility compliance
      const contrastResult = validator.validateContrastRatio(
        textStyle.color,
        textStyle.backgroundColor,
        textStyle.fontSize,
        'AA',
        'integration-test-text'
      );

      const fontSizeResult = validator.validateFontSize(
        textStyle.fontSize,
        'integration-test-text'
      );

      // Step 2: Create visual regression baseline
      const visualBaseline = visualTester.createBaseline(
        'integration-test-baseline',
        'Accessibility Test Text',
        textStyle
      );

      // Step 3: Benchmark text rendering performance
      const performanceResult = await benchmark.benchmarkTextRendering(
        'integration-test-performance',
        {
          textContent: 'Accessibility Test Text',
          fontSize: textStyle.fontSize,
          fontFamily: textStyle.fontFamily,
          color: textStyle.color,
          strokeEnabled: textStyle.strokeEnabled,
          shadowEnabled: textStyle.shadowEnabled,
          backgroundEnabled: true
        },
        { iterations: 10, warmupIterations: 2 }
      );

      // Verify accessibility validation
      expect(contrastResult.isValid).toBe(true);
      expect(contrastResult.contrastRatio).toBeGreaterThan(4.5);
      expect(fontSizeResult.isValid).toBe(true);
      expect(validator.getViolations()).toHaveLength(0);

      // Verify visual baseline creation
      expect(visualBaseline.id).toBe('integration-test-baseline');
      expect(visualBaseline.textContent).toBe('Accessibility Test Text');
      expect(visualBaseline.fontSize).toBe(16);
      expect(visualBaseline.metrics.contrastRatio).toBeGreaterThan(4.5);

      // Verify performance benchmarking
      expect(performanceResult.name).toBe('integration-test-performance');
      expect(performanceResult.iterations).toBe(10);
      expect(performanceResult.averageTime).toBeGreaterThan(0);
      expect(performanceResult.operationsPerSecond).toBeGreaterThan(0);
    });

    it('should detect accessibility violations and provide comprehensive feedback', async () => {
      const poorTextStyle = {
        fontSize: 12, // Too small
        fontFamily: 'Arial',
        color: '#cccccc', // Poor contrast
        backgroundColor: '#ffffff',
        strokeEnabled: false,
        shadowEnabled: false
      };

      // Validate accessibility (should fail)
      const contrastResult = validator.validateContrastRatio(
        poorTextStyle.color,
        poorTextStyle.backgroundColor,
        poorTextStyle.fontSize,
        'AA',
        'poor-accessibility-text'
      );

      const fontSizeResult = validator.validateFontSize(
        poorTextStyle.fontSize,
        'poor-accessibility-text'
      );

      // Create visual baseline for comparison
      const visualBaseline = visualTester.createBaseline(
        'poor-accessibility-baseline',
        'Poor Accessibility Text',
        poorTextStyle
      );

      // Get all violations
      const violations = validator.getViolations();

      // Verify accessibility failures
      expect(contrastResult.isValid).toBe(false);
      expect(contrastResult.contrastRatio).toBeLessThan(4.5);
      expect(fontSizeResult.isValid).toBe(false);
      expect(violations).toHaveLength(2);

      // Verify violation details
      const contrastViolation = violations.find(v => v.type === 'contrast');
      const fontSizeViolation = violations.find(v => v.type === 'font-size');

      expect(contrastViolation).toBeDefined();
      expect(contrastViolation?.severity).toBe('error');
      expect(contrastViolation?.element).toBe('poor-accessibility-text');

      expect(fontSizeViolation).toBeDefined();
      expect(fontSizeViolation?.severity).toBe('warning');
      expect(fontSizeViolation?.actualValue).toBe(12);
      expect(fontSizeViolation?.requiredValue).toBe(14);

      // Verify visual baseline still created (for comparison purposes)
      expect(visualBaseline.id).toBe('poor-accessibility-baseline');
      expect(visualBaseline.fontSize).toBe(12);
    });

    it('should compare improved vs original text rendering performance', async () => {
      // Original text rendering (simple)
      const originalStyle = {
        textContent: 'Performance Test',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        strokeEnabled: false,
        shadowEnabled: false,
        backgroundEnabled: false
      };

      // Improved text rendering (with accessibility features)
      const improvedStyle = {
        textContent: 'Performance Test',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        strokeEnabled: true,
        shadowEnabled: true,
        backgroundEnabled: true
      };

      // Benchmark both approaches
      await benchmark.benchmarkTextRendering(
        'original-text-rendering',
        originalStyle,
        { iterations: 20, warmupIterations: 5 }
      );

      await benchmark.benchmarkTextRendering(
        'improved-text-rendering',
        improvedStyle,
        { iterations: 20, warmupIterations: 5 }
      );

      // Compare performance
      const comparison = benchmark.compareResults(
        'original-text-rendering',
        'improved-text-rendering'
      );

      expect(comparison).toBeDefined();
      expect(comparison!.recommendation).toBeDefined();
      expect(typeof comparison!.speedImprovement).toBe('number');

      // Get individual results
      const originalResult = benchmark.getLatestResult('original-text-rendering');
      const improvedResult = benchmark.getLatestResult('improved-text-rendering');

      expect(originalResult).toBeDefined();
      expect(improvedResult).toBeDefined();
      expect(originalResult!.iterations).toBe(20);
      expect(improvedResult!.iterations).toBe(20);
    });

    it('should validate text across multiple viewport sizes and create baselines', async () => {
      const viewportSizes = [
        { width: 320, height: 568, name: 'mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1920, height: 1080, name: 'desktop' }
      ];

      const baseFontSize = 16;
      const results: Array<{
        viewport: string;
        scaledFontSize: number;
        accessibilityValid: boolean;
        visualBaseline: string;
      }> = [];

      for (const viewport of viewportSizes) {
        // Calculate responsive font size
        const scaleFactor = Math.min(viewport.width / 800, viewport.height / 600);
        const scaledFontSize = Math.max(14, Math.min(32, baseFontSize * scaleFactor));

        // Validate accessibility for scaled font
        const fontSizeResult = validator.validateFontSize(
          scaledFontSize,
          `${viewport.name}-text`
        );

        const contrastResult = validator.validateContrastRatio(
          '#000000',
          '#ffffff',
          scaledFontSize,
          'AA',
          `${viewport.name}-text`
        );

        // Create visual baseline for this viewport
        const visualBaseline = visualTester.createBaseline(
          `${viewport.name}-baseline`,
          `${viewport.name.charAt(0).toUpperCase() + viewport.name.slice(1)} Text`,
          {
            fontSize: scaledFontSize,
            fontFamily: 'Arial',
            color: '#000000',
            backgroundColor: '#ffffff'
          }
        );

        results.push({
          viewport: viewport.name,
          scaledFontSize,
          accessibilityValid: fontSizeResult.isValid && contrastResult.isValid,
          visualBaseline: visualBaseline.id
        });
      }

      // Verify all viewports have valid accessibility
      expect(results.every(r => r.accessibilityValid)).toBe(true);
      expect(results).toHaveLength(3);

      // Verify font scaling worked correctly
      const mobileResult = results.find(r => r.viewport === 'mobile');
      const desktopResult = results.find(r => r.viewport === 'desktop');

      expect(mobileResult?.scaledFontSize).toBeGreaterThanOrEqual(14);
      expect(desktopResult?.scaledFontSize).toBeGreaterThanOrEqual(mobileResult!.scaledFontSize);

      // Verify visual baselines were created
      const baselines = visualTester.getBaselines();
      expect(baselines.size).toBe(3);
      expect(baselines.has('mobile-baseline')).toBe(true);
      expect(baselines.has('tablet-baseline')).toBe(true);
      expect(baselines.has('desktop-baseline')).toBe(true);
    });

    it('should benchmark contrast calculation performance with various color combinations', async () => {
      const colorCombinations = [
        { text: '#000000', background: '#ffffff' }, // High contrast
        { text: '#333333', background: '#f0f0f0' }, // Good contrast
        { text: '#666666', background: '#cccccc' }, // Medium contrast
        { text: '#888888', background: '#aaaaaa' }, // Poor contrast
        { text: '#ff0000', background: '#00ff00' }, // Color contrast
        { text: '#0066cc', background: '#ffffff' }, // Blue on white
        { text: '#ffffff', background: '#000000' }, // White on black
        { text: '#ffff00', background: '#0000ff' }  // Yellow on blue
      ];

      // Benchmark contrast calculations
      const contrastBenchmark = await benchmark.benchmarkContrastCalculation(
        'comprehensive-contrast-test',
        colorCombinations,
        { iterations: 100, warmupIterations: 10 }
      );

      // Validate each color combination
      const validationResults = colorCombinations.map((combo, index) => {
        const result = validator.validateContrastRatio(
          combo.text,
          combo.background,
          16,
          'AA',
          `color-combo-${index}`
        );
        return {
          combo,
          isValid: result.isValid,
          contrastRatio: result.contrastRatio
        };
      });

      // Verify benchmark completed successfully
      expect(contrastBenchmark.name).toBe('comprehensive-contrast-test');
      expect(contrastBenchmark.iterations).toBe(100);
      expect(contrastBenchmark.averageTime).toBeGreaterThan(0);

      // Verify we have validation results for all combinations
      expect(validationResults).toHaveLength(8);

      // Verify high contrast combinations pass
      const highContrastResult = validationResults[0]; // Black on white
      expect(highContrastResult.isValid).toBe(true);
      expect(highContrastResult.contrastRatio).toBeGreaterThan(4.5);

      // Check that we detected some violations
      const violations = validator.getViolations();
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid color formats gracefully', () => {
      const result = validator.validateContrastRatio(
        'invalid-color',
        'another-invalid-color',
        16,
        'AA',
        'invalid-color-test'
      );

      // Should not throw and should provide some result
      expect(result).toBeDefined();
      expect(result.contrastRatio).toBeGreaterThan(0);
    });

    it('should handle extreme font sizes', () => {
      const tinyFontResult = validator.validateFontSize(1, 'tiny-font');
      const hugeFontResult = validator.validateFontSize(1000, 'huge-font');

      expect(tinyFontResult.isValid).toBe(false);
      expect(hugeFontResult.isValid).toBe(true);
    });

    it('should handle disabled validator gracefully', async () => {
      validator.setEnabled(false);

      const contrastResult = validator.validateContrastRatio('#cccccc', '#ffffff', 16);
      const fontSizeResult = validator.validateFontSize(10);

      expect(contrastResult.isValid).toBe(true);
      expect(fontSizeResult.isValid).toBe(true);
      expect(validator.getViolations()).toHaveLength(0);
    });
  });

  describe('Data Export and Import', () => {
    it('should export and import complete validation data', async () => {
      // Create some test data
      validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA', 'export-test');
      
      const visualBaseline = visualTester.createBaseline(
        'export-baseline',
        'Export Test',
        { fontSize: 16, fontFamily: 'Arial', color: '#000000' }
      );

      await benchmark.benchmark('export-benchmark', () => {}, { iterations: 5 });

      // Export data
      const violations = validator.getViolations();
      const visualData = visualTester.exportBaselines();
      const benchmarkData = benchmark.exportResults();

      expect(violations.length).toBeGreaterThan(0);
      expect(typeof visualData).toBe('string');
      expect(typeof benchmarkData).toBe('string');

      // Clear and import
      validator.clearViolations();
      visualTester.clearBaselines();
      benchmark.clearResults();

      expect(validator.getViolations()).toHaveLength(0);
      expect(visualTester.getBaselines().size).toBe(0);
      expect(benchmark.getResults('export-benchmark')).toHaveLength(0);

      // Import data
      visualTester.importBaselines(visualData);
      benchmark.importResults(benchmarkData);

      expect(visualTester.getBaselines().size).toBe(1);
      expect(benchmark.getResults('export-benchmark')).toHaveLength(1);
    });
  });
});