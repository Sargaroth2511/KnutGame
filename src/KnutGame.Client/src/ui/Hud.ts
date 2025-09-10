import Phaser from 'phaser'

export class Hud {
  private scene: Phaser.Scene
  private livesText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private multiplierText!: Phaser.GameObjects.Text
  private bestText!: Phaser.GameObjects.Text
  private shieldText?: Phaser.GameObjects.Text

  private gameOverText?: Phaser.GameObjects.Text
  private restartButton?: Phaser.GameObjects.Text
  private gameOverMsgTitle?: Phaser.GameObjects.Text
  private gameOverMsgText?: Phaser.GameObjects.Text
  private gameOverMsgBg?: Phaser.GameObjects.Rectangle
  private greetingBg?: Phaser.GameObjects.Rectangle
  private greetingTitle?: Phaser.GameObjects.Text
  private greetingMsg?: Phaser.GameObjects.Text
  private greetingClose?: Phaser.GameObjects.Text
  private snowTweens: Phaser.Tweens.Tween[] = []
  private snowDots: Phaser.GameObjects.Rectangle[] = []
  // Loading: wreath spinner
  private loadingSpinnerGroup?: Phaser.GameObjects.Container
  private loadingSpinnerTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const cam = this.scene.cameras.main

    this.livesText = this.scene.add.text(10, 40, 'Lives: ', this.textStyle('#ff0000'))
    this.livesText.setDepth(1000)

    this.timerText = this.scene.add.text(10, 70, 'Time: 0.0s', this.textStyle('#ffffff'))
    this.timerText.setDepth(1000)

    this.scoreText = this.scene.add.text(cam.width - 10, 10, 'Score: 0', this.textStyle('#ffff00'))
    this.scoreText.setOrigin(1, 0)
    this.scoreText.setDepth(1000)

    this.multiplierText = this.scene.add.text(cam.width - 10, 40, '', this.textStyle('#ff8800'))
    this.multiplierText.setOrigin(1, 0)
    this.multiplierText.setDepth(1000)

    this.bestText = this.scene.add.text(cam.width - 10, 70, 'Best: 0', this.textStyle('#ffffff'))
    this.bestText.setOrigin(1, 0)
    this.bestText.setDepth(1000)
  }

  private textStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize: '16px',
      color,
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    }
  }

  setLives(lives: number) {
    this.livesText.setText(`Lives: ${'♥'.repeat(lives)}`)
  }

  setTimer(seconds: number) {
    this.timerText.setText(`Time: ${seconds.toFixed(1)}s`)
  }

  setScore(score: number) {
    this.scoreText.setText(`Score: ${score}`)
  }

  setMultiplier(multiplier: number) {
    if (multiplier > 1) this.multiplierText.setText(`x${multiplier}`)
    else this.multiplierText.setText('')
  }

  setBest(best: number) {
    this.bestText.setText(`Best: ${best}`)
  }

  setShield(active: boolean, secondsRemaining?: number) {
    const cam = this.scene.cameras.main
    if (active) {
      if (!this.shieldText) {
        this.shieldText = this.scene.add.text(cam.width - 10, 100, '', this.textStyle('#00ffff'))
          .setOrigin(1, 0)
          .setDepth(1000)
      }
      const s = Math.max(0, (secondsRemaining ?? 0)).toFixed(1)
      this.shieldText.setText(`Shield: ${s}s`)
      this.shieldText.setVisible(true)
    } else if (this.shieldText) {
      this.shieldText.setVisible(false)
    }
  }

  // Subtle UI pulses for feedback
  pulseScore() {
    this.scene.tweens.add({ targets: this.scoreText, scale: 1.1, duration: 120, yoyo: true, ease: 'Quad.easeOut' })
  }

  pulseMultiplier() {
    if (this.multiplierText.text) {
      this.scene.tweens.add({ targets: this.multiplierText, scale: 1.15, duration: 140, yoyo: true, ease: 'Quad.easeOut' })
    }
  }

  pulseLives() {
    this.scene.tweens.add({ targets: this.livesText, scale: 1.12, duration: 120, yoyo: true, ease: 'Quad.easeOut' })
  }

  showGameOver(): { restartButton: Phaser.GameObjects.Text, docsButton: Phaser.GameObjects.Text } {
    const cam = this.scene.cameras.main
    this.gameOverText = this.scene.add.text(
      cam.width / 2,
      cam.height / 2 - 50,
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

    this.restartButton = this.scene.add.text(
      cam.width / 2,
      cam.height / 2 + 30,
      'Click to Restart',
      this.textStyle('#ffffff')
    ).setOrigin(0.5).setDepth(1000).setInteractive()

    // Add documentation button below restart button
    const docsButton = this.scene.add.text(
      cam.width / 2,
      cam.height / 2 + 70,
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

    // Add hover effects for docs button
    docsButton.on('pointerover', () => {
      docsButton.setColor('#2980b9')
      docsButton.setScale(1.05)
    })
    docsButton.on('pointerout', () => {
      docsButton.setColor('#3498db')
      docsButton.setScale(1.0)
    })
    docsButton.on('pointerdown', () => {
      // Open documentation in new tab/window
      window.open('/developer_guide.html', '_blank')
    })

    return { restartButton: this.restartButton, docsButton }
  }

  clearGameOver() {
    this.gameOverText?.destroy(); this.gameOverText = undefined
    this.restartButton?.destroy(); this.restartButton = undefined
    this.gameOverMsgTitle?.destroy(); this.gameOverMsgTitle = undefined
    this.gameOverMsgText?.destroy(); this.gameOverMsgText = undefined
    this.gameOverMsgBg?.destroy(); this.gameOverMsgBg = undefined
    // Clean up greeting elements if they exist
    this.greetingBg?.destroy(); this.greetingBg = undefined
    this.greetingTitle?.destroy(); this.greetingTitle = undefined
    this.greetingMsg?.destroy(); this.greetingMsg = undefined
    this.greetingClose?.destroy(); this.greetingClose = undefined
  }

  showGameOverMessage(title: string, message: string) {
    const cam = this.scene.cameras.main
    const padding = 16
    const width = Math.min(520, cam.width - 40)
    const yBase = cam.height / 2 + 90
    const cardY = yBase + 60

    // Background card (white with border)
    this.gameOverMsgBg = this.scene.add.rectangle(cam.width / 2, cardY, width, 120, 0xffffff, 0.92)
      .setStrokeStyle(2, 0x222222)
      .setDepth(1000)

    // Title and message (dark text for readability on white)
    this.gameOverMsgTitle = this.scene.add.text(cam.width / 2, yBase + 20, title, {
      fontSize: '20px', color: '#111111', fontFamily: 'Arial, sans-serif', resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001)
    this.gameOverMsgText = this.scene.add.text(cam.width / 2, yBase + 48, message, {
      fontSize: '16px', color: '#333333', fontFamily: 'Arial, sans-serif', wordWrap: { width: width - padding * 2 }, resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001)

    // Fade in card and text
    this.gameOverMsgBg.setAlpha(0)
    this.gameOverMsgTitle.setAlpha(0)
    this.gameOverMsgText.setAlpha(0)
    this.scene.tweens.add({ targets: [this.gameOverMsgBg, this.gameOverMsgTitle, this.gameOverMsgText], alpha: 1, duration: 180 })
  }

  showGreeting(title: string, message: string, onClose?: () => void) {
    const cam = this.scene.cameras.main
    const padding = 16
    const width = Math.min(520, cam.width - 40)
    const x = cam.width / 2 - width / 2
    const y = 80

    this.greetingBg = this.scene.add.rectangle(x + width / 2, y + 80, width, 180, 0xffffff, 0.92)
      .setStrokeStyle(2, 0x222222)
      .setDepth(1000)

    this.greetingTitle = this.scene.add.text(x + width / 2, y + 20, title, {
      fontSize: '20px', color: '#111111', fontFamily: 'Arial, sans-serif', resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001)

    this.greetingMsg = this.scene.add.text(cam.width / 2, y + 50, message, {
      fontSize: '16px', color: '#333333', fontFamily: 'Arial, sans-serif', wordWrap: { width: width - padding * 2 }, resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001)

    this.greetingClose = this.scene.add.text(cam.width / 2 - 80, y + 120, 'Start Game', {
      fontSize: '14px', color: '#2563eb', fontFamily: 'Arial, sans-serif', resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001).setInteractive()

    // Add documentation button next to start game button
    const docsButton = this.scene.add.text(cam.width / 2 + 80, y + 120, '📚 Docs', {
      fontSize: '14px', color: '#059669', fontFamily: 'Arial, sans-serif', resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001).setInteractive()

    this.greetingClose.on('pointerdown', () => { this.clearGreeting(); onClose?.() })

    // Add hover effects and click handler for docs button
    docsButton.on('pointerover', () => docsButton.setColor('#047857'))
    docsButton.on('pointerout', () => docsButton.setColor('#059669'))
    docsButton.on('pointerdown', () => {
      window.open('/developer_guide.html', '_blank')
    })

    // Fade in greeting elements
    this.greetingBg.setAlpha(0)
    this.greetingTitle.setAlpha(0)
    this.greetingMsg.setAlpha(0)
    this.greetingClose.setAlpha(0)
    docsButton.setAlpha(0)
    this.scene.tweens.add({ targets: [this.greetingBg, this.greetingTitle, this.greetingMsg, this.greetingClose, docsButton], alpha: 1, duration: 180 })
  }

  clearGreeting() {
    this.greetingBg?.destroy(); this.greetingBg = undefined
    this.greetingTitle?.destroy(); this.greetingTitle = undefined
    this.greetingMsg?.destroy(); this.greetingMsg = undefined
    this.greetingClose?.destroy(); this.greetingClose = undefined
    // Note: docs button is cleaned up automatically as it's not stored as instance variable
  }

  showLoadingSnow() {
    const cam = this.scene.cameras.main
    const count = 60
    const createDot = () => {
      const x = Phaser.Math.Between(0, cam.width)
      const y = Phaser.Math.Between(-cam.height, 0)
      const size = Phaser.Math.Between(2, 4)
      const dot = this.scene.add.rectangle(x, y, size, size, 0xffffff, 0.9)
      dot.setDepth(999)
      const duration = Phaser.Math.Between(3500, 8000)
      const tween = this.scene.tweens.add({
        targets: dot,
        y: cam.height + 10,
        x: x + Phaser.Math.Between(-40, 40),
        duration,
        repeat: -1,
        onRepeat: () => {
          dot.y = -10
          dot.x = Phaser.Math.Between(0, cam.width)
        }
      })
      this.snowDots.push(dot)
      this.snowTweens.push(tween)
    }
    for (let i = 0; i < count; i++) createDot()
  }

  clearLoadingSnow() {
    this.snowTweens.forEach(t => t.stop());
    this.snowTweens = []
    this.snowDots.forEach(d => d.destroy());
    this.snowDots = []
  }

  // --- Loading Wreath Spinner ---
  showLoadingWreathSpinner() {
    const cam = this.scene.cameras.main
    // Place spinner where the greeting card appears later
    const yBase = 80
    const group = this.scene.add.container(cam.width / 2, yBase + 80)
    group.setDepth(1002)

    const g = this.scene.add.graphics()
    g.setDepth(1002)
    // Responsive size: ~4% of width, clamped
    const outerR = Phaser.Math.Clamp(Math.round(cam.width * 0.04), 18, 34)
    const innerR = Math.round(outerR * 0.6)
    // Draw ring as thick stroke (transparent center)
    const thickness = outerR - innerR
    const radius = innerR + thickness / 2
    g.lineStyle(thickness, 0x1b7c36, 1)
    g.strokeCircle(0, 0, radius)
    group.add(g)

    // Red berries around the ring
    const berryCount = 6
    for (let i = 0; i < berryCount; i++) {
      const angle = (i / berryCount) * Math.PI * 2
      const r = (outerR + innerR) / 2
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      const berry = this.scene.add.ellipse(x, y, 5, 5, 0xe24b4b, 1)
      berry.setDepth(1003)
      group.add(berry)
    }

    // Rotation tween
    this.loadingSpinnerTween = this.scene.tweens.add({
      targets: group,
      angle: 360,
      duration: 2400,
      repeat: -1,
      ease: 'Linear'
    })

    this.loadingSpinnerGroup = group
  }

  clearLoadingSpinner() {
    if (this.loadingSpinnerTween) { this.loadingSpinnerTween.stop(); this.loadingSpinnerTween = undefined }
    this.loadingSpinnerGroup?.destroy(); this.loadingSpinnerGroup = undefined
  }

  fadeOutLoadingSpinner(onDone: () => void) {
    if (!this.loadingSpinnerGroup) { onDone(); return }
    this.scene.tweens.add({
      targets: this.loadingSpinnerGroup,
      alpha: 0,
      duration: 200,
      onComplete: () => { this.clearLoadingSpinner(); onDone() }
    })
  }
}
