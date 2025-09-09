using System.Net;
using System.Net.Http;
using System.Text;
using KnutGame.Options;
using KnutGame.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace KnutGame.Server.Tests;

public class OpenAiTextServiceTests
{
    private class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;
        public StubHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) => _handler = handler;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_handler(request));
    }

    private class StubFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;
        public StubFactory(HttpClient client) => _client = client;
        public HttpClient CreateClient(string name) => _client;
    }

    private class StubEnv : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    [Fact]
    public async Task Parses_Json_Content()
    {
        var json = "{\"choices\":[{\"message\":{\"content\":\"{\\\"title\\\": \\\"Hi\\\", \\\"message\\\": \\\"Welcome!\\\"}\"}}]}";
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.openai.com") };
        var svc = new OpenAiTextService(new StubFactory(client), Microsoft.Extensions.Options.Options.Create(new OpenAiOptions { Enabled = true, ApiKey = "test", SystemPromptPath = "prompts/ai_system_prompt_start.md" }), new StubEnv(), NullLogger<OpenAiTextService>.Instance);
        var (title, message) = await svc.GetGreetingAsync("start");
        Assert.Equal("Hi", title);
        Assert.Equal("Welcome!", message);
    }

    [Fact]
    public async Task Falls_Back_To_Content_When_Not_Json()
    {
        var json = "{\"choices\":[{\"message\":{\"content\":\"Just have fun!\"}}]}";
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.openai.com") };
        var svc = new OpenAiTextService(new StubFactory(client), Microsoft.Extensions.Options.Options.Create(new OpenAiOptions { Enabled = true, ApiKey = "test", SystemPromptPath = "prompts/ai_system_prompt_start.md" }), new StubEnv(), NullLogger<OpenAiTextService>.Instance);
        var (title, message) = await svc.GetGreetingAsync("start");
        Assert.Equal("Welcome!", title);
        Assert.Equal("Just have fun!", message);
    }

    [Fact]
    public async Task Returns_Static_On_Error()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.openai.com") };
        var svc = new OpenAiTextService(new StubFactory(client), Microsoft.Extensions.Options.Options.Create(new OpenAiOptions { Enabled = true, ApiKey = "test", SystemPromptPath = "prompts/ai_system_prompt_start.md" }), new StubEnv(), NullLogger<OpenAiTextService>.Instance);
        var (title, message) = await svc.GetGreetingAsync("start");
        Assert.Equal("Welcome!", title);
        Assert.Contains("fun", message);
    }
}
