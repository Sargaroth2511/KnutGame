import Phaser from 'phaser'

/**
 * Configuration options for the skyscraper background renderer.
 * Defines colors, dimensions, and layout parameters for all background elements.
 */
interface BackgroundConfig {
  /** Color of the building facade */
  facadeColor: number;
  /** Height of the street/asphalt area in pixels */
  streetHeight: number;
  /** Height of the ground floor in pixels */
  groundFloorHeight: number;
  /** Horizontal margin from canvas edges in pixels */
  horizontalMargin: number;
  /** Vertical margin from canvas edges in pixels */
  verticalMargin: number;
  /** Width of each window in pixels */
  windowWidth: number;
  /** Height of each window in pixels */
  windowHeight: number;
  /** Number of window rows (floors) */
  windowRows: number;
  /** Number of window columns per row */
  windowColumns: number;
  /** Vertical offset to lift windows from ground floor in pixels */
  windowLift: number;
  /** Gap between bottom windows and street in pixels */
  bottomWindowGap: number;
  /** Array of colors for lit windows */
  litWindowColors: number[];
  /** Array of colors for dim/unlit windows */
  dimWindowColors: number[];
  /** Color of window frames */
  windowFrameColor: number;
  /** Color of window mullions (dividers) */
  windowMullionColor: number;
  /** Width of the door in pixels */
  doorWidth: number;
  /** Height of the door in pixels (calculated if 0) */
  doorHeight: number;
  /** Color of door frame */
  doorFrameColor: number;
  /** Color of door panel */
  doorPanelColor: number;
  /** Color of door details/accents */
  doorDetailColor: number;
  /** Color of the curb */
  curbColor: number;
  /** Color of the asphalt/street surface */
  asphaltColor: number;
  /** Color of lane markings */
  laneMarkingColor: number;
  /** Width of each lane marking dash in pixels */
  dashWidth: number;
  /** Gap between lane marking dashes in pixels */
  dashGap: number;
}

/**
 * Default configuration values for the background renderer.
 * Provides sensible defaults for all background elements.
 */
const defaultConfig: BackgroundConfig = {
  facadeColor: 0x1b1f2a,
  streetHeight: 90,
  groundFloorHeight: 140,
  horizontalMargin: 64,
  verticalMargin: 48,
  windowWidth: 86,
  windowHeight: 120,
  windowRows: 4,
  windowColumns: 3,
  windowLift: 24,
  bottomWindowGap: 40,
  litWindowColors: [0xffe8a3, 0xffd982, 0xfff0b8],
  dimWindowColors: [0x243046, 0x2a354d, 0x222b3f],
  windowFrameColor: 0x101521,
  windowMullionColor: 0x0e1320,
  doorWidth: 120,
  doorHeight: 0, // Will be calculated
  doorFrameColor: 0x0f131e,
  doorPanelColor: 0x3a2f28,
  doorDetailColor: 0x261d18,
  curbColor: 0x11151f,
  asphaltColor: 0x2b2b2f,
  laneMarkingColor: 0xf0f2f5,
  dashWidth: 48,
  dashGap: 28,
};

/**
 * Renderer for creating procedural skyscraper backgrounds.
 * Generates building facades with windows, doors, and street elements using configurable parameters.
 */
export class BackgroundRenderer {
  private config: BackgroundConfig;

  /**
   * Creates a new BackgroundRenderer instance
   * @param config - Optional configuration overrides for default settings
   */
  constructor(config: Partial<BackgroundConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Draws a complete skyscraper background on the provided Phaser scene.
   * Renders facade, windows, door, and street elements in proper layering order.
   * @param scene - The Phaser scene to draw the background on
   */
  drawSkyscraperBackground(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const canvasWidth = scene.cameras.main.width;
    const canvasHeight = scene.cameras.main.height;

    const cfg = this.getEffectiveConfig(canvasWidth);

    const graphics = scene.add.graphics();
    graphics.setDepth(-1000);

    this.drawFacade(graphics, canvasWidth, canvasHeight, cfg);
    this.drawWindows(graphics, canvasWidth, canvasHeight, cfg);
    this.drawDoor(graphics, canvasWidth, canvasHeight, cfg);
    this.drawStreet(graphics, canvasWidth, canvasHeight, cfg);
    return graphics;
  }

  /**
   * Compute a responsive config based on canvas size to avoid overlaps on small screens.
   */
  private getEffectiveConfig(canvasWidth: number): BackgroundConfig {
    // Base against 640px width and clamp the scale between 0.55 and 1.0
    const scale = Math.max(0.55, Math.min(1.0, canvasWidth / 640));
    // Scale core dimensions
    let horizontalMargin = Math.round(this.config.horizontalMargin * scale);
    const verticalMargin = Math.round(this.config.verticalMargin * scale);
    const streetHeight = Math.max(60, Math.round(this.config.streetHeight * scale));
    const groundFloorHeight = Math.max(90, Math.round(this.config.groundFloorHeight * scale));
    let windowWidth = Math.max(48, Math.round(this.config.windowWidth * scale));
    const windowHeight = Math.max(72, Math.round(this.config.windowHeight * scale));
    let windowColumns = this.config.windowColumns;
    const doorWidth = Math.max(80, Math.round(this.config.doorWidth * scale));
    const dashWidth = Math.max(28, Math.round(this.config.dashWidth * scale));
    const dashGap = Math.max(16, Math.round(this.config.dashGap * scale));

    // Ensure columns fit without overlap. Reduce columns to 2 if needed.
    const usableWidth = Math.max(1, canvasWidth - horizontalMargin * 2);
    if (windowColumns > 1) {
      const separation = usableWidth / (windowColumns - 1);
      if (windowWidth > separation * 0.9) {
        // Try shrinking width a bit more before dropping columns
        windowWidth = Math.floor(separation * 0.85);
      }
      if (windowWidth > separation * 0.95 && windowColumns >= 3) {
        windowColumns = 2;
        // Recompute with two columns
        const separation2 = usableWidth / (windowColumns - 1);
        windowWidth = Math.floor(Math.min(windowWidth, separation2 * 0.8));
      }
    }

    // If margins are too large relative to width, reduce them to keep content centered
    if (horizontalMargin * 2 + windowWidth > canvasWidth) {
      horizontalMargin = Math.max(12, Math.floor((canvasWidth - windowWidth) / 4));
    }

    return {
      ...this.config,
      horizontalMargin,
      verticalMargin,
      streetHeight,
      groundFloorHeight,
      windowWidth,
      windowHeight,
      windowColumns,
      doorWidth,
      dashWidth,
      dashGap,
    };
  }

  /**
   * Draws the building facade background
   * @param graphics - Phaser graphics object to draw with
   * @param canvasWidth - Width of the canvas
   * @param canvasHeight - Height of the canvas
   */
  private drawFacade(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number, cfg: BackgroundConfig): void {
    graphics.fillStyle(cfg.facadeColor, 1);
    graphics.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /**
   * Draws all windows in a grid pattern across the building facade
   * @param graphics - Phaser graphics object to draw with
   * @param canvasWidth - Width of the canvas
   * @param canvasHeight - Height of the canvas
   */
  private drawWindows(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number, cfg: BackgroundConfig): void {
    const usableWidth = Math.max(1, canvasWidth - cfg.horizontalMargin * 2);
    const windowsTopY = Math.max(cfg.verticalMargin, cfg.verticalMargin + cfg.groundFloorHeight - cfg.windowLift);
    const windowsBottomY = canvasHeight - cfg.streetHeight - cfg.verticalMargin - cfg.bottomWindowGap;
    const windowsUsableHeight = Math.max(1, windowsBottomY - windowsTopY);

    for (let rowIndex = 0; rowIndex < cfg.windowRows; rowIndex++) {
      const centerY = windowsTopY + (rowIndex / Math.max(1, (cfg.windowRows - 1))) * windowsUsableHeight;
      const windowY = Math.round(centerY - cfg.windowHeight / 2);

      for (let columnIndex = 0; columnIndex < cfg.windowColumns; columnIndex++) {
        let centerX = cfg.horizontalMargin + (columnIndex / Math.max(1, (cfg.windowColumns - 1))) * usableWidth;
        const horizontalShift = canvasWidth * 0.05;
        if (columnIndex === 0) centerX = Math.min(centerX + horizontalShift, canvasWidth - cfg.horizontalMargin - cfg.windowWidth / 2);
        if (columnIndex === cfg.windowColumns - 1) centerX = Math.max(centerX - horizontalShift, cfg.horizontalMargin + cfg.windowWidth / 2);

        const windowX = Math.round(centerX - cfg.windowWidth / 2);

        // Skip the bottom-row middle window (behind the door)
        if (rowIndex === cfg.windowRows - 1 && columnIndex === Math.floor(cfg.windowColumns / 2)) {
          continue;
        }

        this.drawWindow(graphics, windowX, windowY, rowIndex, cfg);
      }
    }
  }

  /**
   * Draws a single window with frame, pane, and mullions
   * @param graphics - Phaser graphics object to draw with
   * @param windowX - X position of the window
   * @param windowY - Y position of the window
   * @param rowIndex - Row index (used for lighting probability calculation)
   */
  private drawWindow(graphics: Phaser.GameObjects.Graphics, windowX: number, windowY: number, rowIndex: number, cfg: BackgroundConfig): void {
    // Probability a window is lit (more at top floors)
    const lightingProbability = 0.3 + 0.5 * (1 - rowIndex / Math.max(1, (cfg.windowRows - 1)));
    const isLit = Math.random() < lightingProbability;
    const availableColors = isLit ? cfg.litWindowColors : cfg.dimWindowColors;
    const selectedColor = availableColors[Math.floor(Math.random() * availableColors.length)];

    // Frame
    graphics.fillStyle(cfg.windowFrameColor, 1);
    graphics.fillRect(windowX - 3, windowY - 3, cfg.windowWidth + 6, cfg.windowHeight + 6);

    // Pane
    graphics.fillStyle(selectedColor, 1);
    graphics.fillRect(windowX, windowY, cfg.windowWidth, cfg.windowHeight);

    // Mullions
    graphics.fillStyle(cfg.windowMullionColor, 0.35);
    graphics.fillRect(windowX + cfg.windowWidth / 2 - 2, windowY + 6, 4, cfg.windowHeight - 12);
    graphics.fillRect(windowX + 6, windowY + cfg.windowHeight / 2 - 2, cfg.windowWidth - 12, 4);
  }

  /**
   * Draws the building entrance door
   * @param graphics - Phaser graphics object to draw with
   * @param canvasWidth - Width of the canvas
   * @param canvasHeight - Height of the canvas
   */
  private drawDoor(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number, cfg: BackgroundConfig): void {
    const calculatedDoorHeight = cfg.groundFloorHeight - 16;
    const doorX = Math.round(canvasWidth / 2 - cfg.doorWidth / 2);
    const doorY = Math.round(canvasHeight - cfg.streetHeight - calculatedDoorHeight);

    // Door frame
    graphics.fillStyle(cfg.doorFrameColor, 1);
    graphics.fillRect(doorX - 6, doorY - 6, cfg.doorWidth + 12, calculatedDoorHeight + 12);

    // Door panel
    graphics.fillStyle(cfg.doorPanelColor, 1);
    graphics.fillRect(doorX, doorY, cfg.doorWidth, calculatedDoorHeight);

    // Door details: vertical split
    graphics.fillStyle(cfg.doorDetailColor, 0.6);
    graphics.fillRect(doorX + cfg.doorWidth / 2 - 2, doorY + 8, 4, calculatedDoorHeight - 16);
  }

  /**
   * Draws the street with curb, asphalt, and lane markings
   * @param graphics - Phaser graphics object to draw with
   * @param canvasWidth - Width of the canvas
   * @param canvasHeight - Height of the canvas
   */
  private drawStreet(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number, cfg: BackgroundConfig): void {
    const streetY = canvasHeight - cfg.streetHeight;

    // Curb line
    graphics.fillStyle(cfg.curbColor, 1);
    graphics.fillRect(0, streetY - 4, canvasWidth, 4);

    // Asphalt
    graphics.fillStyle(cfg.asphaltColor, 1);
    graphics.fillRect(0, streetY, canvasWidth, cfg.streetHeight);

    // Lane markings (dashed)
    graphics.fillStyle(cfg.laneMarkingColor, 0.4);
    const laneCenterY = streetY + Math.floor(cfg.streetHeight / 2) - 2;
    for (let dashPosition = 0; dashPosition < canvasWidth; dashPosition += cfg.dashWidth + cfg.dashGap) {
      graphics.fillRect(dashPosition, laneCenterY, cfg.dashWidth, 4);
    }
  }
}

// For backward compatibility
/**
 * Draws a skyscraper background (legacy function for backward compatibility)
 * @deprecated Use BackgroundRenderer.drawSkyscraperBackground() instead for better control
 * @param scene - The Phaser scene to draw the background on
 */
export function drawSkyscraperBackground(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const renderer = new BackgroundRenderer();
  return renderer.drawSkyscraperBackground(scene);
}
