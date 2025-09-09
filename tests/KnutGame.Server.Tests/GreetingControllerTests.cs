using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using KnutGame.Services;
using Xunit;

namespace KnutGame.Server.Tests;

public class GreetingControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public GreetingControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private WebApplicationFactory<Program> WithService<T>(T impl) where T : class, IKiTextService
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace IKiTextService with a stub
                var desc = services.FirstOrDefault(d => d.ServiceType == typeof(IKiTextService));
                if (desc != null) services.Remove(desc);
                services.AddSingleton<IKiTextService>(impl);
            });
        });
    }

    private class StubKi : IKiTextService
    {
        private readonly (string Title, string Message) _resp;
        public StubKi((string Title, string Message) resp) { _resp = resp; }
        public Task<(string Title, string Message)> GetGreetingAsync(string kind, CancellationToken ct = default)
            => Task.FromResult(_resp);
        public Task<(string Title, string Message)> GetGameoverAsync(int score, int rank, int totalPlayers, double euros, int durationSec, int itemsCollected, CancellationToken ct = default)
            => Task.FromResult(_resp);
    }

    [Fact]
    public async Task Greeting_Returns_AI_Shape()
    {
        var app = WithService(new StubKi(("Hi there", "Enjoy the run!")));
        var client = app.CreateClient();
        var resp = await client.GetAsync("/api/greeting?kind=start");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(json);
        Assert.True(json!.ContainsKey("title"));
        Assert.True(json!.ContainsKey("message"));
        Assert.Equal("Hi there", json!["title"]);
        Assert.Equal("Enjoy the run!", json!["message"]);
    }

    [Fact]
    public async Task Greeting_Returns_Fallback_Shape()
    {
        var app = WithService(new StubKi(("Welcome!", "Dodge falling trees, collect goodies, and have fun!")));
        var client = app.CreateClient();
        var resp = await client.GetAsync("/api/greeting?kind=start");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(json);
        Assert.Equal("Welcome!", json!["title"]);
        Assert.Contains("fun", json!["message"]);
    }
}
