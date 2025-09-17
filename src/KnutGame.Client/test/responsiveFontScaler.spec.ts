import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ResponsiveFontScaler,
  getResponsiveFontScaler,
  createResponsiveFontSize,
  getDeviceScalingFactor,
  type DeviceInfo,
  type ViewportScalingConfig,
  type FontSizeConstraints
} from '../src/utils/responsiveFontScaler'
import { type ScalingConfig } from '../src/utils/textReadability'

describe('ResponsiveFontScaler', () => {
  let scaler: ResponsiveFontScaler

  beforeEach(() => {
    // Reset all global mocks
    vi.unstubAllGlobals()
    
    // Set up default browser environment
    vi.stubGlobal('innerWidth', 1024)
    vi.stubGlobal('innerHeight', 768)
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('screen', { width: 1024, height: 768 })
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn()
    }))
    
    // Mock document.body
    Object.defineProperty(document, 'body', {
      value: document.createElement('body'),
      writable: true
    })
    
    scaler = new ResponsiveFontScaler()
  })

  afterEach(() => {
    scaler.destroy()
    vi.unstubAllGlobals()
  })

  describe('Device Detection', () => {
    describe('Desktop Detection', () => {
      beforeEach(() => {
        vi.stubGlobal('innerWidth', 1024)
        vi.stubGlobal('innerHeight', 768)
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        // Ensure no touch support
        delete (globalThis as any).ontouchstart
        scaler = new ResponsiveFontScaler()
      })

      it('should detect desktop device correctly', () => {
        const deviceInfo = scaler.getDeviceInfo()
        expect(deviceInfo.type).toBe('desktop')
        expect(deviceInfo.isTouchDevice).toBe(false)
        expect(deviceInfo.orientation).toBe('landscape')
      })
    })

    describe('Mobile Detection', () => {
      beforeEach(() => {
        vi.stubGlobal('innerWidth', 375)
        vi.stubGlobal('innerHeight', 667)
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          maxTouchPoints: 5
        })
        scaler = new ResponsiveFontScaler()
      })

      it('should detect mobile device correctly', () => {
        const deviceInfo = scaler.getDeviceInfo()
        expect(deviceInfo.type).toBe('mobile')
        expect(deviceInfo.isTouchDevice).toBe(true)
        expect(deviceInfo.orientation).toBe('portrait')
      })

      it('should detect mobile landscape orientation', () => {
        vi.stubGlobal('innerWidth', 667)
        vi.stubGlobal('innerHeight', 375)
        scaler = new ResponsiveFontScaler()
        
        const deviceInfo = scaler.getDeviceInfo()
        expect(deviceInfo.orientation).toBe('landscape')
      })
    })

    describe('Tablet Detection', () => {
      beforeEach(() => {
        vi.stubGlobal('innerWidth', 768)
        vi.stubGlobal('innerHeight', 1024)
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
          maxTouchPoints: 5
        })
        scaler = new ResponsiveFontScaler()
      })

      it('should detect tablet device correctly', () => {
        const deviceInfo = scaler.getDeviceInfo()
        expect(deviceInfo.type).toBe('tablet')
        expect(deviceInfo.isTouchDevice).toBe(true)
        expect(deviceInfo.orientation).toBe('portrait')
      })
    })

    describe('High-DPI Detection', () => {
      beforeEach(() => {
        vi.stubGlobal('devicePixelRatio', 2.0)
        scaler = new ResponsiveFontScaler()
      })

      it('should detect high-DPI displays', () => {
        const deviceInfo = scaler.getDeviceInfo()
        expect(deviceInfo.isHighDPI).toBe(true)
        expect(deviceInfo.pixelRatio).toBe(2.0)
      })
    })
  })

  describe('Device Scaling Factor Calculation', () => {
    it('should calculate appropriate scaling for mobile devices', () => {
      vi.stubGlobal('innerWidth', 375)
      vi.stubGlobal('innerHeight', 667)
      vi.stubGlobal('devicePixelRatio', 2)
      scaler = new ResponsiveFontScaler()
      
      const factor = scaler.getDeviceScalingFactor()
      expect(factor).toBeGreaterThanOrEqual(0.7)
      expect(factor).toBeLessThan(2.0)
      // Mobile scaling should be at least the minimum bound
      expect(factor).toBeGreaterThanOrEqual(0.7)
    })

    it('should calculate appropriate scaling for desktop devices', () => {
      vi.stubGlobal('innerWidth', 1920)
      vi.stubGlobal('innerHeight', 1080)
      vi.stubGlobal('devicePixelRatio', 1)
      scaler = new ResponsiveFontScaler()
      
      const factor = scaler.getDeviceScalingFactor()
      expect(factor).toBeGreaterThanOrEqual(0.7)
      expect(factor).toBeLessThanOrEqual(2.0)
    })

    it('should apply pixel ratio adjustment correctly', () => {
      vi.stubGlobal('innerWidth', 375)
      vi.stubGlobal('innerHeight', 667)
      
      // Test with normal DPI
      vi.stubGlobal('devicePixelRatio', 1)
      const scaler1 = new ResponsiveFontScaler()
      const factor1 = scaler1.getDeviceScalingFactor()
      
      // Test with high DPI
      vi.stubGlobal('devicePixelRatio', 2)
      const scaler2 = new ResponsiveFontScaler()
      const factor2 = scaler2.getDeviceScalingFactor()
      
      // High DPI should generally result in higher scaling, but may be clamped
      expect(factor2).toBeGreaterThanOrEqual(factor1)
      
      scaler1.destroy()
      scaler2.destroy()
    })

    it('should apply orientation adjustment', () => {
      // Portrait
      vi.stubGlobal('innerWidth', 375)
      vi.stubGlobal('innerHeight', 667)
      const scaler1 = new ResponsiveFontScaler()
      const factor1 = scaler1.getDeviceScalingFactor()
      
      // Landscape
      vi.stubGlobal('innerWidth', 667)
      vi.stubGlobal('innerHeight', 375)
      const scaler2 = new ResponsiveFontScaler()
      const factor2 = scaler2.getDeviceScalingFactor()
      
      // Portrait should have slightly higher scaling, but may be clamped to minimum
      expect(factor1).toBeGreaterThanOrEqual(factor2)
      
      scaler1.destroy()
      scaler2.destroy()
    })

    it('should clamp scaling factor to reasonable bounds', () => {
      // Test extreme small viewport
      vi.stubGlobal('innerWidth', 100)
      vi.stubGlobal('innerHeight', 100)
      vi.stubGlobal('devicePixelRatio', 0.5)
      const scaler1 = new ResponsiveFontScaler()
      const factor1 = scaler1.getDeviceScalingFactor()
      expect(factor1).toBeGreaterThanOrEqual(0.7)
      
      // Test extreme large viewport
      vi.stubGlobal('innerWidth', 5000)
      vi.stubGlobal('innerHeight', 3000)
      vi.stubGlobal('devicePixelRatio', 3)
      const scaler2 = new ResponsiveFontScaler()
      const factor2 = scaler2.getDeviceScalingFactor()
      expect(factor2).toBeLessThanOrEqual(2.0)
      
      scaler1.destroy()
      scaler2.destroy()
    })
  })

  describe('Font Size Calculation', () => {
    describe('calculateOptimalFontSize', () => {
      it('should calculate font size with device scaling', () => {
        const config: ScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0
        }
        
        const size = scaler.calculateOptimalFontSize(config)
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
        expect(typeof size).toBe('number')
      })

      it('should respect minimum size constraints', () => {
        const config: ScalingConfig = {
          baseSize: 8,
          minSize: 14,
          maxSize: 24,
          scalingFactor: 0.5
        }
        
        const size = scaler.calculateOptimalFontSize(config)
        expect(size).toBeGreaterThanOrEqual(config.minSize)
      })

      it('should respect maximum size constraints', () => {
        const config: ScalingConfig = {
          baseSize: 20,
          minSize: 12,
          maxSize: 18,
          scalingFactor: 3.0
        }
        
        const size = scaler.calculateOptimalFontSize(config)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })
    })

    describe('calculateViewportAwareFontSize', () => {
      it('should calculate font size with viewport breakpoints', () => {
        const config: ViewportScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0,
          viewportBreakpoints: {
            mobile: 480,
            tablet: 768,
            desktop: 1024
          },
          orientationAdjustment: {
            portrait: 1.0,
            landscape: 0.95
          },
          highDPIAdjustment: 1.1
        }
        
        const size = scaler.calculateViewportAwareFontSize(config)
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })

      it('should apply mobile breakpoint scaling', () => {
        vi.stubGlobal('innerWidth', 320)
        scaler = new ResponsiveFontScaler()
        
        const config = scaler.createDefaultViewportConfig(16)
        const size = scaler.calculateViewportAwareFontSize(config)
        
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })

      it('should apply high-DPI adjustment', () => {
        vi.stubGlobal('devicePixelRatio', 2.0)
        scaler = new ResponsiveFontScaler()
        
        const config = scaler.createDefaultViewportConfig(16)
        config.highDPIAdjustment = 1.2
        
        const size = scaler.calculateViewportAwareFontSize(config)
        expect(size).toBeGreaterThan(16) // Should be scaled up for high-DPI
      })
    })
  })

  describe('Font Size Constraints', () => {
    describe('createFontSizeConstraints', () => {
      it('should create appropriate constraints for body text', () => {
        const constraints = scaler.createFontSizeConstraints(16, 'body')
        
        expect(constraints.minimum).toBeGreaterThan(0)
        expect(constraints.maximum).toBeGreaterThan(constraints.minimum)
        expect(constraints.preferred).toBe(16)
        expect(constraints.step).toBeGreaterThan(0)
      })

      it('should create larger constraints for headings', () => {
        const bodyConstraints = scaler.createFontSizeConstraints(16, 'body')
        const headingConstraints = scaler.createFontSizeConstraints(16, 'heading')
        
        expect(headingConstraints.preferred).toBeGreaterThan(bodyConstraints.preferred)
        expect(headingConstraints.maximum).toBeGreaterThan(bodyConstraints.maximum)
      })

      it('should create smaller constraints for captions', () => {
        const bodyConstraints = scaler.createFontSizeConstraints(16, 'body')
        const captionConstraints = scaler.createFontSizeConstraints(16, 'caption')
        
        expect(captionConstraints.preferred).toBeLessThan(bodyConstraints.preferred)
      })

      it('should adjust button constraints for touch devices', () => {
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          maxTouchPoints: 5
        })
        scaler = new ResponsiveFontScaler()
        
        const buttonConstraints = scaler.createFontSizeConstraints(16, 'button')
        expect(buttonConstraints.minimum).toBeGreaterThan(14) // Touch-friendly minimum
      })
    })

    describe('validateFontSize', () => {
      it('should validate font sizes against constraints', () => {
        const result = scaler.validateFontSize(16, 'body')
        expect(result.isValid).toBe(true)
        expect(result.recommendedSize).toBe(16)
        expect(result.reason).toBeUndefined()
      })

      it('should identify font sizes that are too small', () => {
        const result = scaler.validateFontSize(8, 'body')
        expect(result.isValid).toBe(false)
        expect(result.recommendedSize).toBeGreaterThan(8)
        expect(result.reason).toContain('below minimum')
      })

      it('should identify font sizes that are too large', () => {
        const result = scaler.validateFontSize(50, 'body')
        expect(result.isValid).toBe(false)
        expect(result.recommendedSize).toBeLessThan(50)
        expect(result.reason).toContain('exceeds maximum')
      })

      it('should provide device-specific validation messages', () => {
        vi.stubGlobal('navigator', {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
        })
        scaler = new ResponsiveFontScaler()
        
        const result = scaler.validateFontSize(8, 'body')
        expect(result.reason).toContain('mobile')
      })
    })
  })

  describe('Responsive Font Size Creation', () => {
    describe('createResponsiveFontSize', () => {
      it('should return font size as pixel string', () => {
        const config: ScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0
        }
        
        const sizeString = scaler.createResponsiveFontSize(config)
        expect(sizeString).toMatch(/^\d+px$/)
        
        const size = parseInt(sizeString.replace('px', ''))
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })
    })

    describe('createViewportResponsiveFontSize', () => {
      it('should return viewport-aware font size as pixel string', () => {
        const config = scaler.createDefaultViewportConfig(16)
        const sizeString = scaler.createViewportResponsiveFontSize(config)
        
        expect(sizeString).toMatch(/^\d+px$/)
        
        const size = parseInt(sizeString.replace('px', ''))
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })
    })
  })

  describe('Pixel Ratio Handling', () => {
    describe('getPixelRatioAdjustedSize', () => {
      it('should adjust size for high-DPI displays', () => {
        vi.stubGlobal('devicePixelRatio', 2.0)
        scaler = new ResponsiveFontScaler()
        
        const adjustedSize = scaler.getPixelRatioAdjustedSize(16)
        expect(adjustedSize).toBeGreaterThan(16)
        expect(adjustedSize % 0.5).toBe(0) // Should be rounded to half-pixels
      })

      it('should handle normal DPI displays', () => {
        vi.stubGlobal('devicePixelRatio', 1.0)
        scaler = new ResponsiveFontScaler()
        
        const adjustedSize = scaler.getPixelRatioAdjustedSize(16)
        expect(adjustedSize).toBeCloseTo(16, 1)
      })

      it('should cap pixel ratio adjustment', () => {
        vi.stubGlobal('devicePixelRatio', 4.0) // Very high DPI
        scaler = new ResponsiveFontScaler()
        
        const adjustedSize = scaler.getPixelRatioAdjustedSize(16)
        expect(adjustedSize).toBeLessThan(32) // Should be capped
      })
    })
  })

  describe('Text Object Updates', () => {
    describe('updateTextSizeForViewport', () => {
      it('should update Phaser text object font size', () => {
        const mockTextObject = {
          setFontSize: vi.fn(),
          style: { fontSize: '16px' }
        }
        
        const config: ScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0
        }
        
        scaler.updateTextSizeForViewport(mockTextObject, config)
        expect(mockTextObject.setFontSize).toHaveBeenCalledWith(expect.any(Number))
      })
    })
  })

  describe('Orientation Change Handling', () => {
    describe('onOrientationChange', () => {
      it('should register orientation change callbacks', () => {
        const callback = vi.fn()
        const unsubscribe = scaler.onOrientationChange(callback)
        
        expect(typeof unsubscribe).toBe('function')
        
        // Cleanup
        unsubscribe()
      })

      it('should call callbacks on orientation change', () => {
        const callback = vi.fn()
        scaler.onOrientationChange(callback)
        
        // Simulate orientation change by updating viewport
        vi.stubGlobal('innerWidth', 667)
        vi.stubGlobal('innerHeight', 375)
        
        // Trigger the internal update (normally triggered by ResizeObserver)
        scaler['updateDeviceInfo']()
        scaler['notifyOrientationChange']()
        
        expect(callback).toHaveBeenCalled()
      })

      it('should handle callback errors gracefully', () => {
        const errorCallback = vi.fn(() => {
          throw new Error('Test error')
        })
        const goodCallback = vi.fn()
        
        scaler.onOrientationChange(errorCallback)
        scaler.onOrientationChange(goodCallback)
        
        // Should not throw when callbacks error
        expect(() => {
          scaler['notifyOrientationChange']()
        }).not.toThrow()
        
        expect(goodCallback).toHaveBeenCalled()
      })

      it('should allow unsubscribing from callbacks', () => {
        const callback = vi.fn()
        const unsubscribe = scaler.onOrientationChange(callback)
        
        unsubscribe()
        scaler['notifyOrientationChange']()
        
        expect(callback).not.toHaveBeenCalled()
      })
    })
  })

  describe('Configuration Creation', () => {
    describe('createDefaultViewportConfig', () => {
      it('should create valid viewport configuration', () => {
        const config = scaler.createDefaultViewportConfig(16)
        
        expect(config.baseSize).toBe(16)
        expect(config.minSize).toBeGreaterThan(0)
        expect(config.maxSize).toBeGreaterThan(config.minSize)
        expect(config.scalingFactor).toBe(1.0)
        expect(config.viewportBreakpoints).toHaveProperty('mobile')
        expect(config.viewportBreakpoints).toHaveProperty('tablet')
        expect(config.viewportBreakpoints).toHaveProperty('desktop')
        expect(config.orientationAdjustment).toHaveProperty('portrait')
        expect(config.orientationAdjustment).toHaveProperty('landscape')
        expect(typeof config.highDPIAdjustment).toBe('number')
      })
    })
  })

  describe('Cleanup', () => {
    describe('destroy', () => {
      it('should clean up resources', () => {
        const callback = vi.fn()
        scaler.onOrientationChange(callback)
        
        scaler.destroy()
        
        // Should not call callbacks after destroy
        scaler['notifyOrientationChange']()
        expect(callback).not.toHaveBeenCalled()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing global objects gracefully', () => {
      vi.stubGlobal('screen', undefined)
      vi.stubGlobal('navigator', undefined)
      vi.stubGlobal('innerWidth', undefined)
      vi.stubGlobal('innerHeight', undefined)
      vi.stubGlobal('devicePixelRatio', undefined)
      
      expect(() => {
        const edgeScaler = new ResponsiveFontScaler()
        edgeScaler.getDeviceInfo()
        edgeScaler.getDeviceScalingFactor()
        edgeScaler.destroy()
      }).not.toThrow()
    })

    it('should handle ResizeObserver not being available', () => {
      global.ResizeObserver = undefined as any
      
      expect(() => {
        const edgeScaler = new ResponsiveFontScaler()
        edgeScaler.destroy()
      }).not.toThrow()
    })

    it('should handle missing document.body', () => {
      Object.defineProperty(document, 'body', {
        value: null,
        writable: true
      })
      
      expect(() => {
        const edgeScaler = new ResponsiveFontScaler()
        edgeScaler.destroy()
      }).not.toThrow()
    })

    it('should handle extreme viewport dimensions', () => {
      vi.stubGlobal('innerWidth', 0)
      vi.stubGlobal('innerHeight', 0)
      vi.stubGlobal('screen', undefined)
      
      const edgeScaler = new ResponsiveFontScaler()
      const deviceInfo = edgeScaler.getDeviceInfo()
      const scalingFactor = edgeScaler.getDeviceScalingFactor()
      
      // When all dimensions are 0/undefined, fallback to defaults
      expect(deviceInfo.viewportWidth).toBeGreaterThanOrEqual(0)
      expect(deviceInfo.viewportHeight).toBeGreaterThanOrEqual(0)
      expect(scalingFactor).toBeGreaterThanOrEqual(0.7) // Should still be clamped
      
      edgeScaler.destroy()
    })
  })
})

describe('Global Functions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('innerWidth', 1024)
    vi.stubGlobal('innerHeight', 768)
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('screen', { width: 1024, height: 768 })
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn()
    }))
  })

  describe('getResponsiveFontScaler', () => {
    it('should return singleton instance', () => {
      const scaler1 = getResponsiveFontScaler()
      const scaler2 = getResponsiveFontScaler()
      
      expect(scaler1).toBe(scaler2) // Should be same instance
    })

    it('should return working scaler instance', () => {
      const scaler = getResponsiveFontScaler()
      const deviceInfo = scaler.getDeviceInfo()
      
      expect(deviceInfo).toHaveProperty('type')
      expect(deviceInfo).toHaveProperty('orientation')
      expect(deviceInfo).toHaveProperty('pixelRatio')
    })
  })

  describe('createResponsiveFontSize', () => {
    it('should create responsive font size with default scaling', () => {
      const sizeString = createResponsiveFontSize(16)
      expect(sizeString).toMatch(/^\d+px$/)
      
      const size = parseInt(sizeString.replace('px', ''))
      expect(size).toBeGreaterThanOrEqual(12)
      expect(size).toBeLessThanOrEqual(32)
    })

    it('should create responsive font size with custom scaling', () => {
      const sizeString = createResponsiveFontSize(16, 1.5)
      expect(sizeString).toMatch(/^\d+px$/)
      
      const size = parseInt(sizeString.replace('px', ''))
      expect(size).toBeGreaterThan(16) // Should be scaled up
    })
  })

  describe('getDeviceScalingFactor', () => {
    it('should return device scaling factor', () => {
      const factor = getDeviceScalingFactor()
      expect(typeof factor).toBe('number')
      expect(factor).toBeGreaterThan(0)
      expect(factor).toBeLessThanOrEqual(2.0)
    })
  })
})

describe('Cross-Viewport Testing', () => {
  const testViewports = [
    { name: 'iPhone SE', width: 375, height: 667, dpr: 2, expected: 'mobile' },
    { name: 'iPhone 12', width: 390, height: 844, dpr: 3, expected: 'mobile' },
    { name: 'iPad', width: 768, height: 1024, dpr: 2, expected: 'tablet' },
    { name: 'iPad Pro', width: 1024, height: 1366, dpr: 2, expected: 'tablet' },
    { name: 'Desktop HD', width: 1920, height: 1080, dpr: 1, expected: 'desktop' },
    { name: 'Desktop 4K', width: 3840, height: 2160, dpr: 2, expected: 'desktop' }
  ]

  testViewports.forEach(viewport => {
    describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      let scaler: ResponsiveFontScaler

      beforeEach(() => {
        vi.stubGlobal('innerWidth', viewport.width)
        vi.stubGlobal('innerHeight', viewport.height)
        vi.stubGlobal('devicePixelRatio', viewport.dpr)
        vi.stubGlobal('screen', { width: viewport.width, height: viewport.height })
        
        // Set appropriate user agent
        const userAgents = {
          mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          tablet: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
          desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        vi.stubGlobal('navigator', {
          userAgent: userAgents[viewport.expected as keyof typeof userAgents],
          maxTouchPoints: viewport.expected === 'desktop' ? 0 : 5
        })
        
        global.ResizeObserver = vi.fn().mockImplementation(() => ({
          observe: vi.fn(),
          disconnect: vi.fn(),
          unobserve: vi.fn()
        }))
        
        scaler = new ResponsiveFontScaler()
      })

      afterEach(() => {
        scaler.destroy()
      })

      it('should detect correct device type', () => {
        const deviceInfo = scaler.getDeviceInfo()
        expect(deviceInfo.type).toBe(viewport.expected)
      })

      it('should calculate appropriate scaling factor', () => {
        const factor = scaler.getDeviceScalingFactor()
        expect(factor).toBeGreaterThan(0.7)
        expect(factor).toBeLessThanOrEqual(2.0)
      })

      it('should create appropriate font size constraints', () => {
        const constraints = scaler.createFontSizeConstraints(16, 'body')
        
        // Mobile devices should have higher minimum sizes
        if (viewport.expected === 'mobile') {
          expect(constraints.minimum).toBeGreaterThanOrEqual(14)
        }
        
        expect(constraints.minimum).toBeGreaterThan(0)
        expect(constraints.maximum).toBeGreaterThan(constraints.minimum)
      })

      it('should validate font sizes appropriately', () => {
        const validation = scaler.validateFontSize(16, 'body')
        expect(validation.isValid).toBe(true)
        
        const tooSmall = scaler.validateFontSize(8, 'body')
        expect(tooSmall.isValid).toBe(false)
      })

      it('should create responsive font sizes within bounds', () => {
        const config: ScalingConfig = {
          baseSize: 16,
          minSize: 12,
          maxSize: 24,
          scalingFactor: 1.0
        }
        
        const sizeString = scaler.createResponsiveFontSize(config)
        const size = parseInt(sizeString.replace('px', ''))
        
        expect(size).toBeGreaterThanOrEqual(config.minSize)
        expect(size).toBeLessThanOrEqual(config.maxSize)
      })
    })
  })
})