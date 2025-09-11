import Phaser from 'phaser'

/**
 * Base class for HUD elements providing common functionality
 * and consistent styling across all UI components.
 */
abstract class HudElement {
  protected readonly scene: Phaser.Scene
  protected readonly camera: Phaser.Cameras.Scene2D.Camera

  /**
   * Creates a new HUD element
   * @param scene - The Phaser scene this element belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.camera = scene.cameras.main
  }

  /**
   * Creates a standardized text style configuration
   * @param color - Text color as hex string
   * @param fontSize - Font size (defaults to 16px)
   * @returns Phaser text style configuration
   */
  protected createTextStyle(color: string, fontSize: string = '16px'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize,
      color,
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    }
  }

  /**
   * Creates a pulsing animation effect for UI feedback
   * @param target - The Phaser object to animate
   * @param scale - Scale multiplier for the pulse (defaults to 1.1)
   * @param duration - Animation duration in milliseconds (defaults to 120)
   */
  protected createPulseEffect(target: Phaser.GameObjects.GameObject, scale: number = 1.1, duration: number = 120): void {
    this.scene.tweens.add({
      targets: target,
      scale,
      duration,
      yoyo: true,
      ease: 'Quad.easeOut'
    })
  }

  /**
   * Abstract method to be implemented by subclasses for cleanup
   */
  abstract destroy(): void
}

/**
 * Manages the main HUD display elements including lives, timer, score, and multiplier
 */
class HudDisplay extends HudElement {
  private readonly livesText: Phaser.GameObjects.Text
  private readonly timerText: Phaser.GameObjects.Text
  private readonly scoreText: Phaser.GameObjects.Text
  private readonly multiplierText: Phaser.GameObjects.Text
  private readonly bestText: Phaser.GameObjects.Text
  private shieldText?: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    super(scene)

    // Create HUD text elements with proper positioning and depth
    this.livesText = this.scene.add.text(10, 40, 'Lives: ', this.createTextStyle('#ff0000'))
    this.livesText.setDepth(1000)

    this.timerText = this.scene.add.text(10, 70, 'Time: 0.0s', this.createTextStyle('#ffffff'))
    this.timerText.setDepth(1000)

    this.scoreText = this.scene.add.text(this.camera.width - 10, 10, 'Score: 0', this.createTextStyle('#ffff00'))
    this.scoreText.setOrigin(1, 0)
    this.scoreText.setDepth(1000)

    this.multiplierText = this.scene.add.text(this.camera.width - 10, 40, '', this.createTextStyle('#ff8800'))
    this.multiplierText.setOrigin(1, 0)
    this.multiplierText.setDepth(1000)

    this.bestText = this.scene.add.text(this.camera.width - 10, 70, 'Best: 0', this.createTextStyle('#ffffff'))
    this.bestText.setOrigin(1, 0)
    this.bestText.setDepth(1000)
  }

  /**
   * Updates the lives display with heart symbols
   * @param lives - Number of lives remaining
   */
  setLives(lives: number): void {
    this.livesText.setText(`Lives: ${'♥'.repeat(lives)}`)
  }

  /**
   * Updates the timer display
   * @param seconds - Time elapsed in seconds
   */
  setTimer(seconds: number): void {
    this.timerText.setText(`Time: ${seconds.toFixed(1)}s`)
  }

  /**
   * Updates the score display
   * @param score - Current score value
   */
  setScore(score: number): void {
    this.scoreText.setText(`Score: ${score}`)
  }

  /**
   * Updates the multiplier display
   * @param multiplier - Current multiplier value
   */
  setMultiplier(multiplier: number): void {
    if (multiplier > 1) {
      this.multiplierText.setText(`x${multiplier}`)
    } else {
      this.multiplierText.setText('')
    }
  }

  /**
   * Updates the best score display
   * @param best - Best score achieved
   */
  setBest(best: number): void {
    this.bestText.setText(`Best: ${best}`)
  }

  /**
   * Shows or hides the shield status indicator
   * @param active - Whether shield is active
   * @param secondsRemaining - Time remaining on shield effect
   */
  setShield(active: boolean, secondsRemaining?: number): void {
    if (active) {
      if (!this.shieldText) {
        this.shieldText = this.scene.add.text(this.camera.width - 10, 100, '', this.createTextStyle('#00ffff'))
          .setOrigin(1, 0)
          .setDepth(1000)
      }
      const timeString = Math.max(0, (secondsRemaining ?? 0)).toFixed(1)
      this.shieldText.setText(`Shield: ${timeString}s`)
      this.shieldText.setVisible(true)
    } else if (this.shieldText) {
      this.shieldText.setVisible(false)
    }
  }

  /**
   * Creates a pulsing animation on the score text
   */
  pulseScore(): void {
    this.createPulseEffect(this.scoreText, 1.1, 120)
  }

  /**
   * Creates a pulsing animation on the multiplier text
   */
  pulseMultiplier(): void {
    if (this.multiplierText.text) {
      this.createPulseEffect(this.multiplierText, 1.15, 140)
    }
  }

  /**
   * Creates a pulsing animation on the lives text
   */
  pulseLives(): void {
    this.createPulseEffect(this.livesText, 1.12, 120)
  }

  /**
   * Destroys all HUD display elements
   */
  destroy(): void {
    this.livesText.destroy()
    this.timerText.destroy()
    this.scoreText.destroy()
    this.multiplierText.destroy()
    this.bestText.destroy()
    this.shieldText?.destroy()
  }
}

/**
 * Manages game over screen UI elements and interactions
 */
class GameOverScreen extends HudElement {
  private gameOverText?: Phaser.GameObjects.Text
  private restartButton?: Phaser.GameObjects.Text
  private gameOverMsgTitle?: Phaser.GameObjects.Text
  private gameOverMsgText?: Phaser.GameObjects.Text
  private gameOverMsgBg?: Phaser.GameObjects.Rectangle

  /**
   * Shows the game over screen with restart and documentation buttons
   * @returns Object containing the restart and docs buttons for event handling
   */
  showGameOver(): { restartButton: Phaser.GameObjects.Text, docsButton: Phaser.GameObjects.Text } {
    // Main game over text
    this.gameOverText = this.scene.add.text(
      this.camera.width / 2,
      this.camera.height / 2 - 50,
      'GAME OVER',
      {
        fontSize: '48px',
        color: '#ff0000',
        fontFamily: 'Arial, sans-serif',
        resolution: 2,
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(1000)

    // Restart button
    this.restartButton = this.scene.add.text(
      this.camera.width / 2,
      this.camera.height / 2 + 30,
      'Click to Restart',
      this.createTextStyle('#ffffff')
    ).setOrigin(0.5).setDepth(1000).setInteractive()

    // Documentation button
    const docsButton = this.scene.add.text(
      this.camera.width / 2,
      this.camera.height / 2 + 70,
      '📚 View Documentation',
      {
        fontSize: '18px',
        color: '#3498db',
        fontFamily: 'Arial, sans-serif',
        resolution: 2,
        stroke: '#ffffff',
        strokeThickness: 2
      }
    ).setOrigin(0.5).setDepth(1000).setInteractive()

    // Add hover effects for documentation button
    docsButton.on('pointerover', () => {
      docsButton.setColor('#2980b9')
      docsButton.setScale(1.05)
    })
    docsButton.on('pointerout', () => {
      docsButton.setColor('#3498db')
      docsButton.setScale(1.0)
    })
    docsButton.on('pointerdown', () => {
      window.open('/developer_guide.html', '_blank')
    })

    return { restartButton: this.restartButton, docsButton }
  }

  /**
   * Shows a game over message card with title and description
   * @param title - Message title
   * @param message - Message content
   */
  showGameOverMessage(title: string, message: string): void {
    const padding = 16
    const width = Math.min(520, this.camera.width - 40)
    const yBase = this.camera.height / 2 + 90
    const cardY = yBase + 60

    // Background card
    this.gameOverMsgBg = this.scene.add.rectangle(
      this.camera.width / 2,
      cardY,
      width,
      120,
      0xffffff,
      0.92
    ).setStrokeStyle(2, 0x222222).setDepth(1000)

    // Title text
    this.gameOverMsgTitle = this.scene.add.text(
      this.camera.width / 2,
      yBase + 20,
      title,
      {
        fontSize: '20px',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        resolution: 2
      }
    ).setOrigin(0.5, 0).setDepth(1001)

    // Message text with word wrapping
    this.gameOverMsgText = this.scene.add.text(
      this.camera.width / 2,
      yBase + 48,
      message,
      {
        fontSize: '16px',
        color: '#333333',
        fontFamily: 'Arial, sans-serif',
        wordWrap: { width: width - padding * 2 },
        resolution: 2
      }
    ).setOrigin(0.5, 0).setDepth(1001)

    // Fade in animation
    this.gameOverMsgBg.setAlpha(0)
    this.gameOverMsgTitle.setAlpha(0)
    this.gameOverMsgText.setAlpha(0)
    this.scene.tweens.add({
      targets: [this.gameOverMsgBg, this.gameOverMsgTitle, this.gameOverMsgText],
      alpha: 1,
      duration: 180
    })
  }

  /**
   * Clears all game over screen elements
   */
  clearGameOver(): void {
    this.gameOverText?.destroy()
    this.restartButton?.destroy()
    this.gameOverMsgTitle?.destroy()
    this.gameOverMsgText?.destroy()
    this.gameOverMsgBg?.destroy()

    this.gameOverText = undefined
    this.restartButton = undefined
    this.gameOverMsgTitle = undefined
    this.gameOverMsgText = undefined
    this.gameOverMsgBg = undefined
  }

  /**
   * Destroys all game over screen elements
   */
  destroy(): void {
    this.clearGameOver()
  }
}

/**
 * Manages greeting/welcome screen UI elements
 */
class GreetingScreen extends HudElement {
  private greetingBg?: Phaser.GameObjects.Rectangle
  private greetingTitle?: Phaser.GameObjects.Text
  private greetingMsg?: Phaser.GameObjects.Text
  private greetingClose?: Phaser.GameObjects.Text

  /**
   * Shows a greeting screen with title, message, and action buttons
   * @param title - Greeting title
   * @param message - Greeting message
   * @param onClose - Callback when greeting is closed
   */
  showGreeting(title: string, message: string, onClose?: () => void): void {
    const padding = 16
    const width = Math.min(520, this.camera.width - 40)
    const x = this.camera.width / 2 - width / 2
    const y = 80

    // Background card
    this.greetingBg = this.scene.add.rectangle(
      x + width / 2,
      y + 80,
      width,
      180,
      0xffffff,
      0.92
    ).setStrokeStyle(2, 0x222222).setDepth(1000)

    // Title text
    this.greetingTitle = this.scene.add.text(
      x + width / 2,
      y + 20,
      title,
      {
        fontSize: '20px',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        resolution: 2
      }
    ).setOrigin(0.5, 0).setDepth(1001)

    // Message text with word wrapping
    this.greetingMsg = this.scene.add.text(
      this.camera.width / 2,
      y + 50,
      message,
      {
        fontSize: '16px',
        color: '#333333',
        fontFamily: 'Arial, sans-serif',
        wordWrap: { width: width - padding * 2 },
        resolution: 2
      }
    ).setOrigin(0.5, 0).setDepth(1001)

    // Start game button
    this.greetingClose = this.scene.add.text(
      this.camera.width / 2 - 80,
      y + 120,
      'Start Game',
      {
        fontSize: '14px',
        color: '#2563eb',
        fontFamily: 'Arial, sans-serif',
        resolution: 2
      }
    ).setOrigin(0.5, 0).setDepth(1001).setInteractive()

    // Documentation button
    const docsButton = this.scene.add.text(
      this.camera.width / 2 + 80,
      y + 120,
      '📚 Docs',
      {
        fontSize: '14px',
        color: '#059669',
        fontFamily: 'Arial, sans-serif',
        resolution: 2
      }
    ).setOrigin(0.5, 0).setDepth(1001).setInteractive()

    // Event handlers
    this.greetingClose.on('pointerdown', () => {
      this.clearGreeting()
      onClose?.()
    })

    // Documentation button interactions
    docsButton.on('pointerover', () => docsButton.setColor('#047857'))
    docsButton.on('pointerout', () => docsButton.setColor('#059669'))
    docsButton.on('pointerdown', () => {
      window.open('/developer_guide.html', '_blank')
    })

    // Fade in animation
    this.greetingBg.setAlpha(0)
    this.greetingTitle.setAlpha(0)
    this.greetingMsg.setAlpha(0)
    this.greetingClose.setAlpha(0)
    docsButton.setAlpha(0)

    this.scene.tweens.add({
      targets: [this.greetingBg, this.greetingTitle, this.greetingMsg, this.greetingClose, docsButton],
      alpha: 1,
      duration: 180
    })
  }

  /**
   * Clears all greeting screen elements
   */
  clearGreeting(): void {
    this.greetingBg?.destroy()
    this.greetingTitle?.destroy()
    this.greetingMsg?.destroy()
    this.greetingClose?.destroy()

    this.greetingBg = undefined
    this.greetingTitle = undefined
    this.greetingMsg = undefined
    this.greetingClose = undefined
  }

  /**
   * Destroys all greeting screen elements
   */
  destroy(): void {
    this.clearGreeting()
  }
}

/**
 * Manages loading screen visual effects including snow and spinner
 */
class LoadingEffects extends HudElement {
  private snowTweens: Phaser.Tweens.Tween[] = []
  private snowDots: Phaser.GameObjects.Rectangle[] = []
  private loadingSpinnerGroup?: Phaser.GameObjects.Container
  private loadingSpinnerTween?: Phaser.Tweens.Tween

  /**
   * Shows animated snow effect for loading screens
   */
  showLoadingSnow(): void {
    const count = 60

    const createSnowDot = () => {
      const x = Phaser.Math.Between(0, this.camera.width)
      const y = Phaser.Math.Between(-this.camera.height, 0)
      const size = Phaser.Math.Between(2, 4)

      const dot = this.scene.add.rectangle(x, y, size, size, 0xffffff, 0.9)
      dot.setDepth(999)

      const duration = Phaser.Math.Between(3500, 8000)
      const tween = this.scene.tweens.add({
        targets: dot,
        y: this.camera.height + 10,
        x: x + Phaser.Math.Between(-40, 40),
        duration,
        repeat: -1,
        onRepeat: () => {
          dot.y = -10
          dot.x = Phaser.Math.Between(0, this.camera.width)
        }
      })

      this.snowDots.push(dot)
      this.snowTweens.push(tween)
    }

    for (let i = 0; i < count; i++) {
      createSnowDot()
    }
  }

  /**
   * Clears the loading snow effect
   */
  clearLoadingSnow(): void {
    this.snowTweens.forEach(tween => tween.stop())
    this.snowTweens = []
    this.snowDots.forEach(dot => dot.destroy())
    this.snowDots = []
  }

  /**
   * Shows a rotating wreath spinner for loading indication
   */
  showLoadingWreathSpinner(): void {
    const yBase = 80

    const group = this.scene.add.container(this.camera.width / 2, yBase + 80)
    group.setDepth(1002)

    const graphics = this.scene.add.graphics()
    graphics.setDepth(1002)

    // Calculate responsive size
    const outerRadius = Phaser.Math.Clamp(Math.round(this.camera.width * 0.04), 18, 34)
    const innerRadius = Math.round(outerRadius * 0.6)
    const thickness = outerRadius - innerRadius
    const radius = innerRadius + thickness / 2

    // Draw wreath ring
    graphics.lineStyle(thickness, 0x1b7c36, 1)
    graphics.strokeCircle(0, 0, radius)
    group.add(graphics)

    // Add red berries around the wreath
    const berryCount = 6
    for (let i = 0; i < berryCount; i++) {
      const angle = (i / berryCount) * Math.PI * 2
      const wreathRadius = (outerRadius + innerRadius) / 2
      const x = Math.cos(angle) * wreathRadius
      const y = Math.sin(angle) * wreathRadius

      const berry = this.scene.add.ellipse(x, y, 5, 5, 0xe24b4b, 1)
      berry.setDepth(1003)
      group.add(berry)
    }

    // Create rotation animation
    this.loadingSpinnerTween = this.scene.tweens.add({
      targets: group,
      angle: 360,
      duration: 2400,
      repeat: -1,
      ease: 'Linear'
    })

    this.loadingSpinnerGroup = group
  }

  /**
   * Clears the loading spinner
   */
  clearLoadingSpinner(): void {
    if (this.loadingSpinnerTween) {
      this.loadingSpinnerTween.stop()
      this.loadingSpinnerTween = undefined
    }
    this.loadingSpinnerGroup?.destroy()
    this.loadingSpinnerGroup = undefined
  }

  /**
   * Fades out the loading spinner with callback
   * @param onDone - Callback executed when fade out completes
   */
  fadeOutLoadingSpinner(onDone: () => void): void {
    if (!this.loadingSpinnerGroup) {
      onDone()
      return
    }

    this.scene.tweens.add({
      targets: this.loadingSpinnerGroup,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.clearLoadingSpinner()
        onDone()
      }
    })
  }

  /**
   * Destroys all loading effect elements
   */
  destroy(): void {
    this.clearLoadingSnow()
    this.clearLoadingSpinner()
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
 * const { restartButton, docsButton } = hud.showGameOver()
 * restartButton.on('pointerdown', () => game.restart())
 *
 * // Show loading effects
 * hud.showLoadingSnow()
 * hud.showLoadingWreathSpinner()
 * ```
 */
export class Hud {
  private readonly display: HudDisplay
  private readonly gameOverScreen: GameOverScreen
  private readonly greetingScreen: GreetingScreen
  private readonly loadingEffects: LoadingEffects

  /**
   * Creates a new HUD instance with all UI components
   * @param scene - The Phaser scene this HUD belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.display = new HudDisplay(scene)
    this.gameOverScreen = new GameOverScreen(scene)
    this.greetingScreen = new GreetingScreen(scene)
    this.loadingEffects = new LoadingEffects(scene)
  }

  // --- Display Methods (Delegated to HudDisplay) ---

  /**
   * Updates the lives display
   * @param lives - Number of lives remaining
   */
  setLives(lives: number): void {
    this.display.setLives(lives)
  }

  /**
   * Updates the timer display
   * @param seconds - Time elapsed in seconds
   */
  setTimer(seconds: number): void {
    this.display.setTimer(seconds)
  }

  /**
   * Updates the score display
   * @param score - Current score value
   */
  setScore(score: number): void {
    this.display.setScore(score)
  }

  /**
   * Updates the multiplier display
   * @param multiplier - Current multiplier value
   */
  setMultiplier(multiplier: number): void {
    this.display.setMultiplier(multiplier)
  }

  /**
   * Updates the best score display
   * @param best - Best score achieved
   */
  setBest(best: number): void {
    this.display.setBest(best)
  }

  /**
   * Shows or hides the shield status indicator
   * @param active - Whether shield is active
   * @param secondsRemaining - Time remaining on shield effect
   */
  setShield(active: boolean, secondsRemaining?: number): void {
    this.display.setShield(active, secondsRemaining)
  }

  /**
   * Creates a pulsing animation on the score text
   */
  pulseScore(): void {
    this.display.pulseScore()
  }

  /**
   * Creates a pulsing animation on the multiplier text
   */
  pulseMultiplier(): void {
    this.display.pulseMultiplier()
  }

  /**
   * Creates a pulsing animation on the lives text
   */
  pulseLives(): void {
    this.display.pulseLives()
  }

  // --- Game Over Screen Methods (Delegated to GameOverScreen) ---

  /**
   * Shows the game over screen with restart and documentation buttons
   * @returns Object containing the restart and docs buttons for event handling
   */
  showGameOver(): { restartButton: Phaser.GameObjects.Text, docsButton: Phaser.GameObjects.Text } {
    return this.gameOverScreen.showGameOver()
  }

  /**
   * Shows a game over message card
   * @param title - Message title
   * @param message - Message content
   */
  showGameOverMessage(title: string, message: string): void {
    this.gameOverScreen.showGameOverMessage(title, message)
  }

  /**
   * Clears all game over screen elements
   */
  clearGameOver(): void {
    this.gameOverScreen.clearGameOver()
  }

  // --- Greeting Screen Methods (Delegated to GreetingScreen) ---

  /**
   * Shows a greeting screen with title, message, and action buttons
   * @param title - Greeting title
   * @param message - Greeting message
   * @param onClose - Callback when greeting is closed
   */
  showGreeting(title: string, message: string, onClose?: () => void): void {
    this.greetingScreen.showGreeting(title, message, onClose)
  }

  /**
   * Clears all greeting screen elements
   */
  clearGreeting(): void {
    this.greetingScreen.clearGreeting()
  }

  // --- Loading Effects Methods (Delegated to LoadingEffects) ---

  /**
   * Shows animated snow effect for loading screens
   */
  showLoadingSnow(): void {
    this.loadingEffects.showLoadingSnow()
  }

  /**
   * Clears the loading snow effect
   */
  clearLoadingSnow(): void {
    this.loadingEffects.clearLoadingSnow()
  }

  /**
   * Shows a rotating wreath spinner for loading indication
   */
  showLoadingWreathSpinner(): void {
    this.loadingEffects.showLoadingWreathSpinner()
  }

  /**
   * Clears the loading spinner
   */
  clearLoadingSpinner(): void {
    this.loadingEffects.clearLoadingSpinner()
  }

  /**
   * Fades out the loading spinner with callback
   * @param onDone - Callback executed when fade out completes
   */
  fadeOutLoadingSpinner(onDone: () => void): void {
    this.loadingEffects.fadeOutLoadingSpinner(onDone)
  }

  /**
   * Destroys all HUD components and cleans up resources
   */
  destroy(): void {
    this.display.destroy()
    this.gameOverScreen.destroy()
    this.greetingScreen.destroy()
    this.loadingEffects.destroy()
  }
}
