import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  hexToRgb,
  calculateLuminance,
  calculateLuminanceFromHex,
  calculateLuminanceFromNumber,
  calculateContrastRatio,
  calculateContrastRatioFromHex,
  calculateContrastRatioMixed,
  checkWcagCompliance,
  getDevicePixelRatio,
  getDeviceScalingFactor,
  calculateOptimalFontSize,
  createResponsiveFontSize,
  validateTextReadability,
  suggestTextColor,
  getMinimumFontSizes,
  TextReadabilityManager,
  type ScalingConfig,
  type ReadabilityMetrics
} from '../src/utils/textReadability'

describe('Text Readability Utilities', () => {
  describe('hexToRgb', () => {
    it('should convert 6-digit hex colors correctly', () => {
      expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
      expect(hexToRgb('#000000')).toEqual([0, 0, 0])
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0])
      expect(hexToRgb('#00ff00')).toEqual([0, 255, 0])
      expect(hexToRgb('#0000ff')).toEqual([0, 0, 255])
    })

    it('should convert 6-digit hex colors without # prefix', () => {
      expect(hexToRgb('ffffff')).toEqual([255, 255, 255])
      expect(hexToRgb('000000')).toEqual([0, 0, 0])
      expect(hexToRgb('ff0000')).toEqual([255, 0, 0])
    })

    it('should convert 3-digit hex colors correctly', () => {
      expect(hexToRgb('#fff')).toEqual([255, 255, 255])
      expect(hexToRgb('#000')).toEqual([0, 0, 0])
      expect(hexToRgb('#f00')).toEqual([255, 0, 0])
      expect(hexToRgb('#0f0')).toEqual([0, 255, 0])
      expect(hexToRgb('#00f')).toEqual([0, 0, 255])
    })

    it('should convert 3-digit hex colors without # prefix', () => {
      expect(hexToRgb('fff')).toEqual([255, 255, 255])
      expect(hexToRgb('000')).toEqual([0, 0, 0])
      expect(hexToRgb('f00')).toEqual([255, 0, 0])
    })
  })

  describe('calculateLuminance', () => {
    it('should calculate correct luminance for pure colors', () => {
      // White should have luminance of 1
      expect(calculateLuminance(255, 255, 255)).toBeCloseTo(1, 5)
      
      // Black should have luminance of 0
      expect(calculateLuminance(0, 0, 0)).toBeCloseTo(0, 5)
      
      // Pure red
      const redLuminance = calculateLuminance(255, 0, 0)
      expect(redLuminance).toBeCloseTo(0.2126, 4)
      
      // Pure green
      const greenLuminance = calculateLuminance(0, 255, 0)
      expect(greenLuminance).toBeCloseTo(0.7152, 4)
      
      // Pure blue
      const blueLuminance = calculateLuminance(0, 0, 255)
      expect(blueLuminance).toBeCloseTo(0.0722, 4)
    })

    it('should handle gamma correction correctly', () => {
      // Test a mid-range color
      const luminance = calculateLuminance(128, 128, 128)
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
      expect(luminance).toBeCloseTo(0.2159, 3)
    })
  })

  describe('calculateLuminanceFromHex', () => {
    it('should calculate luminance from hex colors', () => {
      expect(calculateLuminanceFromHex('#ffffff')).toBeCloseTo(1, 5)
      expect(calculateLuminanceFromHex('#000000')).toBeCloseTo(0, 5)
      expect(calculateLuminanceFromHex('#ff0000')).toBeCloseTo(0.2126, 4)
      expect(calculateLuminanceFromHex('#00ff00')).toBeCloseTo(0.7152, 4)
      expect(calculateLuminanceFromHex('#0000ff')).toBeCloseTo(0.0722, 4)
    })
  })

  describe('calculateLuminanceFromNumber', () => {
    it('should calculate luminance from numeric colors', () => {
      expect(calculateLuminanceFromNumber(0xffffff)).toBeCloseTo(1, 5)
      expect(calculateLuminanceFromNumber(0x000000)).toBeCloseTo(0, 5)
      expect(calculateLuminanceFromNumber(0xff0000)).toBeCloseTo(0.2126, 4)
      expect(calculateLuminanceFromNumber(0x00ff00)).toBeCloseTo(0.7152, 4)
      expect(calculateLuminanceFromNumber(0x0000ff)).toBeCloseTo(0.0722, 4)
    })
  })

  describe('calculateContrastRatio', () => {
    it('should calculate correct contrast ratios', () => {
      // White on black should be maximum contrast (21:1)
      const maxContrast = calculateContrastRatio(1, 0)
      expect(maxContrast).toBeCloseTo(21, 1)
      
      // Same colors should have 1:1 contrast
      expect(calculateContrastRatio(0.5, 0.5)).toBeCloseTo(1, 5)
      expect(calculateContrastRatio(1, 1)).toBeCloseTo(1, 5)
      expect(calculateContrastRatio(0, 0)).toBeCloseTo(1, 5)
    })

    it('should handle luminance order correctly', () => {
      // Should give same result regardless of parameter order
      const contrast1 = calculateContrastRatio(0.8, 0.2)
      const contrast2 = calculateContrastRatio(0.2, 0.8)
      expect(contrast1).toBeCloseTo(contrast2, 5)
    })
  })

  describe('calculateContrastRatioFromHex', () => {
    it('should calculate contrast ratios from hex colors', () => {
      // White on black
      const whiteBlack = calculateContrastRatioFromHex('#ffffff', '#000000')
      expect(whiteBlack).toBeCloseTo(21, 1)
      
      // Same colors
      const sameSame = calculateContrastRatioFromHex('#808080', '#808080')
      expect(sameSame).toBeCloseTo(1, 5)
    })
  })

  describe('calculateContrastRatioMixed', () => {
    it('should calculate contrast ratios between hex and numeric colors', () => {
      const contrast = calculateContrastRatioMixed('#ffffff', 0x000000)
      expect(contrast).toBeCloseTo(21, 1)
      
      const contrast2 = calculateContrastRatioMixed('#000000', 0xffffff)
      expect(contrast2).toBeCloseTo(21, 1)
    })
  })

  describe('checkWcagCompliance', () => {
    it('should correctly identify AA compliance for normal text', () => {
      // 4.5:1 is minimum for AA normal text
      expect(checkWcagCompliance(4.5, 16)).toBe('AA')
      expect(checkWcagCompliance(4.4, 16)).toBe('fail')
      expect(checkWcagCompliance(7.0, 16)).toBe('AAA')
      expect(checkWcagCompliance(6.9, 16)).toBe('AA')
    })

    it('should correctly identify AA compliance for large text', () => {
      // 3:1 is minimum for AA large text (24px+)
      expect(checkWcagCompliance(3.0, 24)).toBe('AA')
      expect(checkWcagCompliance(2.9, 24)).toBe('fail')
      expect(checkWcagCompliance(4.5, 24)).toBe('AAA')
      expect(checkWcagCompliance(4.4, 24)).toBe('AA')
    })

    it('should correctly identify AA compliance for bold large text', () => {
      // 3:1 is minimum for AA bold large text (18.66px+)
      expect(checkWcagCompliance(3.0, 19, true)).toBe('AA')
      expect(checkWcagCompliance(2.9, 19, true)).toBe('fail')
      expect(checkWcagCompliance(4.5, 19, true)).toBe('AAA')
    })

    it('should treat small bold text as normal text', () => {
      // Bold text under 18.66px should use normal text rules
      expect(checkWcagCompliance(4.5, 16, true)).toBe('AA')
      expect(checkWcagCompliance(4.4, 16, true)).toBe('fail')
    })
  })

  describe('Device and Scaling Functions', () => {
    beforeEach(() => {
      // Reset global mocks
      vi.unstubAllGlobals()
    })

    describe('getDevicePixelRatio', () => {
      it('should return device pixel ratio clamped to maximum of 2', () => {
        vi.stubGlobal('devicePixelRatio', 1.5)
        expect(getDevicePixelRatio()).toBe(1.5)
        
        vi.stubGlobal('devicePixelRatio', 3.0)
        expect(getDevicePixelRatio()).toBe(2)
        
        vi.stubGlobal('devicePixelRatio', undefined)
        expect(getDevicePixelRatio()).toBe(1)
      })
    })

    describe('getDeviceScalingFactor', () => {
      it('should calculate scaling factor based on screen size', () => {
        vi.stubGlobal('screen', { width: 375, height: 667 })
        vi.stubGlobal('devicePixelRatio', 1)
        
        const factor = getDeviceScalingFactor()
        expect(factor).toBeGreaterThan(0.8)
        expect(factor).toBeLessThan(2.0)
      })

      it('should handle missing screen object', () => {
        vi.stubGlobal('screen', undefined)
        vi.stubGlobal('innerWidth', 1024)
        vi.stubGlobal('innerHeight', 768)
        vi.stubGlobal('devicePixelRatio', 1)
        
        const factor = getDeviceScalingFactor()
        expect(factor).toBeGreaterThan(0.8)
        expect(factor).toBeLessThanOrEqual(2.0)
      })

      it('should apply DPR adjustment', () => {
        vi.stubGlobal('screen', { width: 375, height: 667 })
        vi.stubGlobal('devicePixelRatio', 2)
        
        const factor = getDeviceScalingFactor()
        expect(factor).toBeGreaterThan(1.0)
      })
    })

    describe('calculateOptimalFontSize', () => {
      it('should scale font size based on device factor', () => {
        const config: ScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0
        }
        
        const size = calculateOptimalFontSize(config)
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })

      it('should respect minimum size constraints', () => {
        const config: ScalingConfig = {
          baseSize: 8,
          minSize: 14,
          maxSize: 24,
          scalingFactor: 0.5
        }
        
        const size = calculateOptimalFontSize(config)
        expect(size).toBeGreaterThanOrEqual(config.minSize)
      })

      it('should respect maximum size constraints', () => {
        const config: ScalingConfig = {
          baseSize: 20,
          minSize: 12,
          maxSize: 18,
          scalingFactor: 2.0
        }
        
        const size = calculateOptimalFontSize(config)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })
    })

    describe('createResponsiveFontSize', () => {
      it('should return font size as pixel string', () => {
        const config: ScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0
        }
        
        const sizeString = createResponsiveFontSize(config)
        expect(sizeString).toMatch(/^\d+px$/)
        
        const size = parseInt(sizeString.replace('px', ''))
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })
    })
  })

  describe('validateTextReadability', () => {
    it('should return comprehensive readability metrics', () => {
      const metrics = validateTextReadability('#ffffff', '#000000', 16, false)
      
      expect(metrics).toHaveProperty('contrastRatio')
      expect(metrics).toHaveProperty('fontSize')
      expect(metrics).toHaveProperty('textLuminance')
      expect(metrics).toHaveProperty('backgroundLuminance')
      expect(metrics).toHaveProperty('wcagCompliance')
      
      expect(metrics.contrastRatio).toBeCloseTo(21, 1)
      expect(metrics.fontSize).toBe(16)
      expect(metrics.wcagCompliance).toBe('AAA')
    })

    it('should work with numeric background colors', () => {
      const metrics = validateTextReadability('#ffffff', 0x000000, 16, false)
      expect(metrics.contrastRatio).toBeCloseTo(21, 1)
      expect(metrics.wcagCompliance).toBe('AAA')
    })

    it('should identify failing contrast', () => {
      const metrics = validateTextReadability('#888888', '#999999', 16, false)
      expect(metrics.wcagCompliance).toBe('fail')
    })
  })

  describe('suggestTextColor', () => {
    it('should suggest white for dark backgrounds', () => {
      const suggestion = suggestTextColor('#000000')
      expect(suggestion).toBe('#ffffff')
    })

    it('should suggest black for light backgrounds', () => {
      const suggestion = suggestTextColor('#ffffff')
      expect(suggestion).toBe('#000000')
    })

    it('should work with numeric colors', () => {
      const suggestion = suggestTextColor(0x000000)
      expect(suggestion).toBe('#ffffff')
    })

    it('should choose better option when neither meets target', () => {
      // Medium gray background - neither black nor white will meet high contrast
      const suggestion = suggestTextColor('#808080', 10.0) // Very high target
      expect(suggestion).toMatch(/^#(ffffff|000000)$/)
    })
  })

  describe('getMinimumFontSizes', () => {
    beforeEach(() => {
      vi.unstubAllGlobals()
    })

    it('should return mobile sizes for mobile devices', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      })
      
      const sizes = getMinimumFontSizes()
      expect(sizes.body).toBe(16)
      expect(sizes.secondary).toBe(14)
      expect(sizes.large).toBe(20)
    })

    it('should return desktop sizes for desktop devices', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      })
      
      const sizes = getMinimumFontSizes()
      expect(sizes.body).toBe(14)
      expect(sizes.secondary).toBe(12)
      expect(sizes.large).toBe(18)
    })

    it('should handle missing navigator', () => {
      vi.stubGlobal('navigator', undefined)
      
      const sizes = getMinimumFontSizes()
      expect(sizes).toHaveProperty('body')
      expect(sizes).toHaveProperty('secondary')
      expect(sizes).toHaveProperty('large')
    })
  })

  describe('TextReadabilityManager', () => {
    let manager: TextReadabilityManager

    beforeEach(() => {
      vi.unstubAllGlobals()
      manager = new TextReadabilityManager()
    })

    describe('isAccessible', () => {
      it('should return true for accessible text combinations', () => {
        expect(manager.isAccessible('#ffffff', '#000000', 16)).toBe(true)
        expect(manager.isAccessible('#000000', '#ffffff', 16)).toBe(true)
      })

      it('should return false for inaccessible text combinations', () => {
        expect(manager.isAccessible('#888888', '#999999', 16)).toBe(false)
        expect(manager.isAccessible('#cccccc', '#dddddd', 16)).toBe(false)
      })

      it('should work with numeric background colors', () => {
        expect(manager.isAccessible('#ffffff', 0x000000, 16)).toBe(true)
        expect(manager.isAccessible('#888888', 0x999999, 16)).toBe(false)
      })
    })

    describe('getScalingFactor', () => {
      it('should return the device scaling factor', () => {
        const factor = manager.getScalingFactor()
        expect(typeof factor).toBe('number')
        expect(factor).toBeGreaterThan(0)
      })
    })

    describe('getMinimumSizes', () => {
      it('should return minimum font sizes', () => {
        const sizes = manager.getMinimumSizes()
        expect(sizes).toHaveProperty('body')
        expect(sizes).toHaveProperty('secondary')
        expect(sizes).toHaveProperty('large')
        expect(typeof sizes.body).toBe('number')
        expect(typeof sizes.secondary).toBe('number')
        expect(typeof sizes.large).toBe('number')
      })
    })

    describe('createScaledFontSize', () => {
      it('should create scaled font sizes with minimum constraints', () => {
        const bodySize = manager.createScaledFontSize(16, 'body')
        const secondarySize = manager.createScaledFontSize(14, 'secondary')
        const largeSize = manager.createScaledFontSize(20, 'large')
        
        expect(bodySize).toMatch(/^\d+px$/)
        expect(secondarySize).toMatch(/^\d+px$/)
        expect(largeSize).toMatch(/^\d+px$/)
        
        const bodyPx = parseInt(bodySize.replace('px', ''))
        const secondaryPx = parseInt(secondarySize.replace('px', ''))
        const largePx = parseInt(largeSize.replace('px', ''))
        
        const minSizes = manager.getMinimumSizes()
        expect(bodyPx).toBeGreaterThanOrEqual(minSizes.body)
        expect(secondaryPx).toBeGreaterThanOrEqual(minSizes.secondary)
        expect(largePx).toBeGreaterThanOrEqual(minSizes.large)
      })

      it('should default to body type when no type specified', () => {
        const size = manager.createScaledFontSize(16)
        expect(size).toMatch(/^\d+px$/)
        
        const px = parseInt(size.replace('px', ''))
        const minSizes = manager.getMinimumSizes()
        expect(px).toBeGreaterThanOrEqual(minSizes.body)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid hex colors gracefully', () => {
      // These should not throw errors, though results may be unexpected
      expect(() => hexToRgb('')).not.toThrow()
      expect(() => hexToRgb('invalid')).not.toThrow()
      expect(() => calculateLuminanceFromHex('invalid')).not.toThrow()
    })

    it('should handle extreme luminance values', () => {
      expect(calculateContrastRatio(0, 0)).toBeCloseTo(1, 5)
      expect(calculateContrastRatio(1, 1)).toBeCloseTo(1, 5)
      expect(calculateContrastRatio(0, 1)).toBeCloseTo(21, 1)
    })

    it('should handle extreme font sizes in WCAG compliance', () => {
      expect(checkWcagCompliance(4.5, 1)).toBe('AA') // Very small font
      expect(checkWcagCompliance(4.5, 1000)).toBe('AAA') // Very large font
    })

    it('should handle extreme scaling configurations', () => {
      const extremeConfig: ScalingConfig = {
        baseSize: 1000,
        minSize: 1,
        maxSize: 10,
        scalingFactor: 0.001
      }
      
      const size = calculateOptimalFontSize(extremeConfig)
      expect(size).toBeGreaterThanOrEqual(extremeConfig.minSize)
      expect(size).toBeLessThanOrEqual(extremeConfig.maxSize)
    })
  })
})