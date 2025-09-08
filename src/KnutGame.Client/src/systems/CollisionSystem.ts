import Phaser from 'phaser'

export function checkObstacleCollision(
  player: Phaser.GameObjects.Rectangle,
  obstacles: Phaser.GameObjects.Group,
  onHit: () => void
) {
  let hit = false
  obstacles.children.each((obstacle) => {
    const obs = obstacle as Phaser.GameObjects.Rectangle
    if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), obs.getBounds())) {
      hit = true
      return false
    }
    return true
  })
  if (hit) onHit()
}

export function checkItemCollisions(
  player: Phaser.GameObjects.Rectangle,
  items: Phaser.GameObjects.Group,
  onCollect: (item: Phaser.GameObjects.Rectangle) => void
) {
  let collected: Phaser.GameObjects.Rectangle | null = null
  items.children.each((item) => {
    const itm = item as Phaser.GameObjects.Rectangle
    if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), itm.getBounds())) {
      collected = itm
      return false
    }
    return true
  })
  if (collected) onCollect(collected)
}

