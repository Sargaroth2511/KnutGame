using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace KnutGame.Server.Tests;

public class BasicIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public BasicIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Root_Index_ReturnsSuccess_And_ContainsAppDiv()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var html = await resp.Content.ReadAsStringAsync();
        Assert.Contains("<div id=\"app\"></div>", html);
    }

    [Fact]
    public async Task Game_Manifest_And_Assets_AreServed()
    {
        var client = _factory.CreateClient();

        // manifest.json served under /game
        var manifestResp = await client.GetAsync("/game/manifest.json");
        Assert.Equal(HttpStatusCode.OK, manifestResp.StatusCode);
        var manifestJson = await manifestResp.Content.ReadAsStringAsync();

        var manifest = JsonSerializer.Deserialize<Dictionary<string, ManifestEntry>>(manifestJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
        Assert.NotNull(manifest);
        Assert.True(manifest!.ContainsKey("src/main.ts"));

        var entry = manifest!["src/main.ts"]; // main JS + optional CSS

        // JS asset
        Assert.False(string.IsNullOrWhiteSpace(entry.file));
        var jsResp = await client.GetAsync($"/game/{entry.file}");
        Assert.Equal(HttpStatusCode.OK, jsResp.StatusCode);

        // CSS assets if present
        if (entry.css is { Length: > 0 })
        {
            foreach (var css in entry.css)
            {
                var cssResp = await client.GetAsync($"/game/{css}");
                Assert.Equal(HttpStatusCode.OK, cssResp.StatusCode);
            }
        }
    }

    private record ManifestEntry(string file, string[]? css);
}

