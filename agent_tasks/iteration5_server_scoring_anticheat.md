# Agent Task: Iteration 5 — Server‑Authoritative Scoring + Anti‑Cheat (Test‑First)

## Constraints
- No regressions to Iterations 1–4 behavior and tests.
- Test‑first: add/extend tests before implementing server logic.
- Server becomes source of truth for final score. Client submits gameplay events; server validates and computes score.
- Privacy: no raw IP persisted; only a salted hash.
- Keep changes incremental and focused.

## Feature Summary
Make scoring server‑authoritative and resilient to simple cheating by validating a compact event stream from the client. The server computes the final score from these events using the same constants as the client. If events violate plausibility rules (e.g., impossible speed, time going backwards, out‑of‑bounds, duplicate items), the submission is rejected with a reason.

High‑level flow:
- Client requests a session token at game start: `POST /api/session/start`.
- Client collects minimal events during play (movement samples, item pickups, collision hits).
- On game over, client posts the payload to `POST /api/session/submit`.
- Server validates and computes: returns `{ accepted, score, rank, rejectionReason? }` and persists accepted scores.
- Client shows server result; if rejected/unavailable, it falls back to local highscore only.

## Acceptance Criteria
- Server exposes:
  - `POST /api/session/start` → 200 with `{ sessionId, issuedUtc }`.
  - `POST /api/session/submit` → 200 with `{ accepted, score?, rank?, totalPlayers?, rejectionReason? }`.
  - `GET /api/leaderboard?top=50` → 200 with list of `{ score, createdUtc }` (nickname optional later).
- Anti‑cheat plausibility checks:
  - Timestamps monotonic and start at 0; duration within [1s .. 60m].
  - Movement speed check: `|dx|/dt <= MOVE_SPEED * 1.2` (10–20% tolerance).
  - Coordinates sane: `x` within [0 .. canvasWidth], `y` within [0 .. canvasHeight].
  - Item pickup proximity: at pickup `|playerX - itemX| <= 48` and `itemY` near player Y band (±64).
  - No duplicate pickup of same `itemId`.
  - Event counts bounded: total events <= 50k; item pickups <= 500.
  - Lives cannot go below 0; no events after game over.
- Server computes score deterministically using Iteration 4 rules:
  - Base: `BASE_POINTS_PER_SEC` per second times active multiplier.
  - Items: POINTS adds fixed bonus; LIFE increments (capped by `LIFE_MAX`); SLOWMO + MULTI affect state for duration.
- Persist accepted scores; reject invalid with precise reason.
- Tests (unit + integration) cover positive and negative cases (see Tests section).

## API Contracts

### 1) Start Session
- `POST /api/session/start`
- Request: none
- Response:
```json
{
  "sessionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "issuedUtc": "2025-09-08T12:34:56.789Z"
}
```

### 2) Submit Session
- `POST /api/session/submit`
- Request:
```json
{
  "sessionId": "guid",
  "canvasWidth": 800,
  "canvasHeight": 600,
  "clientStartUtc": "2025-09-08T12:34:56.789Z",
  "clientEndUtc": "2025-09-08T12:36:12.123Z",
  "events": {
    "moves": [ { "t": 0, "x": 400 }, { "t": 100, "x": 380 }, { "t": 200, "x": 360 } ],
    "hits":  [ { "t": 12345 } ],
    "items": [ { "t": 15000, "id": "itm-42", "type": "POINTS", "x": 365, "y": 540 } ]
  }
}
```
- Semantics:
  - `t` is milliseconds since run start (0 at first frame). All `t` must be non‑decreasing.
  - `moves` may be sparse; server interpolates checks using successive samples only.
  - `hits` represent obstacle collisions.
  - `items` provide pickup position and item type; server validates proximity.
- Response:
```json
{
  "accepted": true,
  "score": 1234,
  "rank": 42,
  "totalPlayers": 313
}
```
- Rejection example:
```json
{
  "accepted": false,
  "rejectionReason": "SpeedExceeded: dx/dt > limit at t=2500"
}
```

### 3) Leaderboard
- `GET /api/leaderboard?top=50`
- Response:
```json
{
  "entries": [
    { "rank": 1, "score": 43210, "createdUtc": "2025-09-08T12:00:00Z" },
    { "rank": 2, "score": 42100, "createdUtc": "2025-09-08T11:58:00Z" }
  ]
}
```

## Server Model & Services

### Constants (shared)
Use same values as client from `src/KnutGame.Client/src/gameConfig.ts`:
- `BASE_POINTS_PER_SEC = 10`
- `MULTIPLIER_X = 2`, `MULTIPLIER_MS = 7000`
- `SLOWMO_FACTOR = 0.5`, `SLOWMO_MS = 5000`
- `LIFE_MAX = 5`
- `MOVE_SPEED = 200`

Define server equivalents in C# (`GameConfig.cs`) to avoid coupling to client bundle.

### DTOs (C#)
```csharp
public record StartSessionResponse(Guid SessionId, DateTimeOffset IssuedUtc);

public record MoveEvent(int t, float x);
public enum ItemKind { POINTS, LIFE, SLOWMO, MULTI }
public record HitEvent(int t);
public record ItemEvent(int t, string id, ItemKind type, float x, float y);

public record SubmitSessionRequest(
    Guid SessionId,
    int CanvasWidth,
    int CanvasHeight,
    DateTimeOffset ClientStartUtc,
    DateTimeOffset ClientEndUtc,
    EventEnvelope Events
);
public record EventEnvelope(IReadOnlyList<MoveEvent> Moves, IReadOnlyList<HitEvent> Hits, IReadOnlyList<ItemEvent> Items);

public record SubmitSessionResponse(bool Accepted, string? RejectionReason, int? Score, int? Rank, int? TotalPlayers);
```

### Persistence
```csharp
public class ScoreEntry
{
    public int Id { get; set; }
    public Guid SessionId { get; set; }
    public int Score { get; set; }
    public int DurationMs { get; set; }
    public int ItemsCollected { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public string ClientIpHash { get; set; } = string.Empty;
}
```
- `DbContext` with `DbSet<ScoreEntry>`; SQLite default.
- IP hash: `SHA256(salt + remoteIp)` (salt from config).

### Services
- `IScoringEngine`: pure, deterministic score calculator mirroring client logic.
- `IAntiCheat`: validates event stream; returns `Ok` or `RejectionReason`.
- `IScoreService`: orchestrates anti‑cheat, scoring, persistence, and ranking.

Pseudocode:
```csharp
var anti = antiCheat.Validate(req);
if (!anti.Ok) return new SubmitSessionResponse(false, anti.Reason, null, null, null);
var score = scoring.Compute(req);
var rank = await scores.SaveAndRankAsync(sessionId, score, clientIpHash);
return new SubmitSessionResponse(true, null, score, rank.Current, rank.Total);
```

## Anti‑Cheat Rules (Detailed)
- Time: `0 = first t`, strictly non‑decreasing; last `t` equals `(ClientEndUtc - ClientStartUtc).TotalMilliseconds ± 500ms` tolerance.
- Duration: reject `< 1000ms` or `> 60 * 60 * 1000ms`.
- Speed: For successive `moves` `(t1,x1) → (t2,x2)` where `dt = t2 - t1 > 0`, reject if `|x2-x1|/dt > MOVE_SPEED * 1.2 / 1000`.
- Bounds: any `x` out of [0, CanvasWidth] or `y` out of [0, CanvasHeight] in item events → reject.
- Items: duplicate `id` → reject; proximity at pickup `|playerX(t) - item.x| <= 48` and `item.y` within `[0.8H..H+64]` (player is near bottom lane), configurable.
- Hits: optional prox validation; ensure `hits.Count <= lives starting capacity + extras`.
- Size: enforce max counts; reject malformed.
- Idempotence: repeat submissions for same `sessionId` overwrite only if higher score from same hashed IP (optional; or reject duplicates).

## Implementation Steps
1. Tests first (server):
   - Unit tests `ScoringEngineTests`: base score over time, multiplier windows, slowmo factor doesn’t change scoring rate (only applies to physics), points item.
   - Unit tests `AntiCheatTests`: rejects backwards time, excessive speed, OOB coords, duplicate item id; accepts valid stream.
   - Integration `SessionApiTests`:
     - `POST /api/session/start` returns GUID.
     - Valid payload to `POST /api/session/submit` returns `accepted:true` and correct score.
     - Invalid payload (speed exceed) returns `accepted:false` with reason.
2. Server code:
   - Add DTOs, `GameConfig`, `ScoringEngine`, `AntiCheatService`, `ScoreService`.
   - Add EF Core `AppDbContext` with `Scores` and initial migration.
   - Add Minimal API endpoints in `Program.cs` under `/api/session/*` and `/api/leaderboard`.
   - Add IP hashing middleware/helper using configuration salt.
3. Client integration:
   - Add `src/KnutGame.Client/src/services/api.ts` with:
     - `startSession(): Promise<{sessionId}>`
     - `submitSession(payload)`
   - Extend `MainScene` to buffer events:
     - Every N ms (e.g., 100ms) push `{t,x}`.
     - On hit: push `{t}` to `hits`.
     - On item collect: push `{t,id,type,x,y}`.
   - On game over: call `submitSession`; display server response.
   - Fallback: if request fails or rejected → keep local highscore behavior.
4. CI: ensure server tests run as today; no pipeline changes required beyond added projects/files.

## Test Data Examples
- Valid movement samples: `[(0,400), (100,380)]` OK (|dx|/dt = 200 px/s).
- Invalid: `[(0,400), (100,150)]` → |dx|=250 → 2500 px/s > limit.
- Item pickup within 48px horizontal proximity accepted; duplicate id rejected.

## Minimal Data Structures (Client)
```ts
type MoveEvent = { t: number; x: number }
type HitEvent = { t: number }
type ItemEvent = { t: number; id: string; type: 'POINTS'|'LIFE'|'SLOWMO'|'MULTI'; x: number; y: number }
export type SubmitSessionRequest = {
  sessionId: string
  canvasWidth: number
  canvasHeight: number
  clientStartUtc: string
  clientEndUtc: string
  events: { moves: MoveEvent[]; hits: HitEvent[]; items: ItemEvent[] }
}
```

## Commands
- Run server tests: `dotnet test`
- Run client tests: `npm -C src/KnutGame.Client test -- --run`

## Commit Message
Iteration 5: Server‑authoritative scoring with anti‑cheat — add session API, scoring, validation rules, persistence, and tests.

## Machine Spec (JSON)
```json
{
  "status": "planned",
  "requirements": [
    {"id": "ITER5-API", "status": "missing", "evidence": []},
    {"id": "ITER5-ANTICHEAT", "status": "missing", "evidence": []},
    {"id": "ITER5-SCORING", "status": "missing", "evidence": []},
    {"id": "ITER5-PERSIST", "status": "missing", "evidence": []},
    {"id": "ITER5-TESTS", "status": "missing", "evidence": []}
  ],
  "commands": [
    {"name": "server_tests", "cmd": "dotnet test", "when": "before_merge"},
    {"name": "client_tests", "cmd": "npm -C src/KnutGame.Client test -- --run", "when": "before_merge"}
  ],
  "suggested_commits": [
    {"title": "feat(server): add session API + scoring engine + anti-cheat + tests", "includes_patches": false},
    {"title": "feat(client): buffer events and submit session payload", "includes_patches": false}
  ]
}
```
