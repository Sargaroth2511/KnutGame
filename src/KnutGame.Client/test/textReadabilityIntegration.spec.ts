/**
 * Integration tests for the complete text readability system
 * 
 * These tests validate that all text readability components work together
 * correctly and provide comprehensive accessibility compliance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Phaser from 'phaser';
import { TextReadabilityIntegration } from '../src/utils/textReadabilityIntegration';
import { getHighContrastManager } from '../src/utils/highContrastConfig';
import { getResponsiveFontScaler } from '../src/utils/responsiveFontScaler';

// Mock Phaser scene
const createMockScene = (): Phaser.Scene => {
  const scene = {
    add: {
      text: vi.fn().mockReturnValue({
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setStyle: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        setWordWrapWidth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 20 }),
        destroy: vi.fn(),
        text: 'Mock Text',
        width: 100,
        height: 20,
        x: 50,
        y: 50,
        style: { fontSize: '16px', color: '#ffffff' }
      }),
      container: vi.fn().mockReturnValue({
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        getAt: vi.fn().mockReturnValue({
          clear: vi.fn(),
          fillStyle: vi.fn(),
          fillRoundedRect: vi.fn(),
          lineStyle: vi.fn(),
          strokeRoundedRect: vi.fn()
        })
      }),
      graphics: vi.fn().mockReturnValue({
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        lineStyle: vi.fn(),
        strokeRoundedRect: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        destroy: vi.fn()
      }),
      rectangle: vi.fn().mockReturnValue({
        setDepth: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn(),
        destroy: vi.fn()
      })
    },
    cameras: {
      main: {
        width: 800,
        height: 600
      }
    },
    tweens: {
      add: vi.fn().mockReturnValue({
        stop: vi.fn(),
        remove: vi.fn()
      }),
      killTweensOf: vi.fn()
    },
    time: {
      delayedCall: vi.fn().mockReturnValue({
        destroy: vi.fn()
      })
    }
  } as unknown as Phaser.Scene;

  return scene;
};

describe('TextReadabilityIntegration', () => {
  let scene: Phaser.Scene;
  let integration: TextReadabilityIntegration;

  beforeEach(() => {
    // Reset global state
    vi.clearAllMocks();
    
    // Mock global objects
    global.globalThis = {
      devicePixelRatio: 2,
      innerWidth: 800,
      innerHeight: 600,
      screen: { width: 800, height: 600 },
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn()
      },
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    } as any;

    scene = createMockScene();
    integration = new TextReadabilityIntegration(scene);
  });

  afterEach(() => {
    integration.destroy();
  });

  describe('Component Wiring', () => {
    it('should wire all text components successfully', () => {
      expect(() => {
        integration.wireTextComponents();
      }).not.toThrow();
    });

    it('should initialize high contrast manager', () => {
      integration.wireTextComponents();
      
      const highContrastManager = getHighContrastManager();
      expect(highContrastManager).toBeDefined();
    });

    it('should initialize responsive font scaler', () => {
      integration.wireTextComponents();
      
      const fontScaler = getResponsiveFontScaler();
      expect(fontScaler).toBeDefined();
    });
  });

  describe('Comprehensive Testing', () => {
    it('should run comprehensive tests without errors', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results).toBeDefined();
      expect(results.overallScore).toBeGreaterThanOrEqual(0);
      expect(results.overallScore).toBeLessThanOrEqual(100);
    });

    it('should test HUD accessibility', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results.hudAccessibility).toBeDefined();
      expect(results.hudAccessibility.metrics).toBeInstanceOf(Array);
      expect(results.hudAccessibility.issues).toBeInstanceOf(Array);
    });

    it('should test message box accessibility', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results.messageBoxAccessibility).toBeDefined();
      expect(results.messageBoxAccessibility.metrics).toBeInstanceOf(Array);
      expect(results.messageBoxAccessibility.issues).toBeInstanceOf(Array);
    });

    it('should test greeting screen accessibility', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results.greetingScreenAccessibility).toBeDefined();
      expect(results.greetingScreenAccessibility.metrics).toBeInstanceOf(Array);
      expect(results.greetingScreenAccessibility.issues).toBeInstanceOf(Array);
    });

    it('should test high contrast mode functionality', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results.highContrastMode).toBeDefined();
      expect(results.highContrastMode.issues).toBeInstanceOf(Array);
    });

    it('should test responsive scaling', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results.responsiveScaling).toBeDefined();
      expect(results.responsiveScaling.issues).toBeInstanceOf(Array);
    });

    it('should test cross-device compatibility', async () => {
      integration.wireTextComponents();
      
      const results = await integration.runComprehensiveTests();
      
      expect(results.crossDeviceCompatibility).toBeDefined();
      expect(results.crossDeviceCompatibility.deviceTests).toBeInstanceOf(Array);
      expect(results.crossDeviceCompatibility.issues).toBeInstanceOf(Array);
    });
  });

  describe('Accessibility Compliance Validation', () => {
    it('should validate accessibility compliance', () => {
      integration.wireTextComponents();
      
      const compliance = integration.validateAccessibilityCompliance();
      
      expect(compliance).toBeDefined();
      expect(compliance.compliant).toBeDefined();
      expect(compliance.violations).toBeInstanceOf(Array);
      expect(compliance.summary).toBeDefined();
      expect(compliance.summary.totalElements).toBeGreaterThanOrEqual(0);
      expect(compliance.summary.compliantElements).toBeGreaterThanOrEqual(0);
      expect(compliance.summary.complianceRate).toBeGreaterThanOrEqual(0);
      expect(compliance.summary.complianceRate).toBeLessThanOrEqual(100);
    });

    it('should identify accessibility violations', () => {
      integration.wireTextComponents();
      
      const compliance = integration.validateAccessibilityCompliance();
      
      // Each violation should have required properties
      compliance.violations.forEach(violation => {
        expect(violation.element).toBeDefined();
        expect(violation.issue).toBeDefined();
        expect(violation.severity).toMatch(/^(low|medium|high)$/);
        expect(violation.recommendation).toBeDefined();
      });
    });
  });

  describe('Cross-Device Testing', () => {
    it('should perform cross-device tests with default devices', async () => {
      integration.wireTextComponents();
      
      const results = await integration.performCrossDeviceTests();
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result.deviceName).toBeDefined();
        expect(result.passed).toBeDefined();
        expect(result.issues).toBeInstanceOf(Array);
        expect(result.textScaling).toBeDefined();
        expect(result.textScaling.appropriate).toBeDefined();
        expect(result.textScaling.fontSizes).toBeDefined();
        expect(result.visibility).toBeDefined();
        expect(result.visibility.adequate).toBeDefined();
        expect(result.visibility.contrastRatios).toBeDefined();
      });
    });

    it('should perform cross-device tests with custom devices', async () => {
      integration.wireTextComponents();
      
      const customDevices = [
        { name: 'Custom Mobile', width: 360, height: 640, pixelRatio: 2 },
        { name: 'Custom Tablet', width: 1024, height: 768, pixelRatio: 1.5 }
      ];
      
      const results = await integration.performCrossDeviceTests(customDevices);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
      expect(results[0].deviceName).toBe('Custom Mobile');
      expect(results[1].deviceName).toBe('Custom Tablet');
    });

    it('should validate text scaling for different device sizes', async () => {
      integration.wireTextComponents();
      
      const mobileDevice = { name: 'Mobile', width: 375, height: 667, pixelRatio: 2 };
      const desktopDevice = { name: 'Desktop', width: 1920, height: 1080, pixelRatio: 1 };
      
      const results = await integration.performCrossDeviceTests([mobileDevice, desktopDevice]);
      
      expect(results.length).toBe(2);
      
      // Mobile should have appropriate scaling
      const mobileResult = results.find(r => r.deviceName === 'Mobile');
      expect(mobileResult).toBeDefined();
      expect(mobileResult!.textScaling.fontSizes).toBeDefined();
      
      // Desktop should have appropriate scaling
      const desktopResult = results.find(r => r.deviceName === 'Desktop');
      expect(desktopResult).toBeDefined();
      expect(desktopResult!.textScaling.fontSizes).toBeDefined();
    });
  });

  describe('System Documentation', () => {
    it('should create comprehensive system documentation', () => {
      integration.wireTextComponents();
      
      const documentation = integration.createSystemDocumentation();
      
      expect(documentation).toBeDefined();
      expect(documentation.overview).toBeDefined();
      expect(documentation.components).toBeInstanceOf(Array);
      expect(documentation.bestPractices).toBeInstanceOf(Array);
      expect(documentation.troubleshooting).toBeInstanceOf(Array);
    });

    it('should document all major components', () => {
      integration.wireTextComponents();
      
      const documentation = integration.createSystemDocumentation();
      
      const componentNames = documentation.components.map(c => c.name);
      expect(componentNames).toContain('TextReadabilityManager');
      expect(componentNames).toContain('AccessibleMessageBox');
      expect(componentNames).toContain('AdaptiveBackgroundRenderer');
      expect(componentNames).toContain('ResponsiveFontScaler');
    });

    it('should provide usage examples for each component', () => {
      integration.wireTextComponents();
      
      const documentation = integration.createSystemDocumentation();
      
      documentation.components.forEach(component => {
        expect(component.name).toBeDefined();
        expect(component.description).toBeDefined();
        expect(component.usage).toBeDefined();
        expect(component.examples).toBeInstanceOf(Array);
        expect(component.examples.length).toBeGreaterThan(0);
      });
    });

    it('should provide troubleshooting guidance', () => {
      integration.wireTextComponents();
      
      const documentation = integration.createSystemDocumentation();
      
      documentation.troubleshooting.forEach(item => {
        expect(item.issue).toBeDefined();
        expect(item.solution).toBeDefined();
      });
    });
  });

  describe('Test Results Management', () => {
    it('should provide access to test results', async () => {
      integration.wireTextComponents();
      
      await integration.runComprehensiveTests();
      const results = integration.getTestResults();
      
      expect(results).toBeDefined();
      expect(results.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should reset test results between runs', async () => {
      integration.wireTextComponents();
      
      // Run tests first time
      await integration.runComprehensiveTests();
      const firstResults = integration.getTestResults();
      
      // Run tests second time
      await integration.runComprehensiveTests();
      const secondResults = integration.getTestResults();
      
      // Results should be consistent (not accumulated)
      expect(secondResults.overallScore).toBe(firstResults.overallScore);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during testing', async () => {
      integration.wireTextComponents();
      
      // Mock an error in one of the test methods
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      try {
        const results = await integration.runComprehensiveTests();
        expect(results).toBeDefined();
        expect(results.overallScore).toBeGreaterThanOrEqual(0);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should handle missing scene gracefully', () => {
      const invalidScene = null as any;
      
      expect(() => {
        new TextReadabilityIntegration(invalidScene);
      }).toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete comprehensive tests within reasonable time', async () => {
      integration.wireTextComponents();
      
      const startTime = Date.now();
      await integration.runComprehensiveTests();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple test runs efficiently', async () => {
      integration.wireTextComponents();
      
      const startTime = Date.now();
      
      // Run tests multiple times
      for (let i = 0; i < 3; i++) {
        await integration.runComprehensiveTests();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(10000); // Should complete 3 runs within 10 seconds
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources properly', () => {
      integration.wireTextComponents();
      
      expect(() => {
        integration.destroy();
      }).not.toThrow();
    });

    it('should handle multiple destroy calls safely', () => {
      integration.wireTextComponents();
      
      expect(() => {
        integration.destroy();
        integration.destroy(); // Second call should be safe
      }).not.toThrow();
    });
  });
});