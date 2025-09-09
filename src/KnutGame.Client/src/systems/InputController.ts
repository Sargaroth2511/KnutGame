import Phaser from 'phaser'
import { MOVE_SPEED } from '../gameConfig'

export class InputController {
  private scene: Phaser.Scene
  private player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key }
  private onPointerDown!: (pointer: Phaser.Input.Pointer) => void
  private onPointerUp!: () => void

  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle) {
    this.scene = scene
    this.player = player
  }

  attach() {
    this.cursors = this.scene.input.keyboard!.createCursorKeys()
    this.wasd = this.scene.input.keyboard!.addKeys('W,S,A,D') as any

    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      const body = (this.player as any).body as Phaser.Physics.Arcade.Body
      if (pointer.x < this.scene.cameras.main.width / 2) {
        body.setVelocityX(-MOVE_SPEED)
      } else {
        body.setVelocityX(MOVE_SPEED)
      }
    }
    this.onPointerUp = () => {
      const body = (this.player as any).body as Phaser.Physics.Arcade.Body
      body.setVelocityX(0)
    }
    this.scene.input.on('pointerdown', this.onPointerDown)
    this.scene.input.on('pointerup', this.onPointerUp)
  }

  detach() {
    if (this.onPointerDown) this.scene.input.off('pointerdown', this.onPointerDown)
    if (this.onPointerUp) this.scene.input.off('pointerup', this.onPointerUp)
  }

  // Update keyboard-driven movement each frame
  update() {
    const body = (this.player as any).body as Phaser.Physics.Arcade.Body
    body.setVelocityX(0)
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      body.setVelocityX(-MOVE_SPEED)
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      body.setVelocityX(MOVE_SPEED)
    }
  }
}
