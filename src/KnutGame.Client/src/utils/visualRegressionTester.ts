/**
 * Visual regression testing utilities for text rendering validation
 */

export interface TextRenderingSnapshot {
  id: string;
  timestamp: number;
  textContent: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeThickness?: number;
  shadowEnabled?: boolean;
  canvasData: string; // Base64 encoded canvas data
  metrics: TextRenderingMetrics;
}

export interface TextRenderingMetrics {
  width: number;
  height: number;
  actualBounds: { x: number; y: number; width: number; height: number };
  pixelDensity: number;
  renderTime: number;
  contrastRatio?: number;
}

export interface RegressionTestResult {
  passed: boolean;
  differences: PixelDifference[];
  similarityScore: number;
  threshold: number;
  baseline: TextRenderingSnapshot;
  current: TextRenderingSnapshot;
}

export interface PixelDifference {
  x: number;
  y: number;
  baselineColor: { r: number; g: number; b: number; a: number };
  currentColor: { r: number; g: number; b: number; a: number };
  difference: number;
}

/**
 * Visual regression tester for text rendering
 */
export class VisualRegressionTester {
  private baselines: Map<string, TextRenderingSnapshot> = new Map();
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.context = this.canvas.getContext('2d')!;
  }

  /**
   * Create a baseline snapshot for text rendering
   */
  createBaseline(
    id: string,
    text: string,
    style: {
      fontSize: number;
      fontFamily: string;
      color: string;
      backgroundColor?: string;
      strokeColor?: string;
      strokeThickness?: number;
      shadowEnabled?: boolean;
      shadowColor?: string;
      shadowOffsetX?: number;
      shadowOffsetY?: number;
      shadowBlur?: number;
    }
  ): TextRenderingSnapshot {
    const startTime = performance.now();
    
    // Clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Set background if specified
    if (style.backgroundColor) {
      this.context.fillStyle = style.backgroundColor;
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Configure text style
    this.context.font = `${style.fontSize}px ${style.fontFamily}`;
    this.context.fillStyle = style.color;
    this.context.textAlign = 'left';
    this.context.textBaseline = 'top';
    
    // Configure stroke if specified
    if (style.strokeColor && style.strokeThickness) {
      this.context.strokeStyle = style.strokeColor;
      this.context.lineWidth = style.strokeThickness;
    }
    
    // Configure shadow if enabled
    if (style.shadowEnabled) {
      this.context.shadowColor = style.shadowColor || 'rgba(0, 0, 0, 0.5)';
      this.context.shadowOffsetX = style.shadowOffsetX || 2;
      this.context.shadowOffsetY = style.shadowOffsetY || 2;
      this.context.shadowBlur = style.shadowBlur || 4;
    }
    
    // Measure text
    const textMetrics = this.context.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = style.fontSize; // Approximate height
    
    // Position text in center
    const x = (this.canvas.width - textWidth) / 2;
    const y = (this.canvas.height - textHeight) / 2;
    
    // Draw stroke first if specified
    if (style.strokeColor && style.strokeThickness) {
      this.context.strokeText(text, x, y);
    }
    
    // Draw fill text
    this.context.fillText(text, x, y);
    
    const renderTime = performance.now() - startTime;
    
    // Get actual text bounds
    const actualBounds = this.getTextBounds(text, x, y, textWidth, textHeight);
    
    // Create snapshot
    const snapshot: TextRenderingSnapshot = {
      id,
      timestamp: Date.now(),
      textContent: text,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      color: style.color,
      backgroundColor: style.backgroundColor,
      strokeColor: style.strokeColor,
      strokeThickness: style.strokeThickness,
      shadowEnabled: style.shadowEnabled,
      canvasData: this.canvas.toDataURL(),
      metrics: {
        width: textWidth,
        height: textHeight,
        actualBounds,
        pixelDensity: window.devicePixelRatio || 1,
        renderTime,
        contrastRatio: style.backgroundColor ? this.calculateContrastRatio(style.color, style.backgroundColor) : undefined
      }
    };
    
    // Store as baseline
    this.baselines.set(id, snapshot);
    
    return snapshot;
  }

  /**
   * Test current rendering against baseline
   */
  testAgainstBaseline(
    id: string,
    text: string,
    style: any,
    threshold: number = 0.95
  ): RegressionTestResult {
    const baseline = this.baselines.get(id);
    if (!baseline) {
      throw new Error(`No baseline found for id: ${id}`);
    }
    
    // Create current snapshot
    const current = this.createSnapshot(id + '_current', text, style);
    
    // Compare snapshots
    const differences = this.compareSnapshots(baseline, current);
    const similarityScore = this.calculateSimilarityScore(differences, this.canvas.width * this.canvas.height);
    
    return {
      passed: similarityScore >= threshold,
      differences,
      similarityScore,
      threshold,
      baseline,
      current
    };
  }

  /**
   * Create a snapshot without storing as baseline
   */
  private createSnapshot(id: string, text: string, style: any): TextRenderingSnapshot {
    // Same logic as createBaseline but without storing
    const startTime = performance.now();
    
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (style.backgroundColor) {
      this.context.fillStyle = style.backgroundColor;
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    this.context.font = `${style.fontSize}px ${style.fontFamily}`;
    this.context.fillStyle = style.color;
    this.context.textAlign = 'left';
    this.context.textBaseline = 'top';
    
    if (style.strokeColor && style.strokeThickness) {
      this.context.strokeStyle = style.strokeColor;
      this.context.lineWidth = style.strokeThickness;
    }
    
    if (style.shadowEnabled) {
      this.context.shadowColor = style.shadowColor || 'rgba(0, 0, 0, 0.5)';
      this.context.shadowOffsetX = style.shadowOffsetX || 2;
      this.context.shadowOffsetY = style.shadowOffsetY || 2;
      this.context.shadowBlur = style.shadowBlur || 4;
    }
    
    const textMetrics = this.context.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = style.fontSize;
    
    const x = (this.canvas.width - textWidth) / 2;
    const y = (this.canvas.height - textHeight) / 2;
    
    if (style.strokeColor && style.strokeThickness) {
      this.context.strokeText(text, x, y);
    }
    
    this.context.fillText(text, x, y);
    
    const renderTime = performance.now() - startTime;
    const actualBounds = this.getTextBounds(text, x, y, textWidth, textHeight);
    
    return {
      id,
      timestamp: Date.now(),
      textContent: text,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      color: style.color,
      backgroundColor: style.backgroundColor,
      strokeColor: style.strokeColor,
      strokeThickness: style.strokeThickness,
      shadowEnabled: style.shadowEnabled,
      canvasData: this.canvas.toDataURL(),
      metrics: {
        width: textWidth,
        height: textHeight,
        actualBounds,
        pixelDensity: window.devicePixelRatio || 1,
        renderTime,
        contrastRatio: style.backgroundColor ? this.calculateContrastRatio(style.color, style.backgroundColor) : undefined
      }
    };
  }

  /**
   * Compare two snapshots pixel by pixel
   */
  private compareSnapshots(baseline: TextRenderingSnapshot, current: TextRenderingSnapshot): PixelDifference[] {
    const differences: PixelDifference[] = [];
    
    // Create temporary canvases for comparison
    const baselineCanvas = document.createElement('canvas');
    const currentCanvas = document.createElement('canvas');
    
    baselineCanvas.width = currentCanvas.width = this.canvas.width;
    baselineCanvas.height = currentCanvas.height = this.canvas.height;
    
    const baselineCtx = baselineCanvas.getContext('2d')!;
    const currentCtx = currentCanvas.getContext('2d')!;
    
    // Load baseline image
    const baselineImg = new Image();
    baselineImg.src = baseline.canvasData;
    baselineCtx.drawImage(baselineImg, 0, 0);
    
    // Load current image
    const currentImg = new Image();
    currentImg.src = current.canvasData;
    currentCtx.drawImage(currentImg, 0, 0);
    
    // Get image data
    const baselineData = baselineCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const currentData = currentCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Compare pixels
    for (let i = 0; i < baselineData.data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % this.canvas.width;
      const y = Math.floor(pixelIndex / this.canvas.width);
      
      const baselineColor = {
        r: baselineData.data[i],
        g: baselineData.data[i + 1],
        b: baselineData.data[i + 2],
        a: baselineData.data[i + 3]
      };
      
      const currentColor = {
        r: currentData.data[i],
        g: currentData.data[i + 1],
        b: currentData.data[i + 2],
        a: currentData.data[i + 3]
      };
      
      const difference = this.calculatePixelDifference(baselineColor, currentColor);
      
      if (difference > 0.01) { // Threshold for considering pixels different
        differences.push({
          x,
          y,
          baselineColor,
          currentColor,
          difference
        });
      }
    }
    
    return differences;
  }

  /**
   * Calculate similarity score based on pixel differences
   */
  private calculateSimilarityScore(differences: PixelDifference[], totalPixels: number): number {
    if (differences.length === 0) return 1.0;
    
    const differentPixels = differences.length;
    const similarPixels = totalPixels - differentPixels;
    
    return similarPixels / totalPixels;
  }

  /**
   * Calculate difference between two pixel colors
   */
  private calculatePixelDifference(
    color1: { r: number; g: number; b: number; a: number },
    color2: { r: number; g: number; b: number; a: number }
  ): number {
    const rDiff = Math.abs(color1.r - color2.r) / 255;
    const gDiff = Math.abs(color1.g - color2.g) / 255;
    const bDiff = Math.abs(color1.b - color2.b) / 255;
    const aDiff = Math.abs(color1.a - color2.a) / 255;
    
    return (rDiff + gDiff + bDiff + aDiff) / 4;
  }

  /**
   * Get actual text bounds (simplified)
   */
  private getTextBounds(_text: string, x: number, y: number, width: number, height: number) {
    return { x, y, width, height };
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    const luminance1 = this.calculateLuminance(color1);
    const luminance2 = this.calculateLuminance(color2);
    
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calculate luminance of a color
   */
  private calculateLuminance(color: string): number {
    // Simplified luminance calculation
    const rgb = this.parseColor(color);
    const sR = rgb.r / 255;
    const sG = rgb.g / 255;
    const sB = rgb.b / 255;
    
    const rLum = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const gLum = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const bLum = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * rLum + 0.7152 * gLum + 0.0722 * bLum;
  }

  /**
   * Parse color string to RGB
   */
  private parseColor(color: string): { r: number; g: number; b: number } {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    }
    
    // Default to white
    return { r: 255, g: 255, b: 255 };
  }

  /**
   * Get all baselines
   */
  getBaselines(): Map<string, TextRenderingSnapshot> {
    return new Map(this.baselines);
  }

  /**
   * Clear all baselines
   */
  clearBaselines(): void {
    this.baselines.clear();
  }

  /**
   * Export baselines to JSON
   */
  exportBaselines(): string {
    const baselineArray = Array.from(this.baselines.entries());
    return JSON.stringify(baselineArray, null, 2);
  }

  /**
   * Import baselines from JSON
   */
  importBaselines(json: string): void {
    const baselineArray = JSON.parse(json);
    this.baselines = new Map(baselineArray);
  }
}