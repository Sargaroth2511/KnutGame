using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;
using System.IO.Compression;
using KnutGame.Services;
using KnutGame.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using KnutGame.Options;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// Extend configuration: support local, untracked JSON files and user-secrets always
// - appsettings.Local.json (all envs)
// - appsettings.{Environment}.Local.json (per env)
// - UserSecrets (loaded regardless of environment)
builder.Configuration
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.Local.json", optional: true, reloadOnChange: true)
    .AddUserSecrets<Program>(optional: true);

// Razor Pages
builder.Services.AddRazorPages();
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        // Ensure MVC controllers also accept string enums (e.g., "POINTS")
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient("openai", client =>
{
    client.BaseAddress = new Uri("https://api.openai.com");
    client.Timeout = TimeSpan.FromSeconds(15);
});

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
builder.Services.AddScoped<IKiTextService>(sp =>
{
    var opts = sp.GetRequiredService<IOptions<OpenAiOptions>>().Value;
    if (opts.Enabled && !string.IsNullOrWhiteSpace(opts.ApiKey))
    {
        return ActivatorUtilities.CreateInstance<OpenAiTextService>(sp);
    }
    return ActivatorUtilities.CreateInstance<StaticKiTextService>(sp);
});

// Options
builder.Services.Configure<SecurityOptions>(builder.Configuration.GetSection("Security"));
builder.Services.Configure<OpenAiOptions>(builder.Configuration.GetSection("OpenAI"));
builder.Services.AddSingleton<IPostConfigureOptions<OpenAiOptions>, OpenAiOptionsPostConfigure>();


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

// Diagnostics: log environment and OpenAI config presence (masked)
try
{
    var envName = app.Environment.EnvironmentName;
    var openAi = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<KnutGame.Options.OpenAiOptions>>().Value;
    string Mask(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "<none>";
        return s.Length <= 8 ? "********" : $"{s[..3]}****{s[^4..]}";
    }
    app.Logger.LogInformation("Env={Env}; OpenAI Enabled={Enabled}; ApiKey={ApiKeyMasked}; Org={Org}", envName, openAi.Enabled, Mask(openAi.ApiKey), string.IsNullOrWhiteSpace(openAi.Organization) ? "<none>" : "set");
}
catch { }
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
