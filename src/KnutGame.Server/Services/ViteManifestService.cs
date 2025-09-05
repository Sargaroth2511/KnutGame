namespace KnutGame.Services;

using System.Text.Json;

public class ViteManifestService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ViteManifestService> _logger;
    private readonly Lazy<Dictionary<string, ManifestEntry>> _manifest;

    private record ManifestEntry(
        string file,
        string? src,
        bool? isEntry,
        string[]? css,
        string[]? assets,
        string[]? imports
    );

    public ViteManifestService(IWebHostEnvironment env, ILogger<ViteManifestService> logger)
    {
        _env = env;
        _logger = logger;
        _manifest = new Lazy<Dictionary<string, ManifestEntry>>(Load, isThreadSafe: true);
    }

    private Dictionary<string, ManifestEntry> Load()
    {
        var path = Path.Combine(_env.WebRootPath ?? "wwwroot", "game", "manifest.json");
        if (!File.Exists(path))
        {
            _logger.LogWarning("Vite manifest not found at {Path}. Did you run `pnpm -C src/client build`?", path);
            return new();
        }

        var json = File.ReadAllText(path);
        var dict = JsonSerializer.Deserialize<Dictionary<string, ManifestEntry>>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
        );

        return dict ?? new();
    }

    public string? GetJs(string entry = "src/main.ts") =>
        _manifest.Value.TryGetValue(entry, out var m)
            ? "/game/" + m.file.Replace("\\", "/")
            : null;

    public IEnumerable<string> GetCss(string entry = "src/main.ts") =>
        _manifest.Value.TryGetValue(entry, out var m) && m.css is { Length: > 0 }
            ? m.css.Select(c => "/game/" + c.Replace("\\", "/"))
            : Enumerable.Empty<string>();
}
