# Implementation Task — Step 1: Gravity + Terminal Velocity for Obstacles

Author: Physics QA
Date: 2025-09-10
Status: Ready for implementation

## Goal
Replace fixed per-obstacle vertical speeds with a simple physical model:
- Integrate vertical velocity with gravity (constant acceleration).
- Clamp to a per-tier terminal speed (small/medium/large) and keep difficulty scaling.
- Preserve existing lateral motion and rotation for now.

This yields natural acceleration at spawn, consistent slow-motion behavior, and per-tier size–speed realism.

## Acceptance Criteria
- Obstacles start with 0 vertical velocity and accelerate downward at `GRAVITY_Y`, capped at a tier-dependent terminal speed.
- Difficulty still increases effective vertical terminal speed like before (up to +50%); items unaffected.
- Slow-motion affects both acceleration and resulting velocity consistently (use scaled `dt`).
- No regressions in spawning, collision, or removal off-screen.

## Changes by File

### 1) `src/KnutGame.Client/src/gameConfig.ts`
Add new constants for gravity and terminal velocities per tier.

Suggested patch:
```ts
export const GRAVITY_Y = 900; // px/s^2, vertical acceleration (tune 800–1100)
export const VT_SMALL = 320;  // px/s, terminal vertical speed (small tier)
export const VT_MED   = 380;  // px/s, terminal vertical speed (medium tier)
export const VT_LARGE = 440;  // px/s, terminal vertical speed (large tier)
```

Notes:
- Keep existing `FALL_SPEED_MIN/MAX` for items (unchanged in this step).

### 2) `src/KnutGame.Client/src/systems/Spawner.ts`
When spawning an obstacle, initialize physics state and computed terminal speed based on tier and difficulty.

Key points:
- Set `vy = 0` on spawn.
- Set `vterm = VT_*[tier] * max(1, difficulty)` for same difficulty scaling the game used for fixed speeds.
- Stop using `speed` for vertical movement (left in place for backwards-compat; not read anymore).

Suggested patch (insert near existing tier selection and after body sizing):
```ts
import { FALL_SPEED_MIN, FALL_SPEED_MAX, ITEM_SIZE, OBSTACLE_VX_MIN, OBSTACLE_VX_MAX, OBSTACLE_OMEGA_MIN, OBSTACLE_OMEGA_MAX } from '../gameConfig'
import { VT_SMALL, VT_MED, VT_LARGE } from '../gameConfig'
@@
    // Initialize vertical motion: gravity-driven, start at rest; per-tier terminal velocity
    const VT_BY_TIER: Record<string, number> = { small: VT_SMALL, medium: VT_MED, large: VT_LARGE }
    const vtermBase = VT_BY_TIER[tier.name] ?? VT_MED
    const vterm = Math.round(vtermBase * Math.max(1, difficulty))
    obstacle.setData('vy', 0)
    obstacle.setData('vterm', vterm)
    // Keep legacy field for now (not used by movement anymore)
    obstacle.setData('speed', vterm)
```

No other logic in `Spawner` changes for this step.

### 3) `src/KnutGame.Client/src/MainScene.ts`
Integrate gravity each frame and apply vertical velocity; remove direct use of `speed` for Y.

Key points:
- Import `GRAVITY_Y` and `VT_*` (if using default fallback).
- Compute `dt_eff = (delta/1000) * slowMoFactorValue` to integrate under slow-mo.
- Update `vy = min(vy + GRAVITY_Y * dt_eff, vterm)` and set as body velocity Y.

Suggested patch (inside obstacles update loop):
```ts
import { FALL_SPEED_MIN,
  GRAVITY_Y,
  VT_SMALL, VT_MED, VT_LARGE,
  INVULNERABILITY_MS,
  SPAWN_INTERVAL_START,
```

And replace the vertical velocity section:
```ts
      // Gravity + terminal velocity integration
      const dtEff = (delta / 1000) * slowMoFactorValue
      let vy = (obs.getData('vy') as number) ?? 0
      const vterm = (obs.getData('vterm') as number) ?? VT_MED
      vy = Math.min(vy + GRAVITY_Y * dtEff, vterm)
      obs.setData('vy', vy)
      obsBody.setVelocityY(vy)
```

Notes:
- Keep lateral drift/rotation code unchanged.
- Off-screen removal remains the same.

## Optional Feature Flag (for quick rollback)
Add a simple switch in `gameConfig.ts`:
```ts
export const GRAVITY_OBSTACLES_ENABLED = true;
```
Then guard the new integration in `MainScene.ts` with:
```ts
import { GRAVITY_OBSTACLES_ENABLED } from './gameConfig'
@@
      if (GRAVITY_OBSTACLES_ENABLED) {
        const dtEff = (delta / 1000) * slowMoFactorValue
        let vy = (obs.getData('vy') as number) ?? 0
        const vterm = (obs.getData('vterm') as number) ?? VT_MED
        vy = Math.min(vy + GRAVITY_Y * dtEff, vterm)
        obs.setData('vy', vy)
        obsBody.setVelocityY(vy)
      } else {
        const speed = (obs.getData('speed') as number) ?? FALL_SPEED_MIN
        obsBody.setVelocityY(speed * slowMoFactorValue)
      }
```

## Testing Guidance
- Visual: Enable hitbox debug, spawn a few obstacles, observe initial slower fall accelerating to a steady max; slow-mo should slow both ramp-up and top speed.
- Unit (optional): Add a small test to integrate `vy` over fixed `dt` and confirm `vy(t)` saturates at `vterm`.

## Tuning Notes
- If the start feels too slow on-screen, either increase `GRAVITY_Y` to 1000–1100 px/s² or spawn obstacles slightly higher (e.g., `y = -100`) to give them time to accelerate before visible entry.
- Consider per-tier gravity tweaks only if needed for readability; start with a global `GRAVITY_Y`.

## Out of Scope (later steps)
- Wind-like lateral drift and removing edge bounce (Step 2).
- Spin damping (Step 3) and ground contact/topple (Step 4).

