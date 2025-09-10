using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Hosting;
using System.Text.Encodings.Web;
using Markdig;

namespace KnutGame.Pages;

public class DocsModel : PageModel
{
    private readonly IWebHostEnvironment _env;
    public record DocFile(string Title, string RelativePath, string Group, int? Iteration, string FileName);

    public List<DocFile> Files { get; private set; } = new();
    public Dictionary<string, List<DocFile>> Grouped { get; private set; } = new();
    public string? SelectedPath { get; private set; }
    public string? ContentHtml { get; private set; }

    public DocsModel(IWebHostEnvironment env)
    {
        _env = env;
    }

    public void OnGet([FromQuery] string? file)
    {
        // Collect markdown files from known folders at repository root
        var contentRoot = _env.ContentRootPath; // e.g., .../src/KnutGame.Server
        var repoRoot = Path.GetFullPath(Path.Combine(contentRoot, "..", ".."));
        var roots = new[]
        {
            Path.Combine(repoRoot, "docs"),
            Path.Combine(repoRoot, "agent_tasks"),
            Path.Combine(repoRoot, "qa_reports")
        };

        var allowed = new List<string>();
        foreach (var root in roots)
        {
            if (!Directory.Exists(root)) continue;
            foreach (var md in Directory.EnumerateFiles(root, "*.md", SearchOption.AllDirectories))
            {
                allowed.Add(md);
                var rel = Path.GetRelativePath(repoRoot, md).Replace('\\', '/');
                var group = rel.Split('/', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "docs";
                var fileName = Path.GetFileNameWithoutExtension(md);
                var (title, iteration) = BuildTitle(fileName);
                Files.Add(new DocFile(title, rel, group, iteration, fileName));
            }
        }

        // Build grouped view with friendly ordering
        Grouped = Files
            .GroupBy(f => f.Group)
            .OrderBy(g => g.Key.Equals("agent_tasks", StringComparison.OrdinalIgnoreCase) ? 0 : g.Key.Equals("docs", StringComparison.OrdinalIgnoreCase) ? 1 : 2)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderBy(f => f.Iteration.HasValue ? f.Iteration.Value : int.MaxValue)
                    .ThenBy(f => f.FileName, StringComparer.OrdinalIgnoreCase)
                    .ToList()
            );

        if (!string.IsNullOrWhiteSpace(file))
        {
            // Normalize and restrict to allowed list
            var normalized = Path.GetFullPath(Path.Combine(repoRoot, file));
            if (allowed.Any(a => string.Equals(Path.GetFullPath(a), normalized, StringComparison.OrdinalIgnoreCase)))
            {
                SelectedPath = Path.GetRelativePath(repoRoot, normalized).Replace('\\', '/');
                var raw = System.IO.File.ReadAllText(normalized);
                // Render Markdown to HTML (GitHub-like)
                var pipeline = new MarkdownPipelineBuilder()
                    .UseAdvancedExtensions()
                    .UseAutoLinks()
                    .Build();
                var html = Markdown.ToHtml(raw, pipeline);
                ContentHtml = html;
            }
        }
    }

    public IActionResult OnGetDownload([FromQuery] string file)
    {
        var contentRoot = _env.ContentRootPath;
        var repoRoot = Path.GetFullPath(Path.Combine(contentRoot, "..", ".."));
        var roots = new[]
        {
            Path.Combine(repoRoot, "docs"),
            Path.Combine(repoRoot, "agent_tasks"),
            Path.Combine(repoRoot, "qa_reports")
        };

        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var root in roots)
        {
            if (!Directory.Exists(root)) continue;
            foreach (var md in Directory.EnumerateFiles(root, "*.md", SearchOption.AllDirectories))
            {
                allowed.Add(Path.GetFullPath(md));
            }
        }

        var full = Path.GetFullPath(Path.Combine(repoRoot, file));
        if (!allowed.Contains(full)) return NotFound();

        var bytes = System.IO.File.ReadAllBytes(full);
        var name = Path.GetFileName(full);
        return File(bytes, "text/markdown", name);
    }

    private static (string title, int? iteration) BuildTitle(string fileName)
    {
        // Normalize name
        var name = fileName.Replace('-', ' ').Replace('_', ' ').Trim();
        int? iter = null;

        // Detect patterns like "iteration8 ..." or "iteration_08 ..."
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length > 0)
        {
            var head = parts[0].ToLowerInvariant();
            if (head.StartsWith("iteration"))
            {
                var digits = new string(head.SkipWhile(c => !char.IsDigit(c)).TakeWhile(char.IsDigit).ToArray());
                if (int.TryParse(digits, out var n))
                {
                    iter = n;
                    var suffix = string.Join(' ', parts.Skip(1));
                    var niceSuffix = ToTitleCase(suffix);
                    var title = string.IsNullOrWhiteSpace(niceSuffix) ? $"Iteration {n}" : $"Iteration {n} — {niceSuffix}";
                    return (title, iter);
                }
            }
        }

        // Fallback: title case whole name
        return (ToTitleCase(name), iter);
    }

    private static string ToTitleCase(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                        .Select(w => char.ToUpperInvariant(w[0]) + (w.Length > 1 ? w.Substring(1) : string.Empty));
        return string.Join(' ', words);
    }
}
