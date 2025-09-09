# Agent Task: Iteration 8 — Visual Polish, Physics-Like Collisions, and Performance

Goal: Make the game look appealing while keeping gameplay silky-smooth. Add tasteful visual polish (parallax, feedback, particles), introduce light “physics-like” behaviors (tree topple on hit, items settle briefly on the road), and enforce a performance budget across desktop and mobile.

## Constraints
- Maintain 60 FPS on mid-tier devices; minimize jank and GC spikes.
- Preserve current gameplay loop and scoring; no server API regressions.
- Anti-cheat/scoring must remain correct; any change to item pickup windows is opt-in and backward compatible.
- Phaser Arcade Physics remains the primary engine (no Matter.js adoption in this iteration). Physics-like effects use tweens/controlled state.
- Keep allocations/frame minimal; use pooling and object reuse.

## Feature Summary
- Visual polish
  - Parallax background (2–3 layers) using TileSprites with differing scroll factors.
  - Hit feedback: brief hit-stop, screen shake, player flash, subtle vignette pulse.
  - Particles: small leaf/snow burst on collisions and item pickups (pooled emitters).
  - UI refinements: clearer score/highscore, multiplier badge, colorblind-friendly palette.
- Physics-like behaviors
  - Tree topple on collision: obstacle rotates ~90° toward collision side, slides slightly, then settles; remains a short-lived ground obstacle before fade/despawn.
  - Items settle on the road: when falling items reach the player lane without being collected mid-air, they bounce once, then remain collectible for a short window before despawn.
- Performance & tooling
  - Strict pooling for obstacles, toppled trees, items, particles.
  - Off-screen culling and capped active counts.
  - Sprite atlas for common assets; WebP images; pre-sized textures to power-of-two where helpful.
  - Debug FPS and perf overlay (dev only) with toggles.

## Acceptance Criteria
- Visuals
  - Parallax background visible and responsive; no tearing or artifacts.
  - Collision feedback triggers: hit-stop ≤ 100 ms, screen shake ≤ 150 ms.
  - Particles render on hit/pickups and respect object pooling.
- Physics-like
  - On player–tree collision, a toppled tree appears, rotates and settles within 600–900 ms, and blocks the lane for 2–3 s before despawn.
  - Uncollected items reaching the player lane settle and remain collectible for up to 2 s, then despawn.
- Performance
  - 60 FPS sustained on desktop; ≥ 50 FPS on a typical mid-tier mobile (debug HUD off).
  - Max active objects (trees+items+particles) capped and documented; no unbounded growth.
  - No per-frame allocations beyond negligible counters; no memory leaks on restart.
- Tests
  - Unit tests validate topple/linger timelines and pooling caps (pure TS logic).
  - Existing client/server tests remain green; no API regressions.

## Design Notes
- Parallax
  - Use 2–3 TileSprites (back trees, mid snow, near ground). Update positions via `tilePositionY += speed * dt`. Lower scroll factors for distant layers.
  - Keep assets small; prefer tiled textures over large backgrounds.
- Hit feedback
  - Hit-stop: temporarily scale `time.timeScale` to ~0.85 for ≤ 100 ms, then restore to 1.
  - Camera shake: `this.cameras.main.shake(150, 0.0025)` tuned lightly; avoid motion sickness.
  - Player flash: tint or alpha flash via tween for ≤ 300 ms (respect invulnerability window).
- Particles
  - Use a minimal particle texture (e.g., 8×8 leaf/snow). One emitter pool; emit bursts at impact sites.
  - Cap total particles and emitter lifespan.
- Tree topple
  - When a live obstacle collides with player, convert it into a “toppled tree” entity:
    - Set origin near base; rotate to ±90° with easing; slide a few pixels.
    - During topple and settle, keep it as a blocking obstacle (AABB adjusted to the final orientation’s footprint approximation).
    - After 2–3 s on ground, fade out and return to pool.
  - Implement without dynamic rotation physics (Arcade constraint). Use precomputed AABB sizes per orientation stage.
- Item settle/linger
  - When an item reaches the player lane Y without being collected, perform a short vertical bounce, then `velocityY=0` and mark as ground state.
  - Allow pickup during ground state for up to 2 s, then despawn.
  - Server considerations: If server spawn validation with time windows is active, ensure the linger window ≤ late tolerance. Optional server follow-up described below.
- Performance
  - Pools: separate pools for live obstacles, toppled trees, airborne items, ground items, and particle bursts.
  - Caps: configure `MAX_OBSTACLES`, `MAX_ITEMS_AIR`, `MAX_ITEMS_GROUND`, `MAX_TOPPLED`, `MAX_PARTICLES`.
  - Culling: immediately despawn off-screen entities beyond safe margins.
  - Atlas: consolidate small textures into a single atlas to reduce draw calls.

## Server Impact (Optional, backward-compatible)
- If using server-enforced pickup windows (Iteration 5 Spawn Schedule), add an optional late-window bonus for ground state:
  - New option: `AntiCheat:PickupGroundLateBonusMs` (default 0). When > 0 and item is flagged as ground-eligible in schedule, allow `late += bonus`.
  - Schedule marks items with `lingerMs` (0–2000). Anti-cheat validates pickups within `[tHit .. tHit + late + bonus]` if `lingerMs > 0`.
  - If schedule/windows are not yet active, keep client linger ≤ current windows to avoid rejections.

## Implementation Steps
1) Assets & Atlas
   - Add simple parallax textures and small particle texture (WebP if possible).
   - Generate a texture atlas (JSON) for trees/items/particles; update loaders.
2) Parallax & HUD polish
   - Add layers and update loop for parallax. Refine score/multiplier UI with better contrast and alignment.
3) Feedback systems
   - Add hit-stop, camera shake, and player flash toggled by collision system hooks.
   - Add pooled particle bursts for collisions and item pickups.
4) Physics-like entities
   - Toppled trees: implement state machine (spawning → toppling → settled → despawn) with tweens and timers.
   - Ground items: implement fall → bounce → ground → despawn timeline.
   - Adjust collision checks to include toppled trees and ground items, with AABB approximations.
5) Performance hardening
   - Introduce caps and culling. Ensure all new entities are pooled and recyclable.
   - Audit per-frame allocations; convert hot-path closures to pre-bound functions.
6) Optional server knob
   - Add `PickupGroundLateBonusMs` to options and anti-cheat validation (behind feature flag), with tests.
7) Dev tooling
   - Add a debug toggle (`P` key) to show FPS/perf overlay (dev only, excluded from prod build if desired).

## Constants (extend gameConfig.ts)
```
export const TOPPLE_DURATION_MS = 750; // rotation/slide time
export const TOPPLE_BLOCK_MS = 2500;   // ground block duration
export const ITEM_GROUND_MS = 2000;    // item linger duration
export const MAX_OBSTACLES = 20;
export const MAX_TOPPLED = 6;
export const MAX_ITEMS_AIR = 12;
export const MAX_ITEMS_GROUND = 8;
export const MAX_PARTICLES = 80;
```

## Patch Sketches (client)
Note: Names and paths align with existing structure; actual code to be implemented in follow-up PRs.

```
*** Update File: src/KnutGame.Client/src/gameConfig.ts
@@
 export const SPAWN_INTERVAL_DECAY = 10;
+export const TOPPLE_DURATION_MS = 750;
+export const TOPPLE_BLOCK_MS = 2500;
+export const ITEM_GROUND_MS = 2000;
+export const MAX_OBSTACLES = 20;
+export const MAX_TOPPLED = 6;
+export const MAX_ITEMS_AIR = 12;
+export const MAX_ITEMS_GROUND = 8;
+export const MAX_PARTICLES = 80;
```

```
*** Add File: src/KnutGame.Client/src/systems/physicsLike.ts
+export type ToppleConfig = { durationMs: number };
+export type LingerConfig = { groundMs: number };
+
+export function toppleTimeline(t: number, cfg: ToppleConfig) {
+  const clamped = Math.max(0, Math.min(cfg.durationMs, t));
+  const p = clamped / cfg.durationMs; // 0..1
+  // EaseOutCubic approximation for rotation progress
+  const eased = 1 - Math.pow(1 - p, 3);
+  const angleDeg = -90 * eased; // rotate left by default; sign decided by collision side
+  const slidePx = 12 * eased;
+  return { angleDeg, slidePx };
+}
+
+export function shouldDespawnGround(tSinceGroundMs: number, cfg: LingerConfig) {
+  return tSinceGroundMs >= cfg.groundMs;
+}
```

```
*** Add File: src/KnutGame.Client/test/physicsLike.spec.ts
+import { describe, it, expect } from 'vitest'
+import { toppleTimeline, shouldDespawnGround } from '../src/systems/physicsLike'
+
+describe('physics-like timelines', () => {
+  it('toppleTimeline eases to ~-90deg', () => {
+    const end = toppleTimeline(750, { durationMs: 750 });
+    expect(end.angleDeg).toBeLessThanOrEqual(-89);
+  });
+  it('ground despawn respects config window', () => {
+    expect(shouldDespawnGround(1000, { groundMs: 2000 })).toBe(false);
+    expect(shouldDespawnGround(2000, { groundMs: 2000 })).toBe(true);
+  });
+});
```

## Patch Sketch (server, optional)
```
*** Add File: src/KnutGame.Server/Options/AntiCheatOptions.cs
+namespace KnutGame.Server.Options;
+public class AntiCheatOptions
+{
+    public int PickupWindowEarlyMs { get; set; } = 250;
+    public int PickupWindowLateMs { get; set; } = 350;
+    public int PickupBaseRadiusPx { get; set; } = 48;
+    public int PickupRadiusSlackPx { get; set; } = 16;
+    public int NetworkLatencyMs { get; set; } = 100;
+    public int PickupGroundLateBonusMs { get; set; } = 0; // new
+}
```

```
*** Update File: src/KnutGame.Server/Services/AntiCheatService.cs
@@
-var late = opts.PickupWindowLateMs + opts.NetworkLatencyMs;
+var late = opts.PickupWindowLateMs + opts.NetworkLatencyMs;
+if (serverItem.LingerMs > 0) late += opts.PickupGroundLateBonusMs; // optional late bonus when items can linger
```

## Tests
- Client unit tests
  - `physicsLike.spec.ts` validates topple and despawn timelines.
  - Pooling tests for caps (pure logic around counters and queues where possible).
- Server unit tests (optional)
  - AntiCheat: time window accepts a pickup within `PickupGroundLateBonusMs` when `LingerMs > 0`.
- Regression
  - Existing client and server test suites remain green.

## Verification
- Client
  - `npm run test` passes new unit tests.
  - `npm run build` produces acceptable bundle; no large regressions.
  - Manual: play sessions, verify topple animations, ground items, and sustained FPS.
- Server (if options added)
  - `dotnet test` passes including updated AntiCheat tests.

## Rollout & Tuning
- Provide config toggles to disable topple and ground linger quickly if needed.
- Start conservative with caps and durations; increase visual richness gradually.
- Collect feedback on mobile smoothness; adjust particle counts and layer speeds.

## Machine Spec (JSON)
```json
{
  "changes": [
    {"path": "src/KnutGame.Client/src/gameConfig.ts", "action": "append", "reason": "Add iteration 8 constants"},
    {"path": "src/KnutGame.Client/src/systems/physicsLike.ts", "action": "add", "reason": "Physics-like timelines (pure)"},
    {"path": "src/KnutGame.Client/test/physicsLike.spec.ts", "action": "add", "reason": "Unit tests for timelines"}
  ],
  "optional_changes": [
    {"path": "src/KnutGame.Server/Options/AntiCheatOptions.cs", "action": "add", "reason": "Expose ground late bonus option"},
    {"path": "src/KnutGame.Server/Services/AntiCheatService.cs", "action": "patch", "reason": "Apply late bonus when items linger"}
  ],
  "commands": [
    {"name": "client_tests", "cmd": "npm test -- --run", "cwd": "src/KnutGame.Client"},
    {"name": "client_build", "cmd": "npm run build", "cwd": "src/KnutGame.Client"},
    {"name": "server_tests", "cmd": "dotnet test", "cwd": "."}
  ],
  "acceptance": [
    "Polished visuals without FPS drops",
    "Topple and ground linger behaviors work and are capped",
    "All tests pass; no API regressions"
  ]
}
```

