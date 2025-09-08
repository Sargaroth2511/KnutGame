using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;
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
    public async Task Session_Start_ReturnsSessionId()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsync("/api/session/start", null);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadAsStringAsync();
        var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
        Assert.NotNull(data);
        Assert.True(data!.ContainsKey("sessionId"));
        Assert.True(data!.ContainsKey("issuedUtc"));
    }

    [Fact]
    public async Task Session_Submit_ValidPayload_Accepted()
    {
        var client = _factory.CreateClient();
        var startResp = await client.PostAsync("/api/session/start", null);
        var startJson = await startResp.Content.ReadAsStringAsync();
        var startData = JsonSerializer.Deserialize<Dictionary<string, object>>(startJson);
        var sessionId = Guid.Parse(startData!["sessionId"].ToString()!);

        var start = DateTimeOffset.UtcNow.AddMilliseconds(-1500);
        var end = start.AddMilliseconds(1500);
        var payload = new
        {
            sessionId,
            canvasWidth = 800,
            canvasHeight = 600,
            clientStartUtc = start,
            clientEndUtc = end,
            events = new
            {
                moves = new[] { new { t = 0, x = 400 }, new { t = 1400, x = 380 } },
                hits = new object[] { },
                items = new object[] { }
            }
        };

        var submitResp = await client.PostAsJsonAsync("/api/session/submit", payload);
        Assert.Equal(HttpStatusCode.OK, submitResp.StatusCode);
        var submitJson = await submitResp.Content.ReadAsStringAsync();
        var submitData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(submitJson);
        Assert.True(submitData!["accepted"].GetBoolean());
        Assert.True(submitData!.ContainsKey("score"));
    }

    [Fact]
    public async Task Leaderboard_ReturnsEntries()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/leaderboard?top=10");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadAsStringAsync();
        var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
        Assert.NotNull(data);
        Assert.True(data!.ContainsKey("entries"));
    }
}

