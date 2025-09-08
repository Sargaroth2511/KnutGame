# Agent Task: Iteration 5 — Server Spawn Events + Anti‑Cheat Validation Windows

## Goal
Make item collection server‑authoritative by emitting server spawn events and validating client pickup events against server‑known item IDs, time windows, and hit areas. Add configuration to tune latency/time tolerances.

## Constraints
- No regressions to existing APIs/tests unless updated herein.
- Keep transport simple first (SSE or batched REST). WebSocket optional.
- Deterministic schedule (seeded) or server‑emitted events only.
- Test‑first for core logic (schedule determinism and validations).

## High‑Level Design
- Server owns the item spawn schedule per session (ID, type, X, spawn time, fall speed).
- Server publishes spawn announcements (“spawn events”) to the client (SSE stream or REST prefetch).
- Server derives, for each item, the expected pickup time when the item crosses the player lane (tHit) and defines:
  - Time window: [tHit − windowEarlyMs, tHit + windowLateMs]
  - Hit area: |playerX − itemX| ≤ baseRadiusPx + radiusSlackPx
- Client sends pickup `{ t, id, type, x, y }`; server validates only if id exists for session AND t/X within window/area. Otherwise reject.
- Server keeps a consumed set; duplicate pickups are rejected.

## API Changes
- Start Session (extend): `POST /api/session/start` → `{ sessionId, issuedUtc, seed }`
  - `seed` used if client generates the same schedule locally (deterministic mode). If using SSE mode only, `seed` is optional.
- Spawn events (SSE): `GET /api/session/events?sessionId=...`
  - Content-Type: `text/event-stream`
  - Event `spawn`: `{ id, type, x, tSpawn, vY }`
- Fallback Prefetch (REST, optional): `GET /api/session/spawns?sessionId=...&horizonMs=60000` → list of spawn items within horizon.
- Submit unchanged: `POST /api/session/submit` — anti‑cheat uses schedule to validate pickups.

## Configuration (new)
Add to `appsettings.json` with bindable options class `AntiCheatOptions`:
- `AntiCheat:PickupWindowEarlyMs` (default: 250)
- `AntiCheat:PickupWindowLateMs` (default: 350)
- `AntiCheat:PickupBaseRadiusPx` (default: 48)
- `AntiCheat:PickupRadiusSlackPx` (default: 16)   // latency/aim slack
- `AntiCheat:NetworkLatencyMs` (default: 100)     // added to both early/late window
- `Security:IpHashSalt` (string)                  // salt for IP hashing

Validation window used = `[tHit − (Early + NetworkLatencyMs), tHit + (Late + NetworkLatencyMs)]`
Hit radius used = `PickupBaseRadiusPx + PickupRadiusSlackPx`

## Server Implementation
- New: `SpawnScheduleService`
  - `GetItemSpawns(sessionId, canvasWidth, horizonMs) => IEnumerable<SpawnItem>`
  - Deterministic PRNG seeded with `HMACSHA256(secretKey, sessionId + "|canvas" + w)`; produce sequence of items following `ITEM_SPAWN_INTERVAL_MS` and `ITEM_DROP_CHANCE` distributions. Each item: `{ id, type, x, tSpawn, vY }`.
  - Compute `tHit = tSpawn + (playerLaneY - spawnY) / vY`.
  - ID should be session‑scoped and non‑guessable (e.g., `Convert.ToHexString(HMACSHA256(sessionId|ordinal))` truncated).
- New: `SessionEventStream`
  - SSE endpoint that emits `spawn` for each item as it becomes eligible within the horizon or immediately for pre‑computed batches.
  - MVP: return a precomputed list via REST; SSE can be added second.
- Anti‑Cheat changes (`AntiCheatService`)
  - Load session schedule (regenerate deterministically or cache per session).
  - For each client pickup event, find the matching server item by ID.
  - Validate:
    - t within window.
    - |playerX(t) − item.x| ≤ radius; obtain playerX(t) by interpolating from `moves` samples. If no sample near t, use nearest neighbor.
    - Item not consumed before.
  - Keep existing checks (monotonic, speed, bounds, size, duplicates by ID).
- Scoring
  - Award item effects only if pickup validated. Base score from duration; apply multiplier windows.

## Client Implementation (MVP)
- Continue current `submitSession` flow.
- Add support for spawn inputs:
  - Prefetch: `GET /api/session/spawns` at session start; store `id→spawn` map (fastest to implement), or
  - SSE: connect to `/api/session/events?sessionId=...` and build the map as events arrive.
- Buffer gameplay events (if not already):
  - Moves: every 100ms push `{ t, x }`.
  - Hits: on collision, push `{ t }`.
  - Items: on collect, push `{ t, id, type, x, y }`.

## Tests
- Unit: `SpawnScheduleServiceTests`
  - Same sessionId/canvas → deterministic identical sequence; different sessionId → different.
  - `tHit` computed correctly for provided vY.
- Unit: `AntiCheatTests`
  - Reject unknown `itemId`.
  - Accept pickup within window and radius; reject outside time window; reject outside radius.
  - Duration vs `lastT` within tolerance (±(Early+Late+NetworkLatencyMs)).
- Integration: `SessionApiTests`
  - Start session; fetch spawns; submit valid payload → accepted.
  - Submit payload with forged item id → rejected.

## Steps (Minimal, Safe)
1. Options
   - Add `AntiCheatOptions` and bind from config; inject into `AntiCheatService`.
2. Schedule
   - Add `SpawnScheduleService` with deterministic generation and unit tests.
3. Anti‑Cheat
   - Wire schedule into validation; implement window/radius checks; cache consumed IDs per submission.
4. Client
   - Add prefetch call `GET /api/session/spawns` (SSE optional next) and event buffering.
5. Scoring
   - Make item effects conditional on validation results; add multiplier windows.

## Patch Sketches
- Options (C#)
```csharp
public class AntiCheatOptions {
  public int PickupWindowEarlyMs { get; set; } = 250;
  public int PickupWindowLateMs { get; set; } = 350;
  public int PickupBaseRadiusPx { get; set; } = 48;
  public int PickupRadiusSlackPx { get; set; } = 16;
  public int NetworkLatencyMs { get; set; } = 100;
}
```
- Program.cs
```csharp
builder.Services.Configure<AntiCheatOptions>(builder.Configuration.GetSection("AntiCheat"));
builder.Services.AddSingleton<SpawnScheduleService>();
```
- AntiCheatService.cs (window/radius)
```csharp
var opts = _options.Value; // IOptions<AntiCheatOptions>
int early = opts.PickupWindowEarlyMs + opts.NetworkLatencyMs;
int late  = opts.PickupWindowLateMs + opts.NetworkLatencyMs;
int radius = opts.PickupBaseRadiusPx + opts.PickupRadiusSlackPx;
var windowStart = tHit - early;
var windowEnd   = tHit + late;
if (pickup.t < windowStart || pickup.t > windowEnd) return (false, $"PickupTimeOutOfWindow:{pickup.id}");
if (Math.Abs(playerXAtT - item.x) > radius) return (false, $"PickupOutOfRadius:{pickup.id}");
```

## Config Example (appsettings.json)
```json
{
  "AntiCheat": {
    "PickupWindowEarlyMs": 250,
    "PickupWindowLateMs": 350,
    "PickupBaseRadiusPx": 48,
    "PickupRadiusSlackPx": 16,
    "NetworkLatencyMs": 120
  },
  "Security": {
    "IpHashSalt": "change-me-strong-salt"
  }
}
```

## Machine Spec (JSON)
```json
{
  "status": "planned",
  "requirements": [
    {"id": "ITER5-SPAWN-SSE", "status": "missing", "evidence": []},
    {"id": "ITER5-ANTICHEAT-WINDOWS", "status": "missing", "evidence": []},
    {"id": "ITER5-OPTIONS", "status": "missing", "evidence": []}
  ],
  "commands": [
    {"name": "server_tests", "cmd": "dotnet test", "when": "before_merge"}
  ],
  "suggested_commits": [
    {"title": "feat(server): spawn schedule + anti-cheat windows + options", "includes_patches": false},
    {"title": "feat(client): subscribe to spawn events and buffer pickups", "includes_patches": false}
  ]
}
```
