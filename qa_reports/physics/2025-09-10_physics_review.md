# Physics Review — Falling Obstacles and Items

Author: Physics QA
Date: 2025-09-10

## Scope
- Review the in-game motion of falling obstacles (trees) and collectible items.
- Compare with real-world physics expectations (gravity, drag, rotation, ground contact).
- Identify deviations and propose concrete, implementable fixes that preserve gameplay readability.

## Quick Summary
- Current motion uses fixed vertical velocities and ad-hoc horizontal drift/rotation.
- No gravity or air drag; no ground interactions (bounce/topple) are simulated.
- Item and obstacle speeds do not scale physically with size; edge “bounces” are non-physical.
- Collision shapes are simplified but reasonable (OBB for obstacles, AABB for items) for arcade-style gameplay.

## What The Code Does Today
- Engine: Phaser Arcade, gravity disabled (`gravity.y = 0`).
- Obstacles
  - Spawn at y ≈ -60 px with randomized tier (small/medium/large) and constant downward speed per tier (`FALL_SPEED_MIN..MAX`, scaled by difficulty).
  - Lateral motion: constant `vx` plus sinusoidal sway; angular velocity `omega` is constant.
  - Edge handling: reverses `vx` when near lateral bounds (“edge bounce”).
  - Removal: deleted when `y` > screen + 50 px. No ground contact, no toppling.
- Items
  - Spawn with constant downward speed (no acceleration), no bounce on ground; simply removed off-screen.
  - Collected by AABB overlap with a slightly shrunken player box.
- Collisions
  - Obstacles: oriented bounding box approximating the lower trunk portion (good for fairness).
  - Items: AABB overlap with shrink factor.
- Unused physics helpers: `physicsLike.ts` defines a topple timeline and “linger” window but is not integrated into gameplay.

## Real-World Expectations (2D Arcade Approximation)
- Gravity: objects accelerate downward at g ≈ 9.81 m/s². Mapping to game scale, g ≈ 600–1200 px/s² is typical for 60 FPS readability.
- Drag and terminal velocity: larger/heavier objects generally achieve higher terminal velocity (given similar shape/density), but acceleration starts from 0 and asymptotically approaches `v_t`.
- Rotation: air drag damps spin; random torques cause slight, not extreme, rotation.
- Horizontal motion: wind-like drift varies slowly (low-frequency noise), not perfectly sinusoidal nor hard boundary bounces.
- Ground interaction: small elastic bounce for light items; bulky obstacles should topple or settle with friction instead of disappearing.

## Quantitative Reference (suggested target ranges)
Assume 1 m ≈ 80–100 px; pick g ≈ 900 px/s² for clarity.
- Terminal velocities (px/s): small ≈ 320, medium ≈ 380, large ≈ 440 (tune per readability).
- Horizontal wind drift: mean ≈ 0 px/s, RMS ≈ 20–30 px/s, correlation time 0.5–2 s.
- Angular velocities: σ ≈ 20–40 deg/s with damping time ≈ 2–4 s.
- Item bounces: restitution e ≈ 0.25–0.4, up to 1–2 visible bounces before rest/linger.

## Findings and Issues
1) No gravity; fixed vertical speeds
   - Objects appear “already at terminal speed” the moment they spawn, lacking natural acceleration.
   - Slow-motion correctly scales velocity but cannot scale acceleration because none is modeled.

2) Size–speed relation is ad-hoc
   - Larger tiers are simply assigned higher constant speeds. Realistic: speed emerges from mass/drag interplay (terminal velocity), with acceleration phase.

3) Horizontal dynamics are non-physical
   - Constant `vx` + sinusoidal sway + instant edge bounces look artificial. Real wind is stochastic and low-frequency; boundary interactions should be rare (objects shouldn’t “pinball” off invisible walls in the sky).

4) Rotation without dynamics
   - Constant `omega` ignores angular acceleration and air damping; extreme spins may occur without visual cause.

5) No ground interaction
   - Obstacles and items vanish below screen. Realistic: items bounce slightly; obstacles contact ground, topple and slide a bit before despawning.

6) Unused topple/linger helpers
   - `toppleTimeline()` and `shouldDespawnGround()` exist but aren’t wired, leaving a gap between intended behavior and current gameplay.

## Concrete Suggestions (Minimal, Local Changes)
These can be implemented incrementally while keeping gameplay readable.

1) Introduce gravity + terminal velocity per tier
   - Keep per-object state: `vy` (vertical speed). On spawn set `vy = 0`.
   - Each tick: `vy += g * dt`, then clamp `vy = min(vy, v_tier)`; set body velocity Y to `vy * slowMoFactor`.
   - Parameters (in `gameConfig.ts`):
     - `GRAVITY_Y = 900` px/s²
     - `VT_SMALL = 320`, `VT_MED = 380`, `VT_LARGE = 440` px/s
   - Map tiers to terminal `v_tier`, replacing the current fixed speed pick.

2) Replace boundary “bounces” with soft wind drift
   - Maintain `vx` with a simple Ornstein–Uhlenbeck (OU) process (discrete):
     - `vx += -(vx / tau) * dt + sigma * sqrt(dt) * N(0,1)`
     - Use `tau ≈ 1.0 s`, `sigma ≈ 40 px/s^(3/2)`; clamp |vx| ≤ 60 px/s.
   - Remove hard edge-bounce; clamp X inside [margin, width - margin] by zeroing `vx` momentarily when at bounds.

3) Add spin with damping
   - Track `omega` and apply `omega += -omega / tau_spin * dt + noise` with `tau_spin ≈ 3 s`; clamp |omega| ≤ 80 deg/s.
   - This yields natural-looking occasional spins that settle.

4) Implement ground contact
   - Define ground Y: e.g., `groundY = camera.height * 0.96` (aligned with the player’s feet line).
   - Items: when bottom ≥ ground, set `y` to ground, invert `vy *= -e` (e ≈ 0.3), and count bounces; after 1–2 bounces, set `vy = 0` and start “linger” timer using `shouldDespawnGround()` with `ITEM_GROUND_MS`.
   - Obstacles: when bottom ≥ ground, stop downward motion and play a topple animation using `toppleTimeline()` over `TOPPLE_DURATION_MS`; then let the sprite slide ~10–20 px and despawn after `TOPPLE_BLOCK_MS` (limit max concurrent toppled objects per `MAX_TOPPLED`).

5) Keep collision fairness
   - Current OBB trunk footprint is good. When toppling, either freeze collisions during animation or update OBB to match rotation; prefer freezing (simple and fair).

6) Slow-motion integration
   - Apply `slowMoFactor` to both velocity application and integration (`dt_eff = dt * slowMoFactor`) so acceleration also slows down.

7) Parameter hygiene
   - Move hard-coded obstacle size→speed mapping into config constants (per-tier terminal velocities, damping times, restitution).

## Example Pseudocode (Obstacle Tick)
```
// on spawn
vy = 0; omega = random(-20..20); vx = 0

// per frame (delta in seconds)
const dt = delta / 1000 * slowMoFactor
vy = Math.min(vy + GRAVITY_Y * dt, VT_TIER)
// OU wind
vx += (-vx / TAU_WIND) * dt + SIGMA_WIND * sqrt(dt) * randn()
vx = clamp(vx, -VX_MAX, VX_MAX)
// spin damping
omega += (-omega / TAU_SPIN) * dt + SIGMA_SPIN * sqrt(dt) * randn()
omega = clamp(omega, -OMEGA_MAX, OMEGA_MAX)

body.setVelocityY(vy)
body.setVelocityX(vx)
sprite.setAngle(sprite.angle + omega * dt)

// ground contact
if (bottom >= groundY) beginToppleThenDespawn(...)
```

## Suggested Tests (non-breaking)
- Unit tests
  - Gravity integration: `vy(t)` increases monotonically and saturates at `v_tier`.
  - OU drift: bounded `|vx|` and zero mean over long horizon.
  - Topple timeline: angle → ~-90° in `TOPPLE_DURATION_MS` (already covered by `physicsLike.spec.ts`).
  - Item bounce: heights reduce geometrically with restitution; despawn after configured linger.
- Visual toggle
  - Keep existing hitbox debug; add an optional overlay to plot `vy` and `vx` for one sample obstacle to aid tuning.

## Risks and Trade-offs
- Adding acceleration can make early motion “slower”; compensate with slightly higher `v_tier` or spawn objects slightly above screen to allow acceleration before entering view.
- OU noise adds a small per-frame cost; negligible for current object counts.
- Ground interactions add visual complexity; keep counts capped (`MAX_TOPPLED`, `MAX_ITEMS_GROUND`).

## Configuration Proposal (add to `gameConfig.ts`)
- `GRAVITY_Y = 900`
- `VT_SMALL = 320`, `VT_MED = 380`, `VT_LARGE = 440`
- `VX_MAX = 60`, `TAU_WIND = 1.0`, `SIGMA_WIND = 40`
- `TAU_SPIN = 3.0`, `OMEGA_MAX = 80`, `SIGMA_SPIN = 30`
- `GROUND_Y_FRAC = 0.96` (for contact line)
- `ITEM_RESTITUTION = 0.3`, `ITEM_MAX_BOUNCES = 2`

## Conclusion
The current implementation achieves a playable arcade feel but diverges from real-world motion. Introducing simple gravity with per-tier terminal velocity, soft wind-driven drift, spin damping, and ground interactions (bounce/topple) will noticeably improve physical plausibility without sacrificing performance or clarity. The repository already contains topple/linger helpers and tests that can be leveraged—wiring them into `MainScene` and `Spawner` would be a cohesive next step.

