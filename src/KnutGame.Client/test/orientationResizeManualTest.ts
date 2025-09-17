/**
 * Manual Test for Orientation and Resize Handling
 * 
 * This file provides manual testing scenarios for the enhanced orientation
 * and resize handling functionality. Run this in a browser environment
 * to test the behavior interactively.
 * 
 * To use:
 * 1. Import this file in your main game scene
 * 2. Call setupOrientationResizeTest() in the create method
 * 3. Resize the browser window or change device orientation
 * 4. Observe the console logs and text behavior
 */

import {
  getResponsiveFontScaler,
  type DeviceInfo,
  type TextOverflowInfo,
  type TextPositionConfig
} from '../src/utils/responsiveFontScaler'
import { type ScalingConfig } from '../src/utils/textReadability'

interface TestTextElement {
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
  setPosition: (x: number, y: number) => void
  setFontSize: (size: number) => void
  setWordWrapWidth: (width: number) => void
  setText: (text: string) => void
  style: { fontSize: string }
}

class OrientationResizeTestManager {
  private fontScaler = getResponsiveFontScaler()
  private testElements: TestTextElement[] = []
  private positionConfigs: TextPositionConfig[] = []
  private isSetup = false

  /**
   * Sets up the orientation and resize test environment
   */
  setupTest(): void {
    if (this.isSetup) {
      console.warn('Orientation resize test already set up')
      return
    }

    console.log('🔄 Setting up orientation and resize handling test...')
    
    // Create test text elements
    this.createTestElements()
    
    // Set up event listeners
    this.setupEventListeners()
    
    // Log initial state
    this.logDeviceInfo()
    
    this.isSetup = true
    console.log('✅ Orientation resize test setup complete')
    console.log('📱 Try resizing the window or changing device orientation to see the effects')
  }

  /**
   * Creates mock text elements for testing
   */
  private createTestElements(): void {
    const elements = [
      {
        id: 'title',
        text: 'Game Title - Responsive Text Test',
        x: 400,
        y: 50,
        fontSize: 24,
        anchor: 'top-center' as const
      },
      {
        id: 'score',
        text: 'Score: 123,456',
        x: 750,
        y: 30,
        fontSize: 18,
        anchor: 'top-right' as const
      },
      {
        id: 'lives',
        text: 'Lives: ♥♥♥',
        x: 50,
        y: 30,
        fontSize: 16,
        anchor: 'top-left' as const
      },
      {
        id: 'message',
        text: 'This is a longer message that might overflow on smaller screens and needs to be handled properly',
        x: 400,
        y: 400,
        fontSize: 16,
        anchor: 'center' as const
      },
      {
        id: 'footer',
        text: 'Press any key to continue',
        x: 400,
        y: 550,
        fontSize: 14,
        anchor: 'bottom-center' as const
      }
    ]

    elements.forEach(elementData => {
      const element: TestTextElement = {
        x: elementData.x,
        y: elementData.y,
        width: elementData.text.length * (elementData.fontSize * 0.6), // Approximate width
        height: elementData.fontSize * 1.2, // Approximate height
        text: elementData.text,
        fontSize: elementData.fontSize,
        setPosition: (x: number, y: number) => {
          element.x = x
          element.y = y
          console.log(`📍 Repositioned ${elementData.id} to (${x}, ${y})`)
        },
        setFontSize: (size: number) => {
          element.fontSize = size
          element.style.fontSize = `${size}px`
          element.width = element.text.length * (size * 0.6) // Update width
          element.height = size * 1.2 // Update height
          console.log(`📏 Resized ${elementData.id} font to ${size}px`)
        },
        setWordWrapWidth: (width: number) => {
          console.log(`📝 Applied word wrap to ${elementData.id} with width ${width}px`)
        },
        setText: (text: string) => {
          element.text = text
          element.width = text.length * (element.fontSize * 0.6)
          console.log(`✏️ Updated ${elementData.id} text to: "${text}"`)
        },
        style: { fontSize: `${elementData.fontSize}px` }
      }

      this.testElements.push(element)

      // Create position configuration
      const config = this.fontScaler.createTextPositionConfig(
        element,
        elementData.anchor,
        { top: 20, right: 20, bottom: 20, left: 20 },
        true
      )
      this.positionConfigs.push(config)
    })

    console.log(`📝 Created ${this.testElements.length} test text elements`)
  }

  /**
   * Sets up event listeners for orientation and resize changes
   */
  private setupEventListeners(): void {
    // Listen for orientation changes
    this.fontScaler.onOrientationChange(() => {
      console.log('🔄 Orientation change detected!')
      this.handleOrientationChange()
    })

    // Listen for resize events
    this.fontScaler.onResize((newInfo: DeviceInfo) => {
      console.log('📏 Viewport resize detected!')
      this.handleViewportResize(newInfo)
    })

    // Listen for text overflow
    this.fontScaler.onTextOverflow((element: any, overflow: TextOverflowInfo) => {
      console.log('⚠️ Text overflow detected!')
      this.handleTextOverflow(element, overflow)
    })

    console.log('👂 Event listeners set up')
  }

  /**
   * Handles orientation changes
   */
  private handleOrientationChange(): void {
    const deviceInfo = this.fontScaler.getDeviceInfo()
    
    console.log(`📱 New orientation: ${deviceInfo.orientation}`)
    console.log(`📐 New viewport: ${deviceInfo.viewportWidth}x${deviceInfo.viewportHeight}`)

    // Reposition all text elements
    this.fontScaler.repositionTextForOrientation(
      this.positionConfigs,
      deviceInfo.viewportWidth,
      deviceInfo.viewportHeight
    )

    // Handle text scaling for orientation
    const textElements = this.testElements.map(element => ({
      element,
      config: {
        baseSize: element.fontSize,
        minSize: Math.max(12, element.fontSize * 0.75),
        maxSize: element.fontSize * 1.5,
        scalingFactor: 1.0
      } as ScalingConfig
    }))

    this.fontScaler.handleOrientationTextScaling(textElements, deviceInfo.orientation)

    // Check for overflow after orientation change
    this.checkAllTextOverflow(deviceInfo)
  }

  /**
   * Handles viewport resize events
   */
  private handleViewportResize(newInfo: DeviceInfo): void {
    console.log(`📏 Viewport resized to: ${newInfo.viewportWidth}x${newInfo.viewportHeight}`)
    console.log(`📱 Device type: ${newInfo.type}, DPR: ${newInfo.pixelRatio}`)

    // Check for overflow after resize
    this.checkAllTextOverflow(newInfo)
  }

  /**
   * Checks all text elements for overflow
   */
  private checkAllTextOverflow(deviceInfo: DeviceInfo): void {
    console.log('🔍 Checking all text elements for overflow...')

    this.testElements.forEach((element, index) => {
      const overflow = this.fontScaler.detectTextOverflow(
        element,
        deviceInfo.viewportWidth * 0.9, // 90% of viewport width
        deviceInfo.viewportHeight * 0.9  // 90% of viewport height
      )

      if (overflow.isOverflowing) {
        console.log(`⚠️ Element ${index} is overflowing:`, {
          direction: overflow.overflowDirection,
          actualSize: { width: overflow.actualWidth, height: overflow.actualHeight },
          availableSize: { width: overflow.availableWidth, height: overflow.availableHeight },
          recommendedAction: overflow.recommendedAction
        })
      } else {
        console.log(`✅ Element ${index} fits within bounds`)
      }
    })
  }

  /**
   * Handles text overflow by applying fixes
   */
  private handleTextOverflow(element: any, overflow: TextOverflowInfo): void {
    const elementIndex = this.testElements.indexOf(element)
    const elementName = elementIndex >= 0 ? `Element ${elementIndex}` : 'Unknown element'

    console.log(`🔧 Applying overflow fix for ${elementName}:`, {
      action: overflow.recommendedAction,
      recommendedFontSize: overflow.recommendedFontSize
    })

    // Apply the recommended fix
    switch (overflow.recommendedAction) {
      case 'reduce-font':
        if (overflow.recommendedFontSize && element.setFontSize) {
          element.setFontSize(overflow.recommendedFontSize)
        }
        break

      case 'wrap-text':
        if (element.setWordWrapWidth) {
          element.setWordWrapWidth(overflow.availableWidth)
        }
        break

      case 'truncate':
        this.truncateText(element, overflow.availableWidth)
        break
    }
  }

  /**
   * Truncates text to fit within available width
   */
  private truncateText(element: TestTextElement, maxWidth: number): void {
    const originalText = element.text
    let truncatedText = originalText
    
    // Simple truncation simulation
    const maxChars = Math.floor(maxWidth / (element.fontSize * 0.6))
    
    if (originalText.length > maxChars) {
      truncatedText = originalText.substring(0, maxChars - 3) + '...'
      element.setText(truncatedText)
    }
  }

  /**
   * Logs current device information
   */
  private logDeviceInfo(): void {
    const deviceInfo = this.fontScaler.getDeviceInfo()
    
    console.log('📱 Current Device Info:', {
      type: deviceInfo.type,
      orientation: deviceInfo.orientation,
      viewport: `${deviceInfo.viewportWidth}x${deviceInfo.viewportHeight}`,
      screen: `${deviceInfo.screenWidth}x${deviceInfo.screenHeight}`,
      pixelRatio: deviceInfo.pixelRatio,
      isHighDPI: deviceInfo.isHighDPI,
      isTouchDevice: deviceInfo.isTouchDevice
    })
  }

  /**
   * Simulates different viewport sizes for testing
   */
  simulateViewportChanges(): void {
    console.log('🎭 Simulating viewport changes...')

    const testViewports = [
      { name: 'Mobile Portrait', width: 375, height: 667 },
      { name: 'Mobile Landscape', width: 667, height: 375 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Tablet Landscape', width: 1024, height: 768 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ]

    testViewports.forEach((viewport, index) => {
      setTimeout(() => {
        console.log(`📱 Simulating ${viewport.name} (${viewport.width}x${viewport.height})`)
        
        // This would normally be done by the browser, but we can simulate the effects
        const simulatedInfo: DeviceInfo = {
          type: viewport.width < 768 ? 'mobile' : viewport.width < 1024 ? 'tablet' : 'desktop',
          orientation: viewport.width > viewport.height ? 'landscape' : 'portrait',
          pixelRatio: 1,
          screenWidth: viewport.width,
          screenHeight: viewport.height,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          isTouchDevice: viewport.width < 1024,
          isHighDPI: false
        }

        this.handleViewportResize(simulatedInfo)
      }, index * 2000) // 2 second intervals
    })
  }

  /**
   * Tests text overflow scenarios
   */
  testOverflowScenarios(): void {
    console.log('🧪 Testing overflow scenarios...')

    // Create an element with very long text
    const longTextElement: TestTextElement = {
      x: 400,
      y: 300,
      width: 800, // Very wide
      height: 20,
      text: 'This is an extremely long text that will definitely overflow on smaller screens and needs to be handled appropriately',
      fontSize: 16,
      setPosition: (x, y) => console.log(`Long text repositioned to (${x}, ${y})`),
      setFontSize: (size) => console.log(`Long text font size changed to ${size}px`),
      setWordWrapWidth: (width) => console.log(`Long text word wrap applied: ${width}px`),
      setText: (text) => console.log(`Long text updated: "${text}"`),
      style: { fontSize: '16px' }
    }

    // Test overflow detection
    const overflow = this.fontScaler.detectTextOverflow(longTextElement, 300, 100)
    
    console.log('📊 Overflow test result:', {
      isOverflowing: overflow.isOverflowing,
      direction: overflow.overflowDirection,
      recommendedAction: overflow.recommendedAction,
      recommendedFontSize: overflow.recommendedFontSize
    })

    if (overflow.isOverflowing) {
      this.handleTextOverflow(longTextElement, overflow)
    }
  }

  /**
   * Cleans up the test environment
   */
  cleanup(): void {
    if (!this.isSetup) {
      return
    }

    console.log('🧹 Cleaning up orientation resize test...')
    
    // The ResponsiveFontScaler cleanup is handled by its destroy method
    // In a real implementation, you would also clean up Phaser objects
    
    this.testElements = []
    this.positionConfigs = []
    this.isSetup = false
    
    console.log('✅ Cleanup complete')
  }
}

// Global test manager instance
let testManager: OrientationResizeTestManager | null = null

/**
 * Sets up the orientation and resize test
 * Call this from your Phaser scene's create method
 */
export function setupOrientationResizeTest(): void {
  if (testManager) {
    console.warn('Test already set up')
    return
  }

  testManager = new OrientationResizeTestManager()
  testManager.setupTest()

  // Add global functions for manual testing
  ;(globalThis as any).testOrientationResize = {
    simulateViewports: () => testManager?.simulateViewportChanges(),
    testOverflow: () => testManager?.testOverflowScenarios(),
    logDeviceInfo: () => testManager?.['logDeviceInfo'](),
    cleanup: () => {
      testManager?.cleanup()
      testManager = null
    }
  }

  console.log('🎮 Manual test functions available:')
  console.log('  - testOrientationResize.simulateViewports()')
  console.log('  - testOrientationResize.testOverflow()')
  console.log('  - testOrientationResize.logDeviceInfo()')
  console.log('  - testOrientationResize.cleanup()')
}

/**
 * Cleans up the orientation and resize test
 * Call this when the scene is destroyed
 */
export function cleanupOrientationResizeTest(): void {
  if (testManager) {
    testManager.cleanup()
    testManager = null
  }

  // Remove global functions
  delete (globalThis as any).testOrientationResize
}

// Export the test manager class for advanced usage
export { OrientationResizeTestManager }