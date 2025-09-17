import Phaser from "phaser";
import {
  type AccessibilityTextConfig,
  type ScalingConfig,
  TextReadabilityManager,
  calculateContrastRatioMixed,
  calculateContrastRatioFromHex,
  checkWcagCompliance,
  suggestTextColor,
  createResponsiveFontSize,
  validateTextReadability,
  getHighContrastColors,
} from "../utils/textReadability";
import {
  getHighContrastManager,
  onHighContrastChange,
} from "../utils/highContrastConfig";
import {
  AdaptiveBackgroundRenderer,
  type BackgroundConfig,
  type BackgroundAnalysis,
  type BackgroundRenderOptions,
} from "../utils/adaptiveBackgroundRenderer";
import { AccessibleMessageBox, type MessageBoxConfig } from "./AccessibleMessageBox";
import {
  getResponsiveFontScaler,
  type TextOverflowInfo,
  type DeviceInfo
} from "../utils/responsiveFontScaler";

/**
 * Base class for HUD elements providing common functionality
 * and consistent styling across all UI components.
 */
abstract class HudElement {
  protected readonly scene: Phaser.Scene;
  protected readonly camera: Phaser.Cameras.Scene2D.Camera;
  protected readonly dpr: number;
  protected readonly readabilityManager: TextReadabilityManager;
  protected readonly backgroundRenderer: AdaptiveBackgroundRenderer;
  protected readonly highContrastManager = getHighContrastManager();
  protected highContrastChangeCleanup?: () => void;

  /**
   * Creates a new HUD element
   * @param scene - The Phaser scene this element belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.readabilityManager = new TextReadabilityManager();
    this.backgroundRenderer = new AdaptiveBackgroundRenderer(scene);
    
    // Set initial high contrast mode state
    this.readabilityManager.setHighContrastMode(this.highContrastManager.isEnabled());
    
    // Listen for high contrast mode changes
    this.highContrastChangeCleanup = onHighContrastChange((enabled) => {
      this.readabilityManager.setHighContrastMode(enabled);
      this.onHighContrastModeChanged(enabled);
    });
  }

  /**
   * Creates a standardized text style configuration
   * @param color - Text color as hex string
   * @param fontSize - Font size (defaults to 16px)
   * @returns Phaser text style configuration
   */
  protected createTextStyle(
    color: string,
    fontSize: string = "16px"
  ): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize,
      color,
      fontFamily: "Arial, sans-serif",
      resolution: this.dpr,
      stroke: "#000000",
      strokeThickness: 2 * this.dpr,
    };
  }

  /**
   * Plain text style without stroke or shadow for maximum clarity
   */
  protected createPlainTextStyle(
    color: string,
    fontSize: string = "16px",
    fontStyle?: string
  ): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize,
      color,
      fontFamily: "Arial, sans-serif",
      fontStyle,
      resolution: this.dpr,
    };
  }

  /**
   * Creates an accessible text style that meets WCAG compliance requirements
   * @param config - Accessibility configuration options
   * @returns Phaser text style configuration with WCAG compliance
   */
  protected createAccessibleTextStyle(
    config: AccessibilityTextConfig
  ): Phaser.Types.GameObjects.Text.TextStyle {
    // Check if high contrast mode is enabled
    const isHighContrast = config.highContrastMode ?? this.readabilityManager.isHighContrastMode();
    
    // Calculate responsive font size with conservative scaling
    const scalingConfig: ScalingConfig = {
      baseSize: config.baseSize,
      minSize: this.readabilityManager.getMinimumSizes().body,
      maxSize: config.baseSize * 1.3, // Reduced from 2x to 1.3x max scaling
      scalingFactor: config.deviceScaling
        ? this.readabilityManager.getScalingFactor()
        : 1.0,
    };

    const fontSize = createResponsiveFontSize(scalingConfig);
    const fontSizeNum = parseInt(fontSize.replace("px", ""));

    // Use high contrast styling if enabled
    if (isHighContrast) {
      const highContrastColors = getHighContrastColors();
      return this.readabilityManager.createHighContrastStyle(
        highContrastColors.text,
        highContrastColors.background,
        fontSizeNum
      );
    }

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
          strokeThickness:
            Math.max(2, Math.round(fontSizeNum * 0.125)) * this.dpr,
        };

      case "semi-transparent":
        return {
          ...baseStyle,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness:
            Math.max(1, Math.round(fontSizeNum * 0.0625)) * this.dpr,
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
          color: "#000000", // Will be adjusted based on actual background
        };

      case "none":
      default:
        // Maximum contrast with strong outline for no background
        return {
          ...baseStyle,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness:
            Math.max(3, Math.round(fontSizeNum * 0.1875)) * this.dpr,
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
   * Creates a high contrast text style for enhanced visibility
   * @param textColor - Primary text color (hex string)
   * @param backgroundColor - Optional background color for contrast calculation
   * @returns High contrast Phaser text style configuration
   */
  protected createHighContrastTextStyle(
    textColor: string,
    backgroundColor?: number | string
  ): Phaser.Types.GameObjects.Text.TextStyle {
    const minSizes = this.readabilityManager.getMinimumSizes();
    const scalingConfig: ScalingConfig = {
      baseSize: minSizes.body,
      minSize: minSizes.body,
      maxSize: minSizes.body * 1.5,
      scalingFactor: this.readabilityManager.getScalingFactor(),
    };

    const fontSize = createResponsiveFontSize(scalingConfig);
    const fontSizeNum = parseInt(fontSize.replace("px", ""));

    // Determine optimal text color if background is provided
    let finalTextColor = textColor;
    if (backgroundColor !== undefined) {
      const suggestedColor = suggestTextColor(backgroundColor, 7.0); // AAA compliance target

      // Validate current color choice
      const currentContrast =
        typeof backgroundColor === "string"
          ? calculateContrastRatioFromHex(textColor, backgroundColor)
          : calculateContrastRatioMixed(textColor, backgroundColor);

      // Use suggested color if current doesn't meet AAA standards
      if (checkWcagCompliance(currentContrast, fontSizeNum) !== "AAA") {
        finalTextColor = suggestedColor;
      }
    }

    // High contrast style with strong outline and shadow
    return {
      fontSize,
      color: finalTextColor,
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      resolution: this.dpr,
      stroke: finalTextColor === "#ffffff" ? "#000000" : "#ffffff",
      strokeThickness: Math.max(3, Math.round(fontSizeNum * 0.1875)) * this.dpr,
      shadow: {
        offsetX: 0,
        offsetY: 3 * this.dpr,
        color: finalTextColor === "#ffffff" ? "#000000" : "#ffffff",
        blur: 6 * this.dpr,
        stroke: true,
        fill: true,
      },
    };
  }

  /**
   * Creates a responsive text style with device-aware font scaling
   * @param baseColor - Base text color
   * @param baseFontSize - Base font size in pixels
   * @param textType - Type of text for minimum size constraints
   * @returns Responsive Phaser text style configuration
   */
  protected createResponsiveTextStyle(
    baseColor: string,
    baseFontSize: number = 16,
    textType: "body" | "secondary" | "large" = "body"
  ): Phaser.Types.GameObjects.Text.TextStyle {
    const fontSize = this.readabilityManager.createScaledFontSize(
      baseFontSize,
      textType
    );
    const fontSizeNum = parseInt(fontSize.replace("px", ""));

    return {
      fontSize,
      color: baseColor,
      fontFamily: "Arial, sans-serif",
      resolution: this.dpr,
      stroke: "#000000",
      strokeThickness: Math.max(2, Math.round(fontSizeNum * 0.125)) * this.dpr,
    };
  }

  /**
   * Validates text readability and logs warnings for accessibility violations
   * @param textColor - Text color (hex string)
   * @param backgroundColor - Background color (hex string or numeric)
   * @param fontSize - Font size in pixels
   * @param isBold - Whether text is bold
   * @param elementName - Name of the element for logging purposes
   */
  protected validateTextAccessibility(
    textColor: string,
    backgroundColor: string | number,
    fontSize: number,
    isBold: boolean = false,
    elementName: string = "text element"
  ): void {
    const metrics = validateTextReadability(
      textColor,
      backgroundColor,
      fontSize,
      isBold
    );

    if (metrics.wcagCompliance === "fail") {
      console.warn(
        `Accessibility Warning: ${elementName} does not meet WCAG AA requirements. ` +
          `Contrast ratio: ${metrics.contrastRatio.toFixed(2)}:1 ` +
          `(minimum required: ${
            fontSize >= 24 || (fontSize >= 18.66 && isBold) ? "3.0" : "4.5"
          }:1)`
      );
    } else if (metrics.wcagCompliance === "AA") {
      console.info(
        `Accessibility Info: ${elementName} meets WCAG AA requirements. ` +
          `Contrast ratio: ${metrics.contrastRatio.toFixed(2)}:1`
      );
    }
  }

  /**
   * Creates a rounded rectangle card with subtle drop shadow
   */
  protected makeCard(
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 10,
    fill = 0xffffff,
    alpha = 0.95
  ): Phaser.GameObjects.Container {
    const g = this.scene.add.graphics();
    g.setDepth(1000);
    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius);
    // Card
    g.fillStyle(fill, alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    const c = this.scene.add.container(0, 0, [g]);
    c.setDepth(1000);
    return c;
  }

  /**
   * Redraws an existing card container's graphics at a new position/size
   */
  protected redrawCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 10,
    fill = 0xffffff,
    alpha = 0.95
  ): void {
    const g = container.getAt(0) as Phaser.GameObjects.Graphics | undefined;
    if (!g) return;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius);
    // Card
    g.fillStyle(fill, alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }

  /**
   * Creates a button with rounded background and label text
   */
  protected makeButton(
    label: string,
    centerX: number,
    centerY: number,
    onClick: () => void,
    opts?: { padding?: number; bg?: number; fg?: string }
  ): Phaser.GameObjects.Container {
    const padding = opts?.padding ?? 12;
    const bgColor = opts?.bg ?? 0x1a1a1a;
    const fgColor = opts?.fg ?? "#ffffff";
    const txt = this.scene.add
      .text(0, 0, label, this.createTextStyle(fgColor, "18px"))
      .setOrigin(0.5);
    this.applyLetterSpacing(txt, 0.9);
    txt.setShadow(0, 2, "#000000", 4, true, true);
    const w = Math.ceil(txt.width + padding * 2);
    const h = Math.ceil(txt.height + padding);
    const g = this.scene.add.graphics();
    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(centerX - w / 2 + 2, centerY - h / 2 + 4, w, h, 8);
    // Button
    g.fillStyle(bgColor, 0.95);
    g.fillRoundedRect(centerX - w / 2, centerY - h / 2, w, h, 8);
    const container = this.scene.add.container(0, 0, [g, txt]);
    container.setDepth(1001);
    txt.setPosition(centerX, centerY);
    // Interactivity on the button area
    const hit = this.scene.add.rectangle(centerX, centerY, w, h, 0x000000, 0);
    hit.setDepth(1002);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => g.setAlpha(1));
    hit.on("pointerout", () => g.setAlpha(0.98));
    hit.on("pointerdown", () => {
      g.setAlpha(0.9);
      onClick();
    });
    container.add(hit);
    return container;
  }

  /**
   * Applies letter spacing to a text object with best-effort fallbacks.
   */
  protected applyLetterSpacing(t: Phaser.GameObjects.Text, px = 0.5): void {
    const anyT = t as any;
    if (typeof anyT.setLetterSpacing === "function") {
      anyT.setLetterSpacing(px);
    } else if (anyT.style) {
      anyT.style.letterSpacing = px;
      anyT.updateText?.();
    }
  }

  /**
   * Creates a pulsing animation effect for UI feedback
   * @param target - The Phaser object to animate
   * @param scale - Scale multiplier for the pulse (defaults to 1.1)
   * @param duration - Animation duration in milliseconds (defaults to 120)
   */
  protected createPulseEffect(
    target: Phaser.GameObjects.GameObject,
    scale: number = 1.1,
    duration: number = 120
  ): void {
    this.scene.tweens.add({
      targets: target,
      scale,
      duration,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Creates a text element with adaptive background for optimal readability
   * @param text - Text content
   * @param x - X position
   * @param y - Y position
   * @param style - Text style configuration
   * @param backgroundOptions - Background rendering options
   * @returns Container with text and adaptive background
   */
  protected createTextWithAdaptiveBackground(
    text: string,
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    backgroundOptions: BackgroundRenderOptions = { type: "adaptive" }
  ): Phaser.GameObjects.Container {
    const textObject = this.scene.add.text(x, y, text, style);
    return this.backgroundRenderer.createAdaptiveBackground(
      textObject,
      backgroundOptions
    );
  }

  /**
   * Creates a text element with semi-transparent background
   * @param text - Text content
   * @param x - X position
   * @param y - Y position
   * @param style - Text style configuration
   * @param config - Background configuration
   * @returns Container with text and background
   */
  protected createTextWithBackground(
    text: string,
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    config: BackgroundConfig = {
      padding: 12,
      cornerRadius: 8,
      opacity: 0.9,
      blurBackground: false,
    }
  ): Phaser.GameObjects.Container {
    const textObject = this.scene.add.text(x, y, text, style);
    return this.backgroundRenderer.createTextBackground(textObject, config);
  }

  /**
   * Analyzes background contrast at a specific location
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of analysis area
   * @param height - Height of analysis area
   * @returns Background analysis results
   */
  protected analyzeBackgroundContrast(
    x: number,
    y: number,
    width: number,
    height: number
  ): BackgroundAnalysis {
    return this.backgroundRenderer.analyzeBackgroundContrast(
      x,
      y,
      width,
      height
    );
  }

  /**
   * Updates text content in a background container
   * @param container - Container with text and background
   * @param newText - New text content
   */
  protected updateTextWithBackground(
    container: Phaser.GameObjects.Container,
    newText: string
  ): void {
    this.backgroundRenderer.updateBackgroundForText(container, newText);
  }

  /**
   * Called when high contrast mode changes
   * Subclasses should override this to update their styling
   * @param enabled - Whether high contrast mode is now enabled
   */
  protected onHighContrastModeChanged(enabled: boolean): void {
    // Default implementation - subclasses should override
    console.log(`High contrast mode ${enabled ? 'enabled' : 'disabled'} for ${this.constructor.name}`);
  }

  /**
   * Enables or disables high contrast mode for this element
   * @param enabled - Whether to enable high contrast mode
   */
  setHighContrastMode(enabled: boolean): void {
    this.readabilityManager.setHighContrastMode(enabled);
    this.onHighContrastModeChanged(enabled);
  }

  /**
   * Gets the current high contrast mode state
   */
  isHighContrastMode(): boolean {
    return this.readabilityManager.isHighContrastMode();
  }

  /**
   * Abstract method to be implemented by subclasses for cleanup
   */
  abstract destroy(): void;
}

/**
 * Manages the main HUD display elements including lives, timer, score, and multiplier
 */
class HudDisplay extends HudElement {
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly multiplierText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private shieldText?: Phaser.GameObjects.Text;
  
  // Store original colors for high contrast mode switching
  private readonly originalColors = {
    lives: "#ff4444",
    timer: "#ffffff", 
    score: "#ffff44",
    multiplier: "#ff8844",
    best: "#ffffff",
    shield: "#44ffff"
  };

  // Orientation and resize handling
  private resizeCleanup?: () => void;
  private orientationCleanup?: () => void;

  constructor(scene: Phaser.Scene) {
    super(scene);

    // Create HUD text elements with accessible styling and proper positioning
    const accessibleConfig: AccessibilityTextConfig = {
      baseSize: 18,
      contrastRatio: 'AA',
      backgroundType: 'outline',
      deviceScaling: true
    };

    // Lives display with red color for visibility
    this.livesText = this.scene.add.text(
      10,
      40,
      "Lives: ",
      this.createAccessibleTextStyle({
        ...accessibleConfig,
        baseSize: 16
      })
    );
    this.livesText.setDepth(1000);
    // Override color for lives (red) while maintaining accessibility
    this.livesText.setColor("#ff4444");
    this.validateTextAccessibility("#ff4444", "#000000", 16, false, "Lives display");

    // Timer display with white color
    this.timerText = this.scene.add.text(
      10,
      70,
      "Time: 0.0s",
      this.createAccessibleTextStyle({
        ...accessibleConfig,
        baseSize: 16
      })
    );
    this.timerText.setDepth(1000);
    this.validateTextAccessibility("#ffffff", "#000000", 16, false, "Timer display");

    // Score display with yellow color for prominence
    this.scoreText = this.scene.add.text(
      this.camera.width - 10,
      10,
      "Score: 0",
      this.createAccessibleTextStyle({
        ...accessibleConfig,
        baseSize: 18
      })
    );
    this.scoreText.setOrigin(1, 0);
    this.scoreText.setDepth(1000);
    // Override color for score (yellow) while maintaining accessibility
    this.scoreText.setColor("#ffff44");
    this.validateTextAccessibility("#ffff44", "#000000", 18, false, "Score display");

    // Multiplier display with orange color for attention
    this.multiplierText = this.scene.add.text(
      this.camera.width - 10,
      40,
      "",
      this.createAccessibleTextStyle({
        ...accessibleConfig,
        baseSize: 16
      })
    );
    this.multiplierText.setOrigin(1, 0);
    this.multiplierText.setDepth(1000);
    // Override color for multiplier (orange) while maintaining accessibility
    this.multiplierText.setColor("#ff8844");
    this.validateTextAccessibility("#ff8844", "#000000", 16, false, "Multiplier display");

    // Best score display with white color
    this.bestText = this.scene.add.text(
      this.camera.width - 10,
      70,
      "Best: 0",
      this.createAccessibleTextStyle({
        ...accessibleConfig,
        baseSize: 16
      })
    );
    this.bestText.setOrigin(1, 0);
    this.bestText.setDepth(1000);
    this.validateTextAccessibility("#ffffff", "#000000", 16, false, "Best score display");

    // Set up orientation and resize handling
    this.setupOrientationAndResizeHandling();
  }

  /**
   * Repositions HUD elements based on current camera size (responsive layout)
   */
  layout(): void {
    // Update responsive font scaling for all text elements
    this.updateResponsiveScaling();

    // Left-aligned
    this.livesText.setPosition(10, 40);
    this.timerText.setPosition(10, 70);
    // Right-aligned
    const right = this.camera.width - 10;
    this.scoreText.setPosition(right, 10);
    this.multiplierText.setPosition(right, 40);
    this.bestText.setPosition(right, 70);
    if (this.shieldText) this.shieldText.setPosition(right, 100);
  }

  /**
   * Updates responsive font scaling for all HUD text elements
   * Called during layout updates to ensure optimal readability
   */
  private updateResponsiveScaling(): void {
    // Get scaling information for responsive text sizing

    // Update font sizes for all text elements based on current viewport
    const livesSize = this.readabilityManager.createScaledFontSize(16, 'body');
    const timerSize = this.readabilityManager.createScaledFontSize(16, 'body');
    const scoreSize = this.readabilityManager.createScaledFontSize(18, 'body');
    const multiplierSize = this.readabilityManager.createScaledFontSize(16, 'body');
    const bestSize = this.readabilityManager.createScaledFontSize(16, 'body');

    // Apply updated font sizes
    this.livesText.setFontSize(livesSize);
    this.timerText.setFontSize(timerSize);
    this.scoreText.setFontSize(scoreSize);
    this.multiplierText.setFontSize(multiplierSize);
    this.bestText.setFontSize(bestSize);

    if (this.shieldText) {
      const shieldSize = this.readabilityManager.createScaledFontSize(16, 'body');
      this.shieldText.setFontSize(shieldSize);
    }

    // Validate accessibility after scaling updates
    this.validateAllTextAccessibility();
  }

  /**
   * Validates accessibility compliance for all HUD text elements
   */
  private validateAllTextAccessibility(): void {
    const livesSize = parseInt(String(this.livesText.style.fontSize).replace('px', ''));
    const timerSize = parseInt(String(this.timerText.style.fontSize).replace('px', ''));
    const scoreSize = parseInt(String(this.scoreText.style.fontSize).replace('px', ''));
    const multiplierSize = parseInt(String(this.multiplierText.style.fontSize).replace('px', ''));
    const bestSize = parseInt(String(this.bestText.style.fontSize).replace('px', ''));

    this.validateTextAccessibility("#ff4444", "#000000", livesSize, false, "Lives display");
    this.validateTextAccessibility("#ffffff", "#000000", timerSize, false, "Timer display");
    this.validateTextAccessibility("#ffff44", "#000000", scoreSize, false, "Score display");
    this.validateTextAccessibility("#ff8844", "#000000", multiplierSize, false, "Multiplier display");
    this.validateTextAccessibility("#ffffff", "#000000", bestSize, false, "Best score display");

    if (this.shieldText) {
      const shieldSize = parseInt(String(this.shieldText.style.fontSize).replace('px', ''));
      this.validateTextAccessibility("#44ffff", "#000000", shieldSize, false, "Shield display");
    }
  }

  /**
   * Updates the lives display with heart symbols
   * @param lives - Number of lives remaining
   */
  setLives(lives: number): void {
    this.livesText.setText(`Lives: ${"♥".repeat(lives)}`);
  }

  /**
   * Updates the timer display
   * @param seconds - Time elapsed in seconds
   */
  setTimer(seconds: number): void {
    this.timerText.setText(`Time: ${seconds.toFixed(1)}s`);
  }

  /**
   * Updates the score display
   * @param score - Current score value
   */
  setScore(score: number): void {
    this.scoreText.setText(`Score: ${score}`);
  }

  /**
   * Updates the multiplier display
   * @param multiplier - Current multiplier value
   */
  setMultiplier(multiplier: number): void {
    if (multiplier > 1) {
      this.multiplierText.setText(`x${multiplier}`);
    } else {
      this.multiplierText.setText("");
    }
  }

  /**
   * Updates the best score display
   * @param best - Best score achieved
   */
  setBest(best: number): void {
    this.bestText.setText(`Best: ${best}`);
  }

  /**
   * Shows or hides the shield status indicator
   * @param active - Whether shield is active
   * @param secondsRemaining - Time remaining on shield effect
   */
  setShield(active: boolean, secondsRemaining?: number): void {
    if (active) {
      if (!this.shieldText) {
        const accessibleConfig: AccessibilityTextConfig = {
          baseSize: 16,
          contrastRatio: 'AA',
          backgroundType: 'outline',
          deviceScaling: true
        };

        this.shieldText = this.scene.add
          .text(
            this.camera.width - 10,
            100,
            "",
            this.createAccessibleTextStyle(accessibleConfig)
          )
          .setOrigin(1, 0)
          .setDepth(1000);
        
        // Override color for shield (cyan) while maintaining accessibility
        this.shieldText.setColor("#44ffff");
        this.validateTextAccessibility("#44ffff", "#000000", 16, false, "Shield display");
      }
      const timeString = Math.max(0, secondsRemaining ?? 0).toFixed(1);
      this.shieldText.setText(`Shield: ${timeString}s`);
      this.shieldText.setVisible(true);
    } else if (this.shieldText) {
      this.shieldText.setVisible(false);
    }
  }

  /**
   * Creates a pulsing animation on the score text with enhanced visibility
   */
  pulseScore(): void {
    this.createPulseEffect(this.scoreText, 1.1, 120);
    this.enhanceTextVisibility(this.scoreText, "#ffff44");
  }

  /**
   * Creates a pulsing animation on the multiplier text with enhanced visibility
   */
  pulseMultiplier(): void {
    if (this.multiplierText.text) {
      this.createPulseEffect(this.multiplierText, 1.15, 140);
      this.enhanceTextVisibility(this.multiplierText, "#ff8844");
    }
  }

  /**
   * Creates a pulsing animation on the lives text with enhanced visibility
   */
  pulseLives(): void {
    this.createPulseEffect(this.livesText, 1.12, 120);
    this.enhanceTextVisibility(this.livesText, "#ff4444");
  }

  /**
   * Enhances text visibility with improved stroke and shadow effects
   * @param textObject - The text object to enhance
   * @param baseColor - The base color of the text
   */
  private enhanceTextVisibility(textObject: Phaser.GameObjects.Text, baseColor: string): void {
    const fontSize = parseInt(String(textObject.style.fontSize).replace('px', ''));
    const strokeThickness = Math.max(3, Math.round(fontSize * 0.1875)) * this.dpr;
    
    // Apply enhanced stroke for better contrast
    textObject.setStroke("#000000", strokeThickness);
    
    // Add shadow for depth and readability
    textObject.setShadow(
      0, 
      3 * this.dpr, 
      "#000000", 
      6 * this.dpr, 
      true, 
      true
    );

    // Temporarily brighten the color during pulse for better visibility
    this.scene.tweens.add({
      targets: textObject,
      duration: 120,
      yoyo: true,
      onStart: () => {
        // Brighten color during pulse
        const brighterColor = this.brightenColor(baseColor, 0.2);
        textObject.setColor(brighterColor);
      },
      onComplete: () => {
        // Restore original color
        textObject.setColor(baseColor);
      }
    });
  }

  /**
   * Brightens a hex color by a specified amount
   * @param hexColor - The hex color to brighten
   * @param amount - Amount to brighten (0-1)
   * @returns Brightened hex color
   */
  private brightenColor(hexColor: string, amount: number): string {
    const hex = hexColor.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.round(255 * amount));
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.round(255 * amount));
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.round(255 * amount));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Sets up orientation and resize handling for HUD elements
   */
  private setupOrientationAndResizeHandling(): void {
    const fontScaler = getResponsiveFontScaler();

    // Position configurations would be created here for text repositioning

    // Register for orientation changes
    this.orientationCleanup = fontScaler.onOrientationChange(() => {
      this.handleOrientationChange();
    });

    // Register for resize events
    this.resizeCleanup = fontScaler.onResize((newInfo: DeviceInfo) => {
      this.handleViewportResize(newInfo);
    });

    // Register for text overflow detection
    fontScaler.onTextOverflow((element: any, overflow: TextOverflowInfo) => {
      this.handleTextOverflow(element, overflow);
    });
  }

  /**
   * Handles orientation changes by repositioning and rescaling text elements
   */
  private handleOrientationChange(): void {
    const fontScaler = getResponsiveFontScaler();
    const deviceInfo = fontScaler.getDeviceInfo();

    // Reposition all text elements for new orientation
    // fontScaler.repositionTextForOrientation(
    //   textPositionConfigs,
    //   deviceInfo.viewportWidth,
    //   deviceInfo.viewportHeight
    // );

    // Handle text scaling for orientation
    const textElements = [
      { element: this.livesText, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } },
      { element: this.timerText, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } },
      { element: this.scoreText, config: { baseSize: 18, minSize: 14, maxSize: 28, scalingFactor: 1.0 } },
      { element: this.multiplierText, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } },
      { element: this.bestText, config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 } }
    ];

    if (this.shieldText) {
      textElements.push({
        element: this.shieldText,
        config: { baseSize: 16, minSize: 12, maxSize: 24, scalingFactor: 1.0 }
      });
    }

    fontScaler.handleOrientationTextScaling(textElements, deviceInfo.orientation);

    // Update layout after orientation change
    this.layout();
  }

  /**
   * Handles viewport resize events
   */
  private handleViewportResize(newInfo: DeviceInfo): void {
    // Update camera reference if needed
    if (this.camera.width !== newInfo.viewportWidth || this.camera.height !== newInfo.viewportHeight) {
      // Trigger layout update
      this.layout();
    }

    // Check for text overflow after resize
    this.checkAllTextOverflow(newInfo);
  }

  /**
   * Checks all text elements for overflow after viewport changes
   */
  private checkAllTextOverflow(deviceInfo: DeviceInfo): void {
    const fontScaler = getResponsiveFontScaler();
    const textElements = [
      this.livesText,
      this.timerText,
      this.scoreText,
      this.multiplierText,
      this.bestText
    ];

    if (this.shieldText) {
      textElements.push(this.shieldText);
    }

    textElements.forEach(element => {
      // Check overflow with reasonable bounds (90% of viewport)
      const overflow = fontScaler.detectTextOverflow(
        element,
        deviceInfo.viewportWidth * 0.9,
        deviceInfo.viewportHeight * 0.9
      );

      if (overflow.isOverflowing) {
        this.handleTextOverflow(element, overflow);
      }
    });
  }

  /**
   * Handles text overflow by applying appropriate fixes
   */
  private handleTextOverflow(element: any, overflow: TextOverflowInfo): void {
    console.log(`Text overflow detected for HUD element:`, {
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
          console.log(`Reduced font size to ${overflow.recommendedFontSize}px for HUD element`);
        }
        break;

      case 'wrap-text':
        if (element.setWordWrapWidth) {
          element.setWordWrapWidth(overflow.availableWidth);
          console.log(`Applied text wrapping with width ${overflow.availableWidth}px for HUD element`);
        }
        break;

      case 'truncate':
        // For HUD elements, we might need to truncate long text
        this.truncateTextIfNeeded(element, overflow.availableWidth);
        break;
    }

    // Re-validate accessibility after overflow fixes
    this.validateAllTextAccessibility();
  }

  /**
   * Truncates text if it's too long for the available space
   */
  private truncateTextIfNeeded(element: Phaser.GameObjects.Text, maxWidth: number): void {
    const originalText = element.text;
    let truncatedText = originalText;
    
    // Simple truncation with ellipsis
    while (element.width > maxWidth && truncatedText.length > 3) {
      truncatedText = truncatedText.slice(0, -1);
      element.setText(truncatedText + '...');
    }

    if (truncatedText !== originalText) {
      console.log(`Truncated HUD text from "${originalText}" to "${truncatedText}..."`);
    }
  }

  /**
   * Handles high contrast mode changes by updating all text styling
   * @param enabled - Whether high contrast mode is enabled
   */
  protected onHighContrastModeChanged(enabled: boolean): void {
    this.updateAllTextStyling(enabled);
  }

  /**
   * Updates all text elements with appropriate styling for current mode
   * @param highContrastMode - Whether to use high contrast styling
   */
  private updateAllTextStyling(highContrastMode: boolean): void {
    const accessibleConfig: AccessibilityTextConfig = {
      baseSize: 16,
      contrastRatio: highContrastMode ? 'AAA' : 'AA',
      backgroundType: highContrastMode ? 'solid' : 'outline',
      deviceScaling: true,
      highContrastMode
    };

    // Update each text element with new styling
    this.updateTextElementStyle(this.livesText, accessibleConfig, this.originalColors.lives);
    this.updateTextElementStyle(this.timerText, accessibleConfig, this.originalColors.timer);
    
    // Score uses larger font
    const scoreConfig = { ...accessibleConfig, baseSize: 18 };
    this.updateTextElementStyle(this.scoreText, scoreConfig, this.originalColors.score);
    
    this.updateTextElementStyle(this.multiplierText, accessibleConfig, this.originalColors.multiplier);
    this.updateTextElementStyle(this.bestText, accessibleConfig, this.originalColors.best);
    
    if (this.shieldText) {
      this.updateTextElementStyle(this.shieldText, accessibleConfig, this.originalColors.shield);
    }

    // Re-validate accessibility after updates
    this.validateAllTextAccessibility();
  }

  /**
   * Updates a single text element's style
   * @param textElement - The text element to update
   * @param config - Accessibility configuration
   * @param originalColor - Original color for non-high-contrast mode
   */
  private updateTextElementStyle(
    textElement: Phaser.GameObjects.Text,
    config: AccessibilityTextConfig,
    originalColor: string
  ): void {
    const newStyle = this.createAccessibleTextStyle(config);
    
    // In high contrast mode, use the style's color; otherwise use original color
    if (!config.highContrastMode) {
      newStyle.color = originalColor;
    }
    
    textElement.setStyle(newStyle);
  }

  /**
   * Destroys all HUD display elements
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
    
    // Clear position configs
    // Clean up position configs
    
    this.livesText.destroy();
    this.timerText.destroy();
    this.scoreText.destroy();
    this.multiplierText.destroy();
    this.bestText.destroy();
    this.shieldText?.destroy();
  }
}

/**
 * Manages game over screen UI elements and interactions
 */
export class GameOverScreen extends HudElement {
  private gameOverText?: Phaser.GameObjects.Text;
  private restartButton?: Phaser.GameObjects.Text;
  private gameOverMsgTitle?: Phaser.GameObjects.Text;
  private gameOverMsgText?: Phaser.GameObjects.Text;
  private gameOverMsgBg?: Phaser.GameObjects.Container;
  private gameOverMsgCard?: Phaser.GameObjects.Container;
  private gameOverBtn?: Phaser.GameObjects.Container;
  private accessibleMessageBox?: AccessibleMessageBox;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.accessibleMessageBox = new AccessibleMessageBox(scene);
  }

  /**
   * Shows the game over screen with restart button
   * @returns Object containing the restart button for event handling
   */
  showGameOver(): { restartButton: Phaser.GameObjects.Text } {
    const centerX = this.camera.width / 2;
    const centerY = this.camera.height / 2;

    // Title with shadow and higher resolution
    this.gameOverText = this.scene.add
      .text(
        centerX,
        centerY - 60,
        "GAME OVER",
        this.createTextStyle("#ff5555", "48px")
      )
      .setOrigin(0.5)
      .setDepth(1001);
    this.gameOverText.setShadow(0, 3, "#000000", 6, true, true);
    this.applyLetterSpacing(this.gameOverText, 1.2);

    // Button with rounded background
    this.gameOverBtn = this.makeButton(
      "Restart",
      centerX,
      centerY + 20,
      () => {
        // Click handled by scene wiring; expose text shim for backward compatibility
        (this.restartButton as any)?.emit?.("pointerdown");
      },
      { bg: 0x272a34, fg: "#ffffff", padding: 14 }
    );

    // Back-compat: expose a Text-like interactive object for existing scene code
    this.restartButton = this.scene.add
      .text(
        centerX,
        centerY + 20,
        "Restart",
        this.createTextStyle("#ffffff", "1px")
      )
      .setOrigin(0.5)
      .setDepth(1002)
      .setInteractive()
      .setVisible(false);

    return { restartButton: this.restartButton };
  }

  /**
   * Repositions game-over UI elements for the current camera size
   */
  layout(): void {
    if (!this.gameOverText && !this.restartButton && !this.gameOverMsgBg && !this.accessibleMessageBox)
      return;
    
    const width = Math.min(520, this.camera.width - 40);
    const yBase = this.camera.height / 2 + 90;
    const cardY = yBase + 60;
    
    // Core labels
    this.gameOverText?.setPosition(
      Math.round(this.camera.width / 2),
      Math.round(this.camera.height / 2 - 50)
    );
    this.restartButton?.setPosition(
      Math.round(this.camera.width / 2),
      Math.round(this.camera.height / 2 + 30)
    );
    
    if (this.gameOverBtn) {
      const centerX = this.camera.width / 2;
      const centerY = this.camera.height / 2 + 20;
      const g = this.gameOverBtn.getAt(0) as any;
      const txt = this.gameOverBtn.getAt(1) as any;
      const hit = this.gameOverBtn.getAt(2) as any;
      if (g && txt && hit) {
        const w = hit.width;
        const h = hit.height;
        g.clear?.();
        g.fillStyle(0x000000, 0.3);
        g.fillRoundedRect(
          Math.round(centerX - w / 2 + 2),
          Math.round(centerY - h / 2 + 4),
          w,
          h,
          8
        );
        g.fillStyle(0x272a34, 0.95);
        g.fillRoundedRect(
          Math.round(centerX - w / 2),
          Math.round(centerY - h / 2),
          w,
          h,
          8
        );
        txt.setPosition(Math.round(centerX), Math.round(centerY));
        hit.setPosition(Math.round(centerX), Math.round(centerY));
      }
    }
    
    // Handle new accessible message box layout
    if (this.accessibleMessageBox) {
      this.accessibleMessageBox.layout();
    }
    
    // Legacy card + message layout if present (for backward compatibility)
    if (this.gameOverMsgBg)
      this.redrawCard(
        this.gameOverMsgBg,
        Math.round(this.camera.width / 2),
        Math.round(cardY),
        width,
        120,
        10,
        0xffffff,
        0.98
      );
    this.gameOverMsgTitle?.setPosition(
      Math.round(this.camera.width / 2),
      Math.round(yBase + 20)
    );
    this.gameOverMsgText?.setPosition(
      Math.round(this.camera.width / 2),
      Math.round(yBase + 48)
    );
    if (this.gameOverMsgText) {
      this.gameOverMsgText.setWordWrapWidth(width - 16 * 2);
    }
  }

  /**
   * Shows a game over message card with title and description using AccessibleMessageBox
   * @param title - Message title
   * @param message - Message content
   */
  showGameOverMessage(title: string, message: string): void {
    if (!this.accessibleMessageBox) {
      return;
    }

    // Clear any existing legacy message elements
    this.gameOverMsgTitle?.destroy();
    this.gameOverMsgText?.destroy();
    this.gameOverMsgBg?.destroy();
    this.gameOverMsgCard?.destroy();
    
    this.gameOverMsgTitle = undefined;
    this.gameOverMsgText = undefined;
    this.gameOverMsgBg = undefined;
    this.gameOverMsgCard = undefined;

    // Configure the accessible message box
    const messageConfig: MessageBoxConfig = {
      title,
      message,
      width: Math.min(540, this.camera.width - 40),
      position: 'center',
      dismissible: false, // Game over messages shouldn't be dismissible
      autoClose: undefined // No auto-close for game over messages
    };

    // Show the message using the new accessible system
    this.accessibleMessageBox.showMessage(messageConfig);
  }

  /**
   * Clears all game over screen elements
   */
  clearGameOver(): void {
    this.gameOverText?.destroy();
    this.restartButton?.destroy();
    this.gameOverBtn?.destroy();
    this.gameOverMsgTitle?.destroy();
    this.gameOverMsgText?.destroy();
    this.gameOverMsgBg?.destroy();
    this.gameOverMsgCard?.destroy();

    // Clear the accessible message box
    if (this.accessibleMessageBox) {
      this.accessibleMessageBox.clearMessage();
    }

    this.gameOverText = undefined;
    this.restartButton = undefined;
    this.gameOverBtn = undefined;
    this.gameOverMsgTitle = undefined;
    this.gameOverMsgText = undefined;
    this.gameOverMsgBg = undefined;
    this.gameOverMsgCard = undefined;
  }

  /**
   * Destroys all game over screen elements
   */
  destroy(): void {
    this.clearGameOver();
    
    // Destroy the accessible message box
    if (this.accessibleMessageBox) {
      this.accessibleMessageBox.destroy();
      this.accessibleMessageBox = undefined;
    }
  }
}

/**
 * Manages greeting/welcome screen UI elements
 */
class GreetingScreen extends HudElement {
  private greetingBg?: Phaser.GameObjects.Rectangle;
  private greetingTitle?: Phaser.GameObjects.Text;
  private greetingMsg?: Phaser.GameObjects.Text;
  private greetingClose?: Phaser.GameObjects.Text;
  private greetingCard?: Phaser.GameObjects.Container;
  private greetingBtn?: Phaser.GameObjects.Container;

  /**
   * Shows a greeting screen with title, message, and action buttons
   * @param title - Greeting title
   * @param message - Greeting message
   * @param onClose - Callback when greeting is closed
   */
  showGreeting(title: string, message: string, onClose?: () => void): void {
    const padding = 16;
    const width = Math.min(560, this.camera.width - 40);
    const x = this.camera.width / 2 - width / 2;
    const y = 80;

    // Enhanced background card with better contrast and accessibility
    this.greetingCard = this.makeCard(
      x + width / 2,
      y + 90,
      width,
      200,
      12, // Slightly larger corner radius for modern look
      0xffffff,
      0.95 // Slightly more opaque for better contrast
    );
    this.greetingBg = this.greetingCard.list[0] as any;

    // Enhanced title with accessible styling
    const titleConfig: AccessibilityTextConfig = {
      baseSize: 22,
      contrastRatio: 'AA',
      backgroundType: 'solid',
      deviceScaling: true
    };
    
    this.greetingTitle = this.scene.add
      .text(
        Math.round(x + width / 2),
        Math.round(y + 22),
        title,
        this.createAccessibleTextStyle(titleConfig)
      )
      .setOrigin(0.5, 0)
      .setDepth(1002);
    
    // Apply letter spacing for better readability
    this.applyLetterSpacing(this.greetingTitle, 1.35);

    // Enhanced message with accessible styling and proper background contrast
    const messageConfig: AccessibilityTextConfig = {
      baseSize: 16,
      contrastRatio: 'AA',
      backgroundType: 'solid',
      deviceScaling: true
    };
    
    this.greetingMsg = this.scene.add
      .text(
        Math.round(this.camera.width / 2),
        Math.round(y + 56),
        message,
        this.createAccessibleTextStyle(messageConfig)
      )
      .setOrigin(0.5, 0)
      .setDepth(1002);
    this.greetingMsg.setWordWrapWidth(width - padding * 2);

    // Enhanced start button with better accessibility
    this.greetingBtn = this.makeButton(
      "Start",
      x + width - 70,
      y + 90 + 80,
      () => {
        this.clearGreeting();
        onClose?.();
      },
      { 
        bg: 0x2c7a7b, 
        fg: "#ffffff", 
        padding: 14 // Larger padding for better touch targets
      }
    );

    // Smooth fade in animation
    const targets: Phaser.GameObjects.GameObject[] = [
      this.greetingCard!,
      this.greetingTitle,
      this.greetingMsg,
      this.greetingBtn!,
    ];
    targets.forEach((t) => (t as any).setAlpha?.(0));
    this.scene.tweens.add({ 
      targets, 
      alpha: 1, 
      duration: 300, // Slightly longer for smoother animation
      ease: 'Power2.easeOut'
    });
  }

  /**
   * Repositions greeting UI elements for the current camera size
   */
  layout(): void {
    if (!this.greetingBg && !this.greetingTitle && !this.greetingMsg) return;
    const padding = 16;
    const width = Math.min(560, this.camera.width - 40);
    const x = this.camera.width / 2 - width / 2;
    const y = 80;
    this.greetingBg?.setPosition(x + width / 2, y + 90);
    this.greetingBg?.setSize(width, 200);
    this.greetingTitle?.setPosition(x + width / 2, y + 22);
    this.greetingMsg?.setPosition(this.camera.width / 2, y + 50);
    if (this.greetingMsg) {
      this.greetingMsg.setWordWrapWidth(width - padding * 2);
    }
    if (this.greetingBtn) {
      const centerX = x + width - 70;
      const centerY = y + 90 + 80;
      const g = this.greetingBtn.getAt(0) as any;
      const txt = this.greetingBtn.getAt(1) as any;
      const hit = this.greetingBtn.getAt(2) as any;
      if (g && txt && hit) {
        const w = hit.width;
        const h = hit.height;
        g.clear?.();
        g.fillStyle(0x000000, 0.3);
        g.fillRoundedRect(centerX - w / 2 + 2, centerY - h / 2 + 4, w, h, 8);
        g.fillStyle(0x2c7a7b, 0.95);
        g.fillRoundedRect(centerX - w / 2, centerY - h / 2, w, h, 8);
        txt.setPosition(centerX, centerY);
        hit.setPosition(centerX, centerY);
      }
    }
  }

  /**
   * Clears all greeting screen elements
   */
  clearGreeting(): void {
    this.greetingCard?.destroy();
    this.greetingBg?.destroy();
    this.greetingTitle?.destroy();
    this.greetingMsg?.destroy();
    this.greetingClose?.destroy();
    this.greetingBtn?.destroy();

    this.greetingCard = undefined;
    this.greetingBg = undefined;
    this.greetingTitle = undefined;
    this.greetingMsg = undefined;
    this.greetingClose = undefined;
    this.greetingBtn = undefined;
  }

  /**
   * Destroys all greeting screen elements
   */
  destroy(): void {
    this.clearGreeting();
  }
}

/**
 * Manages loading screen visual effects including snow and spinner
 */
class LoadingEffects extends HudElement {
  private snowTweens: Phaser.Tweens.Tween[] = [];
  private snowDots: Phaser.GameObjects.Rectangle[] = [];
  private loadingSpinnerGroup?: Phaser.GameObjects.Container;
  private loadingSpinnerTween?: Phaser.Tweens.Tween;
  private rotateOverlay?: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;

  /**
   * Shows animated snow effect for loading screens
   */
  showLoadingSnow(): void {
    const count = 60;

    const createSnowDot = () => {
      const x = Phaser.Math.Between(0, this.camera.width);
      const y = Phaser.Math.Between(-this.camera.height, 0);
      const size = Phaser.Math.Between(2, 4);

      const dot = this.scene.add.rectangle(x, y, size, size, 0xffffff, 0.9);
      dot.setDepth(999);

      const duration = Phaser.Math.Between(3500, 8000);
      const tween = this.scene.tweens.add({
        targets: dot,
        y: this.camera.height + 10,
        x: x + Phaser.Math.Between(-40, 40),
        duration,
        repeat: -1,
        onRepeat: () => {
          dot.y = -10;
          dot.x = Phaser.Math.Between(0, this.camera.width);
        },
      });

      this.snowDots.push(dot);
      this.snowTweens.push(tween);
    };

    for (let i = 0; i < count; i++) {
      createSnowDot();
    }
  }

  /**
   * Clears the loading snow effect
   */
  clearLoadingSnow(): void {
    this.snowTweens.forEach((tween) => tween.stop());
    this.snowTweens = [];
    this.snowDots.forEach((dot) => dot.destroy());
    this.snowDots = [];
  }

  /**
   * Shows a rotating wreath spinner for loading indication
   */
  showLoadingWreathSpinner(): void {
    const yBase = 80;

    const group = this.scene.add.container(this.camera.width / 2, yBase + 80);
    group.setDepth(1002);

    const graphics = this.scene.add.graphics();
    graphics.setDepth(1002);

    // Calculate responsive size
    const outerRadius = Phaser.Math.Clamp(
      Math.round(this.camera.width * 0.04),
      18,
      34
    );
    const innerRadius = Math.round(outerRadius * 0.6);
    const thickness = outerRadius - innerRadius;
    const radius = innerRadius + thickness / 2;

    // Draw wreath ring
    graphics.lineStyle(thickness, 0x1b7c36, 1);
    graphics.strokeCircle(0, 0, radius);
    group.add(graphics);

    // Add red berries around the wreath
    const berryCount = 6;
    for (let i = 0; i < berryCount; i++) {
      const angle = (i / berryCount) * Math.PI * 2;
      const wreathRadius = (outerRadius + innerRadius) / 2;
      const x = Math.cos(angle) * wreathRadius;
      const y = Math.sin(angle) * wreathRadius;

      const berry = this.scene.add.ellipse(x, y, 5, 5, 0xe24b4b, 1);
      berry.setDepth(1003);
      group.add(berry);
    }

    // Create rotation animation
    this.loadingSpinnerTween = this.scene.tweens.add({
      targets: group,
      angle: 360,
      duration: 2400,
      repeat: -1,
      ease: "Linear",
    });

    this.loadingSpinnerGroup = group;
  }

  /**
   * Repositions loading effects for the current camera size
   */
  layout(): void {
    if (this.loadingSpinnerGroup) {
      const yBase = 80;
      this.loadingSpinnerGroup.setPosition(this.camera.width / 2, yBase + 80);
    }
    if (this.rotateOverlay) {
      const bg = this.rotateOverlay.getAt(0) as Phaser.GameObjects.Rectangle;
      const text = this.rotateOverlay.getAt(1) as Phaser.GameObjects.Text;
      bg.setPosition(this.camera.width / 2, this.camera.height / 2);
      bg.setSize(this.camera.width, this.camera.height);
      text.setPosition(
        Math.round(this.camera.width / 2),
        Math.round(this.camera.height / 2)
      );
    }
  }

  /**
   * Clears the loading spinner
   */
  clearLoadingSpinner(): void {
    if (this.loadingSpinnerTween) {
      this.loadingSpinnerTween.stop();
      this.loadingSpinnerTween = undefined;
    }
    this.loadingSpinnerGroup?.destroy();
    this.loadingSpinnerGroup = undefined;
  }

  /**
   * Fades out the loading spinner with callback
   * @param onDone - Callback executed when fade out completes
   */
  fadeOutLoadingSpinner(onDone: () => void): void {
    if (!this.loadingSpinnerGroup) {
      onDone();
      return;
    }

    this.scene.tweens.add({
      targets: this.loadingSpinnerGroup,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.clearLoadingSpinner();
        onDone();
      },
    });
  }

  /**
   * Destroys all loading effect elements
   */
  destroy(): void {
    this.clearLoadingSnow();
    this.clearLoadingSpinner();
    this.hideRotateOverlay();
    this.hideLoadingText();
    this.hideStatusText();
  }

  /**
   * Shows a full-screen overlay instructing the user to rotate to portrait
   */
  showRotateOverlay(): void {
    if (this.rotateOverlay) return;
    
    // Enhanced background with better opacity for readability
    const bg = this.scene.add.rectangle(
      this.camera.width / 2,
      this.camera.height / 2,
      this.camera.width,
      this.camera.height,
      0x000000,
      0.85 // Increased opacity for better text contrast
    );
    bg.setDepth(5000);
    
    // Enhanced text with high contrast styling and responsive sizing
    // Inline text config for orientation message
    
    const text = this.scene.add
      .text(
        Math.round(this.camera.width / 2),
        Math.round(this.camera.height / 2),
        "Please rotate your device\nUse portrait mode",
        this.createHighContrastTextStyle("#ffffff", 0x000000)
      )
      .setOrigin(0.5)
      .setAlign('center');
    text.setDepth(5001);
    
    // Add subtle pulsing animation to draw attention
    this.scene.tweens.add({
      targets: text,
      alpha: 0.7,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    const group = this.scene.add.container(0, 0, [bg, text]);
    group.setDepth(5000);
    this.rotateOverlay = group;
  }

  /**
   * Hides the rotate overlay if present
   */
  hideRotateOverlay(): void {
    if (!this.rotateOverlay) return;
    this.rotateOverlay.destroy();
    this.rotateOverlay = undefined;
  }

  /**
   * Shows loading status text with enhanced readability
   * @param message - Loading message to display
   * @param position - Position for the text ('top' | 'center' | 'bottom')
   */
  showLoadingText(message: string, position: 'top' | 'center' | 'bottom' = 'center'): void {
    this.hideLoadingText(); // Clear any existing loading text

    let y: number;
    switch (position) {
      case 'top':
        y = this.camera.height * 0.2;
        break;
      case 'bottom':
        y = this.camera.height * 0.8;
        break;
      case 'center':
      default:
        y = this.camera.height / 2;
        break;
    }

    // Create loading text with high contrast and adaptive background
    // Text configuration for loading text (inlined below)

    this.loadingText = this.scene.add
      .text(
        this.camera.width / 2,
        y,
        message,
        this.createAccessibleTextStyle({
          baseSize: 18,
          contrastRatio: 'AA',
          backgroundType: 'semi-transparent',
          deviceScaling: true
        })
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setDepth(1001);

    // Add subtle pulsing animation for loading indication
    this.scene.tweens.add({
      targets: this.loadingText,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * Hides the loading text if present
   */
  hideLoadingText(): void {
    if (this.loadingText) {
      this.scene.tweens.killTweensOf(this.loadingText);
      this.loadingText.destroy();
      this.loadingText = undefined;
    }
  }

  /**
   * Shows status text with enhanced readability (for errors, warnings, etc.)
   * @param message - Status message to display
   * @param type - Type of status ('info' | 'warning' | 'error')
   * @param duration - Auto-hide duration in milliseconds (0 = no auto-hide)
   */
  showStatusText(
    message: string, 
    type: 'info' | 'warning' | 'error' = 'info',
    duration: number = 3000
  ): void {
    this.hideStatusText(); // Clear any existing status text

    // Determine colors based on status type
    let textColor: string;
    let backgroundColor: number;
    
    switch (type) {
      case 'error':
        textColor = '#ffffff';
        backgroundColor = 0xdc2626; // Red background
        break;
      case 'warning':
        textColor = '#000000';
        backgroundColor = 0xfbbf24; // Yellow background
        break;
      case 'info':
      default:
        textColor = '#ffffff';
        backgroundColor = 0x2563eb; // Blue background
        break;
    }

    // Create status text with high contrast
    // Status text configuration
    // const statusConfig: AccessibilityTextConfig = {
    //   baseSize: 16,
    //   contrastRatio: 'AAA',
    //   backgroundType: 'solid',
    //   deviceScaling: true
    // };

    this.statusText = this.scene.add
      .text(
        this.camera.width / 2,
        this.camera.height * 0.15, // Position near top
        message,
        this.createHighContrastTextStyle(textColor, backgroundColor)
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setDepth(2000); // Higher depth for status messages

    // Create background for status text
    const textBounds = this.statusText.getBounds();
    const padding = 16;
    const statusBg = this.scene.add.rectangle(
      this.statusText.x,
      this.statusText.y,
      textBounds.width + padding * 2,
      textBounds.height + padding,
      backgroundColor,
      0.95
    )
    .setDepth(1999);

    // Animate in
    const targets = [statusBg, this.statusText];
    targets.forEach(target => target.setAlpha(0));
    
    this.scene.tweens.add({
      targets,
      alpha: 1,
      duration: 200,
      ease: 'Power2.easeOut'
    });

    // Auto-hide if duration is specified
    if (duration > 0) {
      this.scene.time.delayedCall(duration, () => {
        this.scene.tweens.add({
          targets,
          alpha: 0,
          duration: 200,
          ease: 'Power2.easeIn',
          onComplete: () => {
            statusBg.destroy();
            this.hideStatusText();
          }
        });
      });
    }
  }

  /**
   * Hides the status text if present
   */
  hideStatusText(): void {
    if (this.statusText) {
      this.scene.tweens.killTweensOf(this.statusText);
      this.statusText.destroy();
      this.statusText = undefined;
    }
  }
}

/**
 * Main HUD (Heads-Up Display) manager for the KnutGame.
 *
 * This class orchestrates various UI components including:
 * - Real-time game statistics (lives, timer, score, multiplier)
 * - Game over screens with restart functionality
 * - Welcome/greeting screens
 * - Loading screen effects
 * - Interactive documentation access
 *
 * The HUD follows SOLID principles with separated concerns:
 * - Single Responsibility: Each component handles one UI aspect
 * - Open/Closed: New UI features can be added without modifying existing code
 * - Liskov Substitution: All components implement consistent interfaces
 * - Interface Segregation: Focused interfaces for specific UI needs
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 *
 * @example
 * ```typescript
 * // Create HUD instance
 * const hud = new Hud(scene)
 *
 * // Update game statistics
 * hud.setLives(3)
 * hud.setScore(1250)
 * hud.setTimer(45.2)
 *
 * // Show game over screen
 * const { restartButton } = hud.showGameOver()
 * restartButton.on('pointerdown', () => game.restart())
 *
 * // Show loading effects
 * hud.showLoadingSnow()
 * hud.showLoadingWreathSpinner()
 * ```
 */
export class Hud {
  private readonly display: HudDisplay;
  private readonly gameOverScreen: GameOverScreen;
  private readonly greetingScreen: GreetingScreen;
  private readonly loadingEffects: LoadingEffects;

  /**
   * Creates a new HUD instance with all UI components
   * @param scene - The Phaser scene this HUD belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.display = new HudDisplay(scene);
    this.gameOverScreen = new GameOverScreen(scene);
    this.greetingScreen = new GreetingScreen(scene);
    this.loadingEffects = new LoadingEffects(scene);
  }

  /**
   * Relayout all HUD components when the viewport size changes
   */
  layout(): void {
    (this.display as any).layout?.();
    (this.gameOverScreen as any).layout?.();
    (this.greetingScreen as any).layout?.();
    (this.loadingEffects as any).layout?.();
  }

  // Orientation overlay passthrough
  showRotateOverlay(): void {
    this.loadingEffects.showRotateOverlay();
  }
  hideRotateOverlay(): void {
    this.loadingEffects.hideRotateOverlay();
  }

  // Loading and status text passthrough methods
  showLoadingText(message: string, position: 'top' | 'center' | 'bottom' = 'center'): void {
    this.loadingEffects.showLoadingText(message, position);
  }
  hideLoadingText(): void {
    this.loadingEffects.hideLoadingText();
  }
  showStatusText(message: string, type: 'info' | 'warning' | 'error' = 'info', duration: number = 3000): void {
    this.loadingEffects.showStatusText(message, type, duration);
  }
  hideStatusText(): void {
    this.loadingEffects.hideStatusText();
  }

  // --- Display Methods (Delegated to HudDisplay) ---

  /**
   * Updates the lives display
   * @param lives - Number of lives remaining
   */
  setLives(lives: number): void {
    this.display.setLives(lives);
  }

  /**
   * Updates the timer display
   * @param seconds - Time elapsed in seconds
   */
  setTimer(seconds: number): void {
    this.display.setTimer(seconds);
  }

  /**
   * Updates the score display
   * @param score - Current score value
   */
  setScore(score: number): void {
    this.display.setScore(score);
  }

  /**
   * Updates the multiplier display
   * @param multiplier - Current multiplier value
   */
  setMultiplier(multiplier: number): void {
    this.display.setMultiplier(multiplier);
  }

  /**
   * Updates the best score display
   * @param best - Best score achieved
   */
  setBest(best: number): void {
    this.display.setBest(best);
  }

  /**
   * Shows or hides the shield status indicator
   * @param active - Whether shield is active
   * @param secondsRemaining - Time remaining on shield effect
   */
  setShield(active: boolean, secondsRemaining?: number): void {
    this.display.setShield(active, secondsRemaining);
  }

  /**
   * Creates a pulsing animation on the score text
   */
  pulseScore(): void {
    this.display.pulseScore();
  }

  /**
   * Creates a pulsing animation on the multiplier text
   */
  pulseMultiplier(): void {
    this.display.pulseMultiplier();
  }

  /**
   * Creates a pulsing animation on the lives text
   */
  pulseLives(): void {
    this.display.pulseLives();
  }

  // --- Game Over Screen Methods (Delegated to GameOverScreen) ---

  /**
   * Shows the game over screen with restart button
   * @returns Object containing the restart button for event handling
   */
  showGameOver(): { restartButton: Phaser.GameObjects.Text } {
    return this.gameOverScreen.showGameOver();
  }

  /**
   * Shows a game over message card
   * @param title - Message title
   * @param message - Message content
   */
  showGameOverMessage(title: string, message: string): void {
    this.gameOverScreen.showGameOverMessage(title, message);
  }

  /**
   * Clears all game over screen elements
   */
  clearGameOver(): void {
    this.gameOverScreen.clearGameOver();
  }

  // --- Greeting Screen Methods (Delegated to GreetingScreen) ---

  /**
   * Shows a greeting screen with title, message, and action buttons
   * @param title - Greeting title
   * @param message - Greeting message
   * @param onClose - Callback when greeting is closed
   */
  showGreeting(title: string, message: string, onClose?: () => void): void {
    this.greetingScreen.showGreeting(title, message, onClose);
  }

  /**
   * Clears all greeting screen elements
   */
  clearGreeting(): void {
    this.greetingScreen.clearGreeting();
  }

  // --- Loading Effects Methods (Delegated to LoadingEffects) ---

  /**
   * Shows animated snow effect for loading screens
   */
  showLoadingSnow(): void {
    this.loadingEffects.showLoadingSnow();
  }

  /**
   * Clears the loading snow effect
   */
  clearLoadingSnow(): void {
    this.loadingEffects.clearLoadingSnow();
  }

  /**
   * Shows a rotating wreath spinner for loading indication
   */
  showLoadingWreathSpinner(): void {
    this.loadingEffects.showLoadingWreathSpinner();
  }

  /**
   * Clears the loading spinner
   */
  clearLoadingSpinner(): void {
    this.loadingEffects.clearLoadingSpinner();
  }

  /**
   * Fades out the loading spinner with callback
   * @param onDone - Callback executed when fade out completes
   */
  fadeOutLoadingSpinner(onDone: () => void): void {
    this.loadingEffects.fadeOutLoadingSpinner(onDone);
  }

  /**
   * Destroys all HUD components and cleans up resources
   */
  destroy(): void {
    this.display.destroy();
    this.gameOverScreen.destroy();
    this.greetingScreen.destroy();
    this.loadingEffects.destroy();
  }
}
export {
  HudElement,
  HudDisplay,
  GreetingScreen,
  LoadingEffects,
  AdaptiveBackgroundRenderer,
  type BackgroundConfig,
  type BackgroundAnalysis,
  type BackgroundRenderOptions,
};

// Export the new AccessibleMessageBox
export { AccessibleMessageBox, type MessageBoxConfig } from './AccessibleMessageBox';
