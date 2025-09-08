# Agent Task: Remove Unused Boilerplate Files (Safe Cleanup)

Purpose: Delete Razor template files and static assets that are no longer used by the game. Keep behavior and tests unchanged.

## Rationale
- The game page (`Pages/Index.cshtml`) sets `Layout = null` and injects assets via Vite manifest. The default Razor layout, privacy page, and validation partial are not used.
- Template static assets under `wwwroot/lib`, `wwwroot/css/site.css`, and `wwwroot/js/site.js` are only referenced by the unused layout.
- Vite icons are not used by the current build pipeline.

## Acceptance Criteria
- Builds and tests pass after removal: `dotnet build`, `dotnet test`.
- GET `/` still returns 200 and contains `<div id="app"></div>`.
- GET `/game/manifest.json` still serves and assets resolve.
- No references remain to deleted files/paths.

## Deletions
- Server pages (template):
  - `src/KnutGame.Server/Pages/Privacy.cshtml`
  - `src/KnutGame.Server/Pages/Privacy.cshtml.cs`
  - `src/KnutGame.Server/Pages/Shared/_Layout.cshtml`
  - `src/KnutGame.Server/Pages/Shared/_Layout.cshtml.css`
  - `src/KnutGame.Server/Pages/Shared/_ValidationScriptsPartial.cshtml`
  - `src/KnutGame.Server/Pages/_ViewStart.cshtml`
- Server static assets (template):
  - Entire directory `src/KnutGame.Server/wwwroot/lib/` (Bootstrap, jQuery, validation)
  - `src/KnutGame.Server/wwwroot/js/site.js`
  - `src/KnutGame.Server/wwwroot/css/site.css`
  - `src/KnutGame.Server/wwwroot/game/vite.svg`
- Client public icon (template):
  - `src/KnutGame.Client/public/vite.svg`

## Small Adjustment (to decouple from layout)
- Ensure error page does not expect a layout since `_ViewStart.cshtml` is removed:
  - Add `Layout = null;` to `src/KnutGame.Server/Pages/Error.cshtml` header block.

## Suggested Patches (apply carefully)

Delete files:
```
*** Delete File: src/KnutGame.Server/Pages/Privacy.cshtml
*** Delete File: src/KnutGame.Server/Pages/Privacy.cshtml.cs
*** Delete File: src/KnutGame.Server/Pages/Shared/_Layout.cshtml
*** Delete File: src/KnutGame.Server/Pages/Shared/_Layout.cshtml.css
*** Delete File: src/KnutGame.Server/Pages/Shared/_ValidationScriptsPartial.cshtml
*** Delete File: src/KnutGame.Server/Pages/_ViewStart.cshtml
*** Delete File: src/KnutGame.Server/wwwroot/js/site.js
*** Delete File: src/KnutGame.Server/wwwroot/css/site.css
*** Delete File: src/KnutGame.Server/wwwroot/game/vite.svg
*** Delete File: src/KnutGame.Client/public/vite.svg
```

Delete directory contents (server libs):
```
# Remove the entire libs folder
rm -rf src/KnutGame.Server/wwwroot/lib
```

Update error page layout to null:
```
*** Update File: src/KnutGame.Server/Pages/Error.cshtml
@@
-﻿@page
+﻿@page
 @model ErrorModel
 @{
     ViewData["Title"] = "Error";
+    Layout = null;
 }
```

## Verification Steps
- From repo root:
  - `dotnet build`
  - `dotnet test`
- Manual checks (optional):
  - Run server: `cd src/KnutGame.Server && dotnet run`
  - Open `/` — game loads as before.
  - Open `/Error` to ensure the error page renders without a layout.

## Commit Message
- chore(server): remove unused Razor template files and static libs; set Error page layout to null

## Machine Spec (JSON)
```json
{
  "changes": [
    {"path": "src/KnutGame.Server/Pages/Privacy.cshtml", "action": "delete"},
    {"path": "src/KnutGame.Server/Pages/Privacy.cshtml.cs", "action": "delete"},
    {"path": "src/KnutGame.Server/Pages/Shared/_Layout.cshtml", "action": "delete"},
    {"path": "src/KnutGame.Server/Pages/Shared/_Layout.cshtml.css", "action": "delete"},
    {"path": "src/KnutGame.Server/Pages/Shared/_ValidationScriptsPartial.cshtml", "action": "delete"},
    {"path": "src/KnutGame.Server/Pages/_ViewStart.cshtml", "action": "delete"},
    {"path": "src/KnutGame.Server/wwwroot/lib", "action": "delete_dir"},
    {"path": "src/KnutGame.Server/wwwroot/js/site.js", "action": "delete"},
    {"path": "src/KnutGame.Server/wwwroot/css/site.css", "action": "delete"},
    {"path": "src/KnutGame.Server/wwwroot/game/vite.svg", "action": "delete"},
    {"path": "src/KnutGame.Client/public/vite.svg", "action": "delete"},
    {"path": "src/KnutGame.Server/Pages/Error.cshtml", "action": "patch", "reason": "Set Layout = null"}
  ],
  "commands": [
    {"name": "server_build", "cmd": "dotnet build", "cwd": "."},
    {"name": "server_tests", "cmd": "dotnet test", "cwd": "."}
  ],
  "acceptance": [
    "dotnet build succeeds",
    "dotnet test succeeds",
    "GET / returns 200 and game loads",
    "GET /Error renders without missing layout"
  ]
}
```

