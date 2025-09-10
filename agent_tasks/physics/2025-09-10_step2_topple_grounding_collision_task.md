# Implementation Task — Step 2: Realistic Collision Topple + Grounding

Author: Physics QA
Date: 2025-09-10
Status: Ready for implementation

## Problem
- When a tree (obstacle) hits the player, it performs a small lateral move and then “lies” mid‑air. It should drop to the street and topple there.
- Toppled trees immediately block and can cause additional hits during animation. Collisions feel unfair and non-physical.

## Goal
- On player collision, transition the obstacle through physically plausible phases:
  1) Impact knockback (brief, away from player).
  2) Fall to ground (continue downward to a ground line).
  3) Topple on the ground (pivot at base, slide slightly), then settle.
  4) Become blocking only after it has settled.
- Avoid repeated hits during animation; no tree should “float” in mid‑air.

## Acceptance Criteria
- On hit, an obstacle visually reacts (short knockback + spin) but does not remain suspended; it reaches the ground, then topples and settles.
- During toppling animation it is non-collidable; once settled it becomes a blocking obstacle for `TOPPLE_BLOCK_MS`, then fades out and despawns.
- Topple direction is away from the player’s position at impact.
- Ground line is consistent with the player’s feet line (or a configured fraction of canvas height).

## Changes by File

### 1) `src/KnutGame.Client/src/gameConfig.ts`
Add tuning constants for ground line and topple/impact behavior.

Suggested patch:
```ts
// Grounding & topple tuning
export const GROUND_Y_FRAC = 0.94;     // fraction of screen height treated as street line
export const TOPPLE_KNOCKBACK_PX = 18; // quick lateral offset on impact
export const TOPPLE_IMPACT_SPIN = 15;  // deg of instantaneous spin on impact (sign = away)
export const TOPPLE_DROP_ACCEL = 1000; // px/s^2 used when simulating post-impact fall to ground
export const TOPPLE_MAX_DROP_V = 520;  // px/s clamp for the post-impact fall phase
```

### 2) `src/KnutGame.Client/src/systems/ToppledManager.ts`
Extend the manager to support impact → drop → topple → settled phases and to separate animating vs. blocking groups.

Key changes:
- Accept two groups in the constructor: `animGroup` (non-colliding) and `blockGroup` (colliding after settle).
- Require a `groundY` reference set from the scene at construction time.
- Update entry state machine: `fallingToGround` (simulated drop) → `toppling` → `settled`.
- Add brief impact reaction (lateral offset + instantaneous spin) based on player side.
- Only add the sprite to `blockGroup` when entering `settled`.

Suggested patch (illustrative excerpts):
```ts
import { TOPPLE_BLOCK_MS, TOPPLE_DURATION_MS, MAX_TOPPLED, GROUND_Y_FRAC, TOPPLE_KNOCKBACK_PX, TOPPLE_IMPACT_SPIN, TOPPLE_DROP_ACCEL, TOPPLE_MAX_DROP_V } from '../gameConfig'
type Entry = {
  sprite: Phaser.GameObjects.Sprite,
  baseX: number,
  baseY: number,
  dir: 1 | -1,
  elapsed: number,
  state: 'fallingToGround' | 'toppling' | 'settled',
  lifeLeft: number,
  vy: number
}

export class ToppledManager {
  private scene: Phaser.Scene
  private animGroup: Phaser.GameObjects.Group
  private blockGroup: Phaser.GameObjects.Group
  private active: Entry[] = []
  private groundY: number

  constructor(scene: Phaser.Scene, animGroup: Phaser.GameObjects.Group, blockGroup: Phaser.GameObjects.Group, groundY: number) {
    this.scene = scene
    this.animGroup = animGroup
    this.blockGroup = blockGroup
    this.groundY = groundY
  }

  addFromFalling(obstacle: Phaser.GameObjects.Sprite, playerX: number) {
    if (this.active.length >= MAX_TOPPLED) {
      const old = this.active.shift()!
      this.animGroup.remove(old.sprite)
      old.sprite.destroy()
    }
    const body = (obstacle.body as Phaser.Physics.Arcade.Body | undefined)
    let vy0 = 0
    if (body) {
      vy0 = (body.velocity?.y as number) || 0
      body.setVelocity(0, 0); body.enable = false
    }
    ;(obstacle as any).setOrigin?.(0.5, 1)
    const entry: Entry = {
      sprite: obstacle,
      baseX: obstacle.x,
      baseY: obstacle.y,
      dir: playerX < obstacle.x ? -1 : 1,
      elapsed: 0,
      state: 'fallingToGround',
      lifeLeft: TOPPLE_BLOCK_MS,
      vy: Math.min(vy0, TOPPLE_MAX_DROP_V)
    }
    // Impact knockback & spin away from player
    const knock = TOPPLE_KNOCKBACK_PX * entry.dir
    obstacle.setAngle(obstacle.angle + (TOPPLE_IMPACT_SPIN * entry.dir))
    obstacle.setPosition(obstacle.x + knock, obstacle.y)
    obstacle.setActive(true).setVisible(true)
    this.animGroup.add(obstacle)
    this.active.push(entry)
  }

  update(deltaMs: number) {
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i]
      if (e.state === 'fallingToGround') {
        const dt = deltaMs / 1000
        e.vy = Math.min(e.vy + TOPPLE_DROP_ACCEL * dt, TOPPLE_MAX_DROP_V)
        e.baseY += e.vy * dt
        const spriteBottom = e.baseY
        if (spriteBottom >= this.groundY) {
          e.baseY = this.groundY
          e.state = 'toppling'
          e.elapsed = 0
          e.sprite.setAngle(0)
        }
        e.sprite.setPosition(e.baseX, e.baseY)
      } else if (e.state === 'toppling') {
        e.elapsed += deltaMs
        const t = toppleTimeline(e.elapsed, { durationMs: TOPPLE_DURATION_MS })
        const ang = Math.abs(t.angleDeg) * e.dir
        const slide = t.slidePx * e.dir
        e.sprite.setAngle(ang)
        e.sprite.setPosition(e.baseX + slide, this.groundY)
        if (e.elapsed >= TOPPLE_DURATION_MS) {
          e.state = 'settled'
          this.blockGroup.add(e.sprite)
          this.animGroup.remove(e.sprite)
        }
      } else {
        e.lifeLeft -= deltaMs
        if (e.lifeLeft <= 0) {
          const s = e.sprite
          this.scene.tweens.add({ targets: s, alpha: 0, duration: 180, onComplete: () => { s.destroy() } })
          this.blockGroup.remove(e.sprite)
          this.active.splice(i, 1)
          i--
        }
      }
    }
  }

  clear() {
    for (const e of this.active) {
      try { (this.scene as any).tweens?.killTweensOf?.(e.sprite) } catch {}
      try { e.sprite.destroy() } catch {}
    }
    this.animGroup.clear(true, true)
    this.blockGroup.clear(true, true)
    this.active = []
  }
```

### 3) `src/KnutGame.Client/src/MainScene.ts`
Wire up two toppled groups and pass a consistent `groundY`.

Key changes:
- Create `toppledAnim` and `toppledBlocking` groups.
- Instantiate `ToppledManager` with both groups and `groundY`.
- Use `toppledBlocking` for collisions; exclude `toppledAnim`.
- Ensure both groups are cleared on restart.

Suggested patch (illustrative excerpts):
```ts
import { ToppledManager } from './systems/ToppledManager'
import { GROUND_Y_FRAC } from './gameConfig'

// fields
private toppledAnim!: Phaser.GameObjects.Group
private toppledBlocking!: Phaser.GameObjects.Group
private toppledManager!: ToppledManager
private groundY!: number

// in create()
this.obstacleSpawner = new ObstacleSpawner(this)
this.obstacles = this.obstacleSpawner.group
this.groundY = this.cameras.main.height * GROUND_Y_FRAC
this.toppledAnim = this.add.group()
this.toppledBlocking = this.add.group()
this.toppledManager = new ToppledManager(this, this.toppledAnim, this.toppledBlocking, this.groundY)

// collisions
collideObstacles(this.player, this.obstacles, (obs) => { this.onObstacleHit(obs as Phaser.GameObjects.Sprite, true) })
collideObstacles(this.player, this.toppledBlocking, (obs) => { this.onObstacleHit(obs as Phaser.GameObjects.Sprite, false) })

// restart cleanup
this.toppledAnim?.clear(true, true)
this.toppledBlocking?.clear(true, true)
this.toppledManager?.clear()
```

### 4) `src/KnutGame.Client/src/CollisionSystem.ts` (optional)
No changes required. Because animating trees are not in the colliding group, players won’t take repeated hits during animation.

## Test Updates
- Update `test/toppledManager.spec.ts` to reflect the new phases:
  - New manager signature requires anim and block groups and `groundY`.
  - After a few updates, sprite `y` should reach `groundY` before toppling.
  - Ensure sprite is added to `blockGroup` only when state becomes `settled`.
  - Cap eviction (`MAX_TOPPLED`) remains tested.

Sketch:
```ts
const { scene } = makeScene()
const { group: anim } = makeGroup()
const { group: block, added: blockAdded } = makeGroup()
const mgr = new ToppledManager(scene as any, anim as any, block as any, 300)
const s = makeFallingSprite(100, 100)
mgr.addFromFalling(s.sprite as any, 50)
// Simulate updates until ground reached
mgr.update(200); mgr.update(200)
expect(s.sprite.y).toBeGreaterThanOrEqual(300)
// Simulate topple completion
mgr.update(TOPPLE_DURATION_MS)
expect(blockAdded.includes(s.sprite)).toBe(true)
```

## Tuning Notes
- If the fall‑to‑ground feels too slow or too fast, adjust `TOPPLE_DROP_ACCEL` and `TOPPLE_MAX_DROP_V`.
- Increase `TOPPLE_KNOCKBACK_PX` or `TOPPLE_IMPACT_SPIN` for a more dramatic hit.
- Align `GROUND_Y_FRAC` with `MainScene` player feet (`initialPlayerY`) if a different camera layout is used.

## Out of Scope (later steps)
- Integrating obstacle gravity from Step 1 directly into the drop phase (can reuse the same `GRAVITY_Y / vterm`).
- Frictional slide after settle and updating the OBB during topple; currently the object becomes blocking only when settled for fairness.

## Follow-up Review & Fixes (post-implementation)
Observed after integrating Step 2:

- Symptom A — lateral “snap-back” during the drop: the impact knockback is applied to the sprite’s `x`, but the state machine uses a captured `baseX` taken before knockback. On the first update, the sprite is repositioned to `baseX`, visually snapping back and looking glitchy.
- Symptom B — angle snap at ground contact: an immediate `setAngle(0)` when entering `toppling` causes a visible jump if `TOPPLE_IMPACT_SPIN` was applied on impact.
- Symptom C — occasional “hovering” above street: minor mismatch between `GROUND_Y_FRAC` and the true player foot line can make trees settle slightly above ground on some aspect ratios.
- Symptom D — unfair re-hit at settle: enabling collisions at the exact settle moment can trap the player under the trunk.
- Cosmetic — topple slide too small: `slidePx` of ~12 px reads as “stiff”. Larger trees should slide more.

Concrete fixes:

1) Persist knockback into `baseX`
```ts
// In ToppledManager.addFromFalling, after computing `entry` and before pushing to active:
const knock = TOPPLE_KNOCKBACK_PX * entry.dir
obstacle.setAngle(obstacle.angle + (TOPPLE_IMPACT_SPIN * entry.dir))
obstacle.setPosition(obstacle.x + knock, obstacle.y)
entry.baseX = obstacle.x // keep new X as baseline so the drop doesn’t snap back
```

2) Smooth angle handoff into topple
```ts
// Extend Entry
//   startAngle: number
// When entering 'toppling':
e.startAngle = e.sprite.angle
// During toppling update:
const ang = e.startAngle + Math.abs(t.angleDeg) * e.dir
e.sprite.setAngle(ang)
```
This preserves any impact spin and eases naturally to a final ~±90° without a jump. Optionally clamp to ±100°.

3) Align ground with player feet precisely
```ts
// In MainScene.create(), prefer player’s visual bottom over a fixed fraction
const pAny: any = this.player as any
if (typeof pAny.getBounds === 'function') {
  const pb = pAny.getBounds() as Phaser.Geom.Rectangle
  this.groundY = pb.bottom // exact feet line
} else {
  this.groundY = this.cameras.main.height * GROUND_Y_FRAC
}
```

4) Add settle grace to avoid unfair re-hit
```ts
// In ToppledManager, when transitioning to 'settled': delay adding to block group
e.state = 'settled'
this.animGroup.remove(e.sprite)
this.scene.time.delayedCall(150, () => {
  // Double-check still alive
  if (!e.sprite.active) return
  this.blockGroup.add(e.sprite)
})
```
Optionally, detect overlap with the player and nudge `baseX` ±6–10 px away before enabling collisions.

5) Scale slide distance by sprite size (feels weighty)
```ts
// In toppling update
const sizeScale = Math.max(0.9, Math.min(1.6, (e.sprite.displayHeight || 160) / 160))
const slide = t.slidePx * sizeScale * e.dir
e.sprite.setPosition(e.baseX + slide, this.groundY)
```
Tweak 0.9–1.6 range to taste; larger trees slide further.

6) Depth ordering to avoid odd overlaps
```ts
// When entering 'toppling'
e.sprite.setDepth((this.scene as any).player?.depth ? (this.scene as any).player.depth - 1 : e.sprite.depth)
```
Alternatively manage via a dedicated ground-layer z-index.

7) Optional — settle collision footprint slimmer
- Define `OBST_COLLIDE_HEIGHT_FRAC_SETTLED = 0.22` and use it for toppledBlocking in `CollisionSystem` to feel like a trunk slab while lying down.
- Or keep current OBB but shrink globally by another few percent only for toppledBlocking.

Validation checklist:
- Impact knockback is preserved into drop; no lateral snap.
- Angle transitions are smooth; no sudden reset at ground.
- Trees visually touch the street on all device sizes.
- Player is not immediately re-hit by the settling tree.
- Larger trees slide a bit more; overall motion feels heavier.

## Follow-up 2 — “Suction” to ground and re-hit when lying
Observations after further playtesting:

- Trees appear “sucked” to the street right after impact. Expected is a short, slowed stagger, then a natural diagonal fall and topple.
- The player can still lose another life from the same tree once it is lying on the ground. Expected: toppled trees block movement but do not deal damage again.

Proposed adjustments:

1) Add an explicit impact-stagger phase (ease-out) before drop
- Introduce a new state `impact` with duration `TOPPLE_IMPACT_MS` (e.g., 140–180 ms).
- Behavior in `impact`:
  - Lerp the vertical speed to a small value (or zero), preventing instant plunge.
  - Apply the horizontal knockback smoothly (ease-out) rather than as an immediate jump.
  - Add a small spin impulse that eases in (retain continuity into topple).

Suggested additions to `gameConfig.ts`:
```ts
export const TOPPLE_IMPACT_MS = 160;     // brief stagger after collision
export const TOPPLE_IMPACT_EASE = 'Quad.out';
export const TOPPLE_DROP_ACCEL = 700;    // soften from 1000 → 600–800 to avoid suction
export const TOPPLE_MAX_DROP_V = 420;    // clamp a bit lower for a gentler fall
export const TOPPLE_FALL_VX = 40;        // px/s lateral drift during fall (decays)
export const TOPPLE_FALL_TAU = 0.8;      // s, time constant for decay of lateral drift
```

ToppledManager state machine (illustrative):
```ts
type State = 'impact' | 'fallingToGround' | 'toppling' | 'settled'

// on addFromFalling
entry.state = 'impact';
entry.impactLeft = TOPPLE_IMPACT_MS;
entry.vx = TOPPLE_FALL_VX * entry.dir; // initial lateral drift away from player

// in update()
if (e.state === 'impact') {
  const dt = deltaMs / 1000;
  e.impactLeft -= deltaMs;
  // ease knockback over impact window
  const p = 1 - Math.max(0, e.impactLeft) / TOPPLE_IMPACT_MS; // 0..1
  const eased = 1 - Math.pow(1 - p, 2); // Quad out
  const x = e.baseX + TOPPLE_KNOCKBACK_PX * eased * e.dir;
  // gently reduce vy to near 0 (no suction)
  e.vy *= Math.max(0, 1 - 3 * dt);
  e.sprite.setPosition(x, e.baseY);
  // small spin-in
  e.sprite.setAngle(e.startAngle + (TOPPLE_IMPACT_SPIN * eased * e.dir));
  if (e.impactLeft <= 0) {
    e.state = 'fallingToGround';
  }
}
else if (e.state === 'fallingToGround') {
  const dt = deltaMs / 1000;
  e.vy = Math.min(e.vy + TOPPLE_DROP_ACCEL * dt, TOPPLE_MAX_DROP_V);
  // lateral drift decays (OU-lite)
  e.vx += (-e.vx / TOPPLE_FALL_TAU) * dt;
  e.baseX += e.vx * dt;
  e.baseY += e.vy * dt;
  if (e.baseY >= this.groundY) { e.baseY = this.groundY; e.state = 'toppling'; e.elapsed = 0; }
  e.sprite.setPosition(e.baseX, e.baseY);
}
```

This removes the immediate plunge and produces a brief stagger followed by a gentle, diagonal drop before the ground topple.

2) Make toppled (settled) trees non-damaging and resolve overlap instead
- Do not call the life-loss handler for `toppledBlocking` collisions. Instead, resolve overlap by nudging the player away along the shortest axis, or simply disallow damaging collisions for settled trees altogether.

Minimal change in `MainScene.ts` collision handling:
```ts
// For settled trees (toppledBlocking), resolve overlap without damage
collideObstacles(this.player, this.toppledBlocking, (obs) => {
  if (registered) return; registered = true;
  // Compute a simple push direction away from obstacle center
  const dir = (this.player.x >= (obs as any).x) ? 1 : -1;
  const push = 16 * dir; // tune 12–24 px
  this.player.x += push;
  // Optionally: briefly freeze player’s horizontal input to prevent re-entering
  // this.inputController?.freeze(120);
  // No handleCollision() call here — no damage from settled trees
})
```

Alternative (data flag):
```ts
// When entering 'settled' in ToppledManager:
e.sprite.setData('nonDamage', true);
// In checkCollisions, ignore obstacles with nonDamage flag for life loss.
```

Validation checklist (for this follow-up):
- After impact, trees linger for ~0.15 s with a soft knockback and small spin, not plunging immediately.
- The drop to ground shows mild diagonal drift and reasonable speed.
- No life is lost from collisions with already-settled trees; they only block or nudge the player.
- No visual snapping in X or angle; transitions look continuous.
