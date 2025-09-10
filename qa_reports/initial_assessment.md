# KnutGame QA Report — Initial Assessment

Date: 2025-09-10
Scope: Repository-wide review with a focus on test coverage and security concerns. This is a living document; follow‑ups will iterate on open items.

## Overview
- Stack: ASP.NET Core 9 server + EF Core (SQLite) + Razor Pages; Vite + TypeScript (Phaser 3) client.
- Tests present for server (xUnit) and client (Vitest). CI builds client, runs tests for both.
- No secrets committed; config layering supports local overrides and user-secrets.

## Test Coverage — Observations
- Server tests cover:
  - Basic endpoints and Razor Index rendering (BasicIntegrationTests).
  - Vite manifest injection & asset serving (ManifestInjectionTests).
  - Scoring logic (ScoringEngineTests) incl. base, item bonus, multiplier window.
  - Anti-cheat validator happy-path and several rejection cases (AntiCheatTests).
  - OpenAI service parsing, fallback, and error handling via stubbed HTTP (OpenAiTextServiceTests).
- Client tests cover:
  - Scene class presence and defaults.
  - Core systems (physics-like, scoring), local highscore, vite config shape.

### Coverage Gaps / Risks
- Server
  - ScoreService.SaveAndRankAsync not unit-tested (persistence + rank math).
  - Controller edge cases: SessionController negative paths (anti-cheat rejection), parameter validation, and ip-hash salt behavior untested.
  - LeaderboardController parameter bounds (e.g., `top <= 100`, negative/zero) not enforced or tested.
  - ViteManifestService behavior when manifest.json is missing logged but not tested explicitly (aside from integration expectations).
  - Program pipeline behaviors (HSTS in prod, compression types) are not verified.
- Cross-cutting
  - Integration tests assume `/wwwroot/game/manifest.json` exists. Locally, running only `dotnet test` may fail unless the client is built first. CI orchestrates this correctly, but README lacks an explicit note for local runs.

## Security Review — Server
- Secrets & Config
  - OpenAI keys: not committed; supports env, appsettings.Local.json, and user-secrets. Logs mask keys. Good.
  - Placeholder expansion `${VARNAME}` with fallback to `OPENAI_API_KEY` is convenient; ensure prod processes set via env or secrets, not appsettings.json.
- Data Protection
  - Client IP hashing uses SHA‑256 of `IpHashSalt + ip` then Base64. Risk: default fallback salt in code (`default-salt`) and placeholder in `appsettings.json` could be used accidentally in prod.
    - Recommendation: Require non-default salt in non-development environments; fail fast if unset. Document clearly.
- Input Validation
  - Session submission is validated by AntiCheatService (time windows, monotonicity, bounds, speed, proximity, size limits). Good coverage for common exploits.
  - Controllers allow anonymous (intended). No authentication is expected for this app.
- External Calls
  - OpenAI HTTP client: 15s timeout; minimal retries on 429/5xx; exceptions handled with safe fallbacks. Organization header set only when configured.
  - System prompt file path resolves relative to repo root; logs warning if missing. No file content is echoed back to clients directly.
- Web Surface
  - Swagger only in Development. HSTS + HTTPS redirection enabled in non-dev. Static file caching for hashed game assets OK.
  - Docs page: lists and renders Markdown from `docs/` and `agent_tasks/` only, using an allowlist of resolved full paths. Markdown renders as raw HTML (Markdig) which can include raw HTML tags.
    - Risk: XSS via untrusted Markdown is possible if an attacker can modify repo files on a deployed instance. Typically low in prod (no write path), but medium in shared environments.
    - Recommendation: Restrict `/Docs` to Development or add `[Authorize]`/feature flag; optionally sanitize HTML or disable raw HTML in Markdig pipeline for defense-in-depth.
- Database
  - EF Core migrations applied on startup; falls back to EnsureCreated for legacy DB. Acceptable.
  - ScoreEntry stores salted IP hash; no PII stored beyond that. No dedupe/rate limit; could be spammed.

## Security Review — Client
- No secrets in client sources. API calls are same-origin to backend.
- Build outputs to server `wwwroot/game/` with cache-friendly paths.
- Dev deps pinned with semver ranges; consider enabling `npm audit`/`pnpm audit` in CI for early alerts.

## CI / Operational Notes
- CI sequence correctly builds client (generating manifest) before running server integration tests that depend on it.
- Local testing: README does not explicitly state that building the client is a prerequisite for `dotnet test` to pass. This is a common pitfall.
- Consider adding a solution-level script/target (e.g., `dotnet test` invokes client build in pre-test for local dev via a Directory.Build.props/targets or a simple repo script) or document clearly.

## Recommendations — Next Steps
- Tests
  - Add unit tests for `ScoreService.SaveAndRankAsync` (persist, rank, total) using `InMemory` provider.
  - Add negative-path tests for `SessionController.Submit` (e.g., duplicate items, speed exceeded) to verify 200 with `Accepted=false` and reason.
  - Add parameter validation/bounds tests for `LeaderboardController.Get(top)` and enforce upper bound (e.g., clamp to 100).
  - Add a guard test for `ViteManifestService` missing manifest case to ensure the app still renders a helpful hint (already logged).
- Security
  - Enforce non-default `Security:IpHashSalt` in non-Development environments; log error and fail startup if default/empty.
  - Restrict `/Docs` page to Development or add auth; optionally disable raw HTML in Markdig or sanitize output.
  - Optionally add simple rate-limit on `POST /api/session/submit` (per-IP hash) to reduce spam.
- Dev Experience
  - Update README to note: “Before running server tests locally, run `npm ci && npm run build` in `src/KnutGame.Client` to generate `/wwwroot/game/manifest.json`.”
  - Consider a top-level script to orchestrate client build + server tests for local dev.

## Open Questions
- Should leaderboard `top` have a documented maximum? Current implementation lacks a clamp.
- Is production expected to deploy the `/Docs` page? If so, add auth; if not, consider conditionally mapping it only in Development.

---
Status: Initial pass complete. Ready to deepen with targeted tests and security hardening changes if desired.
