import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ResponsiveFontScaler,
  getResponsiveFontScaler,
  type DeviceInfo,
  type TextOverflowInfo,
  type TextPositionConfig
} from '../src/utils/responsiveFontScaler'
import { type ScalingConfig } from '../src/utils/textReadability'

describe('Orientation and Resize Handling', () => {
  let scaler: ResponsiveFontScaler
  let mockTextElement: any

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
    
    // Mock setTimeout and clearTimeout
    vi.stubGlobal('setTimeout', vi.fn((callback, delay) => {
      // Execute immediately for testing
      callback()
      return 123
    }))
    vi.stubGlobal('clearTimeout', vi.fn())
    
    scaler = new ResponsiveFontScaler()
    
    // Create mock text element
    mockTextElement = {
      x: 100,
      y: 100,
      width: 200,
      height: 30,
      setPosition: vi.fn(),
      setFontSize: vi.fn(),
      setWordWrapWidth: vi.fn(),
      setText: vi.fn(),
      text: 'Sample text',
      style: { fontSize: '16px' }
    }
  })

  afterEach(() => {
    scaler.destroy()
    vi.unstubAllGlobals()
  })

  describe('Orientation Change Handling', () => {
    it('should detect orientation changes correctly', () => {
      const callback = vi.fn()
      scaler.onOrientationChange(callback)
      
      // Start in landscape
      expect(scaler.getDeviceInfo().orientation).toBe('landscape')
      
      // Change to portrait
      vi.stubGlobal('innerWidth', 768)
      vi.stubGlobal('innerHeight', 1024)
      
      // Trigger orientation change
      scaler['handleOrientationChange']()
      
      expect(callback).toHaveBeenCalled()
      expect(scaler.getDeviceInfo().orientation).toBe('portrait')
    })

    it('should handle orientation change with proper debouncing', () => {
      const callback = vi.fn()
      scaler.onOrientationChange(callback)
      
      // Mock setTimeout to track calls
      const mockSetTimeout = vi.fn((cb, delay) => {
        expect(delay).toBe(200) // Should use 200ms delay for orientation changes
        cb() // Execute immediately for testing
        return 123
      })
      vi.stubGlobal('setTimeout', mockSetTimeout)
      
      // Trigger multiple orientation changes rapidly
      scaler['handleOrientationChange']()
      scaler['handleOrientationChange']()
      scaler['handleOrientationChange']()
      
      // Should debounce the calls
      expect(mockSetTimeout).toHaveBeenCalledTimes(3)
    })

    it('should update text scaling for orientation changes', () => {
      const textElements = [
        { element: mockTextElement, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } }
      ]
      
      // Test portrait orientation
      vi.stubGlobal('innerWidth', 375)
      vi.stubGlobal('innerHeight', 667)
      scaler = new ResponsiveFontScaler()
      
      scaler.handleOrientationTextScaling(textElements, 'portrait')
      expect(mockTextElement.setFontSize).toHaveBeenCalled()
      
      // Test landscape orientation (should use smaller scaling factor)
      scaler.handleOrientationTextScaling(textElements, 'landscape')
      expect(mockTextElement.setFontSize).toHaveBeenCalledTimes(2)
    })

    it('should reposition text elements on orientation change', () => {
      const config: TextPositionConfig = scaler.createTextPositionConfig(
        mockTextElement,
        'center',
        { top: 10, right: 10, bottom: 10, left: 10 },
        true
      )
      
      // Change orientation and reposition
      scaler.repositionTextForOrientation([config], 667, 375) // Landscape dimensions
      
      expect(mockTextElement.setPosition).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number)
      )
    })
  })

  describe('Viewport Resize Handling', () => {
    it('should register and call resize callbacks', () => {
      const callback = vi.fn()
      const unsubscribe = scaler.onResize(callback)
      
      // Trigger resize
      vi.stubGlobal('innerWidth', 800)
      vi.stubGlobal('innerHeight', 600)
      scaler['handleViewportResize']([])
      
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        viewportWidth: 800,
        viewportHeight: 600
      }))
      
      // Test unsubscribe
      unsubscribe()
      callback.mockClear()
      scaler['handleViewportResize']([])
      expect(callback).not.toHaveBeenCalled()
    })

    it('should debounce resize events', () => {
      const callback = vi.fn()
      scaler.onResize(callback)
      
      // Mock setTimeout to track debouncing
      const mockSetTimeout = vi.fn((cb, delay) => {
        expect(delay).toBe(150) // Should use 150ms debounce for resize
        cb()
        return 123
      })
      vi.stubGlobal('setTimeout', mockSetTimeout)
      
      // Trigger multiple resize events
      scaler['handleViewportResize']([])
      scaler['handleViewportResize']([])
      
      expect(mockSetTimeout).toHaveBeenCalledTimes(2)
    })

    it('should handle window resize as backup', () => {
      const callback = vi.fn()
      scaler.onResize(callback)
      
      // Mock setTimeout for window resize (shorter debounce)
      const mockSetTimeout = vi.fn((cb, delay) => {
        expect(delay).toBe(100) // Should use 100ms debounce for window resize
        cb()
        return 123
      })
      vi.stubGlobal('setTimeout', mockSetTimeout)
      
      // Trigger window resize
      scaler['handleWindowResize']()
      
      expect(mockSetTimeout).toHaveBeenCalled()
    })
  })

  describe('Text Overflow Detection', () => {
    it('should detect horizontal text overflow', () => {
      mockTextElement.width = 300 // Wider than available space
      mockTextElement.style.fontSize = '20px' // Larger font size to ensure reduction is viable
      
      const overflow = scaler.detectTextOverflow(mockTextElement, 200, 100)
      
      expect(overflow.isOverflowing).toBe(true)
      expect(overflow.overflowDirection).toBe('horizontal')
      expect(overflow.recommendedAction).toBe('reduce-font')
      expect(overflow.recommendedFontSize).toBeLessThan(20)
    })

    it('should detect vertical text overflow', () => {
      mockTextElement.height = 150 // Taller than available space
      
      const overflow = scaler.detectTextOverflow(mockTextElement, 300, 100)
      
      expect(overflow.isOverflowing).toBe(true)
      expect(overflow.overflowDirection).toBe('vertical')
      expect(overflow.recommendedAction).toBe('wrap-text')
    })

    it('should detect both horizontal and vertical overflow', () => {
      mockTextElement.width = 400
      mockTextElement.height = 150
      
      const overflow = scaler.detectTextOverflow(mockTextElement, 200, 100)
      
      expect(overflow.isOverflowing).toBe(true)
      expect(overflow.overflowDirection).toBe('both')
    })

    it('should handle text elements without dimensions gracefully', () => {
      const elementWithoutDimensions = {
        text: 'Sample text'
      }
      
      const overflow = scaler.detectTextOverflow(elementWithoutDimensions, 200, 100)
      
      expect(overflow.isOverflowing).toBe(false)
      expect(overflow.overflowDirection).toBe('none')
      expect(overflow.recommendedAction).toBe('none')
    })

    it('should call overflow callbacks when overflow is detected', () => {
      const callback = vi.fn()
      scaler.onTextOverflow(callback)
      
      mockTextElement.width = 300 // Cause overflow
      
      scaler.detectTextOverflow(mockTextElement, 200, 100)
      
      expect(callback).toHaveBeenCalledWith(
        mockTextElement,
        expect.objectContaining({
          isOverflowing: true,
          overflowDirection: 'horizontal'
        })
      )
    })

    it('should recommend appropriate font size reduction', () => {
      mockTextElement.width = 300
      mockTextElement.style.fontSize = '20px'
      
      const overflow = scaler.detectTextOverflow(mockTextElement, 200, 100)
      
      expect(overflow.recommendedFontSize).toBeDefined()
      expect(overflow.recommendedFontSize).toBeLessThan(20)
      expect(overflow.recommendedFontSize).toBeGreaterThanOrEqual(12) // Should respect minimum
    })

    it('should recommend text wrapping when font reduction is not viable', () => {
      mockTextElement.width = 400
      mockTextElement.style.fontSize = '12px' // Already at minimum
      
      const overflow = scaler.detectTextOverflow(mockTextElement, 200, 100)
      
      expect(overflow.recommendedAction).toBe('wrap-text')
    })
  })

  describe('Text Positioning', () => {
    it('should create text position configuration correctly', () => {
      const config = scaler.createTextPositionConfig(
        mockTextElement,
        'top-right',
        { top: 20, right: 30 },
        true
      )
      
      expect(config.element).toBe(mockTextElement)
      expect(config.anchor).toBe('top-right')
      expect(config.margins.top).toBe(20)
      expect(config.margins.right).toBe(30)
      expect(config.margins.bottom).toBe(10) // Default
      expect(config.margins.left).toBe(10) // Default
      expect(config.responsive).toBe(true)
    })

    it('should calculate responsive positions correctly for different anchors', () => {
      const testCases = [
        { anchor: 'top-left' as const, expectedX: 10, expectedY: 10 },
        { anchor: 'top-center' as const, expectedX: 400, expectedY: 10 },
        { anchor: 'top-right' as const, expectedX: 790, expectedY: 10 },
        { anchor: 'center-left' as const, expectedX: 10, expectedY: 300 },
        { anchor: 'center' as const, expectedX: 400, expectedY: 300 },
        { anchor: 'center-right' as const, expectedX: 790, expectedY: 300 },
        { anchor: 'bottom-left' as const, expectedX: 10, expectedY: 590 },
        { anchor: 'bottom-center' as const, expectedX: 400, expectedY: 590 },
        { anchor: 'bottom-right' as const, expectedX: 790, expectedY: 590 }
      ]
      
      testCases.forEach(({ anchor, expectedX, expectedY }) => {
        const config = scaler.createTextPositionConfig(mockTextElement, anchor)
        const position = scaler['calculateResponsivePosition'](config, 800, 600)
        
        expect(position.x).toBe(expectedX)
        expect(position.y).toBe(expectedY)
      })
    })

    it('should reposition multiple text elements correctly', () => {
      const configs = [
        scaler.createTextPositionConfig(mockTextElement, 'top-left'),
        scaler.createTextPositionConfig({ ...mockTextElement, setPosition: vi.fn() }, 'bottom-right')
      ]
      
      scaler.repositionTextForOrientation(configs, 800, 600)
      
      configs.forEach(config => {
        expect(config.element.setPosition).toHaveBeenCalled()
      })
    })

    it('should handle positioning errors gracefully', () => {
      const brokenElement = {
        // Missing setPosition method
        x: 100,
        y: 100
      }
      
      const config = scaler.createTextPositionConfig(brokenElement, 'center')
      
      expect(() => {
        scaler.repositionTextForOrientation([config], 800, 600)
      }).not.toThrow()
      
      // Should fall back to direct property assignment
      expect(brokenElement.x).not.toBe(100)
      expect(brokenElement.y).not.toBe(100)
    })
  })

  describe('Overflow Fix Application', () => {
    it('should apply font size reduction for overflow', () => {
      const overflow: TextOverflowInfo = {
        isOverflowing: true,
        overflowDirection: 'horizontal',
        actualWidth: 300,
        actualHeight: 30,
        availableWidth: 200,
        availableHeight: 100,
        recommendedFontSize: 14,
        recommendedAction: 'reduce-font'
      }
      
      scaler['applyOverflowFix'](mockTextElement, overflow)
      
      expect(mockTextElement.setFontSize).toHaveBeenCalledWith(14)
    })

    it('should apply text wrapping for overflow', () => {
      const overflow: TextOverflowInfo = {
        isOverflowing: true,
        overflowDirection: 'horizontal',
        actualWidth: 300,
        actualHeight: 30,
        availableWidth: 200,
        availableHeight: 100,
        recommendedAction: 'wrap-text'
      }
      
      scaler['applyOverflowFix'](mockTextElement, overflow)
      
      expect(mockTextElement.setWordWrapWidth).toHaveBeenCalledWith(200)
    })

    it('should handle missing methods gracefully', () => {
      const elementWithoutMethods = {
        text: 'Sample text'
      }
      
      const overflow: TextOverflowInfo = {
        isOverflowing: true,
        overflowDirection: 'horizontal',
        actualWidth: 300,
        actualHeight: 30,
        availableWidth: 200,
        availableHeight: 100,
        recommendedFontSize: 14,
        recommendedAction: 'reduce-font'
      }
      
      expect(() => {
        scaler['applyOverflowFix'](elementWithoutMethods, overflow)
      }).not.toThrow()
    })
  })

  describe('Font Size Extraction', () => {
    it('should extract font size from string style', () => {
      const element = {
        style: { fontSize: '18px' }
      }
      
      const fontSize = scaler['extractFontSize'](element)
      expect(fontSize).toBe(18)
    })

    it('should extract font size from numeric style', () => {
      const element = {
        style: { fontSize: 20 }
      }
      
      const fontSize = scaler['extractFontSize'](element)
      expect(fontSize).toBe(20)
    })

    it('should return default font size for invalid elements', () => {
      const element = {}
      
      const fontSize = scaler['extractFontSize'](element)
      expect(fontSize).toBe(16)
    })

    it('should handle extraction errors gracefully', () => {
      const element = {
        style: {
          get fontSize() {
            throw new Error('Test error')
          }
        }
      }
      
      const fontSize = scaler['extractFontSize'](element)
      expect(fontSize).toBe(16)
    })
  })

  describe('Element Bounds Detection', () => {
    it('should get bounds from width/height properties', () => {
      const element = { width: 200, height: 50 }
      
      const bounds = scaler['getElementBounds'](element)
      
      expect(bounds).toEqual({ width: 200, height: 50 })
    })

    it('should get bounds from getBounds method', () => {
      const element = {
        getBounds: () => ({ width: 150, height: 40 })
      }
      
      const bounds = scaler['getElementBounds'](element)
      
      expect(bounds).toEqual({ width: 150, height: 40 })
    })

    it('should get bounds from display properties', () => {
      const element = { displayWidth: 180, displayHeight: 35 }
      
      const bounds = scaler['getElementBounds'](element)
      
      expect(bounds).toEqual({ width: 180, height: 35 })
    })

    it('should return null for elements without bounds', () => {
      const element = {}
      
      const bounds = scaler['getElementBounds'](element)
      
      expect(bounds).toBeNull()
    })

    it('should handle bounds detection errors gracefully', () => {
      const element = {
        get width() {
          throw new Error('Test error')
        }
      }
      
      const bounds = scaler['getElementBounds'](element)
      
      expect(bounds).toBeNull()
    })
  })

  describe('Cleanup and Error Handling', () => {
    it('should clean up timers on destroy', () => {
      const mockClearTimeout = vi.fn()
      vi.stubGlobal('clearTimeout', mockClearTimeout)
      
      // Trigger some operations that set timers
      scaler['handleOrientationChange']()
      scaler['handleViewportResize']([])
      
      scaler.destroy()
      
      expect(mockClearTimeout).toHaveBeenCalled()
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

    it('should handle resize callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error')
      })
      const goodCallback = vi.fn()
      
      scaler.onResize(errorCallback)
      scaler.onResize(goodCallback)
      
      const deviceInfo = scaler.getDeviceInfo()
      
      expect(() => {
        scaler['notifyResizeChange'](deviceInfo)
      }).not.toThrow()
      
      expect(goodCallback).toHaveBeenCalledWith(deviceInfo)
    })

    it('should handle text overflow callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error')
      })
      const goodCallback = vi.fn()
      
      scaler.onTextOverflow(errorCallback)
      scaler.onTextOverflow(goodCallback)
      
      const overflow: TextOverflowInfo = {
        isOverflowing: true,
        overflowDirection: 'horizontal',
        actualWidth: 300,
        actualHeight: 30,
        availableWidth: 200,
        availableHeight: 100,
        recommendedAction: 'reduce-font'
      }
      
      expect(() => {
        scaler['notifyTextOverflow'](mockTextElement, overflow)
      }).not.toThrow()
      
      expect(goodCallback).toHaveBeenCalledWith(mockTextElement, overflow)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete orientation change workflow', () => {
      const orientationCallback = vi.fn()
      const resizeCallback = vi.fn()
      const overflowCallback = vi.fn()
      
      scaler.onOrientationChange(orientationCallback)
      scaler.onResize(resizeCallback)
      scaler.onTextOverflow(overflowCallback)
      
      // Create text configuration
      const config = scaler.createTextPositionConfig(mockTextElement, 'center')
      
      // Simulate orientation change from landscape to portrait
      vi.stubGlobal('innerWidth', 375)
      vi.stubGlobal('innerHeight', 667)
      
      scaler['handleOrientationChange']()
      
      expect(orientationCallback).toHaveBeenCalled()
      expect(resizeCallback).toHaveBeenCalled()
      
      // Reposition text
      scaler.repositionTextForOrientation([config], 375, 667)
      
      expect(mockTextElement.setPosition).toHaveBeenCalled()
    })

    it('should handle text scaling with overflow detection', () => {
      const textElements = [
        { element: mockTextElement, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } }
      ]
      
      // Make text overflow after scaling
      mockTextElement.width = 400
      
      scaler.handleOrientationTextScaling(textElements, 'landscape')
      
      expect(mockTextElement.setFontSize).toHaveBeenCalled()
      
      // Check if overflow was detected and handled
      const overflow = scaler.detectTextOverflow(mockTextElement, 200, 100)
      expect(overflow.isOverflowing).toBe(true)
    })

    it('should maintain text readability across multiple viewport changes', () => {
      const config = scaler.createTextPositionConfig(mockTextElement, 'center')
      
      // Test multiple viewport changes
      const viewports = [
        { width: 1024, height: 768 }, // Desktop
        { width: 768, height: 1024 }, // Tablet portrait
        { width: 375, height: 667 },  // Mobile portrait
        { width: 667, height: 375 }   // Mobile landscape
      ]
      
      viewports.forEach(viewport => {
        scaler.repositionTextForOrientation([config], viewport.width, viewport.height)
        
        // Verify text remains within bounds
        const overflow = scaler.detectTextOverflow(
          mockTextElement,
          viewport.width * 0.9,
          viewport.height * 0.9
        )
        
        // Text should either not overflow or have a recommended fix
        if (overflow.isOverflowing) {
          expect(overflow.recommendedAction).not.toBe('none')
        }
      })
    })
  })
})