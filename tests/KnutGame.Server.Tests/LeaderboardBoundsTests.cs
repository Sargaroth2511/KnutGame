using System;
using System.Linq;
using System.Threading.Tasks;
using KnutGame.Controllers;
using KnutGame.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace KnutGame.Server.Tests;

public class LeaderboardBoundsTests
{
    private static AppDbContext NewDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task NegativeTop_IsClamped_To_One()
    {
        using var db = NewDb();
        db.Scores.AddRange(new ScoreEntry { SessionId = Guid.NewGuid(), Score = 10, CreatedUtc = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        var ctl = new LeaderboardController(db);

        var res = await ctl.Get(top: -5);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var entries = doc.RootElement.GetProperty("entries");
        Assert.Equal(1, entries.GetArrayLength());
    }

    [Fact]
    public async Task LargeTop_IsClamped_To_100()
    {
        using var db = NewDb();
        // Seed 150 scores
        for (int i = 0; i < 150; i++)
            db.Scores.Add(new ScoreEntry { SessionId = Guid.NewGuid(), Score = i, CreatedUtc = DateTimeOffset.UtcNow.AddMinutes(-i) });
        await db.SaveChangesAsync();
        var ctl = new LeaderboardController(db);

        var res = await ctl.Get(top: 5000);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var entries = doc.RootElement.GetProperty("entries");
        // clamp to 100 despite 150 stored
        Assert.Equal(100, entries.GetArrayLength());
    }
}

