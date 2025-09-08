using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace KnutGame.Server.Tests;

public class ManifestInjectionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ManifestInjectionTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Index_Html_Includes_Manifest_Entry_Script()
    {
        var client = _factory.CreateClient();

        // Ensure manifest exists and parse it
        var manifestResp = await client.GetAsync("/game/manifest.json");
        Assert.Equal(HttpStatusCode.OK, manifestResp.StatusCode);

        var manifestJson = await manifestResp.Content.ReadAsStringAsync();
        var manifest = JsonSerializer.Deserialize<Dictionary<string, ManifestEntry>>(manifestJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
        Assert.NotNull(manifest);

        var entry = Assert.Contains("src/main.ts", manifest!);
        Assert.False(string.IsNullOrWhiteSpace(entry.file));

        // Fetch page and assert script tag uses that file
        var htmlResp = await client.GetAsync("/");
        htmlResp.EnsureSuccessStatusCode();
        var html = await htmlResp.Content.ReadAsStringAsync();

        var expected = $"<script type=\"module\" src=\"/game/{entry.file}\"></script>";
        Assert.Contains(expected, html);
    }

    private record ManifestEntry(string file, string[]? css);
}
