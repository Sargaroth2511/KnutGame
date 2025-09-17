# Text Readability System Documentation

## Overview

The KnutGame Text Readability System provides comprehensive accessibility and readability enhancements for all text elements in the game. The system ensures WCAG 2.1 AA/AAA compliance, responsive scaling, and high contrast mode support across all devices and screen sizes.

## Key Features

- **WCAG 2.1 Compliance**: All text meets AA standards, with AAA support in high contrast mode
- **Responsive Font Scaling**: Automatic scaling based on device characteristics and viewport size
- **High Contrast Mode**: System preference detection with manual toggle support
- **Adaptive Backgrounds**: Dynamic background generation for optimal text visibility
- **Cross-Device Compatibility**: Consistent experience across mobile, tablet, and desktop
- **Real-Time Validation**: Automatic accessibility compliance checking during development
- **Orientation Handling**: Smooth text repositioning and scaling during device rotation
- **Performance Optimized**: Minimal impact on game performance with efficient rendering

## Architecture

The system is built with modular components that work together seamlessly:

```
TextReadabilitySystem
├── TextReadabilityManager (Core calculations and validation)
├── AccessibleMessageBox (Enhanced message display)
├── AdaptiveBackgroundRenderer (Dynamic backgrounds)
├── ResponsiveFontScaler (Device-aware scaling)
├── HighContrastConfig (System preference management)
└── TextReadabilityIntegration (System coordination)
```

## Components

### TextReadabilityManager

Core manager for text accessibility calculations and WCAG compliance validation.

**Key Methods:**
- `isAccessible(textColor, backgroundColor, fontSize, isBold)` - Validates WCAG compliance
- `createScaledFontSize(baseSize, textType)` - Creates responsive font sizes
- `setHighContrastMode(enabled)` - Enables/disables high contrast styling

**Usage Example:**
```typescript
const manager = new TextReadabilityManager();
const isCompliant = manager.isAccessible('#ffffff', 0x000000, 16, false);
const scaledSize = manager.createScaledFontSize(16, 'body');
```

### AccessibleMessageBox

Enhanced message box component with full accessibility support and responsive design.

**Key Features:**
- WCAG AA/AAA compliant text contrast
- Responsive font scaling for all devices
- Semi-transparent backgrounds with proper padding
- Smooth fade-in animations
- High contrast mode support
- Orientation and resize handling

**Usage Example:**
```typescript
const messageBox = new AccessibleMessageBox(scene);
await messageBox.showMessage({
  title: 'Game Over',
  message: 'Final Score: 1250',
  dismissible: true
});
```

### AdaptiveBackgroundRenderer

Creates appropriate backgrounds for text elements based on underlying content.

**Key Methods:**
- `createTextBackground(textObject, config)` - Creates semi-transparent backgrounds
- `analyzeBackgroundContrast(x, y, width, height)` - Analyzes background for contrast
- `updateBackgroundForText(container, newText)` - Updates background when text changes

**Usage Example:**
```typescript
const renderer = new AdaptiveBackgroundRenderer(scene);
const container = renderer.createTextBackground(textObject, {
  padding: 12,
  cornerRadius: 8,
  opacity: 0.9
});
```

### ResponsiveFontScaler

Handles device-aware font scaling and responsive text positioning.

**Key Features:**
- Device type detection (mobile, tablet, desktop)
- Viewport-aware font size calculation
- Orientation change handling
- Text overflow detection and resolution
- Minimum font size enforcement

**Usage Example:**
```typescript
const scaler = getResponsiveFontScaler();
const deviceInfo = scaler.getDeviceInfo();
scaler.handleOrientationTextScaling(textElements, deviceInfo.orientation);
```

### HighContrastConfig

System preference detection and configuration management for high contrast mode.

**Key Features:**
- Automatic system preference detection
- Manual toggle functionality
- Configuration persistence
- Event system for mode changes

**Usage Example:**
```typescript
const manager = getHighContrastManager();
const isEnabled = manager.isEnabled();
manager.toggle(); // Toggle high contrast mode
```

## Integration

### MainScene Integration

The text readability system is integrated into MainScene through the `TextReadabilityIntegration` class:

```typescript
// In MainScene.create()
this.textReadabilityIntegration = new TextReadabilityIntegration(this);
this.textReadabilityIntegration.wireTextComponents();
```

### HUD Integration

All HUD elements automatically use the enhanced text styling:

```typescript
// HUD elements use AccessibilityTextConfig
const config: AccessibilityTextConfig = {
  baseSize: 18,
  contrastRatio: 'AA',
  backgroundType: 'outline',
  deviceScaling: true
};

const textStyle = this.createAccessibleTextStyle(config);
```

### Game Over Message Integration

The game over message uses the AccessibleMessageBox for enhanced readability:

```typescript
// In GameOverScreen
this.accessibleMessageBox.showMessage({
  title: gameOverTitle,
  message: gameOverMessage,
  width: Math.min(540, this.camera.width - 40),
  position: 'center'
});
```

## Testing

### Automated Testing

Run comprehensive automated tests:

```bash
npm test -- textReadabilityIntegration.spec.ts
```

### Manual Testing

Use keyboard shortcuts during gameplay:
- `Ctrl+Shift+C`: Toggle high contrast mode
- `Ctrl+Shift+T`: Run automated accessibility tests

### Cross-Device Testing

The system includes built-in cross-device testing:

```typescript
const integration = new TextReadabilityIntegration(scene);
const results = await integration.performCrossDeviceTests();
```

## Accessibility Compliance

### WCAG 2.1 Standards

The system ensures compliance with WCAG 2.1 guidelines:

- **AA Level**: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text
- **AAA Level**: Minimum 7:1 contrast ratio (available in high contrast mode)
- **Font Sizes**: Minimum 16px for body text on mobile, 14px on desktop
- **Touch Targets**: Minimum 44px for interactive elements on mobile

### Validation

Real-time validation ensures all text meets accessibility standards:

```typescript
const metrics = validateTextReadability(textColor, backgroundColor, fontSize, isBold);
if (metrics.wcagCompliance === 'fail') {
  console.warn('Accessibility violation detected');
}
```

## Best Practices

### Text Creation

Always use `AccessibilityTextConfig` when creating text elements:

```typescript
const config: AccessibilityTextConfig = {
  baseSize: 16,
  contrastRatio: 'AA',
  backgroundType: 'semi-transparent',
  deviceScaling: true,
  highContrastMode: false
};
```

### Responsive Design

Use semantic text sizing for consistency:

```typescript
// Use semantic types instead of fixed sizes
const bodySize = manager.createScaledFontSize(16, 'body');
const secondarySize = manager.createScaledFontSize(14, 'secondary');
const largeSize = manager.createScaledFontSize(20, 'large');
```

### High Contrast Support

Always test in high contrast mode:

```typescript
// Test both normal and high contrast modes
const normalStyle = createAccessibleTextStyle(config);
config.highContrastMode = true;
const highContrastStyle = createAccessibleTextStyle(config);
```

### Background Handling

Use adaptive backgrounds for text overlays:

```typescript
// For text over complex backgrounds
const container = backgroundRenderer.createTextBackground(textObject, {
  padding: 12,
  opacity: 0.9,
  blurBackground: true
});
```

## Performance Considerations

### Optimization Strategies

- **Font Caching**: Calculated font sizes are cached to avoid recalculation
- **Efficient Rendering**: Text styles are optimized for minimal draw calls
- **Memory Management**: Proper cleanup of text elements and event listeners
- **Lazy Loading**: Background analysis is performed only when needed

### Performance Monitoring

Monitor text rendering performance:

```typescript
// Check FPS impact during text operations
const startTime = performance.now();
// ... text operations ...
const endTime = performance.now();
console.log(`Text operation took ${endTime - startTime}ms`);
```

## Troubleshooting

### Common Issues

#### Text Too Small on Mobile
**Problem**: Text appears too small on mobile devices
**Solution**: Ensure `deviceScaling` is enabled in `AccessibilityTextConfig`

```typescript
const config: AccessibilityTextConfig = {
  baseSize: 16,
  deviceScaling: true, // Enable this
  // ... other config
};
```

#### Poor Contrast in High Contrast Mode
**Problem**: Text contrast is insufficient in high contrast mode
**Solution**: Use `createHighContrastTextStyle()` for maximum contrast

```typescript
const highContrastStyle = createHighContrastTextStyle(
  baseColor,
  backgroundColor,
  fontSize
);
```

#### Text Overflow on Small Screens
**Problem**: Text overflows container boundaries
**Solution**: Implement text overflow detection and handling

```typescript
const fontScaler = getResponsiveFontScaler();
fontScaler.onTextOverflow((element, overflow) => {
  // Handle overflow by reducing font size or wrapping text
  if (overflow.recommendedAction === 'reduce-font') {
    element.setFontSize(overflow.recommendedFontSize);
  }
});
```

#### Inconsistent Text Sizing
**Problem**: Text sizes vary inconsistently across components
**Solution**: Use `TextReadabilityManager.createScaledFontSize()` consistently

```typescript
const manager = new TextReadabilityManager();
// Use consistent scaling across all components
const fontSize = manager.createScaledFontSize(baseSize, textType);
```

### Debug Tools

Enable debug information:

```typescript
// Enable console logging for accessibility warnings
const metrics = validateTextReadability(textColor, bgColor, fontSize);
if (metrics.wcagCompliance === 'fail') {
  console.warn('WCAG compliance failure:', metrics);
}
```

## API Reference

### Core Functions

#### `validateTextReadability(textColor, backgroundColor, fontSize, isBold)`
Validates text readability and returns comprehensive metrics.

**Parameters:**
- `textColor` (string): Text color as hex string
- `backgroundColor` (string | number): Background color
- `fontSize` (number): Font size in pixels
- `isBold` (boolean): Whether text is bold

**Returns:** `ReadabilityMetrics` object with contrast ratio and compliance level

#### `createResponsiveFontSize(config)`
Creates a responsive font size string for Phaser text styles.

**Parameters:**
- `config` (ScalingConfig): Scaling configuration object

**Returns:** Font size string (e.g., "16px")

#### `calculateContrastRatio(luminance1, luminance2)`
Calculates the contrast ratio between two colors according to WCAG 2.1.

**Parameters:**
- `luminance1` (number): Luminance of first color (0-1)
- `luminance2` (number): Luminance of second color (0-1)

**Returns:** Contrast ratio (1-21)

### Configuration Interfaces

#### `AccessibilityTextConfig`
```typescript
interface AccessibilityTextConfig {
  baseSize: number;
  contrastRatio: 'AA' | 'AAA';
  backgroundType: 'none' | 'semi-transparent' | 'solid' | 'outline';
  deviceScaling: boolean;
  highContrastMode?: boolean;
}
```

#### `ScalingConfig`
```typescript
interface ScalingConfig {
  baseSize: number;
  minSize: number;
  maxSize: number;
  scalingFactor: number;
}
```

#### `ReadabilityMetrics`
```typescript
interface ReadabilityMetrics {
  contrastRatio: number;
  fontSize: number;
  textWidth: number;
  textHeight: number;
  backgroundLuminance: number;
  textLuminance: number;
  wcagCompliance: 'AA' | 'AAA' | 'fail';
}
```

## Migration Guide

### Upgrading Existing Text Elements

To upgrade existing text elements to use the new readability system:

1. **Replace basic text styles** with `AccessibilityTextConfig`:
```typescript
// Old way
const style = { fontSize: '16px', color: '#ffffff' };

// New way
const config: AccessibilityTextConfig = {
  baseSize: 16,
  contrastRatio: 'AA',
  backgroundType: 'outline',
  deviceScaling: true
};
const style = createAccessibleTextStyle(config);
```

2. **Add responsive scaling**:
```typescript
// Old way
const text = scene.add.text(x, y, 'Hello', { fontSize: '16px' });

// New way
const manager = new TextReadabilityManager();
const fontSize = manager.createScaledFontSize(16, 'body');
const text = scene.add.text(x, y, 'Hello', { fontSize });
```

3. **Implement high contrast support**:
```typescript
// Add high contrast mode handling
const highContrastManager = getHighContrastManager();
onHighContrastChange((enabled) => {
  // Update text styling when high contrast mode changes
  updateTextStyling(enabled);
});
```

## Future Enhancements

### Planned Features

- **Dynamic Font Loading**: Support for custom fonts with fallback handling
- **Advanced Text Effects**: Enhanced shadow and glow effects for better visibility
- **Localization Support**: Text scaling adjustments for different languages
- **Voice Control**: Integration with voice control systems for accessibility
- **Eye Tracking**: Optimization based on eye tracking data for better readability

### Contributing

To contribute to the text readability system:

1. Follow the established architecture patterns
2. Ensure all new text elements use `AccessibilityTextConfig`
3. Add comprehensive tests for new features
4. Validate WCAG compliance for all changes
5. Update documentation for new APIs

## Support

For issues or questions about the text readability system:

1. Check the troubleshooting section above
2. Run the automated tests to identify specific issues
3. Use the manual testing guide for comprehensive validation
4. Review the console for accessibility warnings and recommendations

## Changelog

### Version 1.0.0
- Initial implementation of text readability system
- WCAG 2.1 AA/AAA compliance support
- Responsive font scaling across all devices
- High contrast mode with system preference detection
- Adaptive background rendering for text overlays
- Comprehensive testing suite and documentation
- Integration with MainScene and HUD components
- Cross-device compatibility testing
- Performance optimization and memory management