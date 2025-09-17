import { describe, it, expect, beforeEach, vi } from 'vitest'
import Phaser from 'phaser'
import { HudElement } from '../src/ui/Hud'

// Mock scene for testing
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

// Test HUD element that extends HudElement
class TestHudElement extends HudElement {
  destroy(): void {
    // Test implementation
  }
}

describe('Adaptive Background Integration', () => {
  let mockScene: any
  let hudElement: TestHudElement

  beforeEach(() => {
    vi.clearAllMocks()
    mockScene = createMockScene()
    hudElement = new TestHudElement(mockScene as any)
  })

  describe('HudElement integration', () => {
    it('should have access to backgroundRenderer', () => {
      expect((hudElement as any).backgroundRenderer).toBeDefined()
    })

    it('should create text with adaptive background', () => {
      const mockContainer = { add: vi.fn(), list: [] }
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
        setPosition: vi.fn(),
        x: 50,
        y: 50
      }
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.text.mockReturnValue(mockText)
      mockScene.add.graphics.mockReturnValue({
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn()
      })

      const result = (hudElement as any).createTextWithAdaptiveBackground(
        'Test Text',
        100,
        100,
        { fontSize: '16px', color: '#ffffff' }
      )

      expect(mockScene.add.text).toHaveBeenCalledWith(100, 100, 'Test Text', {
        fontSize: '16px',
        color: '#ffffff'
      })
      expect(result).toBe(mockContainer)
    })

    it('should create text with background using config', () => {
      const mockContainer = { add: vi.fn(), list: [] }
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
        setPosition: vi.fn(),
        x: 50,
        y: 50
      }
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.text.mockReturnValue(mockText)
      mockScene.add.graphics.mockReturnValue({
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn()
      })

      const config = {
        padding: 15,
        cornerRadius: 10,
        opacity: 0.8,
        blurBackground: true
      }

      const result = (hudElement as any).createTextWithBackground(
        'Test Text',
        100,
        100,
        { fontSize: '16px', color: '#ffffff' },
        config
      )

      expect(mockScene.add.text).toHaveBeenCalledWith(100, 100, 'Test Text', {
        fontSize: '16px',
        color: '#ffffff'
      })
      expect(result).toBe(mockContainer)
    })

    it('should analyze background contrast', () => {
      const analysis = (hudElement as any).analyzeBackgroundContrast(100, 100, 200, 50)
      
      expect(analysis).toHaveProperty('averageLuminance')
      expect(analysis).toHaveProperty('contrastRatio')
      expect(analysis).toHaveProperty('wcagCompliance')
      expect(analysis).toHaveProperty('suggestedTextColor')
      expect(analysis).toHaveProperty('backgroundType')
    })

    it('should update text with background', () => {
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
        setText: vi.fn()
      }
      const mockGraphics = {
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn()
      }
      
      // Create proper mock objects that will pass instanceof checks
      const mockTextObj = Object.create(Phaser.GameObjects.Text.prototype)
      Object.assign(mockTextObj, mockText)
      
      const mockGraphicsObj = Object.create(Phaser.GameObjects.Graphics.prototype)
      Object.assign(mockGraphicsObj, mockGraphics)
      
      const mockContainer = {
        list: [mockGraphicsObj, mockTextObj]
      }

      ;(hudElement as any).updateTextWithBackground(mockContainer, 'Updated Text')

      expect(mockText.setText).toHaveBeenCalledWith('Updated Text')
      expect(mockGraphics.clear).toHaveBeenCalled()
    })
  })

  describe('Background rendering options', () => {
    it('should support semi-transparent background type', () => {
      const mockContainer = { add: vi.fn(), list: [] }
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
        setPosition: vi.fn(),
        x: 50,
        y: 50
      }
      const mockGraphics = {
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn()
      }
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.text.mockReturnValue(mockText)
      mockScene.add.graphics.mockReturnValue(mockGraphics)

      const options = {
        type: 'semi-transparent' as const,
        opacity: 0.7,
        cornerRadius: 12
      }

      const result = (hudElement as any).createTextWithAdaptiveBackground(
        'Test Text',
        100,
        100,
        { fontSize: '16px', color: '#ffffff' },
        options
      )

      expect(mockGraphics.fillStyle).toHaveBeenCalled()
      expect(result).toBe(mockContainer)
    })

    it('should support solid background type', () => {
      const mockContainer = { add: vi.fn(), list: [] }
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
        setPosition: vi.fn(),
        x: 50,
        y: 50
      }
      const mockGraphics = {
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn()
      }
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.text.mockReturnValue(mockText)
      mockScene.add.graphics.mockReturnValue(mockGraphics)

      const options = {
        type: 'solid' as const,
        opacity: 0.95,
        shadowEnabled: true
      }

      const result = (hudElement as any).createTextWithAdaptiveBackground(
        'Test Text',
        100,
        100,
        { fontSize: '16px', color: '#ffffff' },
        options
      )

      expect(mockGraphics.fillStyle).toHaveBeenCalled()
      expect(result).toBe(mockContainer)
    })

    it('should support outline type', () => {
      const mockContainer = { add: vi.fn(), list: [] }
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
        setPosition: vi.fn(),
        x: 50,
        y: 50
      }
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.text.mockReturnValue(mockText)

      const options = {
        type: 'outline' as const
      }

      const result = (hudElement as any).createTextWithAdaptiveBackground(
        'Test Text',
        100,
        100,
        { fontSize: '16px', color: '#ffffff' },
        options
      )

      expect(mockContainer.add).toHaveBeenCalledWith(mockText)
      expect(result).toBe(mockContainer)
    })
  })

  describe('Error handling', () => {
    it('should handle invalid background configurations gracefully', () => {
      const mockContainer = { add: vi.fn(), list: [] }
      const mockText = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })), // Zero size
        setPosition: vi.fn(),
        x: 50,
        y: 50
      }
      
      mockScene.add.container.mockReturnValue(mockContainer)
      mockScene.add.text.mockReturnValue(mockText)
      mockScene.add.graphics.mockReturnValue({
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn()
      })

      expect(() => {
        (hudElement as any).createTextWithBackground(
          'Test Text',
          100,
          100,
          { fontSize: '16px', color: '#ffffff' },
          {
            padding: -10, // Negative padding
            cornerRadius: 0,
            opacity: 2.0, // > 1.0
            blurBackground: false
          }
        )
      }).not.toThrow()
    })

    it('should handle missing scene objects gracefully', () => {
      const emptyScene = {
        add: {
          container: vi.fn(() => null),
          graphics: vi.fn(() => null),
          text: vi.fn(() => null)
        },
        cameras: {
          main: { width: 800, height: 600 }
        }
      }

      const emptyHudElement = new TestHudElement(emptyScene as any)

      expect(() => {
        (emptyHudElement as any).analyzeBackgroundContrast(0, 0, 100, 100)
      }).not.toThrow()
    })
  })
})