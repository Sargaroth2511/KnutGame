/**
 * Accessibility validation utilities for runtime WCAG compliance checking
 */

export interface AccessibilityViolation {
  type: 'contrast' | 'font-size' | 'background-contrast';
  severity: 'warning' | 'error';
  message: string;
  element?: string;
  actualValue?: number;
  requiredValue?: number;
  wcagLevel?: 'AA' | 'AAA';
}

export interface ContrastValidationResult {
  isValid: boolean;
  contrastRatio: number;
  requiredRatio: number;
  wcagLevel: 'AA' | 'AAA';
  violation?: AccessibilityViolation;
}

export interface FontSizeValidationResult {
  isValid: boolean;
  actualSize: number;
  minimumSize: number;
  violation?: AccessibilityViolation;
}

/**
 * Runtime accessibility validator for development and testing
 */
export class AccessibilityValidator {
  private static instance: AccessibilityValidator;
  private violations: AccessibilityViolation[] = [];
  private isEnabled: boolean = true;

  static getInstance(): AccessibilityValidator {
    if (!AccessibilityValidator.instance) {
      AccessibilityValidator.instance = new AccessibilityValidator();
    }
    return AccessibilityValidator.instance;
  }

  /**
   * Enable or disable accessibility validation
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Validate contrast ratio between text and background colors
   */
  validateContrastRatio(
    textColor: string | number,
    backgroundColor: string | number,
    fontSize: number,
    wcagLevel: 'AA' | 'AAA' = 'AA',
    elementName?: string
  ): ContrastValidationResult {
    if (!this.isEnabled) {
      return { isValid: true, contrastRatio: 0, requiredRatio: 0, wcagLevel };
    }

    const textLuminance = this.calculateLuminance(textColor);
    const backgroundLuminance = this.calculateLuminance(backgroundColor);
    const contrastRatio = this.calculateContrastRatio(textLuminance, backgroundLuminance);

    // Determine required contrast ratio based on font size and WCAG level
    // Large text is 18px+ normal or 14px+ bold (we assume normal weight here)
    const isLargeText = fontSize >= 18;
    const requiredRatio = this.getRequiredContrastRatio(isLargeText, wcagLevel);

    const isValid = contrastRatio >= requiredRatio;

    if (!isValid) {
      const violation: AccessibilityViolation = {
        type: 'contrast',
        severity: 'error',
        message: `Insufficient contrast ratio: ${contrastRatio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
        element: elementName,
        actualValue: contrastRatio,
        requiredValue: requiredRatio,
        wcagLevel
      };

      this.addViolation(violation);
      this.logViolation(violation);

      return { isValid: false, contrastRatio, requiredRatio, wcagLevel, violation };
    }

    return { isValid: true, contrastRatio, requiredRatio, wcagLevel };
  }

  /**
   * Validate font size meets minimum accessibility requirements
   */
  validateFontSize(fontSize: number, elementName?: string): FontSizeValidationResult {
    if (!this.isEnabled) {
      return { isValid: true, actualSize: fontSize, minimumSize: 0 };
    }

    const minimumSize = 14; // Minimum 14px for accessibility
    const isValid = fontSize >= minimumSize;

    if (!isValid) {
      const violation: AccessibilityViolation = {
        type: 'font-size',
        severity: 'warning',
        message: `Font size too small: ${fontSize}px (minimum: ${minimumSize}px)`,
        element: elementName,
        actualValue: fontSize,
        requiredValue: minimumSize
      };

      this.addViolation(violation);
      this.logViolation(violation);

      return { isValid: false, actualSize: fontSize, minimumSize, violation };
    }

    return { isValid: true, actualSize: fontSize, minimumSize };
  }

  /**
   * Validate text background provides sufficient contrast
   */
  validateBackgroundContrast(
    textColor: string | number,
    backgroundColors: (string | number)[],
    elementName?: string
  ): ContrastValidationResult[] {
    if (!this.isEnabled) {
      return [];
    }

    const results: ContrastValidationResult[] = [];
    const textLuminance = this.calculateLuminance(textColor);

    for (const backgroundColor of backgroundColors) {
      const backgroundLuminance = this.calculateLuminance(backgroundColor);
      const contrastRatio = this.calculateContrastRatio(textLuminance, backgroundLuminance);
      const requiredRatio = 4.5; // WCAG AA standard

      const isValid = contrastRatio >= requiredRatio;

      if (!isValid) {
        const violation: AccessibilityViolation = {
          type: 'background-contrast',
          severity: 'warning',
          message: `Insufficient background contrast: ${contrastRatio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
          element: elementName,
          actualValue: contrastRatio,
          requiredValue: requiredRatio,
          wcagLevel: 'AA'
        };

        this.addViolation(violation);
        this.logViolation(violation);

        results.push({ isValid: false, contrastRatio, requiredRatio, wcagLevel: 'AA', violation });
      } else {
        results.push({ isValid: true, contrastRatio, requiredRatio, wcagLevel: 'AA' });
      }
    }

    return results;
  }

  /**
   * Get all recorded violations
   */
  getViolations(): AccessibilityViolation[] {
    return [...this.violations];
  }

  /**
   * Clear all recorded violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get violations by type
   */
  getViolationsByType(type: AccessibilityViolation['type']): AccessibilityViolation[] {
    return this.violations.filter(v => v.type === type);
  }

  /**
   * Calculate luminance of a color
   */
  private calculateLuminance(color: string | number): number {
    let r: number, g: number, b: number;

    if (typeof color === 'number') {
      // Convert hex number to RGB
      r = (color >> 16) & 0xFF;
      g = (color >> 8) & 0xFF;
      b = color & 0xFF;
    } else {
      // Parse color string
      const rgb = this.parseColorString(color);
      r = rgb.r;
      g = rgb.g;
      b = rgb.b;
    }

    // Convert to relative luminance
    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;

    const rLum = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const gLum = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const bLum = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);

    return 0.2126 * rLum + 0.7152 * gLum + 0.0722 * bLum;
  }

  /**
   * Calculate contrast ratio between two luminance values
   */
  private calculateContrastRatio(luminance1: number, luminance2: number): number {
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Get required contrast ratio based on text size and WCAG level
   */
  private getRequiredContrastRatio(isLargeText: boolean, wcagLevel: 'AA' | 'AAA'): number {
    if (wcagLevel === 'AAA') {
      return isLargeText ? 4.5 : 7;
    }
    return isLargeText ? 3 : 4.5;
  }

  /**
   * Parse color string to RGB values
   */
  private parseColorString(color: string): { r: number; g: number; b: number } {
    // Handle hex colors
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

    // Handle rgb() colors
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }

    // Default to white if parsing fails
    console.warn(`Unable to parse color: ${color}, defaulting to white`);
    return { r: 255, g: 255, b: 255 };
  }

  /**
   * Add violation to the list
   */
  private addViolation(violation: AccessibilityViolation): void {
    this.violations.push(violation);
  }

  /**
   * Log violation to console with appropriate styling
   */
  private logViolation(violation: AccessibilityViolation): void {
    const prefix = violation.severity === 'error' ? '🚨 ACCESSIBILITY ERROR' : '⚠️ ACCESSIBILITY WARNING';
    const style = violation.severity === 'error' ? 'color: red; font-weight: bold' : 'color: orange; font-weight: bold';
    
    console.group(`%c${prefix}`, style);
    console.log(`Type: ${violation.type}`);
    console.log(`Message: ${violation.message}`);
    if (violation.element) {
      console.log(`Element: ${violation.element}`);
    }
    if (violation.actualValue !== undefined && violation.requiredValue !== undefined) {
      console.log(`Actual: ${violation.actualValue}, Required: ${violation.requiredValue}`);
    }
    if (violation.wcagLevel) {
      console.log(`WCAG Level: ${violation.wcagLevel}`);
    }
    console.groupEnd();
  }
}

/**
 * Global accessibility validator instance
 */
export const accessibilityValidator = AccessibilityValidator.getInstance();