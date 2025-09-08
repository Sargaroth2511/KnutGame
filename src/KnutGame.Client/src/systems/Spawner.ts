 import Phaser from 'phaser'
import { FALL_SPEED_MIN, FALL_SPEED_MAX } from '../gameConfig'
import { ItemType } from '../items'

export class ObstacleSpawner {
  readonly group: Phaser.GameObjects.Group
  private pool: Phaser.GameObjects.Rectangle[] = []
  private scene: Phaser.Scene
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.group = this.scene.physics.add.group()
  }

  spawn(): Phaser.GameObjects.Rectangle {
    let obstacle = this.pool.pop()
    if (!obstacle) {
      obstacle = this.scene.add.rectangle(0, -50, 24, 48, 0x8B4513)
      this.scene.physics.add.existing(obstacle)
    }

    const randomX = Phaser.Math.Between(50, this.scene.cameras.main.width - 50)
    obstacle.setPosition(randomX, -50)

    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
    obstacle.setData('speed', speed)

    this.group.add(obstacle)
    obstacle.setActive(true).setVisible(true)
    return obstacle
  }

  remove(obstacle: Phaser.GameObjects.Rectangle) {
    this.group.remove(obstacle)
    obstacle.setActive(false).setVisible(false)
    this.pool.push(obstacle)
  }
}

export class ItemSpawner {
  readonly group: Phaser.GameObjects.Group
  private scene: Phaser.Scene

  private pool: Phaser.GameObjects.Rectangle[] = []
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.group = this.scene.physics.add.group()
  }

  spawn(): Phaser.GameObjects.Rectangle {
    let item = this.pool.pop()

    const itemTypes = [ItemType.POINTS, ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI]
    const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)]

    let color: number
    switch (randomType) {
      case ItemType.POINTS: color = 0xffff00; break
      case ItemType.LIFE: color = 0xff00ff; break
      case ItemType.SLOWMO: color = 0x00ffff; break
      case ItemType.MULTI: color = 0xff8800; break
      default: color = 0xffffff
    }

    if (!item) {
      item = this.scene.add.rectangle(0, -50, 20, 20, color)
      this.scene.physics.add.existing(item)
    } else {
      item.setFillStyle(color)
    }

    item.setData('itemType', randomType)
    // Assign a unique ID for server-side validation
    const newId = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    item.setData('id', newId)

    const randomX = Phaser.Math.Between(50, this.scene.cameras.main.width - 50)
    item.setPosition(randomX, -50)

    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
    item.setData('speed', speed)

    this.group.add(item)
    item.setActive(true).setVisible(true)
    return item
  }

  remove(item: Phaser.GameObjects.Rectangle) {
    this.group.remove(item)
    item.setActive(false).setVisible(false)
    this.pool.push(item)
  }
}
