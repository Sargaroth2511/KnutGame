/**
 * Adaptive Background Renderer for Text Readability
 * 
 * This module provides utilities for creating adaptive backgrounds that enhance
 * text readability by ensuring sufficient contrast and visual separation.
 */

import Phaser from 'phaser'
import {
  calculateLuminanceFromNumber,
  calculateContrastRatio,
  checkWcagCompliance,
  // suggestTextColor
} from './textReadability'

/**
 * Configuration for background rendering
 */
export interface BackgroundConfig {
  padding: number
  cornerRadius: number
  opacity: number
  blurBackground: boolean
}

/**
 * Background analysis result
 */
export interface BackgroundAnalysis {
  averageLuminance: number
  contrastRatio: number
  wcagCompliance: 'AA' | 'AAA' | 'fail'
  suggestedTextColor: string
  backgroundType: 'light' | 'dark' | 'mixed'
}

/**
 * Background rendering options
 */
export interface BackgroundRenderOptions {
  type: 'semi-transparent' | 'solid' | 'outline' | 'adaptive'
  color?: number
  opacity?: number
  padding?: number
  cornerRadius?: number
  shadowEnabled?: boolean
  shadowColor?: number
  shadowOffset?: { x: number; y: number }
  shadowBlur?: number
}

/**
 * AdaptiveBackgroundRenderer creates appropriate backgrounds for text elements
 * to ensure optimal readability and WCAG compliance.
 */
export class AdaptiveBackgroundRenderer {
  private readonly scene: Phaser.Scene
  // private readonly dpr: number

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // this.dpr = Math.min((globalThis.devicePixelRatio || 1), 2)
  }

  /**
   * Creates a text background container with the specified configuration
   * @param text - The Phaser text object to create background for
   * @param config - Background configuration options
   * @returns Container with background graphics and text
   */
  createTextBackground(text: Phaser.GameObjects.Text, config: BackgroundConfig): Phaser.GameObjects.Container {
    const bounds = text.getBounds()
    const width = bounds.width + (config.padding * 2)
    const height = bounds.height + (config.padding * 2)
    
    const container = this.scene.add.container(text.x, text.y)
    
    // Create background graphics
    const background = this.scene.add.graphics()
    
    if (config.blurBackground) {
      // Create blurred background effect
      this.createBlurredBackground(background, width, height, config)
    } else {
      // Create solid background
      this.createSolidBackground(background, width, height, config)
    }
    
    // Add background and text to container
    container.add([background, text])
    
    // Adjust text position relative to container
    text.setPosition(0, 0)
    
    return container
  }

  /**
   * Updates an existing background container for new text content
   * @param container - The container to update
   * @param newText - New text content
   */
  updateBackgroundForText(container: Phaser.GameObjects.Container, newText: string): void {
    const textObject = container.list.find(obj => obj instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text
    const backgroundGraphics = container.list.find(obj => obj instanceof Phaser.GameObjects.Graphics) as Phaser.GameObjects.Graphics
    
    if (!textObject || !backgroundGraphics) {
      console.warn('AdaptiveBackgroundRenderer: Invalid container structure for update')
      return
    }
    
    // Update text content
    textObject.setText(newText)
    
    // Recalculate dimensions
    const bounds = textObject.getBounds()
    const padding = 16 // Default padding, could be made configurable
    const width = bounds.width + (padding * 2)
    const height = bounds.height + (padding * 2)
    
    // Redraw background
    backgroundGraphics.clear()
    this.createSolidBackground(backgroundGraphics, width, height, {
      padding,
      cornerRadius: 8,
      opacity: 0.9,
      blurBackground: false
    })
  }

  /**
   * Analyzes the background contrast at a specific screen region
   * @param x - X coordinate of the region
   * @param y - Y coordinate of the region  
   * @param width - Width of the region
   * @param height - Height of the region
   * @returns Background analysis results
   */
  analyzeBackgroundContrast(x: number, y: number, width: number, height: number): BackgroundAnalysis {
    // Sample multiple points in the region to get average luminance
    const samplePoints = this.getSamplePoints(x, y, width, height)
    const luminanceValues: number[] = []
    
    // For each sample point, get the pixel color and calculate luminance
    samplePoints.forEach(point => {
      const color = this.getPixelColor(point.x, point.y)
      if (color !== null) {
        const luminance = calculateLuminanceFromNumber(color)
        luminanceValues.push(luminance)
      }
    })
    
    // Calculate average luminance
    const averageLuminance = luminanceValues.length > 0 
      ? luminanceValues.reduce((sum, val) => sum + val, 0) / luminanceValues.length
      : 0.5 // Default to medium luminance if no samples
    
    // Determine background type
    const backgroundType = this.determineBackgroundType(luminanceValues)
    
    // Calculate contrast ratios for white and black text
    const whiteContrast = calculateContrastRatio(1.0, averageLuminance)
    const blackContrast = calculateContrastRatio(0.0, averageLuminance)
    
    // Choose better contrast option
    const bestContrast = Math.max(whiteContrast, blackContrast)
    const suggestedTextColor = whiteContrast > blackContrast ? '#ffffff' : '#000000'
    
    // Check WCAG compliance (assuming 16px normal text)
    const wcagCompliance = checkWcagCompliance(bestContrast, 16, false)
    
    return {
      averageLuminance,
      contrastRatio: bestContrast,
      wcagCompliance,
      suggestedTextColor,
      backgroundType
    }
  }

  /**
   * Creates an adaptive background based on the underlying content
   * @param text - Text object to create background for
   * @param options - Rendering options
   * @returns Container with adaptive background
   */
  createAdaptiveBackground(text: Phaser.GameObjects.Text, options: BackgroundRenderOptions = { type: 'adaptive' }): Phaser.GameObjects.Container {
    const bounds = text.getBounds()
    const padding = options.padding || 12
    const width = bounds.width + (padding * 2)
    const height = bounds.height + (padding * 2)
    
    // Analyze the background where text will be placed
    const analysis = this.analyzeBackgroundContrast(
      bounds.x - padding,
      bounds.y - padding,
      width,
      height
    )
    
    // Determine optimal background type based on analysis
    let backgroundType = options.type
    if (backgroundType === 'adaptive') {
      backgroundType = this.selectOptimalBackgroundType(analysis)
    }
    
    // Create background based on determined type
    const container = this.scene.add.container(text.x, text.y)
    const background = this.scene.add.graphics()
    
    switch (backgroundType) {
      case 'semi-transparent':
        this.createSemiTransparentBackground(background, width, height, options, analysis)
        break
      case 'solid':
        this.createSolidBackgroundWithAnalysis(background, width, height, options, analysis)
        break
      case 'outline':
        // For outline, we don't need a background graphic
        container.add(text)
        text.setPosition(0, 0)
        return container
      default:
        this.createSemiTransparentBackground(background, width, height, options, analysis)
    }
    
    container.add([background, text])
    text.setPosition(0, 0)
    
    return container
  }

  /**
   * Creates a semi-transparent background with optimal contrast
   */
  private createSemiTransparentBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    options: BackgroundRenderOptions,
    analysis: BackgroundAnalysis
  ): void {
    const opacity = options.opacity || 0.8
    const cornerRadius = options.cornerRadius || 8
    
    // Choose background color based on analysis
    const backgroundColor = analysis.backgroundType === 'light' ? 0x000000 : 0xffffff
    
    // Draw shadow if enabled
    if (options.shadowEnabled !== false) {
      const shadowOffset = options.shadowOffset || { x: 2, y: 4 }
      // const _shadowBlur = options.shadowBlur || 6
      const shadowColor = options.shadowColor || 0x000000
      
      graphics.fillStyle(shadowColor, 0.3)
      graphics.fillRoundedRect(
        -width / 2 + shadowOffset.x,
        -height / 2 + shadowOffset.y,
        width,
        height,
        cornerRadius
      )
    }
    
    // Draw main background
    graphics.fillStyle(backgroundColor, opacity)
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius)
  }

  /**
   * Creates a solid background with analysis-based color selection
   */
  private createSolidBackgroundWithAnalysis(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    options: BackgroundRenderOptions,
    analysis: BackgroundAnalysis
  ): void {
    const opacity = options.opacity || 0.95
    const cornerRadius = options.cornerRadius || 8
    
    // Use high contrast color based on analysis
    const backgroundColor = analysis.backgroundType === 'light' ? 0x000000 : 0xffffff
    
    // Draw shadow if enabled
    if (options.shadowEnabled !== false) {
      const shadowOffset = options.shadowOffset || { x: 2, y: 4 }
      const shadowColor = options.shadowColor || 0x000000
      
      graphics.fillStyle(shadowColor, 0.25)
      graphics.fillRoundedRect(
        -width / 2 + shadowOffset.x,
        -height / 2 + shadowOffset.y,
        width,
        height,
        cornerRadius
      )
    }
    
    // Draw main background
    graphics.fillStyle(backgroundColor, opacity)
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius)
  }

  /**
   * Creates a blurred background effect
   */
  private createBlurredBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    config: BackgroundConfig
  ): void {
    // Create a semi-transparent background with blur effect simulation
    // Note: True blur would require render textures, this creates a visual approximation
    
    const layers = 3
    const baseOpacity = config.opacity / layers
    
    for (let i = 0; i < layers; i++) {
      const offset = i * 2
      const currentOpacity = baseOpacity * (1 - i * 0.2)
      
      graphics.fillStyle(0x000000, currentOpacity)
      graphics.fillRoundedRect(
        -width / 2 - offset,
        -height / 2 - offset,
        width + offset * 2,
        height + offset * 2,
        config.cornerRadius + offset
      )
    }
  }

  /**
   * Creates a solid background with rounded corners and shadow
   */
  private createSolidBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    config: BackgroundConfig
  ): void {
    // Draw shadow
    graphics.fillStyle(0x000000, 0.25)
    graphics.fillRoundedRect(
      -width / 2 + 3,
      -height / 2 + 6,
      width,
      height,
      config.cornerRadius
    )
    
    // Draw main background
    graphics.fillStyle(0xffffff, config.opacity)
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, config.cornerRadius)
  }

  /**
   * Gets sample points for background analysis
   */
  private getSamplePoints(x: number, y: number, width: number, height: number): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = []
    // const _sampleCount = 9 // 3x3 grid
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        points.push({
          x: x + (width * i) / 2,
          y: y + (height * j) / 2
        })
      }
    }
    
    return points
  }

  /**
   * Gets the pixel color at a specific coordinate
   * Note: This is a simplified implementation. In a real scenario,
   * you might need to use render textures or other techniques.
   */
  private getPixelColor(x: number, y: number): number | null {
    // This is a placeholder implementation
    // In a real game, you would need to sample the actual rendered pixels
    // For now, we'll return a default color based on position
    const normalizedX = (x / this.scene.cameras.main.width) % 1
    const normalizedY = (y / this.scene.cameras.main.height) % 1
    
    // Create a simple gradient pattern for testing
    const r = Math.floor(normalizedX * 255)
    const g = Math.floor(normalizedY * 255)
    const b = Math.floor((normalizedX + normalizedY) * 127.5)
    
    return (r << 16) | (g << 8) | b
  }

  /**
   * Determines background type based on luminance values
   */
  private determineBackgroundType(luminanceValues: number[]): 'light' | 'dark' | 'mixed' {
    if (luminanceValues.length === 0) return 'mixed'
    
    const average = luminanceValues.reduce((sum, val) => sum + val, 0) / luminanceValues.length
    const variance = luminanceValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / luminanceValues.length
    
    // High variance indicates mixed background
    if (variance > 0.1) return 'mixed'
    
    // Classify based on average luminance
    return average > 0.5 ? 'light' : 'dark'
  }

  /**
   * Selects optimal background type based on analysis
   */
  private selectOptimalBackgroundType(analysis: BackgroundAnalysis): 'semi-transparent' | 'solid' | 'outline' {
    // If contrast is already good, use minimal background
    if (analysis.wcagCompliance === 'AAA') {
      return 'outline'
    }
    
    // If contrast is poor or mixed background, use solid
    if (analysis.wcagCompliance === 'fail' || analysis.backgroundType === 'mixed') {
      return 'solid'
    }
    
    // Default to semi-transparent for AA compliance
    return 'semi-transparent'
  }
}