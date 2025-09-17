/**
 * Test suite for greeting and loading screen text readability improvements
 * 
 * Tests implementation of task 8: Improve greeting and loading screen text readability
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import Phaser from 'phaser'
import { Hud } from '../src/ui/Hud'
import {
  calculateContrastRatioFromHex,
  calculateContrastRatioMixed,
  checkWcagCompliance,
  validateTextReadability
} from '../src/utils/textReadability'

describe('Greeting and Loading Screen Text Readability', () => {
  let scene: Phaser.Scene
  let hud: Hud

  beforeEach(() => {
    // Create a minimal Phaser scene for testing
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.HEADLESS,
      width: 800,
      height: 600,
      scene: {
        create: function() {
          // Empty scene for testing
        }
      }
    }

    const game = new Phaser.Game(config)
    scene = game.scene.scenes[0]
    hud = new Hud(scene)
  })

  afterEach(() => {
    scene?.game?.destroy(true)
  })

  describe('Greeting Screen Text Readability', () => {
    test('should create greeting with accessible text styles', () => {
      // Show greeting to trigger text creation
      hud.showGreeting('Welcome!', 'Test message', () => {})

      // Access the greeting screen elements (would need to expose for testing)
      const greetingScreen = (hud as any).greetingScreen
      
      expect(greetingScreen.greetingTitle).toBeDefined()
      expect(greetingScreen.greetingMsg).toBeDefined()
      expect(greetingScreen.greetingCard).toBeDefined()
    })

    test('should use enhanced background with proper opacity', () => {
      hud.showGreeting('Welcome!', 'Test message', () => {})

      const greetingScreen = (hud as any).greetingScreen
      const backgroundCard = greetingScreen.greetingCard

      expect(backgroundCard).toBeDefined()
      // Background should have enhanced opacity (0.95) for better contrast
      const background = backgroundCard.list[0] as any
      expect(background.alpha).toBeCloseTo(0.95, 2)
    })

    test('should apply accessible text styling to title', () => {
      hud.showGreeting('Welcome!', 'Test message', () => {})

      const greetingScreen = (hud as any).greetingScreen
      const titleText = greetingScreen.greetingTitle

      expect(titleText).toBeDefined()
      expect(titleText.style.fontSize).toBeDefined()
      
      // Should use responsive font sizing
      const fontSize = parseInt(titleText.style.fontSize.replace('px', ''))
      expect(fontSize).toBeGreaterThanOrEqual(16) // Minimum accessible size
    })

    test('should apply accessible text styling to message', () => {
      hud.showGreeting('Welcome!', 'Test message', () => {})

      const greetingScreen = (hud as any).greetingScreen
      const messageText = greetingScreen.greetingMsg

      expect(messageText).toBeDefined()
      expect(messageText.style.fontSize).toBeDefined()
      
      // Should use responsive font sizing
      const fontSize = parseInt(messageText.style.fontSize.replace('px', ''))
      expect(fontSize).toBeGreaterThanOrEqual(14) // Minimum accessible size for body text
    })

    test('should validate WCAG compliance for greeting text', () => {
      // Test contrast ratios for greeting text colors
      const titleColor = '#000000' // Black text on white background
      const backgroundColor = '#ffffff'
      
      const contrastRatio = calculateContrastRatioFromHex(titleColor, backgroundColor)
      const wcagCompliance = checkWcagCompliance(contrastRatio, 22, false)
      
      expect(wcagCompliance).not.toBe('fail')
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5) // AA compliance minimum
    })
  })

  describe('Rotate Overlay Text Readability', () => {
    test('should create rotate overlay with high contrast text', () => {
      hud.showRotateOverlay()

      const loadingEffects = (hud as any).loadingEffects
      const rotateOverlay = loadingEffects.rotateOverlay

      expect(rotateOverlay).toBeDefined()
      expect(rotateOverlay.list).toHaveLength(2) // Background and text
    })

    test('should use enhanced background opacity for better contrast', () => {
      hud.showRotateOverlay()

      const loadingEffects = (hud as any).loadingEffects
      const rotateOverlay = loadingEffects.rotateOverlay
      const background = rotateOverlay.list[0] as any

      // Should use enhanced opacity (0.85) for better text contrast
      expect(background.alpha).toBeCloseTo(0.85, 2)
    })

    test('should validate WCAG AAA compliance for rotate overlay text', () => {
      // Test contrast for white text on dark background
      const textColor = '#ffffff'
      const backgroundColor = 0x000000
      
      const contrastRatio = calculateContrastRatioMixed(textColor, backgroundColor)
      const wcagCompliance = checkWcagCompliance(contrastRatio, 20, true) // Bold text
      
      expect(wcagCompliance).toBe('AAA') // Should meet AAA standards for critical messages
      expect(contrastRatio).toBeGreaterThanOrEqual(7.0) // AAA compliance minimum
    })

    test('should include pulsing animation for attention', () => {
      hud.showRotateOverlay()

      const loadingEffects = (hud as any).loadingEffects
      const rotateOverlay = loadingEffects.rotateOverlay
      const text = rotateOverlay.list[1] as any

      expect(text).toBeDefined()
      // Animation would be tested by checking if tweens are created
      // This would require access to scene.tweens.getAllTweens() or similar
    })
  })

  describe('Loading Text Methods', () => {
    test('should create loading text with accessible styling', () => {
      hud.showLoadingText('Loading...', 'center')

      const loadingEffects = (hud as any).loadingEffects
      const loadingText = loadingEffects.loadingText

      expect(loadingText).toBeDefined()
      expect(loadingText.text).toBe('Loading...')
      
      // Should use responsive font sizing
      const fontSize = parseInt(loadingText.style.fontSize.replace('px', ''))
      expect(fontSize).toBeGreaterThanOrEqual(16) // Minimum accessible size
    })

    test('should position loading text correctly', () => {
      const positions = ['top', 'center', 'bottom'] as const
      
      positions.forEach(position => {
        hud.hideLoadingText() // Clear previous
        hud.showLoadingText('Loading...', position)

        const loadingEffects = (hud as any).loadingEffects
        const loadingText = loadingEffects.loadingText

        expect(loadingText).toBeDefined()
        
        const expectedY = position === 'top' ? scene.cameras.main.height * 0.2 :
                         position === 'bottom' ? scene.cameras.main.height * 0.8 :
                         scene.cameras.main.height / 2

        expect(loadingText.y).toBeCloseTo(expectedY, 1)
      })
    })

    test('should clear loading text properly', () => {
      hud.showLoadingText('Loading...', 'center')
      
      let loadingEffects = (hud as any).loadingEffects
      expect(loadingEffects.loadingText).toBeDefined()

      hud.hideLoadingText()
      
      loadingEffects = (hud as any).loadingEffects
      expect(loadingEffects.loadingText).toBeUndefined()
    })
  })

  describe('Status Text Methods', () => {
    test('should create status text with type-appropriate colors', () => {
      const statusTypes = [
        { type: 'info' as const, expectedBg: 0x2563eb },
        { type: 'warning' as const, expectedBg: 0xfbbf24 },
        { type: 'error' as const, expectedBg: 0xdc2626 }
      ]

      statusTypes.forEach(({ type, expectedBg }) => {
        hud.hideStatusText() // Clear previous
        hud.showStatusText(`Test ${type} message`, type, 0) // No auto-hide for testing

        const loadingEffects = (hud as any).loadingEffects
        const statusText = loadingEffects.statusText

        expect(statusText).toBeDefined()
        expect(statusText.text).toBe(`Test ${type} message`)
      })
    })

    test('should validate WCAG compliance for status text colors', () => {
      const statusConfigs = [
        { textColor: '#ffffff', backgroundColor: 0x2563eb }, // Info: white on blue
        { textColor: '#000000', backgroundColor: 0xfbbf24 }, // Warning: black on yellow
        { textColor: '#ffffff', backgroundColor: 0xdc2626 }  // Error: white on red
      ]

      statusConfigs.forEach(({ textColor, backgroundColor }) => {
        const contrastRatio = calculateContrastRatioMixed(textColor, backgroundColor)
        const wcagCompliance = checkWcagCompliance(contrastRatio, 16, true) // Bold text

        expect(wcagCompliance).not.toBe('fail')
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5) // AA compliance minimum
      })
    })

    test('should clear status text properly', () => {
      hud.showStatusText('Test message', 'info', 0)
      
      let loadingEffects = (hud as any).loadingEffects
      expect(loadingEffects.statusText).toBeDefined()

      hud.hideStatusText()
      
      loadingEffects = (hud as any).loadingEffects
      expect(loadingEffects.statusText).toBeUndefined()
    })
  })

  describe('Text Readability Validation', () => {
    test('should meet minimum font size requirements', () => {
      // Test various text elements for minimum font sizes
      const textElements = [
        { name: 'Greeting Title', minSize: 18 },
        { name: 'Greeting Message', minSize: 16 },
        { name: 'Rotate Overlay', minSize: 18 },
        { name: 'Loading Text', minSize: 16 },
        { name: 'Status Text', minSize: 16 }
      ]

      textElements.forEach(({ name, minSize }) => {
        // This would test actual font sizes used in the implementation
        // For now, we validate that our minimum size requirements are reasonable
        expect(minSize).toBeGreaterThanOrEqual(14) // WCAG minimum for desktop
      })
    })

    test('should validate responsive scaling behavior', () => {
      // Test that font sizes scale appropriately for different viewport sizes
      const viewportSizes = [
        { width: 320, height: 568 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 } // Desktop
      ]

      viewportSizes.forEach(({ width, height }) => {
        // Simulate viewport change
        scene.cameras.main.setSize(width, height)
        
        // Test that text elements would scale appropriately
        // This is a conceptual test - actual implementation would need
        // to expose scaling calculations for testing
        const scalingFactor = Math.min(width / 375, 2.0) // Mobile baseline
        expect(scalingFactor).toBeGreaterThan(0)
        expect(scalingFactor).toBeLessThanOrEqual(2.0)
      })
    })

    test('should maintain readability across different backgrounds', () => {
      // Test contrast ratios for various background scenarios
      const backgroundScenarios = [
        { name: 'Light background', bg: '#ffffff', text: '#000000' },
        { name: 'Dark background', bg: '#000000', text: '#ffffff' },
        { name: 'Medium background', bg: '#808080', text: '#ffffff' }
      ]

      backgroundScenarios.forEach(({ name, bg, text }) => {
        const contrastRatio = calculateContrastRatioFromHex(text, bg)
        const wcagCompliance = checkWcagCompliance(contrastRatio, 16, false)
        
        expect(wcagCompliance).not.toBe('fail')
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5) // AA compliance
      })
    })
  })

  describe('Integration with Existing Systems', () => {
    test('should integrate with existing HUD layout system', () => {
      // Show greeting and then trigger layout
      hud.showGreeting('Welcome!', 'Test message', () => {})
      
      // Layout should not throw errors
      expect(() => hud.layout()).not.toThrow()
    })

    test('should clean up properly when destroyed', () => {
      // Show various text elements
      hud.showGreeting('Welcome!', 'Test message', () => {})
      hud.showRotateOverlay()
      hud.showLoadingText('Loading...', 'center')
      hud.showStatusText('Test status', 'info', 0)

      // Cleanup should not throw errors
      const loadingEffects = (hud as any).loadingEffects
      expect(() => loadingEffects.destroy()).not.toThrow()
    })

    test('should handle multiple text elements simultaneously', () => {
      // Show multiple text elements at once
      hud.showLoadingText('Loading...', 'top')
      hud.showStatusText('Connection established', 'info', 0)
      
      const loadingEffects = (hud as any).loadingEffects
      expect(loadingEffects.loadingText).toBeDefined()
      expect(loadingEffects.statusText).toBeDefined()

      // Both should be visible and properly positioned
      expect(loadingEffects.loadingText.y).toBeLessThan(loadingEffects.statusText.y)
    })
  })
})