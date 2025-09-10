import Phaser from 'phaser'
import { COLLIDE_SHRINK_PLAYER, COLLIDE_SHRINK_ITEM, OBST_COLLIDE_WIDTH_FRAC, OBST_COLLIDE_HEIGHT_FRAC, HITBOX_GLOBAL_SHRINK } from '../gameConfig'

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

type OBB = { cx: number, cy: number, hw: number, hh: number, cos: number, sin: number }

function orientedObstacleOBB(sprite: any): OBB | null {
  if (sprite && typeof sprite.getData === "function") {
    const c = sprite.getData("collidable");
    if (c === false) return null;
  }
  if (!sprite) return null
  const dw = sprite.displayWidth ?? sprite.width
  const dh = sprite.displayHeight ?? sprite.height
  if (!dw || !dh) return null
  // Base trunk footprint
  let w = dw * OBST_COLLIDE_WIDTH_FRAC
  let h = dh * OBST_COLLIDE_HEIGHT_FRAC
  // 1) Increase height by 80%
  h = h * 1.8
  // Apply global shrink
  w *= HITBOX_GLOBAL_SHRINK
  h *= HITBOX_GLOBAL_SHRINK
  const hw = w / 2
  const hh = h / 2
  // 3) Rotation matches sprite rotation (degrees → radians)
  const ang = ((sprite.angle as number) || 0) * Math.PI / 180
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)
  // 2) Position center using local offset rotated into world space (origin at bottom-center)
  const vx = -sin, vy = cos // local Y axis (up is negative)
  const offset = hh + 0.2 * h // move up along local Y
  const cx = (sprite.x as number) - vx * offset
  const cy = (sprite.y as number) - vy * offset
  return { cx, cy, hw, hh, cos, sin }
}

function aabbToOBB(r: Phaser.Geom.Rectangle): OBB {
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  return { cx, cy, hw: r.width / 2, hh: r.height / 2, cos: 1, sin: 0 }
}

function obbAxes(obb: OBB) {
  // Two unit axes of the rectangle
  return [ { x: obb.cos, y: obb.sin }, { x: -obb.sin, y: obb.cos } ]
}

function obbCorners(obb: OBB) {
  const ux = obb.cos, uy = obb.sin
  const vx = -obb.sin, vy = obb.cos
  const hw = obb.hw, hh = obb.hh
  return [
    { x: obb.cx + ux*hw + vx*hh, y: obb.cy + uy*hw + vy*hh },
    { x: obb.cx - ux*hw + vx*hh, y: obb.cy - uy*hw + vy*hh },
    { x: obb.cx - ux*hw - vx*hh, y: obb.cy - uy*hw - vy*hh },
    { x: obb.cx + ux*hw - vx*hh, y: obb.cy + uy*hw - vy*hh },
  ]
}

function projectPolygon(axis: {x:number,y:number}, pts: {x:number,y:number}[]) {
  let min = axis.x*pts[0].x + axis.y*pts[0].y
  let max = min
  for (let i=1;i<pts.length;i++) {
    const p = axis.x*pts[i].x + axis.y*pts[i].y
    if (p < min) min = p
    if (p > max) max = p
  }
  return {min, max}
}

function overlap1D(a:{min:number,max:number}, b:{min:number,max:number}) {
  return a.max >= b.min && b.max >= a.min
}

function obbIntersect(a: OBB, b: OBB): boolean {
  const axes = [...obbAxes(a), ...obbAxes(b)]
  const pa = obbCorners(a)
  const pb = obbCorners(b)
  for (const ax of axes) {
    const ra = projectPolygon(ax, pa)
    const rb = projectPolygon(ax, pb)
    if (!overlap1D(ra, rb)) return false
  }
  return true
}

export function checkObstacleCollision(
  player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
  obstacles: Phaser.GameObjects.Group,
  onHit: (obstacle: Phaser.GameObjects.Sprite) => void
) {
  const pB = visualBounds(player as any)
  if (!pB) return
  const pRect = shrinkRect(pB, COLLIDE_SHRINK_PLAYER * HITBOX_GLOBAL_SHRINK)
  const pOBB = aabbToOBB(pRect)
  obstacles.children.each((obstacle) => {
    const oOBB = orientedObstacleOBB(obstacle as any)
    if (!oOBB) return true
    if (obbIntersect(pOBB, oOBB)) {
      onHit(obstacle as any)
      return false
    }
    return true
  })
  // onHit invoked inline when collision is detected
}

export function checkItemCollisions(
  player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
  items: Phaser.GameObjects.Group,
  onCollect: (item: Phaser.GameObjects.Rectangle) => void
) {
  let collected: Phaser.GameObjects.Rectangle | null = null
  const pB = visualBounds(player as any)
  if (!pB) return
  const pRect = shrinkRect(pB, COLLIDE_SHRINK_PLAYER * HITBOX_GLOBAL_SHRINK)
  items.children.each((item) => {
    const iB = visualBounds(item as any)
    if (!iB) return true
    const iRect = shrinkRect(iB, COLLIDE_SHRINK_ITEM * HITBOX_GLOBAL_SHRINK)
    if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, iRect)) {
      collected = item as any
      return false
    }
    return true
  })
  if (collected) onCollect(collected)
}
