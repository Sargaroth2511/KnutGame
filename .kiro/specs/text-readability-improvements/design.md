# Design Document

## Overview

This design addresses text readability issues in KnutGame by implementing a comprehensive text styling system that ensures all text elements meet accessibility standards and provide optimal readability across different devices and screen conditions. The solution focuses on improving contrast ratios, font sizing, text backgrounds, and responsive scaling while maintaining the game's visual aesthetic.

## Architecture

### Text Styling System Enhancement

The current HUD system already provides a foundation with `createTextStyle()` and `createPlainTextStyle()` methods. We will enhance this system with:

1. **Accessibility-First Text Styles**: New text style variants that guarantee WCAG 2.1 AA compliance
2. **Adaptive Background System**: Dynamic background generation for text overlays
3. **Responsive Font Scaling**: Device and viewport-aware font sizing
4. **High Contrast Mode Support**: Alternative styling for accessibility preferences

### Component Architecture

```
TextReadabilityManager
├── AccessibilityTextStyles (WCAG compliance)
├── AdaptiveBackgroundRenderer (text backgrounds)
├── ResponsiveFontScaler (device-aware sizing)
└── ContrastAnalyzer (runtime contrast validation)
```

## Components and Interfaces

### 1. AccessibilityTextStyles

Enhanced text styling system that extends the existing HUD text methods:

```typescript
interface AccessibilityTextConfig {
  baseSize: number
  contrastRatio: 'AA' | 'AAA'
  backgroundType: 'none' | 'semi-transparent' | 'solid' | 'outline'
  deviceScaling: boolean
}

class AccessibilityTextStyles extends HudElement {
  createAccessibleTextStyle(config: AccessibilityTextConfig): Phaser.Types.GameObjects.Text.TextStyle
  createHighContrastStyle(color: string, backgroundColor?: number): Phaser.Types.GameObjects.Text.TextStyle
  createOutlinedTextStyle(textColor: string, outlineColor: string, thickness: number): Phaser.Types.GameObjects.Text.TextStyle
}
```

### 2. AdaptiveBackgroundRenderer

Generates appropriate backgrounds for text elements based on the underlying content:

```typescript
interface BackgroundConfig {
  padding: number
  cornerRadius: number
  opacity: number
  blurBackground: boolean
}

class AdaptiveBackgroundRenderer {
  createTextBackground(text: Phaser.GameObjects.Text, config: BackgroundConfig): Phaser.GameObjects.Container
  updateBackgroundForText(container: Phaser.GameObjects.Container, newText: string): void
  analyzeBackgroundContrast(x: number, y: number, width: number, height: number): number
}
```

### 3. ResponsiveFontScaler

Handles device-aware font scaling and responsive text sizing:

```typescript
interface ScalingConfig {
  baseSize: number
  minSize: number
  maxSize: number
  scalingFactor: number
}

class ResponsiveFontScaler {
  calculateOptimalFontSize(config: ScalingConfig): number
  getDeviceScalingFactor(): number
  updateTextSizeForViewport(text: Phaser.GameObjects.Text): void
}
```

### 4. Enhanced Message Box System

Redesigned end-game message box with improved readability:

```typescript
interface MessageBoxConfig {
  title: string
  message: string
  width?: number
  position?: 'center' | 'top' | 'bottom'
  dismissible: boolean
  autoClose?: number
}

class AccessibleMessageBox extends HudElement {
  showMessage(config: MessageBoxConfig): Promise<void>
  updateMessage(title: string, message: string): void
  setHighContrastMode(enabled: boolean): void
}
```

## Data Models

### Text Style Configuration

```typescript
interface TextStyleConfig {
  // Base styling
  fontSize: number
  fontFamily: string
  color: string
  
  // Accessibility features
  strokeColor: string
  strokeThickness: number
  shadowEnabled: boolean
  shadowColor: string
  shadowOffset: { x: number, y: number }
  
  // Background support
  backgroundColor?: number
  backgroundOpacity?: number
  backgroundPadding?: number
  
  // Responsive scaling
  minFontSize: number
  maxFontSize: number
  scalingEnabled: boolean
  
  // Contrast requirements
  contrastRatio: number
  highContrastMode: boolean
}
```

### Readability Metrics

```typescript
interface ReadabilityMetrics {
  contrastRatio: number
  fontSize: number
  textWidth: number
  textHeight: number
  backgroundLuminance: number
  textLuminance: number
  wcagCompliance: 'AA' | 'AAA' | 'fail'
}
```

## Error Handling

### Contrast Validation

- **Runtime Contrast Checking**: Validate contrast ratios during text rendering
- **Fallback Styling**: Automatic fallback to high-contrast styles when validation fails
- **Warning System**: Console warnings for accessibility violations in development

### Font Loading Failures

- **Font Fallback Chain**: Robust fallback to system fonts if custom fonts fail
- **Size Adjustment**: Automatic size adjustments for different font families
- **Loading State Handling**: Graceful handling of font loading delays

### Responsive Layout Issues

- **Overflow Detection**: Detect and handle text overflow scenarios
- **Dynamic Resizing**: Automatic text resizing when content doesn't fit
- **Layout Validation**: Ensure text remains within viewport bounds

## Testing Strategy

### Automated Accessibility Testing

1. **Contrast Ratio Validation**: Automated tests to verify WCAG compliance
2. **Font Size Testing**: Validate minimum font sizes across different viewports
3. **Background Contrast Testing**: Ensure text backgrounds provide sufficient contrast

### Visual Regression Testing

1. **Screenshot Comparison**: Compare text rendering across different devices
2. **Font Rendering Tests**: Validate text appearance with different font settings
3. **High Contrast Mode Testing**: Verify alternative styling modes

### Device-Specific Testing

1. **Mobile Responsiveness**: Test text scaling on various mobile devices
2. **High-DPI Display Testing**: Validate crisp text rendering on retina displays
3. **Orientation Change Testing**: Ensure text remains readable during orientation changes

### User Experience Testing

1. **Readability Assessment**: Measure reading speed and comprehension
2. **Accessibility User Testing**: Test with users who have visual impairments
3. **Cross-Browser Compatibility**: Validate text rendering across different browsers

## Implementation Approach

### Phase 1: Core Text Styling Enhancement

- Enhance existing `createTextStyle()` methods with accessibility features
- Implement contrast ratio validation
- Add responsive font scaling

### Phase 2: Background System Implementation

- Create adaptive background rendering system
- Implement semi-transparent and solid background options
- Add blur effects for better text separation

### Phase 3: Message Box Redesign

- Redesign end-game message box with new styling system
- Implement dismissible and auto-close functionality
- Add animation improvements for better UX

### Phase 4: HUD Component Updates

- Update all existing HUD components to use new styling system
- Implement high contrast mode support
- Add responsive scaling to all text elements

### Phase 5: Testing and Optimization

- Comprehensive accessibility testing
- Performance optimization for text rendering
- Cross-device compatibility validation

## Integration Points

### Existing HUD System

The new text readability system will integrate seamlessly with the existing HUD architecture:

- Extend existing `HudElement` base class
- Enhance `createTextStyle()` and `createPlainTextStyle()` methods
- Maintain backward compatibility with existing text elements

### Game Scene Integration

- Integrate with existing layout system for responsive behavior
- Hook into existing resize handlers for dynamic text scaling
- Maintain compatibility with existing depth management

### Configuration System

- Add text readability settings to game configuration
- Support user preferences for high contrast mode
- Enable developer settings for accessibility testing

## Performance Considerations

### Text Rendering Optimization

- Cache calculated font sizes and contrast ratios
- Minimize text style recalculations during gameplay
- Use object pooling for frequently created text elements

### Background Rendering Efficiency

- Optimize background blur effects for mobile devices
- Cache background graphics when possible
- Use efficient rendering techniques for semi-transparent overlays

### Memory Management

- Proper cleanup of text styling resources
- Efficient management of cached text metrics
- Minimize memory allocation during text updates