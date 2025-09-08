# Agent Task: Iteration 4 — Items, Scoring, Local Highscore (Test‑First)

Goal: Add collectible items that affect scoring and gameplay, plus a persistent local highscore. Keep performance and code quality high; implement with pure/core logic separated for easy testing.

## Constraints
- Test‑first: add unit tests before wiring runtime where possible.
- No regressions to Iterations 1–3 behavior.
- Keep Phaser‑dependent code thin; put logic into pure TS modules.
- Performance: no leaks; reuse pools; minimal allocations per frame.

## Feature Summary
- Item types: `POINTS`, `LIFE`, `SLOWMO`, `MULTI`.
- Scoring: base +10 points/second; items add effects:
  - `POINTS`: +100 instant points.
  - `LIFE`: +1 life (cap at 5).
  - `SLOWMO`: 50% slow motion for 5s (affects obstacle fall speed).
  - `MULTI`: 2x score multiplier for 7s.
- Local highscore: persist best score in `localStorage` under `knut_highscore_v1`.
- UI: show current score (existing), multiplier indicator, and best score. On game over, update and display highscore.

## Acceptance Criteria
- Items spawn and can be collected; each item applies the correct effect.
- Score ticks at 10 pts/sec; multiplier and points item adjust score accordingly.
- Lives can increase up to 5 via LIFE item.
- Slow motion reduces obstacle speed by 50% while active.
- Highscore persists between sessions and displays on screen.
- Tests pass for scoring/multiplier math and local highscore persistence.

## Plan
1) Core modules (pure): scoring and local highscore services.
2) Item model + basic spawn/collect logic in scene (simple shapes; reuse pooling).
3) Wire score updates, multiplier/slowmo timers, highscore update on game over.
4) UI additions for multiplier and best score.
5) Tests for core modules; smoke test manually.

## Constants
Augment `src/KnutGame.Client/src/gameConfig.ts`:
```
export const BASE_POINTS_PER_SEC = 10;
export const MULTIPLIER_X = 2;
export const MULTIPLIER_MS = 7000; // 7s
export const SLOWMO_FACTOR = 0.5; // 50%
export const SLOWMO_MS = 5000; // 5s
export const LIFE_MAX = 5;
export const POINTS_ITEM_BONUS = 100;
export const ITEM_SPAWN_INTERVAL_MS = 2500;
export const ITEM_DROP_CHANCE = 0.35; // 35% on spawn tick
```

## New Files (core logic)
Add `scoring.ts` (pure functions) and `localHighscore.ts` (injectable storage), plus `items.ts` model.

```
*** Add File: src/KnutGame.Client/src/systems/scoring.ts
+export type ScoreState = {
+  score: number;
+  multiplier: number;            // e.g., 1 or 2
+  multiplierRemainingMs: number; // 0 when inactive
+  slowMoRemainingMs: number;     // 0 when inactive
+}
+
+export const createScoreState = (): ScoreState => ({
+  score: 0,
+  multiplier: 1,
+  multiplierRemainingMs: 0,
+  slowMoRemainingMs: 0,
+});
+
+export const tickScore = (s: ScoreState, dtMs: number, basePtsPerSec: number): ScoreState => {
+  const next: ScoreState = { ...s };
+  const seconds = Math.max(0, dtMs) / 1000;
+  next.score += Math.floor(seconds * basePtsPerSec * next.multiplier);
+  if (next.multiplierRemainingMs > 0) next.multiplierRemainingMs = Math.max(0, next.multiplierRemainingMs - dtMs);
+  if (next.multiplierRemainingMs === 0) next.multiplier = 1;
+  if (next.slowMoRemainingMs > 0) next.slowMoRemainingMs = Math.max(0, next.slowMoRemainingMs - dtMs);
+  return next;
+};
+
+export const applyPoints = (s: ScoreState, bonus: number): ScoreState => ({ ...s, score: s.score + bonus });
+
+export const applyMultiplier = (s: ScoreState, factor: number, durationMs: number): ScoreState => ({
+  ...s,
+  multiplier: Math.max(1, factor),
+  multiplierRemainingMs: Math.max(s.multiplierRemainingMs, durationMs),
+});
+
+export const applySlowMo = (s: ScoreState, durationMs: number): ScoreState => ({
+  ...s,
+  slowMoRemainingMs: Math.max(s.slowMoRemainingMs, durationMs),
+});
+
+export const slowMoFactor = (s: ScoreState, factor: number): number => (s.slowMoRemainingMs > 0 ? factor : 1);
+
*** End Patch
```

```
*** Add File: src/KnutGame.Client/src/services/localHighscore.ts
+export interface KeyValueStorage {
+  getItem(key: string): string | null;
+  setItem(key: string, value: string): void;
+}
+
+const KEY = 'knut_highscore_v1';
+
+export function getHighscore(storage?: KeyValueStorage): number {
+  const s = storage ?? (globalThis.localStorage as unknown as KeyValueStorage);
+  try {
+    const raw = s?.getItem(KEY);
+    const n = raw ? Number(JSON.parse(raw)) : 0;
+    return Number.isFinite(n) && n >= 0 ? n : 0;
+  } catch {
+    return 0;
+  }
+}
+
+export function setHighscore(value: number, storage?: KeyValueStorage): void {
+  const s = storage ?? (globalThis.localStorage as unknown as KeyValueStorage);
+  if (!s) return;
+  const v = Math.max(0, Math.floor(value));
+  try { s.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
+}
+
*** End Patch
```

```
*** Add File: src/KnutGame.Client/src/items.ts
+export enum ItemType { POINTS = 'POINTS', LIFE = 'LIFE', SLOWMO = 'SLOWMO', MULTI = 'MULTI' }
+
+export type ItemConfig = {
+  spawnIntervalMs: number;
+  dropChance: number; // 0..1 per interval
+}
+
+export const defaultItemConfig: ItemConfig = {
+  spawnIntervalMs: 2500,
+  dropChance: 0.35,
+};
+
*** End Patch
```

## Tests (Vitest)
Add unit tests that do not require Phaser runtime.

```
*** Add File: src/KnutGame.Client/test/scoring.spec.ts
+import { describe, it, expect } from 'vitest'
+import { createScoreState, tickScore, applyPoints, applyMultiplier, applySlowMo, slowMoFactor } from '../src/systems/scoring'
+
+describe('scoring system', () => {
+  it('ticks base score at 10 pts/sec', () => {
+    let s = createScoreState();
+    s = tickScore(s, 1000, 10);
+    expect(s.score).toBe(10);
+  });
+
+  it('applies multiplier for limited duration', () => {
+    let s = createScoreState();
+    s = applyMultiplier(s, 2, 2000);
+    s = tickScore(s, 1000, 10); // 1 sec * 10 * 2
+    expect(s.score).toBe(20);
+    s = tickScore(s, 2000, 10); // expires after total 3s, last second un-multiplied
+    expect(s.multiplier).toBe(1);
+  });
+
+  it('adds points from POINTS item', () => {
+    let s = createScoreState();
+    s = applyPoints(s, 100);
+    expect(s.score).toBe(100);
+  });
+
+  it('slowmo exposes factor when active', () => {
+    let s = createScoreState();
+    s = applySlowMo(s, 5000);
+    expect(slowMoFactor(s, 0.5)).toBe(0.5);
+    s = tickScore(s, 6000, 10);
+    expect(slowMoFactor(s, 0.5)).toBe(1);
+  });
+});
+
*** End Patch
```

```
*** Add File: src/KnutGame.Client/test/localHighscore.spec.ts
+import { describe, it, expect } from 'vitest'
+import { getHighscore, setHighscore, type KeyValueStorage } from '../src/services/localHighscore'
+
+const memStore = (): KeyValueStorage => {
+  const map = new Map<string, string>();
+  return {
+    getItem: (k) => map.get(k) ?? null,
+    setItem: (k, v) => { map.set(k, v) }
+  }
+}
+
+describe('localHighscore', () => {
+  it('persists and retrieves best score', () => {
+    const s = memStore();
+    expect(getHighscore(s)).toBe(0);
+    setHighscore(123, s);
+    expect(getHighscore(s)).toBe(123);
+  });
+
+  it('ignores invalid stored values', () => {
+    const s = memStore();
+    (s as any).setItem('knut_highscore_v1', '"not a number"');
+    expect(getHighscore(s)).toBe(0);
+  });
+});
+
*** End Patch
```

## Wire into MainScene (high‑level steps)
- Imports:
  - `items.ts` for `ItemType`.
  - `systems/scoring.ts` functions and state.
  - `services/localHighscore.ts` get/set.
  - Add new constants from `gameConfig.ts`.
- Scene state additions:
  - `private scoreState = createScoreState()`; remove direct int math where appropriate.
  - `private multiplierText!: Phaser.GameObjects.Text` and `private bestText!: Phaser.GameObjects.Text`.
  - Item group/pool similar to obstacles; timers: `itemSpawnTimer`, `itemSpawnInterval`.
- In `create()`:
  - Initialize texts: `bestText` from `getHighscore()`.
  - Set `itemSpawnInterval = ITEM_SPAWN_INTERVAL_MS`.
- In `update(time, delta)`:
  - Score tick: `scoreState = tickScore(scoreState, delta, BASE_POINTS_PER_SEC)`; update `scoreText`.
  - Multiplier UI: show `x2` while `multiplierRemainingMs > 0`.
  - Slowmo: compute `factor = slowMoFactor(scoreState, SLOWMO_FACTOR)` and multiply obstacle velocities by `factor`.
  - Item spawn: accumulate `itemSpawnTimer += delta`; when >= interval, roll `Math.random() < ITEM_DROP_CHANCE` → spawn item from pool at top similar to obstacles.
  - Item collection: AABB with player → apply effect:
    - POINTS: `applyPoints(scoreState, POINTS_ITEM_BONUS)`
    - LIFE: `lives = Math.min(LIFE_MAX, lives + 1)` and update lives UI
    - SLOWMO: `scoreState = applySlowMo(scoreState, SLOWMO_MS)`
    - MULTI: `scoreState = applyMultiplier(scoreState, MULTIPLIER_X, MULTIPLIER_MS)`
  - Despawn items leaving screen; return to pool.
- On `gameOver()`:
  - Compare `scoreState.score` to `getHighscore()`; if higher, `setHighscore()` and update `bestText`.
  - Optionally display “New Highscore!”
- On `restartGame()`:
  - Reset `scoreState = createScoreState()`; clear items; reset timers; keep `bestText` value.

## Minimal UI guidance
- Place `bestText` at top‑right under current score.
- Place `multiplierText` near score; hide when multiplier inactive.

## Commands
- `npm run test` (client) — ensures new tests pass.
- `npm run build` (client) — verify bundle and that no types break.
- `dotnet test` (server) — sanity check server tests.

## Commit Message
- feat(client): items, scoring system, and local highscore with tests

## Machine Spec (JSON)
```json
{
  "changes": [
    {"path": "src/KnutGame.Client/src/systems/scoring.ts", "action": "add"},
    {"path": "src/KnutGame.Client/src/services/localHighscore.ts", "action": "add"},
    {"path": "src/KnutGame.Client/src/items.ts", "action": "add"},
    {"path": "src/KnutGame.Client/test/scoring.spec.ts", "action": "add"},
    {"path": "src/KnutGame.Client/test/localHighscore.spec.ts", "action": "add"},
    {"path": "src/KnutGame.Client/src/gameConfig.ts", "action": "append", "reason": "Add iteration 4 constants"},
    {"path": "src/KnutGame.Client/src/MainScene.ts", "action": "patch", "reason": "Wire scoring + items + highscore"}
  ],
  "commands": [
    {"name": "client_tests", "cmd": "npm test -- --run", "cwd": "src/KnutGame.Client"},
    {"name": "client_build", "cmd": "npm run build", "cwd": "src/KnutGame.Client"},
    {"name": "server_tests", "cmd": "dotnet test", "cwd": "."}
  ],
  "acceptance": [
    "Items spawn and apply effects",
    "Score ticks at 10 pts/sec; multiplier and points adjust",
    "Lives increase up to 5 via LIFE",
    "Slowmo halves obstacle speed while active",
    "Highscore persists and updates on game over",
    "All tests pass"
  ]
}
```

