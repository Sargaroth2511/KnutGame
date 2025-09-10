using System;
using KnutGame.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace KnutGame.Server.Tests;

public class ViteManifestServiceTests
{
    private class StubEnv : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Development";
        public string WebRootPath { get; set; } = string.Empty;
        public string ContentRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    [Fact]
    public void Returns_NullAndEmpty_When_Manifest_Missing()
    {
        var tmp = System.IO.Path.Combine(System.IO.Path.GetTempPath(), Guid.NewGuid().ToString("n"));
        // ensure directory exists but no manifest.json
        System.IO.Directory.CreateDirectory(System.IO.Path.Combine(tmp, "game"));
        var env = new StubEnv { WebRootPath = tmp };
        var svc = new ViteManifestService(env, NullLogger<ViteManifestService>.Instance);

        Assert.Null(svc.GetJs());
        Assert.Empty(svc.GetCss());
    }
}

