import Phaser from 'phaser'

export class Hud {
  private scene: Phaser.Scene
  private livesText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private multiplierText!: Phaser.GameObjects.Text
  private bestText!: Phaser.GameObjects.Text

  private gameOverText?: Phaser.GameObjects.Text
  private restartButton?: Phaser.GameObjects.Text
  private greetingBg?: Phaser.GameObjects.Rectangle
  private greetingTitle?: Phaser.GameObjects.Text
  private greetingMsg?: Phaser.GameObjects.Text
  private greetingClose?: Phaser.GameObjects.Text

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

  showGameOver(): { restartButton: Phaser.GameObjects.Text } {
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
      cam.height / 2 + 50,
      'Click to Restart',
      this.textStyle('#ffffff')
    ).setOrigin(0.5).setDepth(1000).setInteractive()

    return { restartButton: this.restartButton }
  }

  clearGameOver() {
    this.gameOverText?.destroy(); this.gameOverText = undefined
    this.restartButton?.destroy(); this.restartButton = undefined
  }

  showGreeting(title: string, message: string, onClose?: () => void) {
    const cam = this.scene.cameras.main
    const padding = 16
    const width = Math.min(520, cam.width - 40)
    const x = cam.width / 2 - width / 2
    const y = 80

    this.greetingBg = this.scene.add.rectangle(cam.width / 2, y + 80, width, 160, 0xffffff, 0.92)
      .setStrokeStyle(2, 0x222222)
      .setDepth(1000)

    this.greetingTitle = this.scene.add.text(cam.width / 2, y + 20, title, {
      fontSize: '20px', color: '#111111', fontFamily: 'Arial, sans-serif', resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001)

    this.greetingMsg = this.scene.add.text(cam.width / 2, y + 50, message, {
      fontSize: '16px', color: '#333333', fontFamily: 'Arial, sans-serif', wordWrap: { width: width - padding * 2 }, resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001)

    this.greetingClose = this.scene.add.text(cam.width / 2, y + 110, 'Start Game', {
      fontSize: '14px', color: '#2563eb', fontFamily: 'Arial, sans-serif', resolution: 2
    }).setOrigin(0.5, 0).setDepth(1001).setInteractive()

    this.greetingClose.on('pointerdown', () => { this.clearGreeting(); onClose?.() })
  }

  clearGreeting() {
    this.greetingBg?.destroy(); this.greetingBg = undefined
    this.greetingTitle?.destroy(); this.greetingTitle = undefined
    this.greetingMsg?.destroy(); this.greetingMsg = undefined
    this.greetingClose?.destroy(); this.greetingClose = undefined
  }
}
