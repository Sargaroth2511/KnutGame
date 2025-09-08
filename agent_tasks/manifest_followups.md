# Agent Task: Finalize Manifest Integration (CI, Tests, Cleanup)

Purpose: Finish the manifest-based asset flow by building the client in CI, validating injection with an extra server test, and tightening ignore rules. Keep changes minimal and low-risk.

## Context Snapshot
- Server uses `ViteManifestService` in `src/KnutGame.Server/Pages/Index.cshtml` to inject CSS/JS.
- Client Vite config outputs to `../KnutGame.Server/wwwroot/game` with `manifest: 'manifest.json'`.
- Server tests already assert `/game/manifest.json` and assets are served.

## Acceptance Criteria
- CI builds the client before running server tests; all jobs green.
- Optional regression test verifies `<script type="module">` in `/` HTML matches manifest entry file.
- Local builds/tests pass via provided commands.
- Repo ignores dev-only manifest artifacts (`.vite` dir and `manifest.json`) if we choose not to commit them.

## Steps

1) CI: Build client before server tests
- Add GitHub Actions workflow to build client assets (producing `manifest.json`) and then run server tests.
- Node 20+, .NET 9; enable caching for npm and NuGet.

Unified diff (add file):
```
*** Add File: .github/workflows/ci.yml
+name: CI
+
+on:
+  push:
+    branches: [ main ]
+  pull_request:
+    branches: [ main ]
+
+jobs:
+  build-and-test:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+
+      - name: Setup Node
+        uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+          cache: 'npm'
+          cache-dependency-path: src/KnutGame.Client/package-lock.json
+
+      - name: Install client deps
+        working-directory: src/KnutGame.Client
+        run: npm ci
+
+      - name: Build client (generates manifest)
+        working-directory: src/KnutGame.Client
+        run: npm run build
+
+      - name: Run client tests
+        working-directory: src/KnutGame.Client
+        run: npm test -- --run
+
+      - name: Setup .NET
+        uses: actions/setup-dotnet@v4
+        with:
+          dotnet-version: '9.0.x'
+
+      - name: Restore
+        run: dotnet restore
+
+      - name: Build
+        run: dotnet build --no-restore -c Release
+
+      - name: Test
+        run: dotnet test --no-build -c Release
```

2) Optional: Add assertion that `Index.cshtml` uses manifest file
- New test confirms the injected `<script>` src equals the manifest’s `file` for `src/main.ts`.

Unified diff (add file):
```
*** Add File: tests/KnutGame.Server.Tests/ManifestInjectionTests.cs
+using System.Net;
+using System.Text.Json;
+using Microsoft.AspNetCore.Mvc.Testing;
+using Xunit;
+
+namespace KnutGame.Server.Tests;
+
+public class ManifestInjectionTests : IClassFixture<WebApplicationFactory<Program>>
+{
+    private readonly WebApplicationFactory<Program> _factory;
+
+    public ManifestInjectionTests(WebApplicationFactory<Program> factory)
+    {
+        _factory = factory;
+    }
+
+    [Fact]
+    public async Task Index_Html_Includes_Manifest_Entry_Script()
+    {
+        var client = _factory.CreateClient();
+
+        // Ensure manifest exists and parse it
+        var manifestResp = await client.GetAsync("/game/manifest.json");
+        Assert.Equal(HttpStatusCode.OK, manifestResp.StatusCode);
+
+        var manifestJson = await manifestResp.Content.ReadAsStringAsync();
+        var manifest = JsonSerializer.Deserialize<Dictionary<string, ManifestEntry>>(manifestJson, new JsonSerializerOptions
+        {
+            PropertyNameCaseInsensitive = true
+        });
+        Assert.NotNull(manifest);
+
+        var entry = Assert.Contains("src/main.ts", manifest!);
+        Assert.False(string.IsNullOrWhiteSpace(entry.file));
+
+        // Fetch page and assert script tag uses that file
+        var htmlResp = await client.GetAsync("/");
+        htmlResp.EnsureSuccessStatusCode();
+        var html = await htmlResp.Content.ReadAsStringAsync();
+
+        var expected = $"<script type=\"module\" src=\"/game/{entry.file}\"></script>";
+        Assert.Contains(expected, html);
+    }
+
+    private record ManifestEntry(string file, string[]? css);
+}
```

3) Ignore dev-only manifest artifacts (if not committed)
- Prevent noise from ephemeral files.

Unified diff (append lines):
```
*** Update File: .gitignore
@@
 node_modules/
+
+# Built client manifest (prefer generating in CI)
+src/KnutGame.Server/wwwroot/game/manifest.json
+src/KnutGame.Server/wwwroot/game/.vite/
```

4) Optional cleanup (low priority)
- Extra devDeps (`canvas`, `phaser3spectorjs`) are not required by current tests.
- Two options:
  - Keep as-is (safe, no churn).
  - Remove to speed installs: `npm uninstall canvas phaser3spectorjs` in `src/KnutGame.Client` and commit lockfile.
- Config import:
  - Current `vite.config.ts` imports `defineConfig` from `vitest/config` so `test` key is typed; Vite accepts it.
  - Alternative: split to `vitest.config.ts` and revert `vite.config.ts` import to `vite`. Only do this if tooling requires.

## Commands (local verification)
- Client: `cd src/KnutGame.Client && npm ci && npm run build && npm test -- --run`
- Server: `dotnet test`

## Machine Spec (JSON)
```json
{
  "changes": [
    {"path": ".github/workflows/ci.yml", "action": "add", "reason": "Build client before server tests"},
    {"path": "tests/KnutGame.Server.Tests/ManifestInjectionTests.cs", "action": "add", "reason": "Guard manifest injection"},
    {"path": ".gitignore", "action": "append", "reason": "Ignore dev-only manifest artifacts"}
  ],
  "commands": [
    {"name": "client_install", "cmd": "npm ci", "cwd": "src/KnutGame.Client"},
    {"name": "client_build", "cmd": "npm run build", "cwd": "src/KnutGame.Client"},
    {"name": "client_tests", "cmd": "npm test -- --run", "cwd": "src/KnutGame.Client"},
    {"name": "server_tests", "cmd": "dotnet test", "cwd": "."}
  ],
  "acceptance": [
    "CI job builds client then runs tests successfully",
    "GET /game/manifest.json returns 200 and has 'src/main.ts'",
    "GET / includes <script type=\"module\" src=\"/game/<manifest.file>\">",
    "All local tests pass"
  ]
}
```

