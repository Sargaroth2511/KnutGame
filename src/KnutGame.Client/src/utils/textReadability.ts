/**
 * Text readability utility functions for WCAG compliance and accessibility
 * 
 * This module provides utilities for:
 * - WCAG contrast ratio calculations
 * - Font size scaling for different devices
 * - Color luminance calculations
 * - Accessibility validation
 */

/**
 * Configuration for accessibility text styling
 */
export interface AccessibilityTextConfig {
  baseSize: number
  contrastRatio: 'AA' | 'AAA'
  backgroundType: 'none' | 'semi-transparent' | 'solid' | 'outline'
  deviceScaling: boolean
  highContrastMode?: boolean
}

/**
 * Configuration for font scaling
 */
export interface ScalingConfig {
  baseSize: number
  minSize: number
  maxSize: number
  scalingFactor: number
}

/**
 * Readability metrics for validation
 */
export interface ReadabilityMetrics {
  contrastRatio: number
  fontSize: number
  textWidth: number
  textHeight: number
  backgroundLuminance: number
  textLuminance: number
  wcagCompliance: 'AA' | 'AAA' | 'fail'
}

/**
 * Converts a hex color string to RGB values
 * @param hex - Hex color string (e.g., '#ffffff' or 'ffffff')
 * @returns RGB values as [r, g, b] array
 */
export function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Handle 3-digit hex codes
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    return [r, g, b]
  }
  
  // Handle 6-digit hex codes
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return [r, g, b]
}

/**
 * Converts RGB values to relative luminance according to WCAG 2.1
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Relative luminance value (0-1)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  // Convert to sRGB
  const rsRGB = r / 255
  const gsRGB = g / 255
  const bsRGB = b / 255
  
  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)
  
  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
}

/**
 * Calculates luminance from a hex color string
 * @param hex - Hex color string
 * @returns Relative luminance value (0-1)
 */
export function calculateLuminanceFromHex(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return calculateLuminance(r, g, b)
}

/**
 * Calculates luminance from a numeric color value (0xRRGGBB format)
 * @param color - Numeric color value
 * @returns Relative luminance value (0-1)
 */
export function calculateLuminanceFromNumber(color: number): number {
  const r = (color >> 16) & 0xFF
  const g = (color >> 8) & 0xFF
  const b = color & 0xFF
  return calculateLuminance(r, g, b)
}

/**
 * Calculates the contrast ratio between two colors according to WCAG 2.1
 * @param luminance1 - Luminance of first color (0-1)
 * @param luminance2 - Luminance of second color (0-1)
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(luminance1: number, luminance2: number): number {
  const lighter = Math.max(luminance1, luminance2)
  const darker = Math.min(luminance1, luminance2)
  
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Calculates contrast ratio between two hex colors
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatioFromHex(color1: string, color2: string): number {
  const luminance1 = calculateLuminanceFromHex(color1)
  const luminance2 = calculateLuminanceFromHex(color2)
  return calculateContrastRatio(luminance1, luminance2)
}

/**
 * Calculates contrast ratio between hex color and numeric color
 * @param hexColor - Hex color string
 * @param numericColor - Numeric color value
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatioMixed(hexColor: string, numericColor: number): number {
  const luminance1 = calculateLuminanceFromHex(hexColor)
  const luminance2 = calculateLuminanceFromNumber(numericColor)
  return calculateContrastRatio(luminance1, luminance2)
}

/**
 * Checks if a contrast ratio meets WCAG compliance levels
 * @param contrastRatio - The contrast ratio to check
 * @param fontSize - Font size in pixels
 * @param isBold - Whether the text is bold
 * @returns WCAG compliance level ('AA', 'AAA', or 'fail')
 */
export function checkWcagCompliance(contrastRatio: number, fontSize: number, isBold: boolean = false): 'AA' | 'AAA' | 'fail' {
  // Large text is 18pt+ (24px+) or 14pt+ (18.66px+) bold
  const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold)
  
  if (isLargeText) {
    // Large text requirements
    if (contrastRatio >= 4.5) return 'AAA'
    if (contrastRatio >= 3.0) return 'AA'
  } else {
    // Normal text requirements
    if (contrastRatio >= 7.0) return 'AAA'
    if (contrastRatio >= 4.5) return 'AA'
  }
  
  return 'fail'
}

/**
 * Gets the device pixel ratio with a reasonable maximum
 * @returns Device pixel ratio clamped to a maximum of 2
 */
export function getDevicePixelRatio(): number {
  return Math.min((globalThis.devicePixelRatio || 1), 2)
}

/**
 * Calculates device scaling factor based on screen characteristics
 * @returns Scaling factor for responsive design
 */
export function getDeviceScalingFactor(): number {
  const dpr = getDevicePixelRatio()
  const screenWidth = globalThis.screen?.width || globalThis.innerWidth || 1024
  const screenHeight = globalThis.screen?.height || globalThis.innerHeight || 768
  
  // Detect device type based on screen characteristics
  const isMobile = screenWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    globalThis.navigator?.userAgent || ''
  )
  
  if (isMobile) {
    // Mobile devices: scale based on screen width (baseline: 375px)
    const smallerDimension = Math.min(screenWidth, screenHeight)
    let scaleFactor = smallerDimension / 375
    scaleFactor *= Math.sqrt(dpr)
    return Math.max(0.9, Math.min(1.4, scaleFactor))
  } else {
    // Desktop devices: use minimal scaling to avoid oversized text
    return Math.max(0.8, Math.min(1.1, 1.0 + (dpr - 1) * 0.2))
  }
}

/**
 * Calculates optimal font size based on device characteristics and constraints
 * @param config - Scaling configuration
 * @returns Optimal font size in pixels
 */
export function calculateOptimalFontSize(config: ScalingConfig): number {
  const deviceFactor = getDeviceScalingFactor()
  const scaledSize = config.baseSize * config.scalingFactor * deviceFactor
  
  // Apply min/max constraints
  return Math.max(config.minSize, Math.min(config.maxSize, scaledSize))
}

/**
 * Creates a responsive font size string for Phaser text styles
 * @param config - Scaling configuration
 * @returns Font size string (e.g., "16px")
 */
export function createResponsiveFontSize(config: ScalingConfig): string {
  const size = calculateOptimalFontSize(config)
  return `${Math.round(size)}px`
}

/**
 * Validates text readability and returns comprehensive metrics
 * @param textColor - Text color (hex string)
 * @param backgroundColor - Background color (hex string or numeric)
 * @param fontSize - Font size in pixels
 * @param isBold - Whether text is bold
 * @returns Readability metrics object
 */
export function validateTextReadability(
  textColor: string,
  backgroundColor: string | number,
  fontSize: number,
  isBold: boolean = false
): ReadabilityMetrics {
  const textLuminance = calculateLuminanceFromHex(textColor)
  const backgroundLuminance = typeof backgroundColor === 'string' 
    ? calculateLuminanceFromHex(backgroundColor)
    : calculateLuminanceFromNumber(backgroundColor)
  
  const contrastRatio = calculateContrastRatio(textLuminance, backgroundLuminance)
  const wcagCompliance = checkWcagCompliance(contrastRatio, fontSize, isBold)
  
  return {
    contrastRatio,
    fontSize,
    textWidth: 0, // To be calculated by caller if needed
    textHeight: 0, // To be calculated by caller if needed
    backgroundLuminance,
    textLuminance,
    wcagCompliance
  }
}

/**
 * Suggests an improved text color for better contrast
 * @param backgroundColor - Background color (hex string or numeric)
 * @param targetRatio - Target contrast ratio (default: 4.5 for AA compliance)
 * @returns Suggested text color as hex string
 */
export function suggestTextColor(backgroundColor: string | number, targetRatio: number = 4.5): string {
  const backgroundLuminance = typeof backgroundColor === 'string'
    ? calculateLuminanceFromHex(backgroundColor)
    : calculateLuminanceFromNumber(backgroundColor)
  
  // Try white text first
  const whiteContrast = calculateContrastRatio(1.0, backgroundLuminance)
  if (whiteContrast >= targetRatio) {
    return '#ffffff'
  }
  
  // Try black text
  const blackContrast = calculateContrastRatio(0.0, backgroundLuminance)
  if (blackContrast >= targetRatio) {
    return '#000000'
  }
  
  // If neither works well, choose the better option
  return whiteContrast > blackContrast ? '#ffffff' : '#000000'
}

/**
 * Creates minimum font size constraints based on device type
 * @returns Minimum font sizes for different text types
 */
export function getMinimumFontSizes(): { body: number; secondary: number; large: number } {
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    globalThis.navigator?.userAgent || ''
  )
  
  if (isMobile) {
    return {
      body: 16,      // WCAG minimum for mobile
      secondary: 14, // Smaller secondary text
      large: 20      // Large text minimum
    }
  }
  
  return {
    body: 14,      // Desktop can be slightly smaller
    secondary: 12, // Secondary text
    large: 18      // Large text minimum
  }
}

/**
 * High contrast text style configuration
 */
export interface HighContrastTextStyle {
  textColor: string
  backgroundColor: string | number
  strokeColor: string
  strokeThickness: number
  shadowEnabled: boolean
  shadowColor: string
  fontWeight: 'normal' | 'bold'
}

/**
 * Creates high contrast text styling optimized for maximum readability
 * @param baseTextColor - Base text color preference
 * @param backgroundColor - Background color for contrast calculation
 * @param fontSize - Font size for stroke thickness calculation
 * @returns High contrast text style configuration
 */
export function createHighContrastTextStyle(
  baseTextColor: string = '#ffffff',
  backgroundColor: string | number = 0x000000,
  fontSize: number = 16
): HighContrastTextStyle {
  // Determine optimal colors for maximum contrast
  const backgroundLuminance = typeof backgroundColor === 'string'
    ? calculateLuminanceFromHex(backgroundColor)
    : calculateLuminanceFromNumber(backgroundColor);

  // Choose text color for maximum contrast (AAA compliance target)
  const optimalTextColor = suggestTextColor(backgroundColor, 7.0);
  
  // Use optimal color if it provides better contrast than base color
  const baseContrast = calculateContrastRatio(
    calculateLuminanceFromHex(baseTextColor),
    backgroundLuminance
  );
  const optimalContrast = calculateContrastRatio(
    calculateLuminanceFromHex(optimalTextColor),
    backgroundLuminance
  );
  
  const finalTextColor = optimalContrast > baseContrast ? optimalTextColor : baseTextColor;
  
  // Choose stroke color (opposite of text color)
  const strokeColor = finalTextColor === '#ffffff' || finalTextColor === '#FFFFFF' ? '#000000' : '#ffffff';
  
  // Calculate stroke thickness based on font size (thicker for high contrast)
  const strokeThickness = Math.max(3, Math.round(fontSize * 0.25));
  
  return {
    textColor: finalTextColor,
    backgroundColor,
    strokeColor,
    strokeThickness,
    shadowEnabled: true,
    shadowColor: strokeColor,
    fontWeight: 'bold'
  };
}

/**
 * Creates high contrast colors for different UI elements
 */
export function getHighContrastColors(): {
  text: string;
  background: number;
  accent: string;
  warning: string;
  success: string;
  error: string;
} {
  return {
    text: '#ffffff',
    background: 0x000000,
    accent: '#ffff00',    // High contrast yellow
    warning: '#ff8800',   // High contrast orange
    success: '#00ff00',   // High contrast green
    error: '#ff0000'      // High contrast red
  };
}

/**
 * Utility class for managing text readability calculations
 */
export class TextReadabilityManager {
  private readonly scalingFactor: number
  private readonly minimumSizes: { body: number; secondary: number; large: number }
  private highContrastMode: boolean = false
  
  constructor() {
    this.scalingFactor = getDeviceScalingFactor()
    this.minimumSizes = getMinimumFontSizes()
  }
  
  /**
   * Validates if text meets accessibility requirements
   * @param textColor - Text color
   * @param backgroundColor - Background color
   * @param fontSize - Font size in pixels
   * @param isBold - Whether text is bold
   * @returns True if text meets AA requirements
   */
  isAccessible(textColor: string, backgroundColor: string | number, fontSize: number, isBold: boolean = false): boolean {
    const metrics = validateTextReadability(textColor, backgroundColor, fontSize, isBold)
    return metrics.wcagCompliance !== 'fail'
  }
  
  /**
   * Gets the current device scaling factor
   */
  getScalingFactor(): number {
    return this.scalingFactor
  }
  
  /**
   * Gets minimum font sizes for the current device
   */
  getMinimumSizes(): { body: number; secondary: number; large: number } {
    return { ...this.minimumSizes }
  }
  
  /**
   * Creates a scaled font size with minimum constraints
   * @param baseSize - Base font size
   * @param type - Text type for minimum size constraints
   * @returns Scaled font size string
   */
  createScaledFontSize(baseSize: number, type: 'body' | 'secondary' | 'large' = 'body'): string {
    const minSize = this.minimumSizes[type]
    const scaledSize = baseSize * this.scalingFactor
    // Apply a maximum cap to prevent oversized text
    const maxSize = baseSize * 1.5 // Cap at 1.5x the base size
    const finalSize = Math.max(minSize, Math.min(maxSize, scaledSize))
    return `${Math.round(finalSize)}px`
  }

  /**
   * Sets high contrast mode for this manager
   * @param enabled - Whether high contrast mode is enabled
   */
  setHighContrastMode(enabled: boolean): void {
    this.highContrastMode = enabled
  }

  /**
   * Gets the current high contrast mode state
   */
  isHighContrastMode(): boolean {
    return this.highContrastMode
  }

  /**
   * Creates a text style optimized for high contrast mode
   * @param baseColor - Base text color
   * @param backgroundColor - Background color for contrast calculation
   * @param fontSize - Font size in pixels
   * @returns Phaser text style configuration optimized for high contrast
   */
  createHighContrastStyle(
    baseColor: string,
    backgroundColor: string | number = 0x000000,
    fontSize: number = 16
  ): Phaser.Types.GameObjects.Text.TextStyle {
    const highContrastStyle = createHighContrastTextStyle(baseColor, backgroundColor, fontSize);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);

    return {
      fontSize: `${fontSize}px`,
      color: highContrastStyle.textColor,
      fontFamily: 'Arial, sans-serif',
      fontStyle: highContrastStyle.fontWeight,
      resolution: dpr,
      stroke: highContrastStyle.strokeColor,
      strokeThickness: highContrastStyle.strokeThickness * dpr,
      shadow: highContrastStyle.shadowEnabled ? {
        offsetX: 0,
        offsetY: 4 * dpr,
        color: highContrastStyle.shadowColor,
        blur: 8 * dpr,
        stroke: true,
        fill: true,
      } : undefined,
    };
  }

  /**
   * Gets high contrast colors for UI elements
   */
  getHighContrastColors(): {
    text: string;
    background: number;
    accent: string;
    warning: string;
    success: string;
    error: string;
  } {
    return getHighContrastColors();
  }
}