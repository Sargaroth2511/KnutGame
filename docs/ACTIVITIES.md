# Project Activities Log

This file tracks the activities and changes made to the KnutGame project.

## September 5, 2025

### Project Examination
- Examined the project structure consisting of a .NET 9 ASP.NET Core server and a Vite/TypeScript client with Phaser.
- Identified several reference issues preventing the build from succeeding.

### Issues Found
1. **ViteManifestService Reference Error**: The `ViteManifestService.cs` file was located outside the project directory (`Server/KnutGame/Services/`), causing a build error: "The type or namespace name 'Services' does not exist in the namespace 'KnutGame'".
2. **Incorrect Vite Build Output Path**: The `vite.config.ts` had `outDir: '../Server/wwwroot/game'`, which resolved to the wrong location. The correct path should be `Server/KnutGame/KnutGame/wwwroot/game`.
3. **Missing Using Directive**: `ViteManifestService.cs` was missing `using System.Text.Json;` for `JsonSerializer` and `JsonSerializerOptions`.

### Fixes Applied
1. **Moved Service File**: Relocated `ViteManifestService.cs` from `Server/KnutGame/Services/` to `Server/KnutGame/KnutGame/Services/` to include it in the project build.
2. **Updated Vite Configuration**: Changed `vite.config.ts` `outDir` to use an absolute path: `c:/Source/KnutGame/Server/KnutGame/KnutGame/wwwroot/game`.
3. **Added Missing Using**: Added `using System.Text.Json;` to `ViteManifestService.cs`.
4. **Created Output Directory**: Manually created `wwwroot/game` folder since Vite requires it to exist when `emptyOutDir` is true.
5. **Cleanup**: Removed the now-empty `Services` folder outside the project.

### Verification
- **Server Build**: `dotnet build` now succeeds without errors.
- **Client Build**: `npm run build` correctly outputs assets to `wwwroot/game`, including the required `manifest.json`.
- **Asset Integration**: The server can now properly serve the built client assets through the configured static file middleware and `ViteManifestService`.

### Current Status
The project builds successfully and is ready for development and deployment. The client assets are correctly integrated with the server for proper serving.

## September 5, 2025 (Continued)

### Git Setup and Line Ending Fixes
- **Issue**: Git warning about LF/CRLF line ending conversion in `Client/tsconfig.json`
- **Solution**: Created `.gitattributes` file to normalize line endings:
  - JSON files: LF (Unix line endings)
  - Markdown files: LF
  - YAML files: LF
  - Other text files: Auto-normalization
- **Additional Setup**:
  - Created comprehensive `.gitignore` to exclude Visual Studio files, build outputs, and common artifacts
  - Excluded `.vs/` directory from Git tracking
  - Committed all project files with proper line ending normalization
- **Result**: Line ending warnings resolved, consistent file formats across the repository

### Client Code Cleanup
- **Removed Template Files**:
  - Deleted `counter.ts` (template counter component)
  - Deleted `typescript.svg` (template asset)
- **Cleaned Up Core Files**:
  - `main.ts`: Replaced template HTML/JS with minimal game initialization
  - `style.css`: Simplified from template styles to basic game layout
  - `index.html`: Updated title to "Knut Game" and removed vite.svg reference
- **Kept Essential Files**:
  - `vite-env.d.ts` (required for Vite TypeScript integration)
- **Verification**: Client builds successfully with cleaned code (reduced bundle size)

### Iteration 1: Game Shell in Razor Pages + Embedded Client Build
- **Index.cshtml Updated**: Replaced default ASP.NET template with game container and asset loading
- **Asset Loading**: Configured to load built CSS and JS from `/game/assets/` with proper caching
- **Server Configuration**: Static files serving already configured with 7-day cache for game assets
- **Build Integration**: Vite configured to output to correct server location

### Iteration 3: Obstacles & Collision System
- **Obstacle Spawning**: Implemented falling Christmas tree obstacles with random X-position
- **Variable Fall Speed**: Obstacles fall at 150-250 pixels/second with randomization
- **Progressive Difficulty**: Spawn interval decreases from 2s to 0.8s over time
- **Collision Detection**: AABB collision between player and obstacles using Phaser.Geom.Intersects
- **Lives System**: 3 lives with ♥ display, reduces on collision
- **Invulnerability Frames**: 1-second invulnerability after hit with visual feedback (red player)
- **Game Over State**: Pause physics, display "GAME OVER" and restart button
- **Restart Functionality**: Click restart button or press SPACE to restart
- **Score System**: Points per second survived (10 points/second)
- **Timer Display**: Real-time survival timer in top-left
- **Object Pooling**: Reuse obstacle objects to prevent memory leaks
- **UI Updates**: Lives (♥♥♥), timer, score display with proper z-index layering
- **Game State Management**: Proper reset of all game variables on restart
- **Build Size**: Maintained 1.48 MB bundle within performance budget

## September 7, 2025

### Process Update: Test-First Iterations + Refactor After Approval
- Updated `docs/iterationPlan.md` to enforce test-first per iteration and explicit refactor-after-approval policy.

### Tests Implemented for Iterations 1–3
- **Server (xUnit + WebApplicationFactory)**
  - Added test project at `tests/KnutGame.Server.Tests`.
  - Tests cover:
    - GET `/` returns 200 and contains `#app` container (Iteration 1).
    - `/game/manifest.json` is served and referenced JS/CSS assets return 200 (Iteration 1).
  - Minor addition to server: declared `public partial class Program` to enable `WebApplicationFactory<Program>`.

- **Client (Vitest)**
  - Added test stubs under `src/KnutGame.Client/test/` and scripts in `package.json`.
  - Tests cover:
    - `MainScene` existence/constructibility; default state checks (lives=3, spawnInterval=2000) (Iterations 2–3).
    - Presence of obstacle/collision methods on `MainScene` (Iteration 3).
    - Vite config assertions: `base='/game/'`, output path to server `wwwroot/game` (Iteration 1).

### Next
- Upon approval, proceed to refactor `Index.cshtml` to consume `ViteManifestService` (manifest-driven assets) and tidy related code paths.

## September 9, 2025

### Iteration 5: Server‑Authoritative Scoring, Anti‑Cheat, and Client Sync
- Client → Server payload fixes
  - Rounded event timestamps to integer milliseconds for `moves/hits/items` to match server DTOs (`int`).
  - Reset session lifecycle on restart: clear buffered events, refresh `clientStartUtc`, request a new `sessionId`.
  - Ensured unique item IDs are attached to spawned items; added fallback generation at collection time.
  - Submission now uses string enums for item types; server configured to accept string enum values.

- Server API and validation
  - Minimal API endpoints: `POST /api/session/start`, `POST /api/session/submit`, `GET /api/leaderboard`.
  - Anti‑Cheat: monotonic timestamps enforced per stream (moves/hits/items) while allowing interleaving across types; duration≈last event time check (±500ms tolerance); speed limit based on `MOVE_SPEED`; bounds checks; item pickup proximity (≤ 48px from interpolated player X at time t) and ground‑lane Y band; duplicate item IDs rejected; size caps.
  - JSON binding: added `JsonStringEnumConverter` so `ItemKind` accepts string values (e.g., "POINTS").
  - Scoring engine: simulates base accrual + item effects; applies multiplier windows (MULTI) over time; clarified remaining‑time accrual.
  - Persistence/ranking: salted IP hashing, store entries, compute `rank = 1 + count(score > this)`, `totalPlayers` = total entries.

- Tests
  - Added/updated xUnit tests: duration mismatch rejection, item proximity and lane validation, acceptance of interleaved events, multiplier window scoring.
  - Full test run: all tests passing.

- DB handling and VCS hygiene
  - Guarded `EnsureCreated()` for SQLite "already exists" during test runs.
  - Updated `.gitignore` to exclude local SQLite artifacts (`*.db`, `*.db-wal`, `*.db-shm`, etc.). Untracked `src/KnutGame.Server/knutgame.db`.

### Visuals: Skyscraper Background & Street
- Procedural background: building facade with aligned window columns; door on ground floor; street with curb and dashed line in foreground.
- Adjustments: removed window behind door; shifted outer columns inward; lifted windows; lowered player Y to stand on street; added bottom spacing from street to first window row; removed door knob dot.

### Backend Refactor: Controllers, Migrations, Swagger
- API surface moved from Minimal APIs to MVC Controllers for clearer separation and attribute support:
  - `SessionController` → `POST /api/session/start`, `POST /api/session/submit`.
  - `LeaderboardController` → `GET /api/leaderboard`.
- Options pattern introduced: `SecurityOptions` binds `Security:IpHashSalt`.
- EF Core: switched startup DB init to `Database.Migrate()` (with safe fallback to `EnsureCreated()` if legacy dev DB triggers `PendingModelChangesWarning`).
- Added initial EF Core migration (`20250909_InitialCreate`) and model snapshot.
- Swagger/OpenAPI enabled in Development: `AddSwaggerGen`, `UseSwagger`, `UseSwaggerUI` → browse `/swagger`.

### MainScene Refactor & Background
- Extracted responsibilities into modules (SOLID):
  - `systems/background.ts` — procedural skyscraper + street rendering.
  - `systems/InputController.ts` — keyboard/touch input, attach/detach lifecycle.
  - `systems/SessionEventsBuffer.ts` — moves/hits/items buffering with ms rounding.
- `MainScene` now orchestrates lifecycle and delegates to modules.
- Visual polish: aligned window columns, removed window behind the door, inward shifts, window elevation, street and door.

### Docs Viewer (Dev)
- Added `Pages/Docs.cshtml` to browse repository `.md` files from `docs/` and `agent_tasks/` with a Dev-only "View Docs" link on the game page.
- Markdown rendering with Markdig; clean white styling and support for downloading files.
- Resolves paths relative to the repository root; prevents traversal outside allowed folders.

### Iteration 7: AI Greetings (M1 + M2)
- M1: Infrastructure and stub service
  - `OpenAiOptions` (Enabled, ApiKey, Organization?, Model, SystemPromptPath, Temperature, MaxTokens).
  - `IKiTextService` with `StaticKiTextService` fallback.
  - `GreetingController` → `GET /api/greeting?kind=start`.
  - Client: greeting overlay via `Hud.showGreeting()`; game starts on "Start Game" press.
- M2: OpenAI integration
  - `OpenAiTextService` calling Chat Completions; reads prompt from `prompts/ai_system_prompt_start.md`.
  - Robust fallback to static message on failures.
  - Optional `OpenAI-Organization` header support.
  - Startup masked diagnostics log: environment, Enabled flag, and masked ApiKey presence.

### Iteration 7: Completion (M3)
- Added game-over AI endpoint: `GET /api/greeting/gameover` with score, rank, players, euros, durationSec, itemsCollected.
- Client displays AI game‑over message beneath the restart button on the Game Over screen.
- Prompt files:
  - Start: `prompts/ai_system_prompt_start.md` (updated for variety + examples).
  - Game over: `prompts/ai_system_prompt_gameover.md`.
- Controller tests for Greeting endpoints (stubbed service).
- Wreath spinner (transparent center, red berries) positioned at greeting area; fade‑out → greeting fade‑in.

### Configuration & Secrets (Dev Best Practices)
- Added configuration sources to auto-load local, untracked files and user-secrets for all environments:
  - `appsettings.Local.json`, `appsettings.{Environment}.Local.json` (ignored by git).
  - `.NET` user-secrets (always loaded) — added `UserSecretsId` to the server project.
- Implemented `${VARNAME}` placeholder expansion and fallback to `OPENAI_API_KEY` for OpenAI options.
- Documentation updates: `docs/API.md` (Greeting endpoint), `docs/CONFIG.md` (secrets & precedence).
