import Phaser from 'phaser'

function visualBounds(obj: any): Phaser.Geom.Rectangle | null {
  if (obj && typeof obj.getBounds === 'function') return obj.getBounds() as Phaser.Geom.Rectangle
  return null
}

function shrinkRect(r: Phaser.Geom.Rectangle, factor = 0.8): Phaser.Geom.Rectangle {
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  const w = r.width * factor
  const h = r.height * factor
  return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)
}

export function checkObstacleCollision(
  player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
  obstacles: Phaser.GameObjects.Group,
  onHit: () => void
) {
  let hit = false
  const pB = visualBounds(player as any)
  if (!pB) return
  const pRect = shrinkRect(pB, 0.8)
  obstacles.children.each((obstacle) => {
    const oB = visualBounds(obstacle as any)
    if (!oB) return true
    const oRect = shrinkRect(oB, 0.8)
    if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, oRect)) {
      hit = true
      return false
    }
    return true
  })
  if (hit) onHit()
}

export function checkItemCollisions(
  player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
  items: Phaser.GameObjects.Group,
  onCollect: (item: Phaser.GameObjects.Rectangle) => void
) {
  let collected: Phaser.GameObjects.Rectangle | null = null
  const pB = visualBounds(player as any)
  if (!pB) return
  const pRect = shrinkRect(pB, 0.8)
  items.children.each((item) => {
    const iB = visualBounds(item as any)
    if (!iB) return true
    const iRect = shrinkRect(iB, 0.8)
    if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, iRect)) {
      collected = item as any
      return false
    }
    return true
  })
  if (collected) onCollect(collected)
}
