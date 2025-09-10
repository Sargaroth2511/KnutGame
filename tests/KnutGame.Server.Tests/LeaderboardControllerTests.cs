using System;
using System.Linq;
using System.Threading.Tasks;
using KnutGame.Controllers;
using KnutGame.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace KnutGame.Server.Tests;

public class LeaderboardControllerTests
{
    private static AppDbContext NewDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task Get_Returns_Top_Sorted_By_Score()
    {
        using var db = NewDb();
        db.Scores.AddRange(
            new ScoreEntry { SessionId = Guid.NewGuid(), Score = 10, CreatedUtc = DateTimeOffset.UtcNow.AddMinutes(-3) },
            new ScoreEntry { SessionId = Guid.NewGuid(), Score = 30, CreatedUtc = DateTimeOffset.UtcNow.AddMinutes(-2) },
            new ScoreEntry { SessionId = Guid.NewGuid(), Score = 20, CreatedUtc = DateTimeOffset.UtcNow.AddMinutes(-1) }
        );
        await db.SaveChangesAsync();

        var ctl = new LeaderboardController(db);
        var result = await ctl.Get(top: 2);
        var ok = Assert.IsType<OkObjectResult>(result.Result);

        // Serialize anonymous object to JSON to assert shape across assembly boundary
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("entries", out var entriesEl));
        Assert.Equal(2, entriesEl.GetArrayLength());
        var first = entriesEl[0];
        var second = entriesEl[1];
        Assert.Equal(1, first.GetProperty("Rank").GetInt32());
        Assert.Equal(2, second.GetProperty("Rank").GetInt32());
    }
}
