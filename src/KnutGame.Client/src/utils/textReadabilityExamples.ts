/**
 * Examples and usage patterns for text readability utilities
 * 
 * This file demonstrates how to use the text readability utilities
 * in practical scenarios within the KnutGame.
 */

import {
  calculateContrastRatioFromHex,
  calculateContrastRatioMixed,
  checkWcagCompliance,
  validateTextReadability,
  suggestTextColor,
  createResponsiveFontSize,
  TextReadabilityManager,
  type ScalingConfig
} from './textReadability'

/**
 * Example: Validate text contrast for game UI elements
 */
export function validateGameUIContrast(): void {
  // Check if current HUD colors meet accessibility standards
  const hudTextColor = '#ffffff'
  const hudStrokeColor = '#000000'
  
  const contrastRatio = calculateContrastRatioFromHex(hudTextColor, hudStrokeColor)
  const compliance = checkWcagCompliance(contrastRatio, 16, false)
  
  console.log(`HUD text contrast ratio: ${contrastRatio.toFixed(2)}:1`)
  console.log(`WCAG compliance: ${compliance}`)
  
  if (compliance === 'fail') {
    const suggestedColor = suggestTextColor(hudStrokeColor)
    console.log(`Suggested text color: ${suggestedColor}`)
  }
}

/**
 * Example: Create responsive font sizes for different screen sizes
 */
export function createResponsiveFontSizes(): Record<string, string> {
  const fontConfigs = {
    title: {
      baseSize: 48,
      minSize: 32,
      maxSize: 64,
      scalingFactor: 1.2
    } as ScalingConfig,
    
    body: {
      baseSize: 16,
      minSize: 14,
      maxSize: 20,
      scalingFactor: 1.0
    } as ScalingConfig,
    
    small: {
      baseSize: 12,
      minSize: 10,
      maxSize: 16,
      scalingFactor: 1.0
    } as ScalingConfig
  }
  
  return {
    titleSize: createResponsiveFontSize(fontConfigs.title),
    bodySize: createResponsiveFontSize(fontConfigs.body),
    smallSize: createResponsiveFontSize(fontConfigs.small)
  }
}

/**
 * Example: Validate message box readability
 */
export function validateMessageBoxReadability(): void {
  const titleColor = '#111111'
  const messageColor = '#333333'
  const backgroundColor = 0xffffff // White background
  
  // Validate title text
  const titleMetrics = validateTextReadability(titleColor, backgroundColor, 20, false)
  console.log('Title readability:', {
    contrast: titleMetrics.contrastRatio.toFixed(2),
    compliance: titleMetrics.wcagCompliance
  })
  
  // Validate message text
  const messageMetrics = validateTextReadability(messageColor, backgroundColor, 16, false)
  console.log('Message readability:', {
    contrast: messageMetrics.contrastRatio.toFixed(2),
    compliance: messageMetrics.wcagCompliance
  })
}

/**
 * Example: Using TextReadabilityManager for comprehensive text management
 */
export function demonstrateReadabilityManager(): void {
  const manager = new TextReadabilityManager()
  
  // Get device-specific information
  console.log('Device scaling factor:', manager.getScalingFactor())
  console.log('Minimum font sizes:', manager.getMinimumSizes())
  
  // Create scaled font sizes
  const scaledSizes = {
    gameTitle: manager.createScaledFontSize(48, 'large'),
    hudText: manager.createScaledFontSize(16, 'body'),
    secondaryText: manager.createScaledFontSize(14, 'secondary')
  }
  
  console.log('Scaled font sizes:', scaledSizes)
  
  // Test accessibility of various color combinations
  const colorTests = [
    { text: '#ffffff', bg: '#000000', name: 'White on Black' },
    { text: '#000000', bg: '#ffffff', name: 'Black on White' },
    { text: '#ff0000', bg: '#ffffff', name: 'Red on White' },
    { text: '#0066cc', bg: '#ffffff', name: 'Blue on White' },
    { text: '#888888', bg: '#999999', name: 'Gray on Gray (should fail)' }
  ]
  
  colorTests.forEach(test => {
    const isAccessible = manager.isAccessible(test.text, test.bg, 16)
    console.log(`${test.name}: ${isAccessible ? 'PASS' : 'FAIL'}`)
  })
}

/**
 * Example: Create Phaser-compatible text style with accessibility features
 */
export function createAccessiblePhaserTextStyle(
  textColor: string,
  backgroundColor: string | number,
  fontSize: number = 16
): Phaser.Types.GameObjects.Text.TextStyle {
  const manager = new TextReadabilityManager()
  
  // Validate accessibility
  const isAccessible = manager.isAccessible(textColor, backgroundColor, fontSize)
  
  if (!isAccessible) {
    console.warn(`Text color ${textColor} may not be accessible against background`)
    const suggestedColor = suggestTextColor(backgroundColor)
    console.warn(`Consider using ${suggestedColor} instead`)
  }
  
  // Create responsive font size
  const responsiveFontSize = manager.createScaledFontSize(fontSize, 'body')
  
  // Calculate contrast for stroke color
  const contrastWithWhite = calculateContrastRatioMixed(textColor, 0xffffff)
  const contrastWithBlack = calculateContrastRatioMixed(textColor, 0x000000)
  const strokeColor = contrastWithWhite > contrastWithBlack ? '#ffffff' : '#000000'
  
  return {
    fontSize: responsiveFontSize,
    color: textColor,
    fontFamily: 'Arial, sans-serif',
    stroke: strokeColor,
    strokeThickness: 2,
    resolution: Math.min((globalThis.devicePixelRatio || 1), 2)
  }
}

/**
 * Example: Batch validate all game text elements
 */
export function validateAllGameText(): void {
  console.log('=== Game Text Accessibility Report ===')
  
  const textElements = [
    { name: 'Lives Text', color: '#ff0000', bg: 'transparent', size: 16 },
    { name: 'Timer Text', color: '#ffffff', bg: 'transparent', size: 16 },
    { name: 'Score Text', color: '#ffff00', bg: 'transparent', size: 16 },
    { name: 'Multiplier Text', color: '#ff8800', bg: 'transparent', size: 16 },
    { name: 'Game Over Title', color: '#ff5555', bg: 'transparent', size: 48 },
    { name: 'Message Box Title', color: '#111111', bg: '#ffffff', size: 20 },
    { name: 'Message Box Text', color: '#333333', bg: '#ffffff', size: 16 },
    { name: 'Greeting Title', color: '#111111', bg: '#ffffff', size: 22 },
    { name: 'Greeting Message', color: '#333333', bg: '#ffffff', size: 16 }
  ]
  
  textElements.forEach(element => {
    if (element.bg === 'transparent') {
      console.log(`${element.name}: Requires background analysis`)
    } else {
      const metrics = validateTextReadability(element.color, element.bg, element.size)
      console.log(`${element.name}: ${metrics.contrastRatio.toFixed(2)}:1 (${metrics.wcagCompliance})`)
    }
  })
  
  console.log('=== End Report ===')
}

// Export all examples for easy testing
export const examples = {
  validateGameUIContrast,
  createResponsiveFontSizes,
  validateMessageBoxReadability,
  demonstrateReadabilityManager,
  createAccessiblePhaserTextStyle,
  validateAllGameText
}