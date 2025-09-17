import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualRegressionTester } from '../src/utils/visualRegressionTester';

// Mock HTMLCanvasElement and CanvasRenderingContext2D
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
    data: new Uint8ClampedArray(800 * 600 * 4).fill(255) // White pixels
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

// Mock document.createElement
Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    return {};
  })
});

// Mock Image constructor
global.Image = class {
  src: string = '';
  onload: (() => void) | null = null;
  
  constructor() {
    // Auto-trigger onload for testing
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
} as any;

describe('VisualRegressionTester', () => {
  let tester: VisualRegressionTester;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    tester = new VisualRegressionTester();
  });

  describe('Baseline Creation', () => {
    it('should create a baseline snapshot with basic text style', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#ffffff'
      };

      const snapshot = tester.createBaseline('test-baseline', 'Hello World', style);

      expect(snapshot.id).toBe('test-baseline');
      expect(snapshot.textContent).toBe('Hello World');
      expect(snapshot.fontSize).toBe(16);
      expect(snapshot.fontFamily).toBe('Arial');
      expect(snapshot.color).toBe('#000000');
      expect(snapshot.backgroundColor).toBe('#ffffff');
      expect(snapshot.canvasData).toBe('data:image/png;base64,mockdata');
      expect(snapshot.metrics.width).toBe(100);
      expect(snapshot.metrics.renderTime).toBeGreaterThan(0);
    });

    it('should create a baseline with stroke and shadow effects', () => {
      const style = {
        fontSize: 20,
        fontFamily: 'Arial',
        color: '#ffffff',
        strokeColor: '#000000',
        strokeThickness: 2,
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4
      };

      const snapshot = tester.createBaseline('stroke-shadow-baseline', 'Styled Text', style);

      expect(snapshot.strokeColor).toBe('#000000');
      expect(snapshot.strokeThickness).toBe(2);
      expect(snapshot.shadowEnabled).toBe(true);
      expect(mockContext.strokeText).toHaveBeenCalled();
      expect(mockContext.shadowColor).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('should configure canvas context correctly', () => {
      const style = {
        fontSize: 18,
        fontFamily: 'Helvetica',
        color: '#333333'
      };

      tester.createBaseline('context-test', 'Test Text', style);

      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(mockContext.font).toBe('18px Helvetica');
      expect(mockContext.fillStyle).toBe('#333333');
      expect(mockContext.textAlign).toBe('left');
      expect(mockContext.textBaseline).toBe('top');
    });
  });

  describe('Regression Testing', () => {
    it('should test against baseline and return results', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#ffffff'
      };

      // Create baseline
      tester.createBaseline('regression-test', 'Test Text', style);

      // Test against baseline with same style (should pass)
      const result = tester.testAgainstBaseline('regression-test', 'Test Text', style, 0.95);

      expect(result.passed).toBe(true);
      expect(result.similarityScore).toBeGreaterThanOrEqual(0.95);
      expect(result.threshold).toBe(0.95);
      expect(result.baseline).toBeDefined();
      expect(result.current).toBeDefined();
    });

    it('should throw error when baseline not found', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      expect(() => {
        tester.testAgainstBaseline('nonexistent', 'Test', style);
      }).toThrow('No baseline found for id: nonexistent');
    });

    it('should detect differences when text changes', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      // Create baseline with original text
      tester.createBaseline('text-change-test', 'Original Text', style);

      // Test with different text
      const result = tester.testAgainstBaseline('text-change-test', 'Changed Text', style, 0.95);

      expect(result.baseline.textContent).toBe('Original Text');
      expect(result.current.textContent).toBe('Changed Text');
    });
  });

  describe('Pixel Comparison', () => {
    it('should calculate similarity score correctly', () => {
      // Mock getImageData to return different data for comparison
      let callCount = 0;
      mockContext.getImageData.mockImplementation(() => {
        callCount++;
        const data = new Uint8ClampedArray(800 * 600 * 4);
        
        if (callCount === 1) {
          // Baseline: all white pixels
          data.fill(255);
        } else {
          // Current: mostly white with some black pixels
          data.fill(255);
          for (let i = 0; i < 1000; i += 4) {
            data[i] = 0;     // R
            data[i + 1] = 0; // G
            data[i + 2] = 0; // B
            data[i + 3] = 255; // A
          }
        }
        
        return { data };
      });

      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#ffffff'
      };

      tester.createBaseline('pixel-test', 'Test', style);
      const result = tester.testAgainstBaseline('pixel-test', 'Test', style);

      expect(result.differences.length).toBeGreaterThan(0);
      expect(result.similarityScore).toBeLessThan(1.0);
    });
  });

  describe('Baseline Management', () => {
    it('should store and retrieve baselines', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      tester.createBaseline('baseline1', 'Text 1', style);
      tester.createBaseline('baseline2', 'Text 2', style);

      const baselines = tester.getBaselines();
      expect(baselines.size).toBe(2);
      expect(baselines.has('baseline1')).toBe(true);
      expect(baselines.has('baseline2')).toBe(true);
    });

    it('should clear all baselines', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      tester.createBaseline('baseline1', 'Text 1', style);
      tester.createBaseline('baseline2', 'Text 2', style);

      expect(tester.getBaselines().size).toBe(2);

      tester.clearBaselines();
      expect(tester.getBaselines().size).toBe(0);
    });

    it('should export and import baselines', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      tester.createBaseline('export-test', 'Export Text', style);

      const exported = tester.exportBaselines();
      expect(typeof exported).toBe('string');

      tester.clearBaselines();
      expect(tester.getBaselines().size).toBe(0);

      tester.importBaselines(exported);
      expect(tester.getBaselines().size).toBe(1);
      expect(tester.getBaselines().has('export-test')).toBe(true);
    });
  });

  describe('Color Parsing and Contrast', () => {
    it('should parse hex colors correctly', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#ffffff'
      };

      const snapshot = tester.createBaseline('color-test', 'Test', style);
      expect(snapshot.metrics.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should handle 3-digit hex colors', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000',
        backgroundColor: '#fff'
      };

      const snapshot = tester.createBaseline('short-hex-test', 'Test', style);
      expect(snapshot.metrics.contrastRatio).toBeGreaterThan(4.5);
    });
  });

  describe('Performance Metrics', () => {
    it('should measure render time', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      const snapshot = tester.createBaseline('performance-test', 'Test', style);
      expect(snapshot.metrics.renderTime).toBeGreaterThan(0);
      expect(typeof snapshot.metrics.renderTime).toBe('number');
    });

    it('should include pixel density in metrics', () => {
      const style = {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      };

      const snapshot = tester.createBaseline('density-test', 'Test', style);
      expect(snapshot.metrics.pixelDensity).toBeGreaterThan(0);
    });
  });
});