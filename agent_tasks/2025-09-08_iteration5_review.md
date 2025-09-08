# Iteration 5 Review — Server‑Authoritative Scoring & Anti‑Cheat

## Human Summary
- API, DB, and core services are in place; integration tests mostly pass.
- Tests currently fail due to DB initialization race/duplication (`EnsureCreated` on SQLite).
- Anti‑cheat covers basics (duration, monotonic time, speed, bounds, duplicates, size caps) but misses proximity/duration cross‑checks.
- Scoring engine computes base + item points only; does not simulate multiplier windows.
- Client submits payload on game over but doesn’t buffer `moves/hits/items` during play yet.
- IP hashing uses raw IP (no salt); add salt to reduce risk.
- A few TODOs left in `ScoreService` (duration, item count).

## Findings (Annotated)

- [BLOCKER] DB init causes test failure (table exists)
  - Files: `src/KnutGame.Server/Program.cs:~86–96`
  - Details: `Database.EnsureCreated()` throws `SQLite Error 1: 'table "Scores" already exists'` in tests where app starts multiple times using the same file DB.
  - Fix options:
    - Prefer `Database.Migrate()` with an initial migration (recommended), or
    - Wrap `EnsureCreated()` in try/catch for Sqlite "already exists" and ignore, and/or create DB only when file absent, and
    - For tests, use a per‑run/temp DB (e.g., `Data Source=knutgame_test_{Guid}.db`) or in‑memory SQLite.

- [MAJOR] Client doesn’t buffer gameplay events
  - Files: `src/KnutGame.Client/src/MainScene.ts`
  - Details: `sessionEvents` exists but nothing pushes `moves`, `hits`, or `items` during play.
  - Fix: Add event buffering:
    - Moves: every ~100ms push `{ t: nowMs, x: player.x }`.
    - Hit: in `handleCollision()` push `{ t: nowMs }`.
    - Item: in `handleItemCollection()` push `{ t, id, type, x, y }`.

- [MAJOR] Anti‑cheat misses key validations
  - Files: `src/KnutGame.Server/Services/AntiCheatService.cs`
  - Gaps:
    - Duration vs last event time: `lastT` should ≈ `(End-Start)` ± tolerance.
    - Item pickup proximity to player path at time `t` (within 48px, Y band near player lane).
    - “No events after game over” (needs client to indicate game over t or derive from hits/lives).
  - Fix: Add these checks; extend DTO if needed (e.g., `GameOverT`).

- [MAJOR] Scoring engine not applying multipliers
  - Files: `src/KnutGame.Server/Services/ScoringEngine.cs`
  - Details: Only duration base + `POINTS` bonus; ignores multiplier windows and slowmo effects.
  - Fix: Simulate scoring state over time using events:
    - Maintain `score`, `multiplier`, `multiplierRemainingMs`.
    - On `MULTI` item: set multiplier/duration; on tick, accrue `BASE_POINTS_PER_SEC * multiplier`.
    - Keep slowmo physics out of scoring.
  - Tests: Add cases mirroring client `scoring.ts` tests for multiplier windows.

- [MAJOR] IP hashing without salt
  - Files: `src/KnutGame.Server/Program.cs:~114–121`
  - Details: Raw IP hashed with SHA256 only.
  - Fix: Add salt from `appsettings` (e.g., `Security:IpHashSalt`), compute `SHA256(salt + ip)`.

- [MINOR] `ScoreService` leaves metadata defaulted
  - Files: `src/KnutGame.Server/Services/ScoreService.cs`
  - Details: `DurationMs = 0`, `ItemsCollected = 0`.
  - Fix: Compute from request: duration and `events.items.Count`.

- [MINOR] Async warning on start endpoint
  - Files: `src/KnutGame.Server/Program.cs:94`
  - Details: `async` lambda without await.
  - Fix: Drop `async` or return `Task.FromResult(Results.Ok(...))`.

## Action Plan (Small, Safe Steps)
1. DB init
   - Add appsetting `ConnectionStrings:DefaultConnection` for tests (unique temp file per run) or switch tests to in‑memory SQLite.
   - Replace `EnsureCreated()` with guarded create or migrations. Quick fix: try/catch Sqlite "already exists".
2. Client event buffering
   - Implement move sampling timer; add pushes in `handleCollision` and `handleItemCollection`.
   - Add minimal unit checks (if applicable) to ensure arrays are populated.
3. Anti‑cheat enhancements
   - Add last‑t vs duration check (±500ms tolerance).
   - Add item proximity check (|playerX - item.x| ≤ 48 at `t`, Y band near bottom lane).
   - Consider extending payload with `gameOverT` to enforce no events after end.
   - Extend AntiCheatTests for new rules.
4. Scoring engine
   - Implement multiplier window simulation; add tests mirroring client scoring behavior.
5. IP hashing
   - Read salt from config; compute salted SHA256. Document usage.
6. Score metadata
   - Fill `DurationMs` and `ItemsCollected`.
7. Clean warning
   - Remove `async` from `/api/session/start` handler or use `Task.FromResult`.

## Suggested Patch Sketches
- Program.cs (DB init guard)
  - Wrap EnsureCreated in try/catch for SqliteException "already exists"; or better, add migrations and call `Migrate()`.
- AntiCheatService.cs
  - After monotonic pass, compute `expected = (End-Start).TotalMilliseconds` and compare to `lastT`.
  - For proximity, interpolate player x at item.t from neighboring moves; compare distance.
- ScoringEngine.cs
  - Iterate time windows between significant events (start, multiplier start/end) and add `BASE_POINTS_PER_SEC * multiplier * seconds`.
- MainScene.ts
  - Add a small accumulator to push `moves` every 100ms; push hits/items where appropriate.

## Test Additions
- tests/KnutGame.Server.Tests/AntiCheatTests.cs
  - Rejects when `lastT` deviates > 500ms from duration.
  - Rejects item pickup far from player path.
- tests/KnutGame.Server.Tests/ScoringEngineTests.cs
  - Applies multiplier for a given window and reverts to 1 afterward.
- tests/KnutGame.Server.Tests/BasicIntegrationTests.cs
  - Submitting valid payload with items → accepted + expected score.

## Notes
- Long‑term: prefer EF Core migrations over EnsureCreated for reliable schema management.
- Consider per‑environment connection strings (Dev/Tests) to isolate DBs and avoid cross‑test interference.
