# Iterative Development Plan – Razor Pages Backend + Phaser (TypeScript) Client – “Knut” Christmas Game

**Goal:** A lightweight 2D skill game running in the browser (“Knut”: dodge falling Christmas trees, collect items), hosted in an ASP.NET Core **Razor Pages** app. The actual game is rendered with **Phaser 3 (TypeScript, Canvas/WebGL)**. Iterative development – each iteration delivers usable value.

**High-Level Architecture**
```
repo/
  src/
    Server/                # ASP.NET Core Razor Pages (.NET 9 preferred)
      Pages/               # Razor Pages (Index = Game Shell)
      wwwroot/             # built client assets (Vite output)
      Api/                 # Minimal API endpoints (Score, Telemetry, KI, Health)
      Services/            # ScoreService, AntiCheatService, KiTextService, etc.
      Data/                # EF Core DbContext + Migrations (SQLite/SQL Server)
      appsettings*.json
      Program.cs
      Server.csproj
    Client/                # Phaser + TS, built with Vite
      src/
        game/              # Scenes, Entities, Systems
        assets/            # Atlases, SFX, Fonts (initial placeholders)
        styles/
        main.ts
      index.html
      package.json
      tsconfig.json
      vite.config.ts
  tests/
    Server.Tests/          # xUnit + WebApplicationFactory
    Client.Tests/          # Vitest for pure TS logic
  .editorconfig
  .gitattributes
  README.md
  LICENSE
```

---

## Agent Contract (important for coding agents)
- **Follow the order strictly** per iteration. Only move to the next iteration once acceptance criteria are met.
- **No major refactors** unless specified in the plan.
- **Performance budget:** Client initial bundle **≤ 5 MB gzip**. Target 60 FPS desktop, smooth on mobile.
- **CI linting & tests:** Build fails on lint/test errors (Server & Client).
- **.NET version:** .NET 9 preferred (fallback .NET 8 if 9 not available).
- **Package manager:** `pnpm` preferred (fallback `npm`).

---

## Iteration 0 – Repo & Toolchain (Foundation)
**Goal:** Empty but buildable skeleton. Server and client run separately, no interaction yet.

**Tasks**
1. **Initialize repo**: `git init`, standard `.gitignore` (VisualStudio, Node, macOS, Windows), `.editorconfig`.
2. **Server project**: `dotnet new webapp -o src/Server` (Razor Pages). Namespace `KnutGame`.
3. **Client project**: `pnpm create vite src/Client -- --template vanilla-ts` → then `pnpm i phaser`.
4. **Start scripts**:
   - Server: `dotnet run` (Port 5179, adjust via `launchSettings.json`).
   - Client: `pnpm dev` (Port 5173).
5. **CI basics**: GitHub Actions Workflow (`.github/workflows/ci.yml`) – Server build/test, Client build/lint.

**Acceptance criteria**
- `dotnet run` serves Razor Pages welcome (Index only shows "Game is loading...").
- `pnpm dev` serves Vite “Hello Vite” page at `http://localhost:5173`.
- CI: `dotnet build` + `pnpm -C src/Client build` successful.

---

## Iteration 1 – Game Shell in Razor Pages + Embedded Client Build
**Goal:** Razor Page `Index.cshtml` loads the **built** client (not Dev server) from `wwwroot`.

**Tasks**
1. Client `vite.config.ts`: Output to `../Server/wwwroot/game` (fix relative paths).
2. Build phase: `pnpm -C src/Client build` generates `assets` + `index.html`. Adjust: replace root container with `<div id="game-root"></div>`.
3. `Index.cshtml`: Container `<div id="game-root"></div>` + `<script src="/game/assets/index-*.js" defer></script>`.
4. Static caching: `app.UseStaticFiles()` + `Cache-Control` for `/game/*` set to 7 days.

**Acceptance criteria**
- `dotnet run` at `https://localhost:5179` shows client “Hello Canvas” (placeholder), no separate Vite dev server.
- No inline `<script>` errors; CSP-compatible (nonce optional for now).

---

## Iteration 2 – Phaser Setup + Player Movement (No Assets)
**Goal:** Game loop, one scene, minimal player (hitbox), keyboard/touch input.

**Tasks (Client)**
1. Integrate `Phaser`, create `MainScene.ts` with `preload/create/update`.
2. Player entity (AABB hitbox), movement: left/right via arrows/AD + touch (left/right halves of screen).
3. Fixed timestep: physics update via `delta` (no `setInterval`).
4. FPS counter (debug togglable), auto-pause on tab change (`visibilitychange`).

**Acceptance criteria**
- Responsive canvas (full width), player moves smoothly.
- 60 FPS desktop (no heavy assets). No page scroll on touch.

---

## Iteration 3 – Obstacles (Trees), Spawn Logic, Collision, Lives
**Goal:** Falling tree placeholder objects, collision reduces lives, game over loop.

**Tasks (Client)**
1. **Spawner system**: random X-position, variable fall speed, spawn rate scales over time.
2. **Collision**: simple AABB vs. AABB. Hit → `lives--`, short invulnerability.
3. **UI**: Lives (♥♥♥), timer/survival seconds, start/retry button.
4. **Game over**: Retry starts fresh run; state fully reset.

**Acceptance criteria**
- Playable loop (collision reduces lives, 0 = Game Over).
- No memory leaks: objects pooled/reused.

---

## Iteration 4 – Items & Scoring + Local Highscore
**Goal:** Collectible items (points, extra life, slowmo), local score system.

**Tasks (Client)**
1. Item types: `POINTS`, `LIFE`, `SLOWMO`, `MULTI` with drop chances.
2. Score system: base per second + item bonuses; score multiplier (time-limited).
3. Local storage: personal highscore persisted/displayed.

**Acceptance criteria**
- Scores increase logically; items work as expected.
- Local highscore persists between sessions.

---

## Iteration 5 – Server API (Highscores) + Persistence
**Goal:** Server-side score storage (foundation for donation logic) with validation.

**Tasks (Server)**
1. **Data model**
```csharp
public record SubmitScoreRequest(string SessionId, int Score, int DurationMs, int ItemsCollected, DateTimeOffset ClientEndTimeUtc);
public record SubmitScoreResponse(bool Accepted, string? RejectionReason, int? Rank, int? TotalPlayers);
public class ScoreEntry { public int Id; public string SessionId; public int Score; public int DurationMs; public int ItemsCollected; public DateTimeOffset CreatedUtc; public string ClientIpHash; }
```
2. **DB**: EF Core + SQLite (default). Migration `AddScores`.
3. **API**: `POST /api/score` (Minimal API). Plausibility checks: Score > 0, duration/score ratio within bounds.
4. **GET /api/leaderboard?top=50`**: Top X scores (Id, Score, CreatedUtc, optional nickname later).
5. **Client integration**: Submit score at game over; fallback: local only if server unavailable.

**Acceptance criteria**
- Valid scores saved; invalid rejected with reason.
- Leaderboard Razor Page shows Top 20 (server-rendered table).

---

## Iteration 6 – Anti-Cheat "Light" + Session Tokens
**Goal:** Minimal barrier to trivial cheating, without breaking UX.

**Tasks**
1. **Session issue**: `GET /api/session` → `{ sessionId, issuedAt, nonce }` (short TTL).
2. **Client**: fetch session before run; on submit, send raw score/duration/items. (No secret on client).
3. **Server vetting**: rate limits per IP/session, max score/sec, min duration.

**Acceptance criteria**
- Obvious fakes (e.g. Score 1e9, Duration 1s) rejected.
- Normal runs accepted; UX smooth.

---

## Iteration 7 – AI Integration (Texts) + Personalized Greetings
**Goal:** After game over, server generates humorous 2–3 sentence AI message based on score.

**Tasks**
1. **Service** `KiTextService`: template + rules (offline/static or configurable LLM API). Cache per score bucket.
2. **Endpoint** `GET /api/greeting?score=...` → `{ title, message }`.
3. **Client**: show text in game over dialog; copy button.

**Acceptance criteria**
- Different score buckets → different themed texts.
- Fallback present if AI service unavailable.

---

## Iteration 8 – Assets & Style (Lightweight, AI-pre-generated)
**Goal:** Replace placeholders with compact, consistent assets.

**Tasks**
1. **Sprites**: texture atlas (power-of-two dimensions). Export SVG → raster at build.
2. **SFX**: short loops (≤ 50 KB each), lazy load.
3. **Backgrounds**: 2–3 AI-generated winter images (pre-generated), random per session.
4. **Branding**: Color scheme/logo embedded (e.g. HUD corner).

**Acceptance criteria**
- Initial bundle ≤ 5 MB gzip.
- No FPS drops from assets.

---

## Iteration 9 – Donation Progress & Leaderboard Polish
**Goal:** Public progress bar "points → €", cap/milestones, leaderboard with opt-in names.

**Tasks**
1. **Config** `DonationConfig: { PointsPerEuro, CapEuros, Milestones: number[] }`.
2. **Endpoint** `GET /api/donation/progress` → `{ totalScore, euros, nextMilestone }`.
3. **SignalR** optional: live updates to clients.
4. Leaderboard: Opt-in name/company (GDPR checkbox), else anonymized (e.g. "C*** GmbH").

**Acceptance criteria**
- Progress aggregates from DB correctly.
- Cap never exceeded.

---

## Iteration 10 – Telemetry (privacy-aware) & QA
**Goal:** Basic telemetry without personal data + test coverage.

**Tasks**
1. Client: FPS, session length, device type (desktop/mobile), resolution – via `POST /api/telemetry` (10% sampling).
2. Server: Serilog + structured logs, optional OpenTelemetry export.
3. Tests: Server xUnit (score/validation); Client Vitest (spawn/score functions). Coverage ≥ 70%.

**Acceptance criteria**
- CI fails on <70% coverage or lint errors.
- Telemetry can be disabled via `appsettings.Production.json`.

---

## Iteration 11 – Accessibility & UX Polish
**Goal:** Broader accessibility, polished impression.

**Tasks**
1. Options: volume, reduced motion, high contrast.
2. Keyboard-only UX, focus rings visible, ARIA labels for HUD.
3. Auto-pause on tab change, “Continue” dialog.
4. Localization (de/en) via simple JSON resources.

**Acceptance criteria**
- Playable without mouse; screen reader reads UI basics.

---

## Iteration 12 – Packaging & Deployment
**Goal:** Reproducible build, optional Docker, release artifacts.

**Tasks**
1. **Build script** `scripts/build-all.ps1` / `.sh`: Client build → Server publish → artifact in `publish/`.
2. **Dockerfile** (multi-stage): `node:XX` for client build, then `mcr.microsoft.com/dotnet/aspnet:9.0` for runtime.
3. **CD**: GitHub Actions release on tag, upload artifact; optional container registry push.

**Acceptance criteria**
- `docker run -p 8080:8080 image` serves playable app.

---

## Quality Rules & Linting
- **Client**: ESLint (TS), Prettier, strict TS (`"strict": true`), Vitest.
- **Server**: .editorconfig + Roslyn Analyzer (`EnableNETAnalyzers`, `AnalysisMode=AllEnabledByDefault`, TreatWarningsAsErrors=true), xUnit.
- **PR gates**: Build, lint, tests, bundle size check (e.g. `rollup-plugin-visualizer`/Vite report).

---

## Developer Commands (for Agents & Humans)
**Server**
```
dotnet --info
cd src/Server
 dotnet new webapp -n KnutGame -f net9.0
 dotnet add package Microsoft.EntityFrameworkCore.Sqlite
 dotnet add package Microsoft.EntityFrameworkCore.Design
 dotnet add package Serilog.AspNetCore
 dotnet add package Swashbuckle.AspNetCore
 dotnet build
 dotnet run
```

**Client**
```
cd src/Client
pnpm create vite . -- --template vanilla-ts
pnpm i
pnpm i phaser
pnpm dev
pnpm build
```

**Integration Build**
```
pnpm -C src/Client build
# Vite output to ../Server/wwwroot/game
cd src/Server
dotnet run
```

---

## Open Assumptions (ask back if different!)
1. **.NET 9** available; otherwise downgrade to .NET 8 (API same).
2. DB initially **SQLite**; production maybe SQL Server / Azure SQL.
3. No login/SSO required (anonymous sessions only).
4. AI integration in Iteration 7 only **texts**; images/audio pre-generated offline.
5. Deployment target Linux container or Azure App Service – final host later.

---

## Definition of Done (overall)
- Game achieves consistent 60 FPS on average laptop (Chrome/Edge) with active obstacles and items.
- Server API stable, validates scores, shows leaderboard & donation progress.
- AI text feature produces thematic, useful messages.
- CI/CD generates reproducible artifact/Docker image.

---

## Stretch Goals (optional)
- SignalR live events (Global Christmas storm: 30s double points).
- Share-image generator (server renders social card with score & greeting).
- PWA manifest + offline start (game only, no server features).

