import Phaser from 'phaser'

/**
 * Base class for HUD elements providing common functionality
 * and consistent styling across all UI components.
 */
abstract class HudElement {
  protected readonly scene: Phaser.Scene
  protected readonly camera: Phaser.Cameras.Scene2D.Camera
  protected readonly dpr: number

  /**
   * Creates a new HUD element
   * @param scene - The Phaser scene this element belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.camera = scene.cameras.main
    this.dpr = Math.min((globalThis.devicePixelRatio || 1), 2)
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
      resolution: this.dpr,
      stroke: '#000000',
      strokeThickness: 2 * this.dpr
    }
  }

  /**
   * Plain text style without stroke or shadow for maximum clarity
   */
  protected createPlainTextStyle(color: string, fontSize: string = '16px', fontStyle?: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize,
      color,
      fontFamily: 'Arial, sans-serif',
      fontStyle,
      resolution: this.dpr
    }
  }

  /**
   * Creates a rounded rectangle card with subtle drop shadow
   */
  protected makeCard(x: number, y: number, w: number, h: number, radius = 10, fill = 0xffffff, alpha = 0.95): Phaser.GameObjects.Container {
    const g = this.scene.add.graphics()
    g.setDepth(1000)
    // Shadow
    g.fillStyle(0x000000, 0.25)
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius)
    // Card
    g.fillStyle(fill, alpha)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius)
    const c = this.scene.add.container(0, 0, [g])
    c.setDepth(1000)
    return c
  }

  /**
   * Redraws an existing card container's graphics at a new position/size
   */
  protected redrawCard(container: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, radius = 10, fill = 0xffffff, alpha = 0.95): void {
    const g = container.getAt(0) as Phaser.GameObjects.Graphics | undefined
    if (!g) return
    g.clear()
    // Shadow
    g.fillStyle(0x000000, 0.25)
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius)
    // Card
    g.fillStyle(fill, alpha)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius)
  }

  /**
   * Creates a button with rounded background and label text
   */
  protected makeButton(label: string, centerX: number, centerY: number, onClick: () => void, opts?: { padding?: number; bg?: number; fg?: string }): Phaser.GameObjects.Container {
    const padding = opts?.padding ?? 12
    const bgColor = opts?.bg ?? 0x1a1a1a
    const fgColor = opts?.fg ?? '#ffffff'
    const txt = this.scene.add.text(0, 0, label, this.createTextStyle(fgColor, '18px')).setOrigin(0.5)
    this.applyLetterSpacing(txt, 0.9)
    txt.setShadow(0, 2, '#000000', 4, true, true)
    const w = Math.ceil(txt.width + padding * 2)
    const h = Math.ceil(txt.height + padding)
    const g = this.scene.add.graphics()
    // Shadow
    g.fillStyle(0x000000, 0.3)
    g.fillRoundedRect(centerX - w / 2 + 2, centerY - h / 2 + 4, w, h, 8)
    // Button
    g.fillStyle(bgColor, 0.95)
    g.fillRoundedRect(centerX - w / 2, centerY - h / 2, w, h, 8)
    const container = this.scene.add.container(0, 0, [g, txt])
    container.setDepth(1001)
    txt.setPosition(centerX, centerY)
    // Interactivity on the button area
    const hit = this.scene.add.rectangle(centerX, centerY, w, h, 0x000000, 0)
    hit.setDepth(1002)
    hit.setInteractive({ useHandCursor: true })
    hit.on('pointerover', () => g.setAlpha(1))
    hit.on('pointerout', () => g.setAlpha(0.98))
    hit.on('pointerdown', () => { g.setAlpha(0.9); onClick() })
    container.add(hit)
    return container
  }

  /**
   * Applies letter spacing to a text object with best-effort fallbacks.
   */
  protected applyLetterSpacing(t: Phaser.GameObjects.Text, px = 0.5): void {
    const anyT = t as any
    if (typeof anyT.setLetterSpacing === 'function') {
      anyT.setLetterSpacing(px)
    } else if (anyT.style) {
      anyT.style.letterSpacing = px
      anyT.updateText?.()
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
   * Repositions HUD elements based on current camera size (responsive layout)
   */
  layout(): void {
    // Left-aligned
    this.livesText.setPosition(10, 40)
    this.timerText.setPosition(10, 70)
    // Right-aligned
    const right = this.camera.width - 10
    this.scoreText.setPosition(right, 10)
    this.multiplierText.setPosition(right, 40)
    this.bestText.setPosition(right, 70)
    if (this.shieldText) this.shieldText.setPosition(right, 100)
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
  private gameOverMsgBg?: Phaser.GameObjects.Container
  private gameOverMsgCard?: Phaser.GameObjects.Container
  private gameOverBtn?: Phaser.GameObjects.Container

  /**
   * Shows the game over screen with restart button
   * @returns Object containing the restart button for event handling
   */
  showGameOver(): { restartButton: Phaser.GameObjects.Text } {
    const centerX = this.camera.width / 2
    const centerY = this.camera.height / 2

    // Title with shadow and higher resolution
    this.gameOverText = this.scene.add.text(
      centerX,
      centerY - 60,
      'GAME OVER',
      this.createTextStyle('#ff5555', '48px')
    ).setOrigin(0.5)
     .setDepth(1001)
    this.gameOverText.setShadow(0, 3, '#000000', 6, true, true)
    this.applyLetterSpacing(this.gameOverText, 1.2)

    // Button with rounded background
    this.gameOverBtn = this.makeButton('Restart', centerX, centerY + 20, () => {
      // Click handled by scene wiring; expose text shim for backward compatibility
      (this.restartButton as any)?.emit?.('pointerdown')
    }, { bg: 0x272a34, fg: '#ffffff', padding: 14 })

    // Back-compat: expose a Text-like interactive object for existing scene code
    this.restartButton = this.scene.add.text(centerX, centerY + 20, 'Restart', this.createTextStyle('#ffffff', '1px'))
      .setOrigin(0.5)
      .setDepth(1002)
      .setInteractive()
      .setVisible(false)

    return { restartButton: this.restartButton }
  }

  /**
   * Repositions game-over UI elements for the current camera size
   */
  layout(): void {
    if (!this.gameOverText && !this.restartButton && !this.gameOverMsgBg) return
    const width = Math.min(520, this.camera.width - 40)
    const yBase = this.camera.height / 2 + 90
    const cardY = yBase + 60
    // Core labels
    this.gameOverText?.setPosition(Math.round(this.camera.width / 2), Math.round(this.camera.height / 2 - 50))
    this.restartButton?.setPosition(Math.round(this.camera.width / 2), Math.round(this.camera.height / 2 + 30))
    if (this.gameOverBtn) {
      const centerX = this.camera.width / 2
      const centerY = this.camera.height / 2 + 20
      const g = this.gameOverBtn.getAt(0) as any
      const txt = this.gameOverBtn.getAt(1) as any
      const hit = this.gameOverBtn.getAt(2) as any
      if (g && txt && hit) {
        const w = hit.width
        const h = hit.height
        g.clear?.()
        g.fillStyle(0x000000, 0.3)
        g.fillRoundedRect(Math.round(centerX - w / 2 + 2), Math.round(centerY - h / 2 + 4), w, h, 8)
        g.fillStyle(0x272a34, 0.95)
        g.fillRoundedRect(Math.round(centerX - w / 2), Math.round(centerY - h / 2), w, h, 8)
        txt.setPosition(Math.round(centerX), Math.round(centerY))
        hit.setPosition(Math.round(centerX), Math.round(centerY))
      }
    }
    // Card + message layout if present
    if (this.gameOverMsgBg) this.redrawCard(this.gameOverMsgBg, Math.round(this.camera.width / 2), Math.round(cardY), width, 120, 10, 0xffffff, 0.98)
    this.gameOverMsgTitle?.setPosition(Math.round(this.camera.width / 2), Math.round(yBase + 20))
    this.gameOverMsgText?.setPosition(Math.round(this.camera.width / 2), Math.round(yBase + 48))
    if (this.gameOverMsgText) {
      this.gameOverMsgText.setWordWrapWidth(width - 16 * 2)
    }
  }

  /**
   * Shows a game over message card with title and description
   * @param title - Message title
   * @param message - Message content
   */
  showGameOverMessage(title: string, message: string): void {
    const padding = 16
    const width = Math.min(540, this.camera.width - 40)
    const yBase = this.camera.height / 2 + 70
    const cardY = yBase + 58

    this.gameOverMsgBg = this.makeCard(this.camera.width / 2, cardY, width, 140, 10, 0xffffff, 0.98)

    this.gameOverMsgTitle = this.scene.add.text(
      this.camera.width / 2,
      yBase + 20,
      title,
      this.createTextStyle('#111111', '20px')
    ).setOrigin(0.5, 0).setDepth(1002)
    this.gameOverMsgTitle.setShadow(0, 2, '#000000', 4, true, true)
    this.applyLetterSpacing(this.gameOverMsgTitle, 0.9)

    this.gameOverMsgText = this.scene.add.text(
      this.camera.width / 2,
      yBase + 48,
      message,
      this.createTextStyle('#333333', '16px')
    ).setOrigin(0.5, 0).setDepth(1002)
    this.gameOverMsgText.setWordWrapWidth(width - padding * 2)
    this.applyLetterSpacing(this.gameOverMsgText, 0.7)

    // Fade in
    const targets: Phaser.GameObjects.GameObject[] = [this.gameOverMsgBg!, this.gameOverMsgTitle, this.gameOverMsgText]
    targets.forEach(t => (t as any).setAlpha?.(0))
    this.scene.tweens.add({ targets, alpha: 1, duration: 180 })
  }

  /**
   * Clears all game over screen elements
   */
  clearGameOver(): void {
    this.gameOverText?.destroy()
    this.restartButton?.destroy()
    this.gameOverBtn?.destroy()
    this.gameOverMsgTitle?.destroy()
    this.gameOverMsgText?.destroy()
    this.gameOverMsgBg?.destroy()
    this.gameOverMsgCard?.destroy()

    this.gameOverText = undefined
    this.restartButton = undefined
    this.gameOverBtn = undefined
    this.gameOverMsgTitle = undefined
    this.gameOverMsgText = undefined
    this.gameOverMsgBg = undefined
    this.gameOverMsgCard = undefined
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
  private greetingCard?: Phaser.GameObjects.Container
  private greetingBtn?: Phaser.GameObjects.Container

  /**
   * Shows a greeting screen with title, message, and action buttons
   * @param title - Greeting title
   * @param message - Greeting message
   * @param onClose - Callback when greeting is closed
   */
  showGreeting(title: string, message: string, onClose?: () => void): void {
    const padding = 16
    const width = Math.min(560, this.camera.width - 40)
    const x = this.camera.width / 2 - width / 2
    const y = 80

    // Background card with rounded corners and shadow
    this.greetingCard = this.makeCard(x + width / 2, y + 90, width, 200, 10, 0xffffff, 0.98)
    this.greetingBg = (this.greetingCard.list[0] as any)

    // Title
    this.greetingTitle = this.scene.add.text(
      Math.round(x + width / 2),
      Math.round(y + 22),
      title,
      this.createPlainTextStyle('#111111', '22px')
    ).setOrigin(0.5, 0).setDepth(1002)
    // No shadow for maximum crispness; increase letter spacing
    this.applyLetterSpacing(this.greetingTitle, 1.35)

    // Message
    this.greetingMsg = this.scene.add.text(
      Math.round(this.camera.width / 2),
      Math.round(y + 56),
      message,
      this.createPlainTextStyle('#333333', '16px', 'bold')
    ).setOrigin(0.5, 0).setDepth(1002)
    this.greetingMsg.setWordWrapWidth(width - padding * 2)
    // Ensure no stroke/shadow for body message
    this.greetingMsg.setStroke('#000000', 0)

    // Start button (styled)
    this.greetingBtn = this.makeButton('Start', x + width - 70, y + 90 + 80, () => {
      this.clearGreeting(); onClose?.()
    }, { bg: 0x2c7a7b, fg: '#ffffff', padding: 12 })

    // Fade in
    const targets: Phaser.GameObjects.GameObject[] = [this.greetingCard!, this.greetingTitle, this.greetingMsg, this.greetingBtn!]
    targets.forEach(t => (t as any).setAlpha?.(0))
    this.scene.tweens.add({ targets, alpha: 1, duration: 200 })
  }

  /**
   * Repositions greeting UI elements for the current camera size
   */
  layout(): void {
    if (!this.greetingBg && !this.greetingTitle && !this.greetingMsg) return
    const padding = 16
    const width = Math.min(560, this.camera.width - 40)
    const x = this.camera.width / 2 - width / 2
    const y = 80
    this.greetingBg?.setPosition(x + width / 2, y + 90)
    this.greetingBg?.setSize(width, 200)
    this.greetingTitle?.setPosition(x + width / 2, y + 22)
    this.greetingMsg?.setPosition(this.camera.width / 2, y + 50)
    if (this.greetingMsg) {
      this.greetingMsg.setWordWrapWidth(width - padding * 2)
    }
    if (this.greetingBtn) {
      const centerX = x + width - 70
      const centerY = y + 90 + 80
      const g = this.greetingBtn.getAt(0) as any
      const txt = this.greetingBtn.getAt(1) as any
      const hit = this.greetingBtn.getAt(2) as any
      if (g && txt && hit) {
        const w = hit.width
        const h = hit.height
        g.clear?.()
        g.fillStyle(0x000000, 0.3)
        g.fillRoundedRect(centerX - w / 2 + 2, centerY - h / 2 + 4, w, h, 8)
        g.fillStyle(0x2c7a7b, 0.95)
        g.fillRoundedRect(centerX - w / 2, centerY - h / 2, w, h, 8)
        txt.setPosition(centerX, centerY)
        hit.setPosition(centerX, centerY)
      }
    }
  }

  /**
   * Clears all greeting screen elements
   */
  clearGreeting(): void {
    this.greetingCard?.destroy()
    this.greetingBg?.destroy()
    this.greetingTitle?.destroy()
    this.greetingMsg?.destroy()
    this.greetingClose?.destroy()
    this.greetingBtn?.destroy()

    this.greetingCard = undefined
    this.greetingBg = undefined
    this.greetingTitle = undefined
    this.greetingMsg = undefined
    this.greetingClose = undefined
    this.greetingBtn = undefined
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
  private rotateOverlay?: Phaser.GameObjects.Container

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
   * Repositions loading effects for the current camera size
   */
  layout(): void {
    if (this.loadingSpinnerGroup) {
      const yBase = 80
      this.loadingSpinnerGroup.setPosition(this.camera.width / 2, yBase + 80)
    }
    if (this.rotateOverlay) {
      const bg = this.rotateOverlay.getAt(0) as Phaser.GameObjects.Rectangle
      const text = this.rotateOverlay.getAt(1) as Phaser.GameObjects.Text
      bg.setPosition(this.camera.width / 2, this.camera.height / 2)
      bg.setSize(this.camera.width, this.camera.height)
      text.setPosition(Math.round(this.camera.width / 2), Math.round(this.camera.height / 2))
    }
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
    this.hideRotateOverlay()
  }

  /**
   * Shows a full-screen overlay instructing the user to rotate to portrait
   */
  showRotateOverlay(): void {
    if (this.rotateOverlay) return
    const bg = this.scene.add.rectangle(this.camera.width / 2, this.camera.height / 2, this.camera.width, this.camera.height, 0x000000, 0.75)
    bg.setDepth(5000)
    const text = this.scene.add.text(
      Math.round(this.camera.width / 2),
      Math.round(this.camera.height / 2),
      'Please rotate your device\nUse portrait mode',
      this.createPlainTextStyle('#ffffff', '20px', 'bold')
    ).setOrigin(0.5)
    text.setDepth(5001)
    const group = this.scene.add.container(0, 0, [bg, text])
    group.setDepth(5000)
    this.rotateOverlay = group
  }

  /**
   * Hides the rotate overlay if present
   */
  hideRotateOverlay(): void {
    if (!this.rotateOverlay) return
    this.rotateOverlay.destroy()
    this.rotateOverlay = undefined
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

  /**
   * Relayout all HUD components when the viewport size changes
   */
  layout(): void {
    (this.display as any).layout?.()
    ;(this.gameOverScreen as any).layout?.()
    ;(this.greetingScreen as any).layout?.()
    ;(this.loadingEffects as any).layout?.()
  }

  // Orientation overlay passthrough
  showRotateOverlay(): void { this.loadingEffects.showRotateOverlay() }
  hideRotateOverlay(): void { this.loadingEffects.hideRotateOverlay() }

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
   * Shows the game over screen with restart button
   * @returns Object containing the restart button for event handling
   */
  showGameOver(): { restartButton: Phaser.GameObjects.Text } {
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
