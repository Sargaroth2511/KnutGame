# API Guide

This document describes the current server API, how to explore it via Swagger in Development, and notes on persistence.

## Overview
- Framework: ASP.NET Core 9, MVC controllers
- Persistence: EF Core with migrations (SQLite by default; provider is configurable)
- JSON: System.Text.Json with `JsonStringEnumConverter` (enum values accepted as strings)

## Endpoints

- SessionController
  - POST `/api/session/start`
    - Response: `{ sessionId: string, issuedUtc: string }`
  - POST `/api/session/submit`
    - Body: `SubmitSessionRequest`
    - Response: `SubmitSessionResponse`

- LeaderboardController
  - GET `/api/leaderboard?top=50`
    - Response: `{ entries: [{ rank: number, score: number, createdUtc: string }] }`

- GreetingController
  - GET `/api/greeting?kind=start`
    - Response (200): `{ title: string, message: string }`
    - Behavior: returns AI-generated greeting when OpenAI is configured; otherwise returns a static friendly fallback.

## DTOs (C#)
```csharp
public record MoveEvent(int t, float x);
public enum ItemKind { POINTS, LIFE, SLOWMO, MULTI }
public record HitEvent(int t);
public record ItemEvent(int t, string id, ItemKind type, float x, float y);
public record EventEnvelope(IReadOnlyList<MoveEvent> Moves, IReadOnlyList<HitEvent> Hits, IReadOnlyList<ItemEvent> Items);
public record SubmitSessionRequest(Guid SessionId, int CanvasWidth, int CanvasHeight, DateTimeOffset ClientStartUtc, DateTimeOffset ClientEndUtc, EventEnvelope Events);
public record SubmitSessionResponse(bool Accepted, string? RejectionReason, int? Score, int? Rank, int? TotalPlayers);
```

## Swagger / OpenAPI
- Enabled in Development. Browse to `/swagger` for interactive docs and to try requests.
- Add the `Swashbuckle.AspNetCore` package; Program.cs calls `AddEndpointsApiExplorer()`, `AddSwaggerGen()`, `UseSwagger()`, and `UseSwaggerUI()` (Development only).

## Persistence & Migrations
- Migrations are included and version-controlled. At startup, the app runs `Database.Migrate()`.
- For legacy dev/test DBs created via `EnsureCreated()`, the app falls back to `EnsureCreated()` when EF warns about pending model changes, avoiding breaks during transition.
- To switch providers (e.g., SQL Server, Postgres), change the `UseSqlite(...)` registration and connection string in `appsettings.*.json`.

## Anti-Cheat & Scoring (Summary)
- Anti-cheat validates per-stream monotonic timestamps, session duration, player speed, bounds, item pickup proximity and lane, unique item IDs, and size caps.
- Scoring accrues base points per second and applies item effects (bonus points, multiplier windows). Slowmo does not affect accrual rate.

## Notes
- Authentication/authorization: Controllers are annotated with `[AllowAnonymous]` for now; switch to `[Authorize]` as needed.
- Health checks: Not currently mapped; can be added (`/health/live`, `/health/ready`) when needed.

## Configuration (OpenAI)
- Options: `OpenAI.Enabled`, `OpenAI.ApiKey`, `OpenAI.Organization?`, `OpenAI.Model`, `OpenAI.SystemPromptPath`, `OpenAI.Temperature`, `OpenAI.MaxTokens`.
- Secrets precedence (highest first):
  1. Environment variables (e.g., `OpenAI__ApiKey`),
  2. appsettings.{Environment}.Local.json (ignored by git),
  3. appsettings.Local.json (ignored by git),
  4. User-secrets (always loaded),
  5. appsettings.{Environment}.json,
  6. appsettings.json.
- Placeholders: `${VARNAME}` in appsettings are expanded; fallback reads `OPENAI_API_KEY` if unresolved.
- Prompt: read from `prompts/ai_system_prompt_start.md` (editable without code changes).

## Docs Viewer (Dev)
- Dev-only link on the game page opens `/Docs` to browse Markdown files under `docs/` and `agent_tasks/`.
- Supports download and clean HTML rendering (Markdig). Prevents path traversal outside allowed roots.
