/**
 * Responsive Font Scaler for KnutGame
 * 
 * This module provides comprehensive font scaling functionality that adapts to:
 * - Different device types and screen sizes
 * - Viewport dimensions and orientation changes
 * - High-DPI displays and device pixel ratios
 * - User accessibility preferences
 * 
 * Implements requirements 4.2, 5.1, 5.2, 5.4 from the text readability specification.
 */

import type { ScalingConfig } from './textReadability'

/**
 * Device type detection results
 */
export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop'
  orientation: 'portrait' | 'landscape'
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  viewportWidth: number
  viewportHeight: number
  isTouchDevice: boolean
  isHighDPI: boolean
}

/**
 * Viewport-aware scaling configuration
 */
export interface ViewportScalingConfig extends ScalingConfig {
  viewportBreakpoints: {
    mobile: number
    tablet: number
    desktop: number
  }
  orientationAdjustment: {
    portrait: number
    landscape: number
  }
  highDPIAdjustment: number
}

/**
 * Font size constraints for different contexts
 */
export interface FontSizeConstraints {
  minimum: number
  maximum: number
  preferred: number
  step: number
}

/**
 * Text overflow detection information
 */
export interface TextOverflowInfo {
  isOverflowing: boolean
  overflowDirection: 'horizontal' | 'vertical' | 'both' | 'none'
  actualWidth: number
  actualHeight: number
  availableWidth: number
  availableHeight: number
  recommendedFontSize?: number
  recommendedAction: 'reduce-font' | 'wrap-text' | 'truncate' | 'scroll' | 'none'
}

/**
 * Text positioning configuration for orientation changes
 */
export interface TextPositionConfig {
  element: any // Phaser text object or similar
  originalPosition: { x: number, y: number }
  anchor: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  margins: { top: number, right: number, bottom: number, left: number }
  responsive: boolean
}

/**
 * Responsive Font Scaler class that handles device-aware font scaling
 */
export class ResponsiveFontScaler {
  private deviceInfo: DeviceInfo
  private readonly defaultConstraints: FontSizeConstraints
  private readonly viewportObserver: ResizeObserver | null = null
  private readonly orientationChangeCallbacks: Set<() => void> = new Set()
  private readonly resizeCallbacks: Set<(newInfo: DeviceInfo) => void> = new Set()
  private readonly textOverflowCallbacks: Set<(element: any, overflow: TextOverflowInfo) => void> = new Set()
  private resizeDebounceTimer?: number
  private orientationChangeTimer?: number

  constructor() {
    this.deviceInfo = this.detectDeviceInfo()
    this.defaultConstraints = this.createDefaultConstraints()
    
    // Set up viewport monitoring with enhanced resize handling
    if (typeof ResizeObserver !== 'undefined') {
      this.viewportObserver = new ResizeObserver((entries) => {
        this.handleViewportResize(entries)
      })
      
      if (document.body) {
        this.viewportObserver.observe(document.body)
      }
    }
    
    // Listen for orientation changes with improved handling
    if (typeof window !== 'undefined') {
      window.addEventListener('orientationchange', () => {
        this.handleOrientationChange()
      })
      
      // Also listen for resize events as backup
      window.addEventListener('resize', () => {
        this.handleWindowResize()
      })
    }
  }

  /**
   * Detects comprehensive device information
   */
  private detectDeviceInfo(): DeviceInfo {
    const userAgent = globalThis.navigator?.userAgent || ''
    const screenWidth = globalThis.screen?.width || globalThis.innerWidth || 1024
    const screenHeight = globalThis.screen?.height || globalThis.innerHeight || 768
    const viewportWidth = globalThis.innerWidth || screenWidth || 1024
    const viewportHeight = globalThis.innerHeight || screenHeight || 768
    const pixelRatio = globalThis.devicePixelRatio || 1

    // Device type detection
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop'
    const isMobile = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent) || 
                    (viewportWidth >= 768 && viewportWidth < 1024)
    
    if (isMobile) {
      deviceType = 'mobile'
    } else if (isTablet) {
      deviceType = 'tablet'
    }

    // Orientation detection
    const orientation: 'portrait' | 'landscape' = viewportWidth > viewportHeight ? 'landscape' : 'portrait'

    // Touch device detection
    const isTouchDevice = 'ontouchstart' in globalThis || 
                         (globalThis.navigator && globalThis.navigator.maxTouchPoints > 0)

    // High-DPI detection
    const isHighDPI = pixelRatio > 1.5

    return {
      type: deviceType,
      orientation,
      pixelRatio,
      screenWidth,
      screenHeight,
      viewportWidth,
      viewportHeight,
      isTouchDevice,
      isHighDPI
    }
  }

  /**
   * Updates device information when viewport changes
   */
  private updateDeviceInfo(): void {
    this.deviceInfo = this.detectDeviceInfo()
  }

  /**
   * Creates default font size constraints based on device type
   */
  private createDefaultConstraints(): FontSizeConstraints {
    const { type, isTouchDevice } = this.deviceInfo

    switch (type) {
      case 'mobile':
        return {
          minimum: isTouchDevice ? 16 : 14, // WCAG mobile minimum
          maximum: 32,
          preferred: 18,
          step: 2
        }
      case 'tablet':
        return {
          minimum: 14,
          maximum: 28,
          preferred: 16,
          step: 2
        }
      case 'desktop':
      default:
        return {
          minimum: 12,
          maximum: 24,
          preferred: 14,
          step: 1
        }
    }
  }

  /**
   * Notifies registered callbacks about orientation changes
   */
  private notifyOrientationChange(): void {
    this.orientationChangeCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.warn('Error in orientation change callback:', error)
      }
    })
  }

  /**
   * Gets current device information
   */
  getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo }
  }

  /**
   * Calculates device-specific scaling factor
   */
  getDeviceScalingFactor(): number {
    const { type, pixelRatio, viewportWidth, orientation } = this.deviceInfo
    
    let baseScale = 1.0

    // Base scaling by device type
    switch (type) {
      case 'mobile':
        baseScale = Math.max(0.8, viewportWidth / 375) // iPhone 6/7/8 baseline with minimum
        break
      case 'tablet':
        baseScale = Math.max(0.9, viewportWidth / 768) // iPad baseline with minimum
        break
      case 'desktop':
        baseScale = Math.min(viewportWidth / 1024, 1.2) // Desktop baseline with cap
        break
    }

    // Pixel ratio adjustment (square root to avoid over-scaling)
    const dpiAdjustment = Math.sqrt(Math.min(pixelRatio, 2.0))
    
    // Orientation adjustment
    const orientationAdjustment = orientation === 'portrait' ? 1.0 : 0.95

    // Combine factors
    const finalScale = baseScale * dpiAdjustment * orientationAdjustment

    // Clamp to reasonable bounds
    return Math.max(0.7, Math.min(2.0, finalScale))
  }

  /**
   * Calculates viewport-aware font size with comprehensive scaling
   */
  calculateOptimalFontSize(config: ScalingConfig): number {
    const deviceFactor = this.getDeviceScalingFactor()
    const scaledSize = config.baseSize * config.scalingFactor * deviceFactor
    
    // Apply constraints
    return Math.max(config.minSize, Math.min(config.maxSize, scaledSize))
  }

  /**
   * Calculates viewport-aware font size with enhanced configuration
   */
  calculateViewportAwareFontSize(config: ViewportScalingConfig): number {
    const { viewportWidth, orientation, pixelRatio } = this.deviceInfo
    
    // Determine breakpoint scaling
    let breakpointScale = 1.0
    if (viewportWidth <= config.viewportBreakpoints.mobile) {
      breakpointScale = 0.9
    } else if (viewportWidth <= config.viewportBreakpoints.tablet) {
      breakpointScale = 0.95
    } else if (viewportWidth >= config.viewportBreakpoints.desktop) {
      breakpointScale = 1.1
    }

    // Apply orientation adjustment
    const orientationScale = config.orientationAdjustment[orientation]
    
    // Apply high-DPI adjustment
    const dpiScale = pixelRatio > 1.5 ? config.highDPIAdjustment : 1.0

    // Calculate final size
    const scaledSize = config.baseSize * 
                      config.scalingFactor * 
                      breakpointScale * 
                      orientationScale * 
                      dpiScale

    // Apply constraints
    return Math.max(config.minSize, Math.min(config.maxSize, scaledSize))
  }

  /**
   * Creates font size constraints for specific context
   */
  createFontSizeConstraints(
    baseSize: number, 
    context: 'body' | 'heading' | 'caption' | 'button' = 'body'
  ): FontSizeConstraints {
    const { type: _type, isTouchDevice } = this.deviceInfo
    const deviceConstraints = this.defaultConstraints

    // Context-specific adjustments
    let contextMultiplier = 1.0
    let minAdjustment = 0
    let maxAdjustment = 0

    switch (context) {
      case 'heading':
        contextMultiplier = 1.5
        minAdjustment = 4
        maxAdjustment = 8
        break
      case 'caption':
        contextMultiplier = 0.85
        minAdjustment = -2
        maxAdjustment = -4
        break
      case 'button':
        contextMultiplier = 1.0
        minAdjustment = isTouchDevice ? 2 : 0 // Touch targets need larger text
        maxAdjustment = 4
        break
      case 'body':
      default:
        contextMultiplier = 1.0
        break
    }

    const scaledBase = baseSize * contextMultiplier
    
    return {
      minimum: Math.max(deviceConstraints.minimum + minAdjustment, 10),
      maximum: deviceConstraints.maximum + maxAdjustment,
      preferred: Math.round(scaledBase),
      step: deviceConstraints.step
    }
  }

  /**
   * Updates text size for viewport changes (for Phaser text objects)
   */
  updateTextSizeForViewport(
    textObject: { setFontSize: (size: number) => void; style: { fontSize?: string | number } },
    originalConfig: ScalingConfig
  ): void {
    const newSize = this.calculateOptimalFontSize(originalConfig)
    textObject.setFontSize(newSize)
  }

  /**
   * Creates a responsive font size string for Phaser text styles
   */
  createResponsiveFontSize(config: ScalingConfig): string {
    const size = this.calculateOptimalFontSize(config)
    return `${Math.round(size)}px`
  }

  /**
   * Creates enhanced responsive font size with viewport awareness
   */
  createViewportResponsiveFontSize(config: ViewportScalingConfig): string {
    const size = this.calculateViewportAwareFontSize(config)
    return `${Math.round(size)}px`
  }

  /**
   * Handles device pixel ratio for crisp text rendering
   */
  getPixelRatioAdjustedSize(baseSize: number): number {
    const { pixelRatio } = this.deviceInfo
    
    // For high-DPI displays, we want to ensure text renders crisply
    // by rounding to pixel boundaries that work well with the pixel ratio
    const adjustedSize = baseSize * Math.sqrt(Math.min(pixelRatio, 2.0))
    
    // Round to nearest half-pixel for crisp rendering
    return Math.round(adjustedSize * 2) / 2
  }

  /**
   * Registers a callback for orientation changes
   */
  onOrientationChange(callback: () => void): () => void {
    this.orientationChangeCallbacks.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.orientationChangeCallbacks.delete(callback)
    }
  }

  /**
   * Creates default viewport scaling configuration
   */
  createDefaultViewportConfig(baseSize: number): ViewportScalingConfig {
    return {
      baseSize,
      minSize: this.defaultConstraints.minimum,
      maxSize: this.defaultConstraints.maximum,
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
  }

  /**
   * Validates font size against accessibility requirements
   */
  validateFontSize(
    fontSize: number, 
    context: 'body' | 'heading' | 'caption' | 'button' = 'body'
  ): { isValid: boolean; recommendedSize: number; reason?: string } {
    const constraints = this.createFontSizeConstraints(fontSize, context)
    
    if (fontSize < constraints.minimum) {
      return {
        isValid: false,
        recommendedSize: constraints.minimum,
        reason: `Font size ${fontSize}px is below minimum ${constraints.minimum}px for ${context} text on ${this.deviceInfo.type} devices`
      }
    }
    
    if (fontSize > constraints.maximum) {
      return {
        isValid: false,
        recommendedSize: constraints.maximum,
        reason: `Font size ${fontSize}px exceeds maximum ${constraints.maximum}px for ${context} text`
      }
    }
    
    return {
      isValid: true,
      recommendedSize: fontSize
    }
  }

  /**
   * Handles viewport resize events with debouncing
   */
  private handleViewportResize(_entries: ResizeObserverEntry[]): void {
    // Clear existing timer
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer)
    }
    
    // Debounce resize events to avoid excessive updates
    this.resizeDebounceTimer = window.setTimeout(() => {
      const previousInfo = { ...this.deviceInfo }
      this.updateDeviceInfo()
      
      // Check if orientation actually changed
      if (previousInfo.orientation !== this.deviceInfo.orientation) {
        this.notifyOrientationChange()
      }
      
      // Notify resize callbacks
      this.notifyResizeChange(this.deviceInfo)
    }, 150) // 150ms debounce
  }

  /**
   * Handles orientation change events with proper timing
   */
  private handleOrientationChange(): void {
    // Clear existing timer
    if (this.orientationChangeTimer) {
      clearTimeout(this.orientationChangeTimer)
    }
    
    // Delay to allow viewport to fully update after orientation change
    this.orientationChangeTimer = window.setTimeout(() => {
      // const _previousInfo = { ...this.deviceInfo }
      this.updateDeviceInfo()
      
      // Always notify on orientation change events
      this.notifyOrientationChange()
      this.notifyResizeChange(this.deviceInfo)
    }, 200) // Longer delay for orientation changes
  }

  /**
   * Handles window resize events as backup
   */
  private handleWindowResize(): void {
    // Use shorter debounce for window resize as backup
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer)
    }
    
    this.resizeDebounceTimer = window.setTimeout(() => {
      const previousInfo = { ...this.deviceInfo }
      this.updateDeviceInfo()
      
      if (previousInfo.orientation !== this.deviceInfo.orientation ||
          Math.abs(previousInfo.viewportWidth - this.deviceInfo.viewportWidth) > 50 ||
          Math.abs(previousInfo.viewportHeight - this.deviceInfo.viewportHeight) > 50) {
        this.notifyOrientationChange()
        this.notifyResizeChange(this.deviceInfo)
      }
    }, 100)
  }

  /**
   * Notifies registered callbacks about resize changes
   */
  private notifyResizeChange(newInfo: DeviceInfo): void {
    this.resizeCallbacks.forEach(callback => {
      try {
        callback(newInfo)
      } catch (error) {
        console.warn('Error in resize change callback:', error)
      }
    })
  }

  /**
   * Notifies registered callbacks about text overflow
   */
  private notifyTextOverflow(element: any, overflow: TextOverflowInfo): void {
    this.textOverflowCallbacks.forEach(callback => {
      try {
        callback(element, overflow)
      } catch (error) {
        console.warn('Error in text overflow callback:', error)
      }
    })
  }

  /**
   * Registers a callback for resize events
   */
  onResize(callback: (newInfo: DeviceInfo) => void): () => void {
    this.resizeCallbacks.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.resizeCallbacks.delete(callback)
    }
  }

  /**
   * Registers a callback for text overflow detection
   */
  onTextOverflow(callback: (element: any, overflow: TextOverflowInfo) => void): () => void {
    this.textOverflowCallbacks.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.textOverflowCallbacks.delete(callback)
    }
  }

  /**
   * Detects text overflow for a given text element
   */
  detectTextOverflow(
    textElement: any,
    availableWidth: number,
    availableHeight: number,
    options: { checkHorizontal?: boolean, checkVertical?: boolean } = {}
  ): TextOverflowInfo {
    const { checkHorizontal = true, checkVertical = true } = options
    
    // Get actual text dimensions
    let actualWidth = 0
    let actualHeight = 0
    
    try {
      if (textElement.width !== undefined && textElement.height !== undefined) {
        actualWidth = textElement.width
        actualHeight = textElement.height
      } else if (textElement.getBounds) {
        const bounds = textElement.getBounds()
        actualWidth = bounds.width
        actualHeight = bounds.height
      } else if (textElement.displayWidth !== undefined && textElement.displayHeight !== undefined) {
        actualWidth = textElement.displayWidth
        actualHeight = textElement.displayHeight
      }
    } catch (error) {
      console.warn('Could not determine text element dimensions:', error)
      return {
        isOverflowing: false,
        overflowDirection: 'none',
        actualWidth: 0,
        actualHeight: 0,
        availableWidth,
        availableHeight,
        recommendedAction: 'none'
      }
    }

    // Check for overflow
    const horizontalOverflow = checkHorizontal && actualWidth > availableWidth
    const verticalOverflow = checkVertical && actualHeight > availableHeight
    
    let overflowDirection: TextOverflowInfo['overflowDirection'] = 'none'
    if (horizontalOverflow && verticalOverflow) {
      overflowDirection = 'both'
    } else if (horizontalOverflow) {
      overflowDirection = 'horizontal'
    } else if (verticalOverflow) {
      overflowDirection = 'vertical'
    }

    const isOverflowing = horizontalOverflow || verticalOverflow

    // Determine recommended action
    let recommendedAction: TextOverflowInfo['recommendedAction'] = 'none'
    let recommendedFontSize: number | undefined

    if (isOverflowing) {
      const currentFontSize = this.extractFontSize(textElement)
      
      if (overflowDirection === 'horizontal' || overflowDirection === 'both') {
        // For horizontal overflow, try reducing font size first
        const scaleFactor = availableWidth / actualWidth
        recommendedFontSize = Math.floor(currentFontSize * scaleFactor * 0.9) // 10% buffer
        
        // Only recommend font reduction if the new size is reasonable
        if (recommendedFontSize >= this.defaultConstraints.minimum && recommendedFontSize < currentFontSize) {
          recommendedAction = 'reduce-font'
        } else {
          recommendedAction = 'wrap-text'
        }
      } else if (overflowDirection === 'vertical') {
        // For vertical overflow, try wrapping or scrolling
        recommendedAction = 'wrap-text'
      }
    }

    const overflowInfo: TextOverflowInfo = {
      isOverflowing,
      overflowDirection,
      actualWidth,
      actualHeight,
      availableWidth,
      availableHeight,
      recommendedFontSize,
      recommendedAction
    }

    // Notify callbacks if overflow detected
    if (isOverflowing) {
      this.notifyTextOverflow(textElement, overflowInfo)
    }

    return overflowInfo
  }

  /**
   * Extracts font size from a text element
   */
  private extractFontSize(textElement: any): number {
    try {
      if (textElement.style && textElement.style.fontSize) {
        const fontSize = textElement.style.fontSize
        if (typeof fontSize === 'string') {
          return parseInt(fontSize.replace('px', ''))
        } else if (typeof fontSize === 'number') {
          return fontSize
        }
      }
      
      // Fallback to default
      return 16
    } catch (error) {
      console.warn('Could not extract font size from text element:', error)
      return 16
    }
  }

  /**
   * Repositions text elements based on orientation and viewport changes
   */
  repositionTextForOrientation(
    configs: TextPositionConfig[],
    newViewportWidth: number,
    newViewportHeight: number
  ): void {
    configs.forEach(config => {
      try {
        const newPosition = this.calculateResponsivePosition(
          config,
          newViewportWidth,
          newViewportHeight
        )
        
        // Update element position
        if (config.element.setPosition) {
          config.element.setPosition(newPosition.x, newPosition.y)
        } else if (config.element.x !== undefined && config.element.y !== undefined) {
          config.element.x = newPosition.x
          config.element.y = newPosition.y
        }
        
        // Check for overflow after repositioning
        if (config.responsive) {
          const overflow = this.detectTextOverflow(
            config.element,
            newViewportWidth - config.margins.left - config.margins.right,
            newViewportHeight - config.margins.top - config.margins.bottom
          )
          
          // Apply overflow handling if needed
          if (overflow.isOverflowing && overflow.recommendedAction === 'reduce-font') {
            this.applyOverflowFix(config.element, overflow)
          }
        }
      } catch (error) {
        console.warn('Error repositioning text element:', error)
      }
    })
  }

  /**
   * Calculates responsive position based on anchor and viewport
   */
  private calculateResponsivePosition(
    config: TextPositionConfig,
    viewportWidth: number,
    viewportHeight: number
  ): { x: number, y: number } {
    const { anchor, margins } = config
    
    let x = 0
    let y = 0
    
    // Calculate X position based on anchor
    switch (anchor) {
      case 'top-left':
      case 'center-left':
      case 'bottom-left':
        x = margins.left
        break
      case 'top-center':
      case 'center':
      case 'bottom-center':
        x = viewportWidth / 2
        break
      case 'top-right':
      case 'center-right':
      case 'bottom-right':
        x = viewportWidth - margins.right
        break
    }
    
    // Calculate Y position based on anchor
    switch (anchor) {
      case 'top-left':
      case 'top-center':
      case 'top-right':
        y = margins.top
        break
      case 'center-left':
      case 'center':
      case 'center-right':
        y = viewportHeight / 2
        break
      case 'bottom-left':
      case 'bottom-center':
      case 'bottom-right':
        y = viewportHeight - margins.bottom
        break
    }
    
    return { x, y }
  }

  /**
   * Applies overflow fixes to text elements
   */
  private applyOverflowFix(textElement: any, overflow: TextOverflowInfo): void {
    try {
      switch (overflow.recommendedAction) {
        case 'reduce-font':
          if (overflow.recommendedFontSize && textElement.setFontSize) {
            textElement.setFontSize(overflow.recommendedFontSize)
          }
          break
          
        case 'wrap-text':
          if (textElement.setWordWrapWidth) {
            textElement.setWordWrapWidth(overflow.availableWidth)
          }
          break
          
        case 'truncate':
          // Implementation depends on text element type
          // This would need to be handled by the calling code
          break
      }
    } catch (error) {
      console.warn('Error applying overflow fix:', error)
    }
  }

  /**
   * Creates a text position configuration
   */
  createTextPositionConfig(
    element: any,
    anchor: TextPositionConfig['anchor'] = 'center',
    margins: Partial<TextPositionConfig['margins']> = {},
    responsive: boolean = true
  ): TextPositionConfig {
    const defaultMargins = { top: 10, right: 10, bottom: 10, left: 10 }
    
    return {
      element,
      originalPosition: {
        x: element.x || 0,
        y: element.y || 0
      },
      anchor,
      margins: { ...defaultMargins, ...margins },
      responsive
    }
  }

  /**
   * Handles text scaling during orientation changes with overflow prevention
   */
  handleOrientationTextScaling(
    textElements: Array<{ element: any, config: ScalingConfig }>,
    newOrientation: 'portrait' | 'landscape'
  ): void {
    const orientationScaleFactor = newOrientation === 'portrait' ? 1.0 : 0.95
    
    textElements.forEach(({ element, config }) => {
      try {
        // Calculate new font size with orientation adjustment
        const adjustedConfig = {
          ...config,
          scalingFactor: config.scalingFactor * orientationScaleFactor
        }
        
        const newSize = this.calculateOptimalFontSize(adjustedConfig)
        
        // Apply new font size
        if (element.setFontSize) {
          element.setFontSize(newSize)
        }
        
        // Check for overflow after scaling
        const bounds = this.getElementBounds(element)
        if (bounds) {
          const overflow = this.detectTextOverflow(
            element,
            this.deviceInfo.viewportWidth * 0.9, // 90% of viewport width
            this.deviceInfo.viewportHeight * 0.9  // 90% of viewport height
          )
          
          if (overflow.isOverflowing) {
            this.applyOverflowFix(element, overflow)
          }
        }
      } catch (error) {
        console.warn('Error handling orientation text scaling:', error)
      }
    })
  }

  /**
   * Gets element bounds in a safe way
   */
  private getElementBounds(element: any): { width: number, height: number } | null {
    try {
      if (element.width !== undefined && element.height !== undefined) {
        return { width: element.width, height: element.height }
      } else if (element.getBounds) {
        const bounds = element.getBounds()
        return { width: bounds.width, height: bounds.height }
      } else if (element.displayWidth !== undefined && element.displayHeight !== undefined) {
        return { width: element.displayWidth, height: element.displayHeight }
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Cleanup method to remove event listeners
   */
  destroy(): void {
    // Clear timers
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer)
    }
    if (this.orientationChangeTimer) {
      clearTimeout(this.orientationChangeTimer)
    }
    
    // Disconnect observer
    if (this.viewportObserver) {
      this.viewportObserver.disconnect()
    }
    
    // Clear callbacks
    this.orientationChangeCallbacks.clear()
    this.resizeCallbacks.clear()
    this.textOverflowCallbacks.clear()
  }
}

/**
 * Singleton instance for global use
 */
let globalFontScaler: ResponsiveFontScaler | null = null

/**
 * Gets or creates the global ResponsiveFontScaler instance
 */
export function getResponsiveFontScaler(): ResponsiveFontScaler {
  if (!globalFontScaler) {
    globalFontScaler = new ResponsiveFontScaler()
  }
  return globalFontScaler
}

/**
 * Convenience function to create responsive font size
 */
export function createResponsiveFontSize(baseSize: number, scalingFactor: number = 1.0): string {
  const scaler = getResponsiveFontScaler()
  const config: ScalingConfig = {
    baseSize,
    minSize: 12,
    maxSize: 32,
    scalingFactor
  }
  return scaler.createResponsiveFontSize(config)
}

/**
 * Convenience function to get device scaling factor
 */
export function getDeviceScalingFactor(): number {
  const scaler = getResponsiveFontScaler()
  return scaler.getDeviceScalingFactor()
}