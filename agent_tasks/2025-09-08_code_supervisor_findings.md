# Code Supervisor Findings – KnutGame (2025-09-08)

This document captures current issues, severities, rationale, and concrete next steps. Fixes applied: F-001, F-002, F-003.

## Human Summary
- Compression order prevented asset gzip/brotli; fixed to compress static files.
- `MainScene` god-object issues mitigated: extracted HUD, Spawner, and CollisionSystem.
- Obstacle/item speeds re-randomized every frame; fixed by storing once on spawn.
- Vite config test is string-based; acceptable but brittle.
- `canvas` dev dep appears unused; safe to remove.

## Findings (Annotated)

### F-001 [MAJOR][Perf] Response compression after static files
- Location: `src/KnutGame.Server/Program.cs`
- Evidence: `UseResponseCompression()` was invoked after `UseStaticFiles()`; static assets were not compressed.
- Rationale: Middleware order matters. To compress static responses, compression must run before the static file middleware(s).
- Fix (APPLIED): Move `app.UseResponseCompression()` before both static files registrations.
- Validation:
  - Run server and request an asset with `Accept-Encoding: gzip, br`.
  - Expect `Content-Encoding: br` or `gzip` for `/game/assets/*`.
- Unified diff:
```
*** Begin Patch
*** Update File: src/KnutGame.Server/Program.cs
@@
 app.UseHttpsRedirection();
-
-// Serve static files (default /wwwroot)
-app.UseStaticFiles();
+// Enable compression early so it applies to static files too
+app.UseResponseCompression();
+
+// Serve static files (default /wwwroot)
+app.UseStaticFiles();
@@
-// Compression after static file setup is fine too
-app.UseResponseCompression();
+// (Compression already enabled above)
*** End Patch
```

### F-002 [MAJOR][SOLID] `MainScene` concentrates many responsibilities (APPLIED)
- Location: `src/KnutGame.Client/src/MainScene.ts`
- Rationale: Scene currently owns input handling, HUD rendering, spawning, collision, scoring, items, and lifecycle. High coupling and low cohesion impede testability and future changes.
- Applied refactor (behavior preserved):
  - Added `src/KnutGame.Client/src/ui/Hud.ts` and integrated in `MainScene`.
  - Added `src/KnutGame.Client/src/systems/Spawner.ts` with `ObstacleSpawner` and `ItemSpawner`; `MainScene` now delegates spawn/remove.
  - Added `src/KnutGame.Client/src/systems/CollisionSystem.ts`; `MainScene` delegates collision checks.
  - Kept scoring as pure system and wired via scene; method names `spawnObstacle`, `checkCollisions` preserved for tests.
- Benefits: Improved SRP, lower coupling, clearer seams for further evolution.

Additional note (TS config):
- With `"erasableSyntaxOnly": true`, TypeScript parameter properties are disallowed. Updated `Spawner.ts` to avoid `constructor(private scene: ...)` and instead declare and assign explicitly.
- Server: To avoid Razor resolution issues, `Error.cshtml` now uses fully-qualified model `@model KnutGame.Pages.ErrorModel`.

### F-003 [MINOR][Behavior/Perf] Random speeds recalculated every frame (APPLIED)
- Locations:
  - Obstacles update: `MainScene.ts` around lines where `obsBody.setVelocityY(baseSpeed * slowMoFactorValue)` is executed; `baseSpeed` is recomputed per frame.
  - Items update: same pattern for items.
- Risk: Jittery motion, unnecessary RNG cost each frame. Also makes difficulty non-deterministic.
- Fix: Assign a fixed `speed` at spawn (`setData('speed', value)`) and reuse in update.
- Implemented changes:
  - `src/KnutGame.Client/src/MainScene.ts` — set `speed` in `spawnObstacle()` and `spawnItem()` using `Phaser.Math.Between(...)`.
  - Use stored `speed` in the update loop for obstacles and items.
- Unified diff (excerpt):
```
@@
-      const baseSpeed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
-      obsBody.setVelocityY(baseSpeed * slowMoFactorValue)
+      const speed = (obs.getData('speed') as number) ?? FALL_SPEED_MIN
+      obsBody.setVelocityY(speed * slowMoFactorValue)
@@
-      const baseSpeed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
-      itmBody.setVelocityY(baseSpeed * slowMoFactorValue)
+      const speed = (itm.getData('speed') as number) ?? FALL_SPEED_MIN
+      itmBody.setVelocityY(speed * slowMoFactorValue)
@@
+    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
+    obstacle.setData('speed', speed)
@@
+    const speed = Phaser.Math.Between(FALL_SPEED_MIN, FALL_SPEED_MAX)
+    item.setData('speed', speed)
```

### F-004 [MINOR][Tests] Vite config test relies on string search (APPLIED)
- Location: `src/KnutGame.Client/test/viteConfig.spec.ts`
- Change: Replace brittle string greps with a VM-based parse of `vite.config.ts` that extracts the object literal from `defineConfig(...)` and evaluates it in a sandbox, asserting `base` and `build.outDir`.
- Rationale: Avoids esbuild/TS import pitfalls in CI and is resilient to whitespace/comment changes.
- Validation: Vitest suite passes (11/11).

### F-005 [MINOR][Tooling] Potentially unused devDependency: `canvas`
- Location: `src/KnutGame.Client/package.json`
- Observation: No tests import/use `canvas`; JSDOM suffices.
- Action: If not used intentionally, remove to speed CI installs: `npm pkg delete devDependencies.canvas`.

## Action Plan (≤30 min each)
1. Verify compression change with a quick request (curl instructions below).
2. Draft `Hud` extraction (non-behavioral refactor); keep public API stable.
3. Optional: Remove `canvas` from devDependencies if unused.
4. Optional: Replace `viteConfig` string test with a config import test.

## Validation Commands
- Check compression header for game asset:
  - `curl -I -H "Accept-Encoding: gzip, br" https://localhost:7104/game/assets/main-*.js`
  - Expect `Content-Encoding: br` (or `gzip`).
- Run tests:
  - Client: `npm -C src/KnutGame.Client test -- --run`
  - Server: `dotnet test`

## Notes
- CI already builds client first, ensuring manifest exists before server tests run.
- Scoring is already a pure system; refactors should keep that pattern for other concerns.
