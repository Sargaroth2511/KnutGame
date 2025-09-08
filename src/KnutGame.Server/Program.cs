using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;
using System.IO.Compression;
using KnutGame.Services;
using KnutGame.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Razor Pages
builder.Services.AddRazorPages();

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


var app = builder.Build();

if (!app.Environment.IsDevelopment())
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

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        db.Database.EnsureCreated();
    }
    catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("already exists"))
    {
        // Ignore if table already exists (e.g., in tests)
    }
}

// API endpoints
app.MapPost("/api/session/start", (IServiceProvider services) =>
{
    var db = services.GetRequiredService<AppDbContext>();
    var sessionId = Guid.NewGuid();
    // For now, no persistence for session start, just return
    return Results.Ok(new StartSessionResponse(sessionId, DateTimeOffset.UtcNow));
});

app.MapPost("/api/session/submit", async (SubmitSessionRequest req, HttpContext http, IServiceProvider services) =>
{
    var antiCheat = services.GetRequiredService<IAntiCheat>();
    var scoring = services.GetRequiredService<IScoringEngine>();
    var scoreSvc = services.GetRequiredService<IScoreService>();

    var validation = antiCheat.Validate(req);
    if (!validation.Ok)
    {
        return Results.Ok(new SubmitSessionResponse(false, validation.Reason, null, null, null));
    }

    var score = scoring.Compute(req);

    // Salted IP hash
    var salt = builder.Configuration["Security:IpHashSalt"] ?? "default-salt";
    var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var saltedIp = salt + ip;
    var ipHash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(saltedIp)));

        var (rank, total) = await scoreSvc.SaveAndRankAsync(req.SessionId, score, ipHash, req);

    return Results.Ok(new SubmitSessionResponse(true, null, score, rank, total));
});

app.MapGet("/api/leaderboard", async (IServiceProvider services, int top = 50) =>
{
    var db = services.GetRequiredService<AppDbContext>();
    var scores = await db.Scores
        .OrderByDescending(s => s.Score)
        .Take(top)
        .ToListAsync();

    var entries = scores.Select((s, index) => new LeaderboardEntry(index + 1, s.Score, s.CreatedUtc)).ToList();

    return Results.Ok(new { entries });
});

app.Run();

// Enable WebApplicationFactory<T> usage in tests
public partial class Program { }
