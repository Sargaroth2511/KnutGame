using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using KnutGame.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KnutGame.Services;

public class OpenAiTextService : IKiTextService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly OpenAiOptions _options;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<OpenAiTextService> _logger;

    public OpenAiTextService(
        IHttpClientFactory httpFactory,
        IOptions<OpenAiOptions> options,
        IWebHostEnvironment env,
        ILogger<OpenAiTextService> logger)
    {
        _httpFactory = httpFactory;
        _options = options.Value;
        _env = env;
        _logger = logger;
    }

    public async Task<(string Title, string Message)> GetGreetingAsync(string kind, CancellationToken ct = default)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return ("Welcome!", "Dodge falling trees, collect goodies, and have fun!");
        }

        try
        {
            var client = _httpFactory.CreateClient("openai");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
            if (!string.IsNullOrWhiteSpace(_options.Organization))
            {
                client.DefaultRequestHeaders.Remove("OpenAI-Organization");
                client.DefaultRequestHeaders.Add("OpenAI-Organization", _options.Organization);
            }

            var systemPrompt = await LoadSystemPromptAsync(kind, ct);
            var userPrompt = kind == "start"
                ? "Generate the start greeting JSON."
                : $"Generate the greeting JSON for kind='{kind}'.";

            var body = BuildChatCompletionsBody(systemPrompt, userPrompt);
            // Basic retry on 429/5xx
            for (int attempt = 0; attempt < 2; attempt++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json")
                };
                using var resp = await client.SendAsync(req, ct);
                if ((int)resp.StatusCode == 429 || (int)resp.StatusCode >= 500)
                {
                    if (attempt == 0)
                    {
                        await Task.Delay(250, ct);
                        continue;
                    }
                }
                resp.EnsureSuccessStatusCode();
                var json = await resp.Content.ReadAsStringAsync(ct);

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var content = root.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
                content = NormalizeContent(content);

                // Try to parse content as JSON { title, message }
                var (title, message) = TryParseJsonPair(content);
                if (!string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(message))
                    return (TrimSafe(title), TrimSafe(message));

                // Fallback: use content as message
                if (!string.IsNullOrWhiteSpace(content))
                    return ("Welcome!", TrimSafe(content));

                break;
            }

            return ("Welcome!", "Dodge falling trees, collect goodies, and have fun!");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI greeting generation failed. Falling back to static message.");
            return ("Welcome!", "Dodge falling trees, collect goodies, and have fun!");
        }
    }

    public async Task<(string Title, string Message)> GetGameoverAsync(int score, int rank, int totalPlayers, double euros, int durationSec, int itemsCollected, CancellationToken ct = default)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            var title = rank == 1 ? "Top of the Pines" : "Winter Wrap";
            var message = $"You scored {score} pts and placed {rank}/{totalPlayers}. €{euros:0.00} goes to a good cause • {durationSec}s survived • {itemsCollected} items.";
            return (title, message);
        }

        try
        {
            var client = _httpFactory.CreateClient("openai");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
            if (!string.IsNullOrWhiteSpace(_options.Organization))
            {
                client.DefaultRequestHeaders.Remove("OpenAI-Organization");
                client.DefaultRequestHeaders.Add("OpenAI-Organization", _options.Organization);
            }

            var systemPrompt = await LoadSystemPromptAsync("gameover", ct);
            var userPrompt = $"Inputs: score={score}, rank={rank}, totalPlayers={totalPlayers}, euros=€{euros:0.00}, durationSec={durationSec}, itemsCollected={itemsCollected}. Return JSON as specified.";
            var body = BuildChatCompletionsBody(systemPrompt, userPrompt);

            for (int attempt = 0; attempt < 2; attempt++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json")
                };
                using var resp = await client.SendAsync(req, ct);
                if ((int)resp.StatusCode == 429 || (int)resp.StatusCode >= 500)
                {
                    if (attempt == 0)
                    {
                        await Task.Delay(250, ct);
                        continue;
                    }
                }
                resp.EnsureSuccessStatusCode();
                var json = await resp.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(json);
                var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
                content = NormalizeContent(content);
                var (title, message) = TryParseJsonPair(content);
                if (!string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(message))
                    return (TrimSafe(title), TrimSafe(message));
                if (!string.IsNullOrWhiteSpace(content))
                    return ("Well played", TrimSafe(content));
                break;
            }

            return ("Well played", $"Score {score}, rank {rank}/{totalPlayers}, €{euros:0.00} for good.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI gameover generation failed. Falling back to static message.");
            return ("Well played", $"Score {score}, rank {rank}/{totalPlayers}, €{euros:0.00} for good.");
        }
    }

    private async Task<string> LoadSystemPromptAsync(string kind, CancellationToken ct)
    {
        // Resolve prompt path relative to repository root (two levels up from content root), mirroring Docs page logic
        var contentRoot = _env.ContentRootPath; // src/KnutGame.Server
        var repoRoot = Path.GetFullPath(Path.Combine(contentRoot, "..", ".."));
        var path = kind == "gameover" ? _options.SystemPromptPathGameover : _options.SystemPromptPath;
        var full = Path.IsPathRooted(path) ? path : Path.GetFullPath(Path.Combine(repoRoot, path));

        if (File.Exists(full))
        {
            return await File.ReadAllTextAsync(full, ct);
        }

        _logger.LogWarning("System prompt file not found at {Path}. Using minimal default.", full);
        return "You are a friendly, concise game greeter. Return JSON with fields: title, message.";
    }

    private static (string Title, string Message) TryParseJsonPair(string content)
    {
        try
        {
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var title = root.TryGetProperty("title", out var t) ? t.GetString() : null;
            var message = root.TryGetProperty("message", out var m) ? m.GetString() : null;
            return (title ?? string.Empty, message ?? string.Empty);
        }
        catch
        {
            return (string.Empty, string.Empty);
        }
    }

    private string BuildChatCompletionsBody(string systemPrompt, string userPrompt)
    {
        // Minimal body per OpenAI chat.completions
        var payload = new
        {
            model = _options.Model,
            temperature = _options.Temperature,
            max_tokens = _options.MaxTokens,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            }
        };
        return JsonSerializer.Serialize(payload);
    }

    private static string NormalizeContent(string content)
    {
        var trimmed = content.Trim();
        // Strip Markdown code fences if present
        if (trimmed.StartsWith("```"))
        {
            // remove first fence line
            var idx = trimmed.IndexOf('\n');
            if (idx > 0)
            {
                trimmed = trimmed.Substring(idx + 1);
            }
            if (trimmed.EndsWith("```"))
            {
                trimmed = trimmed.Substring(0, trimmed.Length - 3);
            }
            trimmed = trimmed.Trim();
        }
        return trimmed;
    }

    private static string TrimSafe(string s)
    {
        s = s.Trim();
        const int max = 500;
        return s.Length > max ? s.Substring(0, max) : s;
    }
}
