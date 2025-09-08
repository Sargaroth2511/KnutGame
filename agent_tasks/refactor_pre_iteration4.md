# Agent Task: Refactor Prep Before Iteration 4 (No Behavior Change)

Purpose: Reduce complexity and improve maintainability of the client code before adding items/highscore. Keep tests green and behavior identical.

## Constraints
- No behavior changes. Existing gameplay, timings, UI, and tests must remain identical.
- Keep public API of `MainScene` intact (methods like `spawnObstacle`, `checkCollisions` must still exist).
- Keep patch small and safe; avoid broad renames or moves.

## Targets
- `src/KnutGame.Client/src/MainScene.ts` — high responsibility; extract constants and add cleanup hooks.
- `src/KnutGame.Client/src/style.css` — remove unused template rules.

## Acceptance Criteria
- All numbers currently hardcoded in `MainScene.ts` come from a new `gameConfig.ts` constants module.
- `MainScene` registers cleanup for event listeners on scene shutdown/destroy.
- CSS no longer contains unused `.logo`, `.card`, `.read-the-docs` rules.
- All tests pass: `npm run test` (client) and `dotnet test` (server).
- No bundle size regression beyond noise (< 1%).

## Steps

1) Extract configuration constants
- Add `src/KnutGame.Client/src/gameConfig.ts` exporting constants used by the scene.
- Replace magic numbers in `MainScene.ts` with imports.

2) Add lifecycle cleanup in `MainScene`
- Unregister `document.visibilitychange` and input listeners on shutdown/destroy to avoid leaks on scene restart.

3) CSS cleanup
- Delete unused rules: `.logo`, `.card`, `.read-the-docs`.
- Do not change any rules that affect current visuals (container/canvas/body).

## Suggested Patches (apply carefully)

Add constants file:
```
*** Add File: src/KnutGame.Client/src/gameConfig.ts
+export const MOVE_SPEED = 200;
+export const FALL_SPEED_MIN = 150;
+export const FALL_SPEED_MAX = 250;
+export const INVULNERABILITY_MS = 1000;
+export const SPAWN_INTERVAL_START = 2000;
+export const SPAWN_INTERVAL_MIN = 800;
+export const SPAWN_INTERVAL_DECAY = 10;
```

Import and use in `MainScene.ts`:
```
*** Update File: src/KnutGame.Client/src/MainScene.ts
@@
-import Phaser from 'phaser'
+import Phaser from 'phaser'
+import {
+  MOVE_SPEED,
+  FALL_SPEED_MIN,
+  FALL_SPEED_MAX,
+  INVULNERABILITY_MS,
+  SPAWN_INTERVAL_START,
+  SPAWN_INTERVAL_MIN,
+  SPAWN_INTERVAL_DECAY
+} from './gameConfig'
@@
-  private spawnInterval: number = 2000 // Start with 2 seconds between spawns
+  private spawnInterval: number = SPAWN_INTERVAL_START // Start with 2 seconds between spawns
@@
-      playerBody.setVelocityX(-200)
+      playerBody.setVelocityX(-MOVE_SPEED)
@@
-      playerBody.setVelocityX(200)
+      playerBody.setVelocityX(MOVE_SPEED)
@@
-      playerBody.setVelocityX(-200)
+      playerBody.setVelocityX(-MOVE_SPEED)
@@
-      playerBody.setVelocityX(200)
+      playerBody.setVelocityX(MOVE_SPEED)
@@
-      if (this.spawnInterval > 800) {
-        this.spawnInterval -= 10
+      if (this.spawnInterval > SPAWN_INTERVAL_MIN) {
+        this.spawnInterval -= SPAWN_INTERVAL_DECAY
       }
@@
-      obsBody.setVelocityY(150 + Math.random() * 100) // Variable fall speed
+      obsBody.setVelocityY(FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)) // Variable fall speed
@@
-    this.invulnerableTimer = 1000
+    this.invulnerableTimer = INVULNERABILITY_MS
@@
-    this.spawnInterval = 2000
+    this.spawnInterval = SPAWN_INTERVAL_START
```

Add lifecycle cleanup (listeners are defined in `create()`):
```
*** Update File: src/KnutGame.Client/src/MainScene.ts
@@
   create() {
@@
-    // Handle visibility change (tab switching)
-    document.addEventListener('visibilitychange', () => {
-      if (document.hidden) {
-        this.pauseGame()
-      } else {
-        this.resumeGame()
-      }
-    })
+    // Handle visibility change (tab switching)
+    const onVisibility = () => {
+      if (document.hidden) this.pauseGame(); else this.resumeGame();
+    };
+    document.addEventListener('visibilitychange', onVisibility)
@@
-    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
+    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
       if (pointer.x < this.cameras.main.width / 2) {
         // Left side of screen - move left
         const playerBody = this.player.body as Phaser.Physics.Arcade.Body
-        playerBody.setVelocityX(-200)
+        playerBody.setVelocityX(-MOVE_SPEED)
       } else {
         // Right side of screen - move right
         const playerBody = this.player.body as Phaser.Physics.Arcade.Body
-        playerBody.setVelocityX(200)
+        playerBody.setVelocityX(MOVE_SPEED)
       }
-    })
+    }

-    this.input.on('pointerup', () => {
+    const onPointerUp = () => {
       const playerBody = this.player.body as Phaser.Physics.Arcade.Body
       playerBody.setVelocityX(0)
-    })
+    }
+
+    this.input.on('pointerdown', onPointerDown)
+    this.input.on('pointerup', onPointerUp)
+
+    // Register cleanup on shutdown/destroy
+    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
+      document.removeEventListener('visibilitychange', onVisibility)
+      this.input.off('pointerdown', onPointerDown)
+      this.input.off('pointerup', onPointerUp)
+    })
+    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
+      document.removeEventListener('visibilitychange', onVisibility)
+      this.input.off('pointerdown', onPointerDown)
+      this.input.off('pointerup', onPointerUp)
+    })
   }
```

CSS cleanup:
```
*** Update File: src/KnutGame.Client/src/style.css
@@
-.logo:hover {
-  filter: drop-shadow(0 0 2em #646cffaa);
-}
-.logo.vanilla:hover {
-  filter: drop-shadow(0 0 2em #3178c6aa);
-}
-
-.card {
-  padding: 2em;
-}
-
-.read-the-docs {
-  color: #888;
-}
+/* removed unused template styles (.logo, .card, .read-the-docs) */
```

## Verification
- Client tests: `cd src/KnutGame.Client && npm test` (should remain green).
- Manual smoke: Run the app, verify movement speed, spawn timing, and invulnerability feel identical.
- Bundle check: `npm run build` and compare asset sizes (no significant increase).

## Commit Message
- refactor(client): extract constants, add scene cleanup; remove unused CSS

## Machine Spec (JSON)
```json
{
  "changes": [
    {"path": "src/KnutGame.Client/src/gameConfig.ts", "action": "add", "reason": "Extract game constants"},
    {"path": "src/KnutGame.Client/src/MainScene.ts", "action": "patch", "reason": "Use constants and add cleanup"},
    {"path": "src/KnutGame.Client/src/style.css", "action": "patch", "reason": "Remove unused rules"}
  ],
  "commands": [
    {"name": "client_tests", "cmd": "npm test -- --run", "cwd": "src/KnutGame.Client"},
    {"name": "client_build", "cmd": "npm run build", "cwd": "src/KnutGame.Client"}
  ],
  "acceptance": [
    "All tests remain green",
    "No behavior change observed",
    "No notable bundle size increase"
  ]
}
```

