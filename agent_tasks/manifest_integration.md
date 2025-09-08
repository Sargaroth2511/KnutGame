# Agent Task: Manifest-Driven Asset Injection + Build & Test

Goal: Replace hardcoded asset links in `Index.cshtml` with `ViteManifestService` output, ensure the client build generates `manifest.json`, and validate via tests.

## Context
- Server: `src/KnutGame.Server` (Razor Pages, .NET 9) already registers `KnutGame.Services.ViteManifestService`.
- Client: `src/KnutGame.Client` (Vite + TS + Phaser) outputs to `../KnutGame.Server/wwwroot/game` with `manifest: true`.
- Current issue: `Pages/Index.cshtml` hardcodes hashed JS/CSS; `manifest.json` may be missing if the client hasn’t been built.

## Acceptance Criteria
- `Index.cshtml` uses `ViteManifestService` to render CSS `<link>`s and a JS `<script type="module">` for entry `src/main.ts`.
- If the manifest is missing, the page still renders the `#app` container and shows a dev hint comment (no hard failures).
- Client build creates `wwwroot/game/manifest.json`.
- Tests pass: `dotnet test` (server) and `npm run test` (client).

## Implementation Steps
1) Edit `src/KnutGame.Server/Pages/Index.cshtml` to consume the manifest service and emit assets dynamically.
2) Build client to generate `manifest.json` into `wwwroot/game`.
3) Validate serving and run tests.

## Patch (apply to `src/KnutGame.Server/Pages/Index.cshtml`)

Unified diff:

```
--- a/src/KnutGame.Server/Pages/Index.cshtml
+++ b/src/KnutGame.Server/Pages/Index.cshtml
@@
-﻿@page
-@{
--    Layout = null;
--    ViewData["Title"] = "Knut Game";
--}
+﻿@page
+@inject KnutGame.Services.ViteManifestService Manifest
+@{
+    Layout = null;
+    ViewData["Title"] = "Knut Game";
+    var js = Manifest.GetJs("src/main.ts");
+    var cssFiles = Manifest.GetCss("src/main.ts");
+}
@@
 <head>
     <meta charset="utf-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <title>@ViewData["Title"]</title>
+
+    @* Emit CSS from Vite manifest, if any *@
+    @foreach (var href in cssFiles)
+    {
+        <link rel="stylesheet" href="@href" />
+    }
 </head>
 <body>
     <div id="app"></div>

-    <link rel="stylesheet" href="/game/assets/main-8MPEXs9s.css">
-    <script type="module" src="/game/assets/main-Dc32h3_3.js"></script>
+    @* Emit JS entry from Vite manifest, else show a dev hint *@
+    @if (js is not null)
+    {
+        <script type="module" src="@js"></script>
+    }
+    else
+    {
+        @:<!-- No manifest found. Run `npm install && npm run build` in src/KnutGame.Client to generate /wwwroot/game/manifest.json -->
+    }
 </body>
 </html>
```

Notes:
- No changes needed in `Program.cs` (service already registered; static file middleware configured for `/game`).
- Keeping `Layout = null;` preserves the minimal page shell for the game.

## Build Client (generate manifest)

Run from repo root:
- `cd src/KnutGame.Client`
- `npm install` (or `npm ci`)
- `npm run build`

Expected outputs:
- `src/KnutGame.Server/wwwroot/game/manifest.json`
- Hashed assets under `src/KnutGame.Server/wwwroot/game/assets/`

## Validate
- Serve check: `dotnet run -c Release` from `src/KnutGame.Server` and open `/`.
- Manifest check: GET `/game/manifest.json` returns 200 and includes key `"src/main.ts"`.
- Tests:
  - Server: `dotnet test` (from repo root or `tests/KnutGame.Server.Tests`).
  - Client: `npm run test` (from `src/KnutGame.Client`).

## Troubleshooting
- If `/game/manifest.json` is 404:
  - Re-run client build; confirm `vite.config.ts` `build.outDir` is `../KnutGame.Server/wwwroot/game`.
  - Ensure build didn’t write to a different path (relative roots differ if run from unexpected cwd).
- If Index fails to render assets:
  - Confirm DI: `@inject KnutGame.Services.ViteManifestService Manifest` present.
  - Add logging level to see `ViteManifestService` warnings about missing manifest.

## Optional (nice-to-have) Test
- Add an integration test asserting that `Index.cshtml` references the JS file reported by manifest:
  - Fetch `/game/manifest.json`, read `file` for `src/main.ts`.
  - Fetch `/`, assert HTML contains `<script type="module" src="/game/{file}">`.
  - This guards against regressions in asset injection.

## Machine Spec (JSON)

```json
{
  "changes": [
    {
      "path": "src/KnutGame.Server/Pages/Index.cshtml",
      "action": "patch",
      "reason": "Use ViteManifestService for CSS/JS injection"
    }
  ],
  "commands": [
    { "name": "client_install", "cmd": "npm install", "cwd": "src/KnutGame.Client", "when": "before_tests" },
    { "name": "client_build", "cmd": "npm run build", "cwd": "src/KnutGame.Client", "when": "before_tests" },
    { "name": "server_tests", "cmd": "dotnet test", "cwd": ".", "when": "before_merge" },
    { "name": "client_tests", "cmd": "npm run test", "cwd": "src/KnutGame.Client", "when": "before_merge" }
  ],
  "acceptance": [
    "GET / returns 200 and contains '<div id=\"app\"></div>'",
    "GET /game/manifest.json returns 200 and has key 'src/main.ts'",
    "HTML for / contains a <script type=\"module\"> with src matching manifest file",
    "All tests pass: dotnet and vitest"
  ]
}
```

