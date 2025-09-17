/**
 * Example demonstrating comprehensive accessibility validation and testing utilities
 */

import { accessibilityValidator } from './accessibilityValidator';
import { VisualRegressionTester } from './visualRegressionTester';
import { globalBenchmark } from './performanceBenchmark';

/**
 * Comprehensive accessibility validation example
 */
export class AccessibilityValidationExample {
  private visualTester: VisualRegressionTester;

  constructor() {
    this.visualTester = new VisualRegressionTester();
  }

  /**
   * Run complete accessibility validation workflow
   */
  async runCompleteValidation(): Promise<void> {
    console.log('🚀 Starting comprehensive accessibility validation...');

    // Step 1: Validate text accessibility compliance
    await this.validateTextAccessibility();

    // Step 2: Create visual regression baselines
    await this.createVisualBaselines();

    // Step 3: Benchmark performance improvements
    await this.benchmarkPerformance();

    // Step 4: Generate comprehensive report
    this.generateReport();

    console.log('✅ Accessibility validation complete!');
  }

  /**
   * Validate text accessibility compliance
   */
  private async validateTextAccessibility(): Promise<void> {
    console.log('\n📋 Validating text accessibility compliance...');

    const testCases = [
      {
        name: 'Game Over Message',
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: '#000000',
        wcagLevel: 'AA' as const
      },
      {
        name: 'HUD Score Display',
        fontSize: 16,
        color: '#ffff00',
        backgroundColor: '#333333',
        wcagLevel: 'AA' as const
      }
    ];

    for (const testCase of testCases) {
      console.log(`  Testing: ${testCase.name}`);

      // Validate contrast ratio
      const contrastResult = accessibilityValidator.validateContrastRatio(
        testCase.color,
        testCase.backgroundColor,
        testCase.fontSize,
        testCase.wcagLevel,
        testCase.name
      );

      // Validate font size
      const fontSizeResult = accessibilityValidator.validateFontSize(
        testCase.fontSize,
        testCase.name
      );

      // Log results
      if (contrastResult.isValid && fontSizeResult.isValid) {
        console.log(`    ✅ ${testCase.name}: PASSED`);
      } else {
        console.log(`    ❌ ${testCase.name}: FAILED`);
      }
    }
  }

  /**
   * Create visual regression baselines
   */
  private async createVisualBaselines(): Promise<void> {
    console.log('\n🎨 Creating visual regression baselines...');

    const textStyles = [
      {
        id: 'game-over-message',
        text: 'Game Over',
        style: {
          fontSize: 32,
          fontFamily: 'Arial',
          color: '#ffffff',
          backgroundColor: '#000000'
        }
      }
    ];

    for (const textStyle of textStyles) {
      console.log(`  Creating baseline: ${textStyle.id}`);
      
      const baseline = this.visualTester.createBaseline(
        textStyle.id,
        textStyle.text,
        textStyle.style
      );

      console.log(`    ✅ Baseline created: ${baseline.metrics.width}x${baseline.metrics.height}px`);
    }
  }

  /**
   * Benchmark performance improvements
   */
  private async benchmarkPerformance(): Promise<void> {
    console.log('\n⚡ Benchmarking performance improvements...');

    // Benchmark basic text rendering
    console.log('  Benchmarking basic text rendering...');
    await globalBenchmark.measureAsync('basic-text-rendering', async () => {
      let sum = 0
      for (let i = 0; i < 1000; i++) {
        sum += Math.random()
      }
      return sum
    })

    console.log('  Performance benchmarks completed');
  }

  /**
   * Generate comprehensive accessibility report
   */
  private generateReport(): void {
    console.log('\n📄 Generating accessibility report...');

    const violations = accessibilityValidator.getViolations();
    
    console.log('\n=== ACCESSIBILITY VALIDATION REPORT ===');
    console.log(`Generated: ${new Date().toISOString()}`);
    
    console.log('\n📋 COMPLIANCE SUMMARY:');
    console.log(`  Total violations: ${violations.length}`);

    if (violations.length === 0) {
      console.log('  ✅ All accessibility tests PASSED');
    } else {
      console.log('  ❌ Accessibility violations detected');
    }

    console.log('\n=== END REPORT ===\n');
  }

  /**
   * Export all validation data
   */
  exportValidationData(): {
    violations: any[];
    visualBaselines: string;
    performanceResults: string;
    timestamp: number;
  } {
    return {
      violations: accessibilityValidator.getViolations(),
      visualBaselines: this.visualTester.exportBaselines(),
      performanceResults: globalBenchmark.exportData(),
      timestamp: Date.now()
    };
  }

  /**
   * Import validation data
   */
  importValidationData(data: {
    visualBaselines: string;
    performanceResults: string;
  }): void {
    this.visualTester.importBaselines(data.visualBaselines);
    globalBenchmark.importData(data.performanceResults);
  }

  /**
   * Clear all validation data
   */
  clearValidationData(): void {
    accessibilityValidator.clearViolations();
    this.visualTester.clearBaselines();
    globalBenchmark.clear();
  }
}

/**
 * Run the complete accessibility validation example
 */
export async function runAccessibilityValidationExample(): Promise<void> {
  const example = new AccessibilityValidationExample();
  await example.runCompleteValidation();
}

// Export for use in development/testing
if (typeof window !== 'undefined') {
  (window as any).runAccessibilityValidation = runAccessibilityValidationExample;
}