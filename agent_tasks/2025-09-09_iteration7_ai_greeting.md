# Iteration 7 — AI Greetings (Detailed Plan)

## Goal
Deliver an AI‑generated greeting that appears when the player starts the game. Keep the design clean, configurable, and testable. Use an existing OpenAI API key via server‑side config.

## Constraints & Principles
- Don’t expose API keys to the client; all AI calls go through the server.
- System prompt must be configurable without code changes (file‑based or appsettings path).
- Graceful fallback when AI fails or is disabled.
- Keep anti‑cheat unaffected; no change to scoring.
- SOLID: introduce clear interfaces and adapters; no logic buried in controllers.

## High‑Level Architecture
- Domain/service: `IKiTextService` → returns `{ title, message }` for a given context (e.g., start greeting, later game-over commentary).
- Infra adapter: `OpenAiTextService` using Chat Completions with an injected `OpenAiOptions` (apiKey, model, systemPromptPath, timeouts).
- Config: `OpenAiOptions` bound from configuration/env. Use env var `OPENAI_API_KEY` in dev, with `appsettings.Development.json` mapping `OpenAI:ApiKey` from env.
- Prompt: Keep a system prompt file (editable) whose path is set in options; load the contents on startup with a change‑friendly approach (watch file for reload can be a follow‑up).
- API: `GET /api/greeting?kind=start` → `{ title, message }`. Later: `kind=gameover&score=...`.
- Client: On scene create/start, fetch `/api/greeting?kind=start`, display via HUD overlay or a small modal; dismissible.
- Testing: Introduce a `StubTextService` in tests; do not call OpenAI in unit/integration tests.

## Detailed Tasks
1) Options & Config
- Add `OpenAiOptions` with: `ApiKey`, `Model` (default `gpt-4o-mini` or `gpt-4o`), `SystemPromptPath`, `Temperature` (default 0.6), `MaxTokens` (sane default), `Enabled` (bool).
- Wire reading options: `builder.Services.Configure<OpenAiOptions>(Configuration.GetSection("OpenAI"));`
- Document setting `OPENAI_API_KEY` in dev. Provide `appsettings.Development.json` example mapping.

2) Service Interface & Impl
- Interface `IKiTextService { Task<(string Title, string Message)> GetGreetingAsync(string kind, CancellationToken ct); }`.
- Implementation `OpenAiTextService`:
  - Reads system prompt from `OpenAiOptions.SystemPromptPath` at call time (or cache) to allow quick edits.
  - Builds messages: system = file contents; user = a short directive: "Generate a short, warm greeting for starting a simple arcade game."
  - Calls OpenAI Chat Completions. Parses and returns title + message.
  - On failure or disabled, returns a static fallback (e.g., "Welcome!", "Dodge the trees and have fun!").

3) Controller Endpoint
- `GreetingController` (`GET /api/greeting?kind=start`): calls `IKiTextService.GetGreetingAsync(kind)` → `{ title, message }`.
- `[AllowAnonymous]` is fine for now.

4) Client Integration
- In `MainScene.create()`: fetch `/api/greeting?kind=start`.
- HUD: Add a simple overlay panel with title + message and a close button. Ensure it overlays the canvas and doesn’t block input after close.
- Failure fallback: render a static greeting if API returns error.

5) Prompt File
- Add a default prompt file: `prompts/ai_system_prompt_start.md` with clear instructions and style guides.
- Make path configurable via `OpenAI:SystemPromptPath`.
- Example content: tone, brevity (1–2 sentences), thematic (winter/holiday), avoid heavy punctuation, no marketing.

6) Security & Limits
- Do not log the API key.
- Add basic timeouts and minimal retries on 5xx.
- Consider response size limits via `MaxTokens`.

7) Tests (Server)
- Unit tests for `OpenAiTextService` shape parsing via a stubbed response (no network).
- Controller test: `/api/greeting?kind=start` returns `{ title, message }` with the stub.

8) Dev Operability
- If `OpenAI:Enabled=false` or missing key, service returns a static fallback (still 200 OK) and logs a warning.
- Docs: Update `docs/API.md` and `docs/iterationPlan.md` with endpoint and config.

## Milestones
- M1: Options + interface + controller stub + static greeting (no OpenAI call yet). Client shows greeting.
- M2: OpenAI integration behind `Enabled` flag and prompt file. Server returns real AI text when configured.
- M3: Polish (prompt tweaks, basic caching of start greeting, error handling, docs updates).

## Config Examples
```jsonc
// appsettings.Development.json
{
  "OpenAI": {
    "Enabled": true,
    "ApiKey": "${OPENAI_API_KEY}",
    "Model": "gpt-4o-mini",
    "SystemPromptPath": "prompts/ai_system_prompt_start.md",
    "Temperature": 0.6,
    "MaxTokens": 200
  }
}
```

Export env: `export OPENAI_API_KEY=sk-...`

## Prompt Template (example)
```
You are a friendly, concise game greeter.
- Audience: casual players starting a winter-themed arcade game.
- Style: warm, 1–2 sentences, no emojis, no fluff.
- Encourage: movement keys/touch, avoiding obstacles, collecting items.
- Keep it welcoming; avoid repeating the game title.
Return JSON with fields: title, message.
```

## API Contract
- GET `/api/greeting?kind=start`
- 200 OK `{ "title": string, "message": string }`
- 200 OK (fallback) when disabled/misconfigured.
- 500 on unexpected server failures.

## Rollout Notes
- Keep AI off by default unless `Enabled=true` and key present.
- No user content sent; privacy friendly. Later: opt-in personalization.

