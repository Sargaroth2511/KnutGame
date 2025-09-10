import { describe, it, expect } from 'vitest'
import { checkObstacleCollision } from '../src/systems/CollisionSystem'
import { COLLIDE_SHRINK_PLAYER, HITBOX_GLOBAL_SHRINK } from '../src/gameConfig'

function makePlayerRect(px: number, py: number, w = 40, h = 40) {
  const rect = {
    getBounds: () => ({ x: px - w / 2, y: py - h / 2, width: w, height: h })
  } as any
  return rect
}

function makeToppledSprite(x: number, y: number, angleDeg: number, dw = 100, dh = 200) {
  const sprite: any = { x, y, angle: angleDeg, width: dw, height: dh, displayWidth: dw, displayHeight: dh }
  return sprite
}

function makeGroup(obstacles: any[]) {
  return {
    children: {
      each: (fn: (o: any) => boolean | void) => {
        for (const o of obstacles) {
          const cont = fn(o)
          if (cont === false) break
        }
      }
    }
  } as any
}

describe('CollisionSystem OBB with toppled trees', () => {
  it('blocks player when tree toppled left (~-90°)', () => {
    // Tree positioned at (200, 300); OBB center ends up ~96px to the left of x
    const tree = makeToppledSprite(200, 300, -90)
    const group = makeGroup([tree])
    // Place player near expected OBB center to ensure collision
    const player = makePlayerRect(104, 300)

    let hit = false
    checkObstacleCollision(player as any, group, () => { hit = true })
    expect(hit).toBe(true)
  })

  it('blocks player when tree toppled right (~+90°)', () => {
    const tree = makeToppledSprite(200, 300, 90)
    const group = makeGroup([tree])
    // OBB center is shifted ~+96 px when rotated right
    const player = makePlayerRect(296, 300)

    let hit = false
    checkObstacleCollision(player as any, group, () => { hit = true })
    expect(hit).toBe(true)
  })

  it('does not collide when player is well outside OBB footprint', () => {
    const tree = makeToppledSprite(200, 300, -90)
    const group = makeGroup([tree])
    // Far to the left beyond the toppled OBB horizontal extent
    const player = makePlayerRect(0, 300)

    let hit = false
    checkObstacleCollision(player as any, group, () => { hit = true })
    expect(hit).toBe(false)
  })
})
