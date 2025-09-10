# KnutGame Refactor and Quality Plan (Step-by-Step)

This plan focuses on code quality, readability, SOLID alignment, and maintainability. It sequences work into small, verifiable steps with explicit acceptance criteria and validation commands.

Contents
- Goals & Constraints
- Risks & Assumptions
- Refactor Roadmap (Phases 0–9)
- Validation Matrix
- Rollback & Contingencies

---

## Goals & Constraints

- Improve readability and maintainability through clear naming, small focused modules, and separation of concerns.
- Keep behavior stable; do not change gameplay unless explicitly stated.
- Maintain server–client API compatibility; prevent runtime and model-binding errors.
- Keep tests green throughout; add tests where they reduce risk.

Constraints
- Do not introduce unrelated features.
- Keep changes incremental and reviewable; prefer small PRs per phase.
- Target existing toolchain (ASP.NET Core 9, EF Core, Node 18+, Vite, Phaser 3).

---

## Risks & Assumptions

- Risk: Client enum includes `ANGEL` item, server enum does not → model-binding errors on submit. Mitigate by aligning enums or filtering client submission in the short term.
- Risk: `MainScene.ts` is large and cross-cuts responsibilities → refactors should avoid functional drift. Use acceptance criteria per extraction.
- Assumption: Current tests represent intended behavior; where divergence exists (e.g., time-based server scoring vs client coin scoring), we keep server behavior stable initially.

---

## Refactor Roadmap

### Phase 0 — Baseline & Safety Net
1) Run all tests locally
   - Commands:
     - `dotnet test`
     - `cd src/KnutGame.Client && npm install && npm run test`
   - Acceptance: All tests pass or known flaky tests are documented.
2) Manual smoke: build client and ensure manifest is served
   - Commands:
     - `cd src/KnutGame.Client && npm run build`
     - `cd ../KnutGame.Server && dotnet run`
   - Acceptance: Index loads; `/game/manifest.json` resolves; no console errors.

### Phase 1 — Server–Client Contract Alignment (Items Enum)
Problem: Client has `ItemType.ANGEL` but server enum `ItemKind` lacks it.

Option A (preferred): Add `ANGEL` to server enum and treat as “no score impact”.
1) Server: extend `ItemKind` with `ANGEL` (DTOs.cs); update `AntiCheatService` no functional change.
2) Tests: add model-binding smoke test that submits an `ANGEL` item within bounds and asserts 200 OK + Accepted.
3) Scoring: explicitly ignore `ANGEL` in `ScoringEngine` switch (clarify intent).
4) Validation: run tests.

Option B (temporary): Client filters out `ANGEL` in submission snapshot.
1) Client: filter events before `submitSession` to map `ANGEL` → drop or convert to `MULTI` (documented). Only use if backend cannot change.

Acceptance:
- Submitting a session with an `ANGEL` pickup succeeds (Accepted=true) with unchanged score computation.

### Phase 2 — Split Main Scene Responsibilities
Goal: Reduce `MainScene.ts` complexity via focused modules. No behavior change.

2.1) Create new folders
- `src/scene/` for scene glue and lifecycle
- `src/scene/vfx/` for visual effects helpers (particles, aura, snow burst)
- `src/scene/session/` for session buffering/start/submit and AI greeting flow
- `src/scene/state/` for player state (lives, invulnerability, multiplier blink)

2.2) Extract small, pure helpers first (low risk)
- Move `drawRect`, `shrinkRect` debug utilities to a `geometry.ts` under `scene/util` (no side effects).
- Move particle burst / pickup aura methods into `vfx/Effects.ts` using `ParticlePool` (inject pool).

2.3) Extract session lifecycle
- `session/SessionLifecycle.ts`: start session, buffer snapshots, submit payload, fetch gameover greeting.
- Inject minimal interfaces into `MainScene` to call: `session.start()`, `session.bufferMove()`, `session.bufferHit()`, `session.bufferItem()`, `session.submit()`.

2.4) Extract player protection state
- `state/Protection.ts`: invulnerability timer, shield HUD updates, blink control hooks (start/stop).

2.5) Wire back in `MainScene`
- Replace inlined logic with module calls. Ensure all existing references compile and behavior remains unchanged.

Acceptance:
- `MainScene` shrinks significantly; extracted modules compile and are unit-testable.
- No change in runtime behavior (manual smoke matches before/after).

### Phase 3 — Collision System Clarity & Tests
3.1) Centralize collision constants
- Move magic numbers to `gameConfig.ts` (if any remain in `CollisionSystem`), ensure single source.

3.2) Add geometry unit tests (no Phaser runtime)
- Factor OBB/AABB math into `systems/geometry.ts` (pure functions) and add Vitest specs for SAT projections, corner generation, and simple overlap cases.

3.3) Document the hitbox model
- Inline comments in `CollisionSystem.ts` explaining trunk OBB assumptions and offsets.

Acceptance:
- New unit tests for geometry math pass; collision behavior unchanged in-game.

### Phase 4 — Server Scoring Documentation and Guardrails
Context: Server uses time-based base points; client uses coin-driven score display but submits full event stream.

4.1) Clarify intent in code
- Add comments in `ScoringEngine` noting time-based base and item bonuses; explicitly ignore `ANGEL`.

4.2) Add unit test parity notes
- Expand test names and XML docs indicating the model.

4.3) Optional (future): move to coin-only score on server
- Design doc stub: compute score from POINTS/MULTI windows only; migrate tests accordingly.

Acceptance:
- No behavior change; improved clarity and readiness for future scoring revision.

### Phase 5 — OpenAI Service Hardening
5.1) Extract JSON pair parsing and fence normalization into a small static utility class.
5.2) Add unit tests covering:
- Code-fenced JSON, extra whitespace, missing fields, non-JSON fallback.
5.3) Ensure headers set idempotently; keep retry on 429/5xx.

Acceptance:
- Existing tests still pass; new tests validate resilient parsing.

### Phase 6 — IP Hashing Small Refactor
6.1) Extract IP hashing into `ISecurityHasher` service
- `ComputeClientIpHash(HttpContext, salt)` with pure implementation for easy testing.
6.2) Inject into `SessionController`; add unit test covering hash value and decoding of IP.

Acceptance:
- No behavior change; controller slimmer and easier to test.

### Phase 7 — Type Safety & Linting (Client)
7.1) Increase TS strictness gradually (optional):
- Enable `noImplicitAny` for new/modified files; avoid changing legacy files en masse.
7.2) Add ESLint config tuned for Phaser projects (if not present); run lint and fix low-risk issues (naming, unused vars).

Acceptance:
- Lint passes for touched files; no runtime changes.

### Phase 8 — Documentation & Dev UX
8.1) Update README with:
- Short refactor summary and new module layout.
8.2) Add short “Docs” section pointing to `/Docs` and this plan file.

Acceptance:
- Docs reflect current structure and how to run tests.

### Phase 9 — Verification & Build
9.1) Run full test matrix:
- `dotnet test`
- `cd src/KnutGame.Client && npm run test`
9.2) Build artifacts and manual smoke:
- `npm run build` (client), `dotnet run` (server), test `/` and `/Docs`.

Acceptance:
- All tests green; app loads, greeting shown, gameplay unaffected, scoreboard works.

---

## Validation Matrix

| Phase | Validation | Command(s) |
|------:|------------|------------|
| 0 | Server tests pass | `dotnet test` |
| 0 | Client tests pass | `cd src/KnutGame.Client && npm i && npm t` |
| 1 | ANGEL submits OK | Integration test passes; manual submit in-game |
| 2 | No behavior change | Manual play 2–3 mins; compare logs and HUD |
| 3 | Geometry tests pass | `npm run test` (client) |
| 5 | OpenAI parsing tests | `dotnet test` |
| 6 | IP hashing unit test | `dotnet test` |
| 9 | Build + smoke | `npm run build` + `dotnet run` |

---

## Rollback & Contingencies

- Each phase is self-contained; roll back by reverting the phase’s commit(s).
- If ANGEL alignment (Phase 1) is blocked on backend policy, apply Option B client-side filter as a hotfix and track backend change separately.
- If strict TS checks cause friction, scope them to extracted modules only.

---

## Implementation Notes

- Favor pure functions and dependency injection for testability.
- Keep file sizes small; if a file exceeds ~200–300 lines, consider further extraction.
- Maintain consistent naming: modules named by domain (e.g., `SessionLifecycle`, `Protection`, `Effects`).
- Avoid `any` where reasonable; prefer Phaser types or minimal interfaces.

