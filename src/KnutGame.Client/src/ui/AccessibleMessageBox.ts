import Phaser from "phaser";
import {
  type AccessibilityTextConfig,
  type ScalingConfig,
  TextReadabilityManager,
  createResponsiveFontSize,
  validateTextReadability,
  getHighContrastColors,
} from "../utils/textReadability";
// import {
//   AdaptiveBackgroundRenderer,
// } from "../utils/adaptiveBackgroundRenderer";
import {
  getHighContrastManager,
  onHighContrastChange,
} from "../utils/highContrastConfig";
import {
  getResponsiveFontScaler,
  type DeviceInfo,
  type TextOverflowInfo
} from "../utils/responsiveFontScaler";

/**
 * Configuration for the accessible message box
 */
export interface MessageBoxConfig {
  title: string;
  message: string;
  width?: number;
  position?: 'center' | 'top' | 'bottom';
  dismissible?: boolean;
  autoClose?: number;
}

/**
 * Accessible message box component that provides improved readability
 * and WCAG compliance for end-game messages and other notifications.
 * 
 * Features:
 * - WCAG AA/AAA compliant text contrast
 * - Responsive font scaling
 * - Semi-transparent backgrounds with proper padding
 * - Smooth fade-in animations
 * - High contrast mode support
 */
export class AccessibleMessageBox {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly dpr: number;
  private readonly readabilityManager: TextReadabilityManager;
  // Background renderer for future use
  // private readonly backgroundRenderer: AdaptiveBackgroundRenderer;

  // UI Elements
  private container?: Phaser.GameObjects.Container;
  private backgroundContainer?: Phaser.GameObjects.Container;
  private titleText?: Phaser.GameObjects.Text;
  private messageText?: Phaser.GameObjects.Text;
  private dismissButton?: Phaser.GameObjects.Container;
  private autoCloseTimer?: Phaser.Time.TimerEvent;

  // State
  private isVisible: boolean = false;
  private highContrastMode: boolean = false;
  private currentConfig?: MessageBoxConfig;
  private highContrastChangeCleanup?: () => void;
  private resizeCleanup?: () => void;
  private orientationCleanup?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.readabilityManager = new TextReadabilityManager();
    // this.backgroundRenderer = new AdaptiveBackgroundRenderer(scene);
    
    // Initialize high contrast mode state
    const highContrastManager = getHighContrastManager();
    this.highContrastMode = highContrastManager.isEnabled();
    this.readabilityManager.setHighContrastMode(this.highContrastMode);
    
    // Listen for high contrast mode changes
    this.highContrastChangeCleanup = onHighContrastChange((enabled) => {
      this.setHighContrastMode(enabled);
    });

    // Set up orientation and resize handling
    this.setupOrientationAndResizeHandling();
  }

  /**
   * Shows a message with improved accessibility and readability
   * @param config - Message configuration options
   * @returns Promise that resolves when the message is displayed
   */
  async showMessage(config: MessageBoxConfig): Promise<void> {
    // Clear any existing message
    this.clearMessage();

    this.currentConfig = config;
    this.isVisible = true;

    // Calculate dimensions and positioning
    const width = config.width || Math.min(540, this.camera.width - 40);
    const padding = 24;

    // Create main container
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    // Position calculation
    const position = this.calculatePosition(config.position || 'center', width, 140);

    // Create background manually since we don't have text yet
    this.backgroundContainer = this.createMessageBackground(position.x, position.y, width, 140, padding);
    this.container.add(this.backgroundContainer);

    // Create title text with accessibility features
    this.createTitleText(config.title, position, width, padding);

    // Create message text with accessibility features  
    this.createMessageText(config.message, position, width, padding);

    // Add dismissible button if requested
    if (config.dismissible) {
      this.createDismissButton(position, width);
    }

    // Set up auto-close timer if specified
    if (config.autoClose && config.autoClose > 0) {
      this.setupAutoClose(config.autoClose);
    }

    // Animate in with smooth fade
    await this.animateIn();

    // Validate accessibility compliance
    this.validateAccessibility();
  }

  /**
   * Updates the message content without recreating the entire component
   * @param title - New title text
   * @param message - New message text
   */
  updateMessage(title: string, message: string): void {
    if (!this.isVisible || !this.currentConfig) {
      return;
    }

    // Update title
    if (this.titleText) {
      this.titleText.setText(title);
    }

    // Update message
    if (this.messageText) {
      this.messageText.setText(message);
      // Recalculate word wrap
      const width = this.currentConfig.width || Math.min(540, this.camera.width - 40);
      this.messageText.setWordWrapWidth(width - 48); // Account for padding
    }

    // Re-validate accessibility
    this.validateAccessibility();
  }

  /**
   * Enables or disables high contrast mode
   * @param enabled - Whether to enable high contrast mode
   */
  setHighContrastMode(enabled: boolean): void {
    this.highContrastMode = enabled;
    this.readabilityManager.setHighContrastMode(enabled);

    if (this.isVisible && this.currentConfig) {
      // Recreate text elements with high contrast styling
      this.updateTextStyling();
      // Update background if needed
      this.updateBackgroundForHighContrast();
    }
  }

  /**
   * Clears the current message and cleans up resources
   */
  clearMessage(): void {
    if (this.autoCloseTimer) {
      this.autoCloseTimer.destroy();
      this.autoCloseTimer = undefined;
    }

    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }

    this.backgroundContainer = undefined;
    this.titleText = undefined;
    this.messageText = undefined;
    this.dismissButton = undefined;
    this.isVisible = false;
    this.currentConfig = undefined;
  }

  /**
   * Handles layout updates when the camera size changes
   */
  layout(): void {
    if (!this.isVisible || !this.currentConfig || !this.container) {
      return;
    }

    const width = this.currentConfig.width || Math.min(540, this.camera.width - 40);
    const position = this.calculatePosition(this.currentConfig.position || 'center', width, 140);

    // Update container position
    this.container.setPosition(0, 0);

    // Update background position
    if (this.backgroundContainer) {
      this.backgroundContainer.setPosition(position.x, position.y);
    }

    // Update text positions
    if (this.titleText) {
      this.titleText.setPosition(position.x, position.y - 30);
    }

    if (this.messageText) {
      this.messageText.setPosition(position.x, position.y + 5);
      this.messageText.setWordWrapWidth(width - 48);
    }

    // Update dismiss button position
    if (this.dismissButton) {
      this.dismissButton.setPosition(position.x + width/2 - 20, position.y - 60);
    }
  }

  /**
   * Sets up orientation and resize handling for the message box
   */
  private setupOrientationAndResizeHandling(): void {
    const fontScaler = getResponsiveFontScaler();

    // Register for orientation changes
    this.orientationCleanup = fontScaler.onOrientationChange(() => {
      if (this.isVisible) {
        this.handleOrientationChange();
      }
    });

    // Register for resize events
    this.resizeCleanup = fontScaler.onResize((newInfo: DeviceInfo) => {
      if (this.isVisible) {
        this.handleViewportResize(newInfo);
      }
    });

    // Register for text overflow detection
    fontScaler.onTextOverflow((element: any, overflow: TextOverflowInfo) => {
      if (this.isVisible) {
        this.handleTextOverflow(element, overflow);
      }
    });
  }

  /**
   * Handles orientation changes by repositioning and rescaling the message box
   */
  private handleOrientationChange(): void {
    if (!this.isVisible || !this.currentConfig) {
      return;
    }

    // Trigger layout update which will handle repositioning
    this.layout();

    // Update text scaling for new orientation
    this.updateTextScalingForOrientation();
  }

  /**
   * Handles viewport resize events
   */
  private handleViewportResize(newInfo: DeviceInfo): void {
    if (!this.isVisible || !this.currentConfig) {
      return;
    }

    // Update layout for new viewport size
    this.layout();

    // Check for text overflow after resize
    this.checkTextOverflow(newInfo);
  }

  /**
   * Updates text scaling when orientation changes
   */
  private updateTextScalingForOrientation(): void {
    const fontScaler = getResponsiveFontScaler();
    const deviceInfo = fontScaler.getDeviceInfo();

    if (this.titleText && this.messageText) {
      const textElements = [
        { element: this.titleText, config: { baseSize: 22, minSize: 16, maxSize: 32, scalingFactor: 1.0 } },
        { element: this.messageText, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } }
      ];

      fontScaler.handleOrientationTextScaling(textElements, deviceInfo.orientation);
    }
  }

  /**
   * Checks for text overflow after viewport changes
   */
  private checkTextOverflow(deviceInfo: DeviceInfo): void {
    const fontScaler = getResponsiveFontScaler();
    const width = this.currentConfig?.width || Math.min(540, deviceInfo.viewportWidth - 40);

    if (this.titleText) {
      const titleOverflow = fontScaler.detectTextOverflow(
        this.titleText,
        width - 48, // Account for padding
        deviceInfo.viewportHeight * 0.3 // Max 30% of viewport height for title
      );

      if (titleOverflow.isOverflowing) {
        this.handleTextOverflow(this.titleText, titleOverflow);
      }
    }

    if (this.messageText) {
      const messageOverflow = fontScaler.detectTextOverflow(
        this.messageText,
        width - 48, // Account for padding
        deviceInfo.viewportHeight * 0.5 // Max 50% of viewport height for message
      );

      if (messageOverflow.isOverflowing) {
        this.handleTextOverflow(this.messageText, messageOverflow);
      }
    }
  }

  /**
   * Handles text overflow by applying appropriate fixes
   */
  private handleTextOverflow(element: any, overflow: TextOverflowInfo): void {
    console.log(`Text overflow detected in message box:`, {
      overflowDirection: overflow.overflowDirection,
      recommendedAction: overflow.recommendedAction,
      actualSize: { width: overflow.actualWidth, height: overflow.actualHeight },
      availableSize: { width: overflow.availableWidth, height: overflow.availableHeight }
    });

    // Apply recommended fixes
    switch (overflow.recommendedAction) {
      case 'reduce-font':
        if (overflow.recommendedFontSize && element.setFontSize) {
          element.setFontSize(overflow.recommendedFontSize);
          console.log(`Reduced font size to ${overflow.recommendedFontSize}px for message box text`);
        }
        break;

      case 'wrap-text':
        if (element.setWordWrapWidth) {
          element.setWordWrapWidth(overflow.availableWidth);
          console.log(`Applied text wrapping with width ${overflow.availableWidth}px for message box text`);
        }
        break;

      case 'truncate':
        this.truncateMessageText(element, overflow.availableWidth);
        break;
    }

    // Update background size if text changed
    this.updateBackgroundForTextChanges();
  }

  /**
   * Truncates message text if it's too long
   */
  private truncateMessageText(element: Phaser.GameObjects.Text, maxWidth: number): void {
    const originalText = element.text;
    let truncatedText = originalText;
    
    // Simple truncation with ellipsis
    while (element.width > maxWidth && truncatedText.length > 3) {
      truncatedText = truncatedText.slice(0, -1);
      element.setText(truncatedText + '...');
    }

    if (truncatedText !== originalText) {
      console.log(`Truncated message text from "${originalText}" to "${truncatedText}..."`);
    }
  }

  /**
   * Updates background size when text content changes
   */
  private updateBackgroundForTextChanges(): void {
    if (!this.backgroundContainer || !this.currentConfig) {
      return;
    }

    // Recalculate background size based on current text dimensions
    const width = this.currentConfig.width || Math.min(540, this.camera.width - 40);
    let height = 140; // Default height

    // Adjust height based on actual text content
    if (this.titleText && this.messageText) {
      const titleHeight = this.titleText.height;
      const messageHeight = this.messageText.height;
      height = Math.max(140, titleHeight + messageHeight + 80); // 80px for padding and spacing
    }

    // Update background graphics
    const graphics = this.backgroundContainer.getAt(0) as Phaser.GameObjects.Graphics;
    if (graphics) {
      graphics.clear();
      
      if (this.highContrastMode) {
        const highContrastColors = getHighContrastColors();
        graphics.fillStyle(highContrastColors.background, 1.0);
        graphics.fillRoundedRect(-width/2, -height/2, width, height, 12);
        graphics.lineStyle(3, 0xffffff, 1.0);
        graphics.strokeRoundedRect(-width/2, -height/2, width, height, 12);
      } else {
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRoundedRect(-width/2 + 2, -height/2 + 4, width, height, 12);
        graphics.fillStyle(0xffffff, 0.95);
        graphics.fillRoundedRect(-width/2, -height/2, width, height, 12);
      }
    }
  }

  /**
   * Destroys the message box and cleans up all resources
   */
  destroy(): void {
    // Clean up high contrast change listener
    if (this.highContrastChangeCleanup) {
      this.highContrastChangeCleanup();
    }
    
    // Clean up orientation and resize listeners
    if (this.orientationCleanup) {
      this.orientationCleanup();
    }
    
    if (this.resizeCleanup) {
      this.resizeCleanup();
    }
    
    this.clearMessage();
  }

  /**
   * Calculates the position for the message box based on configuration
   */
  private calculatePosition(position: 'center' | 'top' | 'bottom', _width: number, height: number): { x: number, y: number } {
    const centerX = this.camera.width / 2;
    
    switch (position) {
      case 'top':
        return { x: centerX, y: height / 2 + 40 };
      case 'bottom':
        return { x: centerX, y: this.camera.height - height / 2 - 40 };
      case 'center':
      default:
        return { x: centerX, y: this.camera.height / 2 + 90 };
    }
  }

  /**
   * Creates the title text with accessibility features
   */
  private createTitleText(title: string, position: { x: number, y: number }, _width: number, _padding: number): void {
    const titleConfig: AccessibilityTextConfig = {
      baseSize: 22,
      contrastRatio: this.highContrastMode ? 'AAA' : 'AA',
      backgroundType: this.highContrastMode ? 'solid' : 'semi-transparent',
      deviceScaling: true,
      highContrastMode: this.highContrastMode
    };

    const titleStyle = this.createAccessibleTextStyle(titleConfig);
    
    this.titleText = this.scene.add
      .text(position.x, position.y - 30, title, titleStyle)
      .setOrigin(0.5, 0.5)
      .setDepth(1002);

    this.applyLetterSpacing(this.titleText, 0.8);
    this.container!.add(this.titleText);
  }

  /**
   * Creates the message text with accessibility features
   */
  private createMessageText(message: string, position: { x: number, y: number }, width: number, padding: number): void {
    const messageConfig: AccessibilityTextConfig = {
      baseSize: 16,
      contrastRatio: this.highContrastMode ? 'AAA' : 'AA',
      backgroundType: this.highContrastMode ? 'solid' : 'semi-transparent',
      deviceScaling: true,
      highContrastMode: this.highContrastMode
    };

    const messageStyle = this.createAccessibleTextStyle(messageConfig);
    
    this.messageText = this.scene.add
      .text(position.x, position.y + 5, message, messageStyle)
      .setOrigin(0.5, 0.5)
      .setDepth(1002);

    this.messageText.setWordWrapWidth(width - padding * 2);
    this.applyLetterSpacing(this.messageText, 0.6);
    this.container!.add(this.messageText);
  }

  /**
   * Creates a dismiss button for the message box
   */
  private createDismissButton(position: { x: number, y: number }, width: number): void {
    const buttonConfig: AccessibilityTextConfig = {
      baseSize: 14,
      contrastRatio: 'AA',
      backgroundType: 'solid',
      deviceScaling: true
    };

    const buttonStyle = this.createAccessibleTextStyle(buttonConfig);
    buttonStyle.color = '#666666';

    const buttonText = this.scene.add
      .text(0, 0, '✕', buttonStyle)
      .setOrigin(0.5, 0.5)
      .setDepth(1003);

    // Create button background
    const buttonBg = this.scene.add.graphics();
    buttonBg.fillStyle(0xffffff, 0.8);
    buttonBg.fillCircle(0, 0, 16);
    buttonBg.lineStyle(1, 0xcccccc, 0.8);
    buttonBg.strokeCircle(0, 0, 16);

    this.dismissButton = this.scene.add.container(
      position.x + width/2 - 20,
      position.y - 60,
      [buttonBg, buttonText]
    );
    this.dismissButton.setDepth(1002);
    this.dismissButton.setInteractive({ useHandCursor: true });

    // Add hover effects
    this.dismissButton.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0xf0f0f0, 0.9);
      buttonBg.fillCircle(0, 0, 16);
      buttonBg.lineStyle(1, 0x999999, 0.9);
      buttonBg.strokeCircle(0, 0, 16);
    });

    this.dismissButton.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0xffffff, 0.8);
      buttonBg.fillCircle(0, 0, 16);
      buttonBg.lineStyle(1, 0xcccccc, 0.8);
      buttonBg.strokeCircle(0, 0, 16);
    });

    this.dismissButton.on('pointerdown', () => {
      this.clearMessage();
    });

    this.container!.add(this.dismissButton);
  }

  /**
   * Sets up auto-close functionality
   */
  private setupAutoClose(delay: number): void {
    this.autoCloseTimer = this.scene.time.delayedCall(delay, () => {
      this.clearMessage();
    });
  }

  /**
   * Animates the message box in with a smooth fade effect
   */
  private async animateIn(): Promise<void> {
    if (!this.container) return;

    // Start with alpha 0
    this.container.setAlpha(0);

    // Create fade-in tween
    return new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 300,
        ease: 'Power2.easeOut',
        onComplete: () => resolve()
      });
    });
  }

  /**
   * Updates text styling for high contrast mode
   */
  private updateTextStyling(): void {
    if (!this.currentConfig) return;

    // Update title styling
    if (this.titleText) {
      const titleConfig: AccessibilityTextConfig = {
        baseSize: 22,
        contrastRatio: this.highContrastMode ? 'AAA' : 'AA',
        backgroundType: this.highContrastMode ? 'solid' : 'semi-transparent',
        deviceScaling: true,
        highContrastMode: this.highContrastMode
      };
      
      const titleStyle = this.createAccessibleTextStyle(titleConfig);
      this.titleText.setStyle(titleStyle);
    }

    // Update message styling
    if (this.messageText) {
      const messageConfig: AccessibilityTextConfig = {
        baseSize: 16,
        contrastRatio: this.highContrastMode ? 'AAA' : 'AA',
        backgroundType: this.highContrastMode ? 'solid' : 'semi-transparent',
        deviceScaling: true,
        highContrastMode: this.highContrastMode
      };
      
      const messageStyle = this.createAccessibleTextStyle(messageConfig);
      this.messageText.setStyle(messageStyle);
    }
  }

  /**
   * Updates background styling for high contrast mode
   */
  private updateBackgroundForHighContrast(): void {
    if (!this.backgroundContainer || !this.currentConfig) return;

    // Get the graphics object from the background container
    let graphics: Phaser.GameObjects.Graphics | undefined;
    
    try {
      if (typeof this.backgroundContainer.getAt === 'function') {
        graphics = this.backgroundContainer.getAt(0) as Phaser.GameObjects.Graphics;
      } else if (this.backgroundContainer.list && this.backgroundContainer.list.length > 0) {
        graphics = this.backgroundContainer.list[0] as Phaser.GameObjects.Graphics;
      }
    } catch (error) {
      console.warn('Could not access background graphics:', error);
      return;
    }
    
    if (!graphics) return;

    const width = this.currentConfig.width || Math.min(540, this.camera.width - 40);
    const height = 140;
    
    // Clear and redraw with high contrast colors
    graphics.clear();
    
    if (this.highContrastMode) {
      const highContrastColors = getHighContrastColors();
      
      // High contrast: solid black background with white border
      graphics.fillStyle(highContrastColors.background, 1.0);
      graphics.fillRoundedRect(-width/2, -height/2, width, height, 12);
      
      // Add white border for definition
      graphics.lineStyle(3, 0xffffff, 1.0);
      graphics.strokeRoundedRect(-width/2, -height/2, width, height, 12);
    } else {
      // Normal mode: semi-transparent white with shadow
      graphics.fillStyle(0x000000, 0.3);
      graphics.fillRoundedRect(-width/2 + 2, -height/2 + 4, width, height, 12);
      
      graphics.fillStyle(0xffffff, 0.95);
      graphics.fillRoundedRect(-width/2, -height/2, width, height, 12);
    }
  }

  /**
   * Validates accessibility compliance and logs warnings
   */
  private validateAccessibility(): void {
    if (!this.titleText || !this.messageText) return;

    // Validate title accessibility
    const titleStyle = this.titleText.style as any;
    const titleFontSize = parseInt(titleStyle.fontSize?.replace('px', '') || '22');
    
    const titleMetrics = validateTextReadability(
      titleStyle.color || '#ffffff',
      0x000000, // Assuming dark background for semi-transparent
      titleFontSize,
      titleStyle.fontStyle?.includes('bold') || false
    );

    if (titleMetrics.wcagCompliance === 'fail') {
      console.warn('AccessibleMessageBox: Title text does not meet WCAG AA requirements');
    }

    // Validate message accessibility
    const messageStyle = this.messageText.style as any;
    const messageFontSize = parseInt(messageStyle.fontSize?.replace('px', '') || '16');
    
    const messageMetrics = validateTextReadability(
      messageStyle.color || '#ffffff',
      0x000000, // Assuming dark background for semi-transparent
      messageFontSize,
      messageStyle.fontStyle?.includes('bold') || false
    );

    if (messageMetrics.wcagCompliance === 'fail') {
      console.warn('AccessibleMessageBox: Message text does not meet WCAG AA requirements');
    }
  }

  /**
   * Creates an accessible text style that meets WCAG compliance requirements
   */
  private createAccessibleTextStyle(config: AccessibilityTextConfig): Phaser.Types.GameObjects.Text.TextStyle {
    // Calculate responsive font size with more conservative scaling
    const scalingConfig: ScalingConfig = {
      baseSize: config.baseSize,
      minSize: this.readabilityManager.getMinimumSizes().body,
      maxSize: config.baseSize * 1.3, // Reduced from 2x to 1.3x max scaling
      scalingFactor: config.deviceScaling ? this.readabilityManager.getScalingFactor() : 1.0,
    };

    const fontSize = createResponsiveFontSize(scalingConfig);
    const fontSizeNum = parseInt(fontSize.replace("px", ""));

    // Base style configuration
    const baseStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize,
      fontFamily: "Arial, sans-serif",
      resolution: this.dpr,
    };

    // Apply background-specific styling based on configuration
    switch (config.backgroundType) {
      case "outline":
        return {
          ...baseStyle,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: Math.max(2, Math.round(fontSizeNum * 0.125)) * this.dpr,
        };

      case "semi-transparent":
        return {
          ...baseStyle,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: Math.max(1, Math.round(fontSizeNum * 0.0625)) * this.dpr,
          shadow: {
            offsetX: 0,
            offsetY: 2 * this.dpr,
            color: "#000000",
            blur: 4 * this.dpr,
            stroke: true,
            fill: true,
          },
        };

      case "solid":
        // For solid backgrounds, use high contrast colors
        return {
          ...baseStyle,
          color: this.highContrastMode ? "#000000" : "#333333",
        };

      case "none":
      default:
        // Maximum contrast with strong outline for no background
        return {
          ...baseStyle,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: Math.max(3, Math.round(fontSizeNum * 0.1875)) * this.dpr,
          shadow: {
            offsetX: 0,
            offsetY: 3 * this.dpr,
            color: "#000000",
            blur: 6 * this.dpr,
            stroke: true,
            fill: true,
          },
        };
    }
  }

  /**
   * Creates a message background container with proper styling
   */
  private createMessageBackground(x: number, y: number, width: number, height: number, _padding: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const graphics = this.scene.add.graphics();
    
    // Create shadow
    graphics.fillStyle(0x000000, 0.3);
    graphics.fillRoundedRect(-width/2 + 2, -height/2 + 4, width, height, 12);
    
    // Create main background
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillRoundedRect(-width/2, -height/2, width, height, 12);
    
    container.add(graphics);
    container.setDepth(1000);
    
    return container;
  }

  /**
   * Applies letter spacing to a text object with best-effort fallbacks
   */
  private applyLetterSpacing(t: Phaser.GameObjects.Text, px = 0.5): void {
    const anyT = t as any;
    if (typeof anyT.setLetterSpacing === "function") {
      anyT.setLetterSpacing(px);
    } else if (anyT.style) {
      anyT.style.letterSpacing = px;
      anyT.updateText?.();
    }
  }
}