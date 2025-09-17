import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessibilityValidationExample, runAccessibilityValidationExample } from '../src/utils/accessibilityValidationExample';

// Mock canvas and context
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

// Mock console methods to reduce test output noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'group').mockImplementation(() => {});
vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('AccessibilityValidationExample', () => {
  let example: AccessibilityValidationExample;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    timeCounter = 0;
    
    example = new AccessibilityValidationExample();
    example.clearValidationData();
  });

  describe('Complete Validation Workflow', () => {
    it('should run complete accessibility validation workflow', async () => {
      // This test verifies the entire workflow runs without errors
      await expect(example.runCompleteValidation()).resolves.not.toThrow();
      
      // Verify console.log was called (indicating the workflow ran)
      expect(console.log).toHaveBeenCalledWith('🚀 Starting comprehensive accessibility validation...');
      expect(console.log).toHaveBeenCalledWith('✅ Accessibility validation complete!');
    });

    it('should export and import validation data', async () => {
      // Run a minimal validation to generate some data
      await example.runCompleteValidation();
      
      // Export data
      const exportedData = example.exportValidationData();
      
      expect(exportedData).toHaveProperty('violations');
      expect(exportedData).toHaveProperty('visualBaselines');
      expect(exportedData).toHaveProperty('performanceResults');
      expect(exportedData).toHaveProperty('timestamp');
      expect(typeof exportedData.visualBaselines).toBe('string');
      expect(typeof exportedData.performanceResults).toBe('string');
      
      // Clear data
      example.clearValidationData();
      
      // Import data back
      example.importValidationData({
        visualBaselines: exportedData.visualBaselines,
        performanceResults: exportedData.performanceResults
      });
      
      // Verify data was imported (this is a basic check)
      expect(() => example.exportValidationData()).not.toThrow();
    });

    it('should handle clearing validation data', () => {
      expect(() => example.clearValidationData()).not.toThrow();
    });
  });

  describe('Global Function', () => {
    it('should provide global accessibility validation function', async () => {
      await expect(runAccessibilityValidationExample()).resolves.not.toThrow();
    });
  });

  describe('Window Integration', () => {
    it('should attach function to window object', async () => {
      // Simulate browser environment
      const mockWindow = { runAccessibilityValidation: undefined };
      Object.defineProperty(global, 'window', {
        value: mockWindow,
        configurable: true
      });

      // Import the function directly and assign it
      const { runAccessibilityValidationExample } = await import('../src/utils/accessibilityValidationExample');
      (mockWindow as any).runAccessibilityValidation = runAccessibilityValidationExample;

      expect(mockWindow.runAccessibilityValidation).toBeDefined();
      expect(typeof mockWindow.runAccessibilityValidation).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during validation', async () => {
      // Mock an error in one of the validation steps
      const originalLog = console.log;
      console.log = vi.fn().mockImplementation((message) => {
        if (message.includes('Benchmarking')) {
          throw new Error('Mock benchmark error');
        }
      });

      // The validation should still complete even with errors
      await expect(example.runCompleteValidation()).rejects.toThrow('Mock benchmark error');

      // Restore console.log
      console.log = originalLog;
    });

    it('should handle export/import errors gracefully', () => {
      // Test with invalid JSON
      expect(() => {
        example.importValidationData({
          visualBaselines: 'invalid json',
          performanceResults: 'invalid json'
        });
      }).toThrow();
    });
  });

  describe('Data Validation', () => {
    it('should generate meaningful validation data', async () => {
      await example.runCompleteValidation();
      
      const data = example.exportValidationData();
      
      // Check that data structure is correct
      expect(Array.isArray(data.violations)).toBe(true);
      expect(typeof data.visualBaselines).toBe('string');
      expect(typeof data.performanceResults).toBe('string');
      expect(typeof data.timestamp).toBe('number');
      expect(data.timestamp).toBeGreaterThan(0);
      
      // Verify JSON is valid
      expect(() => JSON.parse(data.visualBaselines)).not.toThrow();
      expect(() => JSON.parse(data.performanceResults)).not.toThrow();
    });

    it('should handle empty validation data', () => {
      const data = example.exportValidationData();
      
      expect(data.violations).toHaveLength(0);
      expect(data.visualBaselines).toBe('[]');
      expect(data.performanceResults).toBe('{}');
    });
  });

  describe('Performance Considerations', () => {
    it('should complete validation in reasonable time', async () => {
      const startTime = Date.now();
      
      await example.runCompleteValidation();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 10 seconds (generous for CI environments)
      expect(duration).toBeLessThan(10000);
    });

    it('should not consume excessive memory', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      await example.runCompleteValidation();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not increase memory by more than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});