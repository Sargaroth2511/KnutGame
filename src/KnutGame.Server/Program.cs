using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;
using System.IO.Compression;
using KnutGame.Services;
using KnutGame.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using KnutGame.Options;

var builder = WebApplication.CreateBuilder(args);

// Razor Pages
builder.Services.AddRazorPages();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// JSON options: allow string enums (e.g., "POINTS") from client
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

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

// Add EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=knutgame.db"));

// Add services
builder.Services.AddScoped<IScoringEngine, ScoringEngine>();
builder.Services.AddScoped<IAntiCheat, AntiCheatService>();
builder.Services.AddScoped<IScoreService, ScoreService>();

// Options
builder.Services.Configure<SecurityOptions>(builder.Configuration.GetSection("Security"));


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
// Enable compression early so it applies to static files too
app.UseResponseCompression();

// Serve static files (default /wwwroot)
app.UseStaticFiles();

// Extra: long cache for built game assets under /wwwroot/game
var gameDir = Path.Combine(app.Environment.WebRootPath, "game");
if (!Directory.Exists(gameDir))
{
    Directory.CreateDirectory(gameDir);
    app.Logger.LogWarning("Created missing game assets directory at {Dir}. Run `npm run build` in src/KnutGame.Client to populate manifest and assets.", gameDir);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(gameDir),
    RequestPath = "/game",
    OnPrepareResponse = ctx =>
    {
        // 7-day cache for hashed asset files
        const int seconds = 7 * 24 * 60 * 60;
        ctx.Context.Response.Headers["Cache-Control"] = $"public,max-age={seconds},immutable";
    }
});

// (Compression already enabled above)

app.UseRouting();
app.UseAuthorization();

// Razor Pages endpoints
app.MapRazorPages();
app.MapControllers();

// Ensure database is migrated to latest schema
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        db.Database.Migrate();
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("PendingModelChangesWarning"))
    {
        // Legacy DB created via EnsureCreated detected; fall back to EnsureCreated for compatibility in dev/test
        db.Database.EnsureCreated();
    }
}

// API endpoints handled by MVC controllers (see Controllers/*)

app.Run();

// Enable WebApplicationFactory<T> usage in tests
public partial class Program { }
