using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;
using System.IO.Compression;
using KnutGame.Services;

var builder = WebApplication.CreateBuilder(args);

// Razor Pages
builder.Services.AddRazorPages();

// Compression (add package: Microsoft.AspNetCore.ResponseCompression)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "application/javascript",
        "application/wasm",
        "text/css",
        "image/svg+xml"
    });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

builder.Services.AddSingleton<KnutGame.Services.ViteManifestService>();


var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Serve static files (default /wwwroot)
app.UseStaticFiles();

// Extra: long cache for built game assets under /wwwroot/game
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(app.Environment.WebRootPath, "game")),
    RequestPath = "/game",
    OnPrepareResponse = ctx =>
    {
        // 7-day cache for hashed asset files
        const int seconds = 7 * 24 * 60 * 60;
        ctx.Context.Response.Headers["Cache-Control"] = $"public,max-age={seconds},immutable";
    }
});

// Compression after static file setup is fine too
app.UseResponseCompression();

app.UseRouting();
app.UseAuthorization();

// Razor Pages endpoints
app.MapRazorPages();

app.Run();
