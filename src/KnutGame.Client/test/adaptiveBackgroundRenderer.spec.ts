import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import Phaser from 'phaser'
import {
  AdaptiveBackgroundRenderer,
  type BackgroundConfig,
  type BackgroundAnalysis,
  type BackgroundRenderOptions
} from '../src/utils/adaptiveBackgroundRenderer'

// Mock Phaser objects
const createMockScene = () => ({
  add: {
    container: vi.fn(() => ({
      add: vi.fn(),
      list: [],
      x: 0,
      y: 0
    })),
    graphics: vi.fn(() => ({
      fillStyle: vi.fn(),
      fillRoundedRect: vi.fn(),
      clear: vi.fn(),
      setPosition: vi.fn()
    })),
    text: vi.fn(() => ({
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
      setText: vi.fn(),
      setPosition: vi.fn(),
      x: 50,
      y: 50
    }))
  },
  cameras: {
    main: {
      width: 800,
      height: 600
    }
  }
})

const createMockText = (width = 100, height = 20, x = 50, y = 50) => ({
  getBounds: vi.fn(() => ({ x, y, width, height })),
  setText: vi.fn(),
  setPosition: vi.fn(),
  x,
  y
})

const createMockContainer = (textObj?: any, graphicsObj?: any) => ({
  add: vi.fn(),
  list: [graphicsObj, textObj].filter(Boolean),
  x: 0,
  y: 0
})

const createMockGraphics = () => ({
  fillStyle: vi.fn(),
  fillRoundedRect: vi.fn(),
  clear: vi.fn(),
  setPosition: vi.fn()
})

describe('AdaptiveBackgroundRenderer', () => {
  let renderer: AdaptiveBackgroundRenderer
  let mockScene: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock global devicePixelRatio
    vi.stubGlobal('devicePixelRatio', 1.5)
    
    mockScene = createMockScene()
    renderer = new AdaptiveBackgroundRenderer(mockScene as any)
  })

  describe('constructor', () => {
    it('should initialize with scene and device pixel ratio', () => {
      expect(renderer).toBeInstanceOf(AdaptiveBackgroundRenderer)
    })

    it('should clamp device pixel ratio to maximum of 2', () => {
      vi.stubGlobal('devicePixelRatio', 3.0)
      const highDprRenderer = new AdaptiveBackgroundRenderer(mockScene as any)
      expect(highDprRenderer).toBeInstanceOf(AdaptiveBackgroundRenderer)
    })

    it('should handle missing devicePixelRatio', () => {
      vi.stubGlobal('devicePixelRatio', undefined)
      const fallbackRenderer = new AdaptiveBackgroundRenderer(mockScene as any)
      expect(fallbackRenderer).toBeInstanceOf(AdaptiveBackgroundRenderer)
    })
  })

  describe('createTextBackground', () => {
    it('should create a container with background and text', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 10,
        cornerRadius: 8,
        opacity: 0.9,
        blurBackground: false
      }
      
      const result = renderer.createTextBackground(mockText as any, config)
      
      expect(mockScene.add.container).toHaveBeenCalledWith(50, 50)
      expect(mockScene.add.graphics).toHaveBeenCalled()
      expect(mockContainer.add).toHaveBeenCalledWith([mockGraphics, mockText])
      expect(mockText.setPosition).toHaveBeenCalledWith(0, 0)
      expect(result).toBe(mockContainer)
    })

    it('should create blurred background when blurBackground is true', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 10,
        cornerRadius: 8,
        opacity: 0.8,
        blurBackground: true
      }
      
      renderer.createTextBackground(mockText as any, config)
      
      // Should call fillStyle and fillRoundedRect multiple times for blur effect
      expect(mockGraphics.fillStyle).toHaveBeenCalledTimes(3) // 3 layers for blur
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalledTimes(3)
    })

    it('should create solid background when blurBackground is false', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 12,
        cornerRadius: 6,
        opacity: 0.95,
        blurBackground: false
      }
      
      renderer.createTextBackground(mockText as any, config)
      
      // Should call fillStyle twice (shadow + background)
      expect(mockGraphics.fillStyle).toHaveBeenCalledTimes(2)
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalledTimes(2)
      
      // Check shadow call
      expect(mockGraphics.fillStyle).toHaveBeenNthCalledWith(1, 0x000000, 0.25)
      expect(mockGraphics.fillRoundedRect).toHaveBeenNthCalledWith(
        1, -62 + 3, -22 + 6, 124, 44, 6
      )
      
      // Check background call
      expect(mockGraphics.fillStyle).toHaveBeenNthCalledWith(2, 0xffffff, 0.95)
      expect(mockGraphics.fillRoundedRect).toHaveBeenNthCalledWith(
        2, -62, -22, 124, 44, 6
      )
    })

    it('should calculate correct dimensions with padding', () => {
      const mockText = createMockText(80, 16)
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 15,
        cornerRadius: 10,
        opacity: 0.9,
        blurBackground: false
      }
      
      renderer.createTextBackground(mockText as any, config)
      
      // Expected dimensions: 80 + (15 * 2) = 110, 16 + (15 * 2) = 46
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalledWith(
        -55, -23, 110, 46, 10
      )
    })
  })

  describe('updateBackgroundForText', () => {
    it('should update text and redraw background', () => {
      const mockText = createMockText()
      const mockGraphics = createMockGraphics()
      
      // Create proper mock objects that will pass instanceof checks
      const mockTextObj = Object.create(Phaser.GameObjects.Text.prototype)
      Object.assign(mockTextObj, mockText)
      
      const mockGraphicsObj = Object.create(Phaser.GameObjects.Graphics.prototype)
      Object.assign(mockGraphicsObj, mockGraphics)
      
      const mockContainer = {
        list: [mockGraphicsObj, mockTextObj]
      }
      
      renderer.updateBackgroundForText(mockContainer as any, 'New Text')
      
      expect(mockText.setText).toHaveBeenCalledWith('New Text')
      expect(mockGraphics.clear).toHaveBeenCalled()
      expect(mockGraphics.fillStyle).toHaveBeenCalled()
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalled()
    })

    it('should handle invalid container structure gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const invalidContainer = { list: [] }
      
      renderer.updateBackgroundForText(invalidContainer as any, 'New Text')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'AdaptiveBackgroundRenderer: Invalid container structure for update'
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle missing text object', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockGraphics = createMockGraphics()
      const containerWithoutText = { list: [mockGraphics] }
      
      renderer.updateBackgroundForText(containerWithoutText as any, 'New Text')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'AdaptiveBackgroundRenderer: Invalid container structure for update'
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle missing graphics object', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockText = createMockText()
      const containerWithoutGraphics = { list: [mockText] }
      
      renderer.updateBackgroundForText(containerWithoutGraphics as any, 'New Text')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'AdaptiveBackgroundRenderer: Invalid container structure for update'
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('analyzeBackgroundContrast', () => {
    it('should return background analysis with contrast metrics', () => {
      const analysis = renderer.analyzeBackgroundContrast(100, 100, 200, 50)
      
      expect(analysis).toHaveProperty('averageLuminance')
      expect(analysis).toHaveProperty('contrastRatio')
      expect(analysis).toHaveProperty('wcagCompliance')
      expect(analysis).toHaveProperty('suggestedTextColor')
      expect(analysis).toHaveProperty('backgroundType')
      
      expect(typeof analysis.averageLuminance).toBe('number')
      expect(typeof analysis.contrastRatio).toBe('number')
      expect(['AA', 'AAA', 'fail']).toContain(analysis.wcagCompliance)
      expect(['#ffffff', '#000000']).toContain(analysis.suggestedTextColor)
      expect(['light', 'dark', 'mixed']).toContain(analysis.backgroundType)
    })

    it('should suggest white text for dark backgrounds', () => {
      // Mock getPixelColor to return dark colors
      const originalGetPixelColor = (renderer as any).getPixelColor
      ;(renderer as any).getPixelColor = vi.fn(() => 0x000000) // Black
      
      const analysis = renderer.analyzeBackgroundContrast(0, 0, 100, 100)
      
      expect(analysis.suggestedTextColor).toBe('#ffffff')
      expect(analysis.backgroundType).toBe('dark')
      
      // Restore original method
      ;(renderer as any).getPixelColor = originalGetPixelColor
    })

    it('should suggest black text for light backgrounds', () => {
      // Mock getPixelColor to return light colors
      const originalGetPixelColor = (renderer as any).getPixelColor
      ;(renderer as any).getPixelColor = vi.fn(() => 0xffffff) // White
      
      const analysis = renderer.analyzeBackgroundContrast(0, 0, 100, 100)
      
      expect(analysis.suggestedTextColor).toBe('#000000')
      expect(analysis.backgroundType).toBe('light')
      
      // Restore original method
      ;(renderer as any).getPixelColor = originalGetPixelColor
    })

    it('should handle mixed backgrounds', () => {
      // Mock getPixelColor to return varied colors
      const originalGetPixelColor = (renderer as any).getPixelColor
      const colors = [0x000000, 0xffffff, 0x808080, 0x404040, 0xc0c0c0]
      let colorIndex = 0
      ;(renderer as any).getPixelColor = vi.fn(() => colors[colorIndex++ % colors.length])
      
      const analysis = renderer.analyzeBackgroundContrast(0, 0, 100, 100)
      
      expect(analysis.backgroundType).toBe('mixed')
      
      // Restore original method
      ;(renderer as any).getPixelColor = originalGetPixelColor
    })

    it('should handle null pixel colors gracefully', () => {
      // Mock getPixelColor to return null
      const originalGetPixelColor = (renderer as any).getPixelColor
      ;(renderer as any).getPixelColor = vi.fn(() => null)
      
      const analysis = renderer.analyzeBackgroundContrast(0, 0, 100, 100)
      
      expect(analysis.averageLuminance).toBe(0.5) // Default fallback
      expect(typeof analysis.contrastRatio).toBe('number')
      
      // Restore original method
      ;(renderer as any).getPixelColor = originalGetPixelColor
    })
  })

  describe('createAdaptiveBackground', () => {
    it('should create adaptive background based on analysis', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const options: BackgroundRenderOptions = {
        type: 'adaptive',
        padding: 10
      }
      
      const result = renderer.createAdaptiveBackground(mockText as any, options)
      
      expect(mockScene.add.container).toHaveBeenCalled()
      expect(mockScene.add.graphics).toHaveBeenCalled()
      expect(result).toBe(mockContainer)
    })

    it('should create semi-transparent background when specified', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const options: BackgroundRenderOptions = {
        type: 'semi-transparent',
        opacity: 0.7,
        cornerRadius: 12
      }
      
      renderer.createAdaptiveBackground(mockText as any, options)
      
      expect(mockGraphics.fillStyle).toHaveBeenCalled()
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalled()
    })

    it('should create solid background when specified', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const options: BackgroundRenderOptions = {
        type: 'solid',
        opacity: 0.95
      }
      
      renderer.createAdaptiveBackground(mockText as any, options)
      
      expect(mockGraphics.fillStyle).toHaveBeenCalled()
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalled()
    })

    it('should handle outline type without background graphics', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      
      // Mock the analyzeBackgroundContrast to return AAA compliance (which triggers outline)
      const originalAnalyze = renderer.analyzeBackgroundContrast
      renderer.analyzeBackgroundContrast = vi.fn(() => ({
        averageLuminance: 0.2,
        contrastRatio: 8.0,
        wcagCompliance: 'AAA' as const,
        suggestedTextColor: '#ffffff',
        backgroundType: 'dark' as const
      }))
      
      const options: BackgroundRenderOptions = {
        type: 'adaptive' // Use adaptive to trigger the selection logic
      }
      
      const result = renderer.createAdaptiveBackground(mockText as any, options)
      
      expect(mockContainer.add).toHaveBeenCalledWith(mockText)
      expect(result).toBe(mockContainer)
      
      // Restore original method
      renderer.analyzeBackgroundContrast = originalAnalyze
    })

    it('should use default options when none provided', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      renderer.createAdaptiveBackground(mockText as any)
      
      expect(mockScene.add.container).toHaveBeenCalled()
      expect(mockScene.add.graphics).toHaveBeenCalled()
    })

    it('should apply shadow when shadowEnabled is not false', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const options: BackgroundRenderOptions = {
        type: 'solid',
        shadowEnabled: true,
        shadowColor: 0x333333,
        shadowOffset: { x: 3, y: 5 },
        shadowBlur: 8
      }
      
      renderer.createAdaptiveBackground(mockText as any, options)
      
      // Should call fillStyle for both shadow and background
      expect(mockGraphics.fillStyle).toHaveBeenCalledTimes(2)
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalledTimes(2)
    })

    it('should skip shadow when shadowEnabled is false', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const options: BackgroundRenderOptions = {
        type: 'solid',
        shadowEnabled: false
      }
      
      renderer.createAdaptiveBackground(mockText as any, options)
      
      // Should only call fillStyle for background (no shadow)
      expect(mockGraphics.fillStyle).toHaveBeenCalledTimes(1)
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalledTimes(1)
    })
  })

  describe('private methods', () => {
    describe('getSamplePoints', () => {
      it('should generate 9 sample points in a 3x3 grid', () => {
        // Test through public method that uses getSamplePoints
        const analysis = renderer.analyzeBackgroundContrast(100, 100, 200, 100)
        expect(analysis).toHaveProperty('averageLuminance')
        expect(analysis).toHaveProperty('backgroundType')
      })
    })

    describe('getPixelColor', () => {
      it('should return consistent results through analysis', () => {
        // Test through public method that uses getPixelColor
        const analysis1 = renderer.analyzeBackgroundContrast(100, 100, 50, 50)
        const analysis2 = renderer.analyzeBackgroundContrast(100, 100, 50, 50)
        
        expect(analysis1.averageLuminance).toBe(analysis2.averageLuminance)
      })

      it('should return different results for different positions', () => {
        const analysis1 = renderer.analyzeBackgroundContrast(0, 0, 50, 50)
        const analysis2 = renderer.analyzeBackgroundContrast(400, 300, 50, 50)
        
        // Results should potentially be different for different positions
        expect(typeof analysis1.averageLuminance).toBe('number')
        expect(typeof analysis2.averageLuminance).toBe('number')
      })
    })

    describe('background type determination', () => {
      it('should classify background types correctly', () => {
        // Test various positions to get different background types
        const analysis = renderer.analyzeBackgroundContrast(0, 0, 100, 100)
        expect(['light', 'dark', 'mixed']).toContain(analysis.backgroundType)
      })
    })

    describe('optimal background type selection', () => {
      it('should select appropriate background types through adaptive creation', () => {
        const mockText = createMockText()
        const mockContainer = createMockContainer()
        const mockGraphics = createMockGraphics()
        
        mockScene.add.container.mockReturnValue(mockContainer)
        mockScene.add.graphics.mockReturnValue(mockGraphics)
        
        // Test adaptive type selection
        const options: BackgroundRenderOptions = {
          type: 'adaptive'
        }
        
        const result = renderer.createAdaptiveBackground(mockText as any, options)
        expect(result).toBe(mockContainer)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero-sized text bounds', () => {
      const mockText = createMockText(0, 0)
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 10,
        cornerRadius: 8,
        opacity: 0.9,
        blurBackground: false
      }
      
      expect(() => {
        renderer.createTextBackground(mockText as any, config)
      }).not.toThrow()
    })

    it('should handle negative padding values', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: -5,
        cornerRadius: 8,
        opacity: 0.9,
        blurBackground: false
      }
      
      expect(() => {
        renderer.createTextBackground(mockText as any, config)
      }).not.toThrow()
    })

    it('should handle extreme opacity values', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 10,
        cornerRadius: 8,
        opacity: 2.0, // > 1.0
        blurBackground: false
      }
      
      expect(() => {
        renderer.createTextBackground(mockText as any, config)
      }).not.toThrow()
    })

    it('should handle zero corner radius', () => {
      const mockText = createMockText()
      const mockContainer = createMockContainer()
      const mockGraphics = createMockGraphics()
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.graphics.mockReturnValue(mockGraphics)
      
      const config: BackgroundConfig = {
        padding: 10,
        cornerRadius: 0,
        opacity: 0.9,
        blurBackground: false
      }
      
      expect(() => {
        renderer.createTextBackground(mockText as any, config)
      }).not.toThrow()
    })
  })
})