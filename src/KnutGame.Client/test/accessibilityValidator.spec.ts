import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessibilityValidator, accessibilityValidator } from '../src/utils/accessibilityValidator';

describe('AccessibilityValidator', () => {
  let validator: AccessibilityValidator;

  beforeEach(() => {
    validator = AccessibilityValidator.getInstance();
    validator.clearViolations();
    validator.setEnabled(true);
    
    // Mock console methods to avoid spam during tests
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Contrast Ratio Validation', () => {
    it('should validate high contrast text as compliant', () => {
      // Black text on white background
      const result = validator.validateContrastRatio('#000000', '#ffffff', 16, 'AA', 'test-element');
      
      expect(result.isValid).toBe(true);
      expect(result.contrastRatio).toBeGreaterThan(4.5);
      expect(result.wcagLevel).toBe('AA');
      expect(result.violation).toBeUndefined();
    });

    it('should detect insufficient contrast and create violation', () => {
      // Light gray text on white background (poor contrast)
      const result = validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA', 'test-element');
      
      expect(result.isValid).toBe(false);
      expect(result.contrastRatio).toBeLessThan(4.5);
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe('contrast');
      expect(result.violation?.severity).toBe('error');
    });

    it('should handle large text with lower contrast requirements', () => {
      // Test with large text (18px) which has lower contrast requirements
      const result = validator.validateContrastRatio('#666666', '#ffffff', 18, 'AA', 'large-text');
      
      expect(result.requiredRatio).toBe(3); // Large text requires 3:1 for AA
    });

    it('should handle AAA level requirements', () => {
      const result = validator.validateContrastRatio('#666666', '#ffffff', 16, 'AAA', 'aaa-text');
      
      expect(result.requiredRatio).toBe(7); // Normal text requires 7:1 for AAA
      expect(result.wcagLevel).toBe('AAA');
    });

    it('should handle hex number colors', () => {
      const result = validator.validateContrastRatio(0x000000, 0xffffff, 16, 'AA');
      
      expect(result.isValid).toBe(true);
      expect(result.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should handle rgb color strings', () => {
      const result = validator.validateContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 16, 'AA');
      
      expect(result.isValid).toBe(true);
      expect(result.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should skip validation when disabled', () => {
      validator.setEnabled(false);
      const result = validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA');
      
      expect(result.isValid).toBe(true);
      expect(result.contrastRatio).toBe(0);
    });
  });

  describe('Font Size Validation', () => {
    it('should validate adequate font sizes as compliant', () => {
      const result = validator.validateFontSize(16, 'test-text');
      
      expect(result.isValid).toBe(true);
      expect(result.actualSize).toBe(16);
      expect(result.minimumSize).toBe(14);
      expect(result.violation).toBeUndefined();
    });

    it('should detect font sizes that are too small', () => {
      const result = validator.validateFontSize(12, 'small-text');
      
      expect(result.isValid).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe('font-size');
      expect(result.violation?.severity).toBe('warning');
      expect(result.violation?.actualValue).toBe(12);
      expect(result.violation?.requiredValue).toBe(14);
    });

    it('should accept minimum font size', () => {
      const result = validator.validateFontSize(14, 'minimum-text');
      
      expect(result.isValid).toBe(true);
    });

    it('should skip validation when disabled', () => {
      validator.setEnabled(false);
      const result = validator.validateFontSize(10);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Background Contrast Validation', () => {
    it('should validate text against multiple background colors', () => {
      const results = validator.validateBackgroundContrast(
        '#000000',
        ['#ffffff', '#f0f0f0', '#cccccc'],
        'multi-bg-text'
      );
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true); // Black on white
      expect(results[1].isValid).toBe(true); // Black on light gray
      // Third result may vary depending on exact contrast
    });

    it('should detect poor background contrast', () => {
      const results = validator.validateBackgroundContrast(
        '#888888',
        ['#999999', '#aaaaaa'],
        'poor-contrast-text'
      );
      
      expect(results.some(r => !r.isValid)).toBe(true);
      expect(results.some(r => r.violation?.type === 'background-contrast')).toBe(true);
    });

    it('should return empty array when disabled', () => {
      validator.setEnabled(false);
      const results = validator.validateBackgroundContrast('#000000', ['#ffffff']);
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Violation Management', () => {
    it('should record and retrieve violations', () => {
      validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA', 'test1');
      validator.validateFontSize(10, 'test2');
      
      const violations = validator.getViolations();
      expect(violations).toHaveLength(2);
      expect(violations[0].type).toBe('contrast');
      expect(violations[1].type).toBe('font-size');
    });

    it('should filter violations by type', () => {
      validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA', 'test1');
      validator.validateFontSize(10, 'test2');
      
      const contrastViolations = validator.getViolationsByType('contrast');
      const fontSizeViolations = validator.getViolationsByType('font-size');
      
      expect(contrastViolations).toHaveLength(1);
      expect(fontSizeViolations).toHaveLength(1);
    });

    it('should clear violations', () => {
      validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA');
      expect(validator.getViolations()).toHaveLength(1);
      
      validator.clearViolations();
      expect(validator.getViolations()).toHaveLength(0);
    });
  });

  describe('Color Parsing', () => {
    it('should parse 3-digit hex colors', () => {
      const result = validator.validateContrastRatio('#000', '#fff', 16, 'AA');
      expect(result.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should parse 6-digit hex colors', () => {
      const result = validator.validateContrastRatio('#000000', '#ffffff', 16, 'AA');
      expect(result.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should parse rgb color strings', () => {
      const result = validator.validateContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 16, 'AA');
      expect(result.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should handle invalid color strings gracefully', () => {
      const result = validator.validateContrastRatio('invalid-color', '#ffffff', 16, 'AA');
      // Should not throw and should use default white color
      expect(result).toBeDefined();
    });
  });

  describe('WCAG Compliance Levels', () => {
    it('should correctly calculate AA requirements for normal text', () => {
      const result = validator.validateContrastRatio('#767676', '#ffffff', 16, 'AA');
      expect(result.requiredRatio).toBe(4.5);
    });

    it('should correctly calculate AA requirements for large text', () => {
      const result = validator.validateContrastRatio('#959595', '#ffffff', 18, 'AA');
      expect(result.requiredRatio).toBe(3);
    });

    it('should correctly calculate AAA requirements for normal text', () => {
      const result = validator.validateContrastRatio('#595959', '#ffffff', 16, 'AAA');
      expect(result.requiredRatio).toBe(7);
    });

    it('should correctly calculate AAA requirements for large text', () => {
      const result = validator.validateContrastRatio('#767676', '#ffffff', 18, 'AAA');
      expect(result.requiredRatio).toBe(4.5);
    });
  });

  describe('Console Logging', () => {
    it('should log error violations with appropriate styling', () => {
      validator.validateContrastRatio('#cccccc', '#ffffff', 16, 'AA', 'test-element');
      
      expect(console.group).toHaveBeenCalledWith(
        expect.stringContaining('ACCESSIBILITY ERROR'),
        expect.stringContaining('color: red')
      );
    });

    it('should log warning violations with appropriate styling', () => {
      validator.validateFontSize(10, 'test-element');
      
      expect(console.group).toHaveBeenCalledWith(
        expect.stringContaining('ACCESSIBILITY WARNING'),
        expect.stringContaining('color: orange')
      );
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AccessibilityValidator.getInstance();
      const instance2 = AccessibilityValidator.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(accessibilityValidator);
    });
  });
});