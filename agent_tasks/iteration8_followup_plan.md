# Iteration 8 — Follow‑Up Implementation Plan (Visuals, Physics‑Like, Performance)

Purpose: implement the remaining Iteration 8 features in an order that protects FPS and stability, with clear milestones and performance guardrails.

## Priority Order

1) Enforce Caps + Baseline Pooling
- Tasks:
  - Enforce `MAX_OBSTACLES`, `MAX_ITEMS_AIR`, `MAX_ITEMS_GROUND`, `MAX_PARTICLES` in update/spawn paths.
  - Add a tiny pool helper and convert ad‑hoc creations (esp. particles) to use pooling.
- Performance rationale:
  - Caps prevent unbounded growth of active objects that cause frame drops and GC pressure.
  - Pooling eliminates hot‑path allocations and frequent GC, reducing jank and improving input latency consistency.

2) Toppled Trees (State Machine)
- Tasks:
  - On player–tree collision: convert obstacle to a pooled “toppled tree” entity with timeline: topple → settle (block) → fade/despawn.
  - Adjust collision footprint during topple/settle using an oriented OBB approximation.
  - Respect `TOPPLE_DURATION_MS` and `TOPPLE_BLOCK_MS` and pool all toppled entities.
- Performance rationale:
  - Implemented with tweens/state transitions but reusing objects; avoids spawning new physics bodies every time.
  - Keeps per‑frame math minimal (no heavy physics), ensuring stable CPU time.

3) Ground Item Bounce + Linger
- Tasks:
  - Items reaching lane perform a short bounce, then enter a ground‑linger state up to `ITEM_GROUND_MS`, collectible during this window.
  - Despawn cleanly after linger; pool ground‑state items separately or mark state flags to reuse same object.
- Performance rationale:
  - Constraining linger duration and pooling ensures bounded object lifetimes; avoids idle updates for long‑lived objects.

4) Particle System Rework (Pooled Bursts)
- Tasks:
  - Replace per‑event creation/destroy with a pooled particle dot/emitter system and a global `MAX_PARTICLES` cap.
  - Provide burst helpers for hits, pickups, and ambient effects.
- Performance rationale:
  - Particle storms can create allocation spikes; pooling and caps avoid GC churn and keep frame times predictable.

5) Visual Polish
- Tasks:
  - Add 2–3 parallax layers (TileSprites) with differing scroll factors.
  - Add a subtle vignette pulse on hits (lightweight overlay tween).
- Performance rationale:
  - TileSprites reuse a small texture region and minimize draw cost compared to large bitmaps; vignette as a single quad is negligible.

6) Performance Hardening + Dev HUD
- Tasks:
  - Add a dev HUD toggle to display FPS and live counts for active/pool sizes (obstacles, items, toppled, particles).
  - Audit per‑frame allocations; prebind callbacks; early‑out culling; ensure all new systems respect caps.
- Performance rationale:
  - Visibility of counts helps catch leaks early; fewer allocations reduce GC and micro‑stutter; culling reduces per‑frame work.

7) Assets Pipeline (Optional but Valuable)
- Tasks:
  - Introduce a small sprite atlas for common assets; prefer WebP where quality allows.
  - Update loaders to use atlas frames and validate scaling.
- Performance rationale:
  - Atlases reduce draw calls and texture binds; WebP shrinks downloads and memory footprint on load.

8) Optional Server Knob (Backward‑Compatible)
- Tasks:
  - Add `AntiCheatOptions.PickupGroundLateBonusMs` and apply when server schedule allows item linger.
  - Keep default 0; add tests to validate acceptance window.
- Performance rationale:
  - N/A (server correctness/UX improvement, negligible perf impact).

## Milestones & Acceptance

- M1 Caps/Pooling: Caps enforced; particles/items/obstacles respect pools; FPS stable in dense scenes.
- M2 Topple: Trees topple, block for configured time, and despawn; no leaks; unit tests for timeline math.
- M3 Ground Linger: Items bounce/linger and despawn; pickups accepted; tests for linger timing.
- M4 Particles Pooled: Hit/pickup effects use pooled bursts; cap respected under spam.
- M5 Visual Polish: Parallax visible; vignette pulse on hit; no regressions in FPS.
- M6 Perf HUD: Live counts visible; audit removes hot‑path allocations and redundant work.
- M7 Atlas/WebP: Atlas integrated; load path updated; bundle size/load time improve.
- M8 Server Knob: Option exists; anti‑cheat tests green; client behavior unchanged when 0.

## Testing & Verification

- Unit tests:
  - Physics‑like timelines (`topple`, `linger`) and pooling/cap utilities.
  - Collision footprint checks for toppled trees (math‑only helpers).
- Client checks:
  - `npm run test` green; manual play verifies topple, linger, parallax, and no perf dips.
  - Stress test with elevated spawn rates to confirm caps hold and FPS ≥ 60 desktop.
- Server (optional knob):
  - xUnit test for adjusted pickup window acceptance when linger allowed.

## Notes

- Keep behavior behind flags as needed to reduce risk; default to conservative visuals.
- Document any tuning constants added to `gameConfig.ts` and reference them in the HUD for quick checks during testing.

