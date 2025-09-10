using System;
using System.Threading.Tasks;
using KnutGame.Models;
using KnutGame.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace KnutGame.Server.Tests;

public class ScoreServiceTests
{
    private static AppDbContext NewDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task SaveAndRank_Persists_And_Computes_Rank()
    {
        using var db = NewDb();
        var svc = new ScoreService(db);

        var req1 = new SubmitSessionRequest(
            Guid.NewGuid(), 800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-5),
            DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );
        var (rank1, total1) = await svc.SaveAndRankAsync(req1.SessionId, 100, "ip1", req1);
        Assert.Equal(1, rank1);
        Assert.Equal(1, total1);

        var req2 = new SubmitSessionRequest(
            Guid.NewGuid(), 800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-5),
            DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );
        var (rank2, total2) = await svc.SaveAndRankAsync(req2.SessionId, 50, "ip2", req2);
        Assert.Equal(2, rank2); // lower score → lower rank
        Assert.Equal(2, total2);

        var req3 = new SubmitSessionRequest(
            Guid.NewGuid(), 800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-5),
            DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );
        var (rank3, total3) = await svc.SaveAndRankAsync(req3.SessionId, 200, "ip3", req3);
        Assert.Equal(1, rank3); // highest so far
        Assert.Equal(3, total3);
    }

    [Fact]
    public async Task SaveAndRank_Computes_Derived_Fields()
    {
        using var db = NewDb();
        var svc = new ScoreService(db);

        var start = DateTimeOffset.UtcNow.AddMilliseconds(-2500);
        var end = DateTimeOffset.UtcNow;
        var req = new SubmitSessionRequest(
            Guid.NewGuid(), 800, 600, start, end,
            new EventEnvelope([], [], [
                new ItemEvent(100, "i1", ItemKind.POINTS, 400, 500),
                new ItemEvent(200, "i2", ItemKind.MULTI, 400, 500)
            ])
        );

        _ = await svc.SaveAndRankAsync(req.SessionId, 123, "hash", req);

        var entry = await db.Scores.SingleAsync(s => s.SessionId == req.SessionId);
        Assert.InRange(entry.DurationMs, 2400, 2600); // around 2500ms
        Assert.Equal(2, entry.ItemsCollected);
        Assert.Equal(123, entry.Score);
        Assert.False(string.IsNullOrWhiteSpace(entry.ClientIpHash));
    }
}

