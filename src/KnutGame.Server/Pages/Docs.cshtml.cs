using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Hosting;
using System.Text.Encodings.Web;
using Markdig;

namespace KnutGame.Pages;

public class DocsModel : PageModel
{
    private readonly IWebHostEnvironment _env;
    public record DocFile(string DisplayName, string RelativePath);

    public List<DocFile> Files { get; private set; } = new();
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
        var roots = new[] { Path.Combine(repoRoot, "docs"), Path.Combine(repoRoot, "agent_tasks") };

        var allowed = new List<string>();
        foreach (var root in roots)
        {
            if (!Directory.Exists(root)) continue;
            foreach (var md in Directory.EnumerateFiles(root, "*.md", SearchOption.AllDirectories))
            {
                allowed.Add(md);
                var rel = Path.GetRelativePath(repoRoot, md).Replace('\\', '/');
                Files.Add(new DocFile(rel, rel));
            }
        }

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
        var roots = new[] { Path.Combine(repoRoot, "docs"), Path.Combine(repoRoot, "agent_tasks") };

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
}
