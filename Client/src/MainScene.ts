import Phaser from 'phaser'

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key }
  private fpsText!: Phaser.GameObjects.Text
  private isPaused: boolean = false

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    // No assets to preload yet
  }

  create() {
    // Create player as a simple rectangle (hitbox)
    this.player = this.add.rectangle(400, 300, 32, 32, 0x00ff00)
    this.physics.add.existing(this.player)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)

    // Set up input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D') as any

    // Create FPS counter
    this.fpsText = this.add.text(10, 10, 'FPS: 0', {
      fontSize: '16px',
      color: '#ffffff'
    })

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseGame()
      } else {
        this.resumeGame()
      }
    })

    // Touch controls for mobile
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < this.cameras.main.width / 2) {
        // Left side of screen - move left
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body
        playerBody.setVelocityX(-200)
      } else {
        // Right side of screen - move right
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body
        playerBody.setVelocityX(200)
      }
    })

    this.input.on('pointerup', () => {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body
      playerBody.setVelocityX(0)
    })
  }

  update(_time: number, _delta: number) {
    if (this.isPaused) return

    // Update FPS counter
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`)

    // Handle keyboard input
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body

    // Reset velocity
    playerBody.setVelocityX(0)

    // Arrow keys or WASD movement
    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      playerBody.setVelocityX(-200)
    } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      playerBody.setVelocityX(200)
    }

    // Optional: Up/Down movement (commented out for now)
    // if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
    //   playerBody.setVelocityY(-200)
    // } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
    //   playerBody.setVelocityY(200)
    // }
  }

  private pauseGame() {
    this.isPaused = true
    this.physics.pause()
    console.log('Game paused')
  }

  private resumeGame() {
    this.isPaused = false
    this.physics.resume()
    console.log('Game resumed')
  }
}
