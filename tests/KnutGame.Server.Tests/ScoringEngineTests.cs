using KnutGame.Services;
using KnutGame.Models;
using Xunit;

namespace KnutGame.Server.Tests;

public class ScoringEngineTests
{
    private readonly IScoringEngine _engine = new ScoringEngine();

    [Fact]
    public void Compute_BaseScoreFromDuration()
    {
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-10),
            DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );

        var score = _engine.Compute(req);
        Assert.Equal(100, score); // 10 * 10
    }

    [Fact]
    public void Compute_IncludesItemBonuses()
    {
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-10),
            DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [new ItemEvent(5000, "item1", ItemKind.POINTS, 400, 500)])
        );

        var score = _engine.Compute(req);
        Assert.Equal(200, score); // 100 + 100
    }

    [Fact]
    public void Compute_AppliesMultiplierWindow()
    {
        // 10 seconds total.
        // MULTI at t=3000ms → multiplier=2 for 7000ms (till 10000ms), covering remaining duration.
        // Base: 10s * 10 = 100
        // Multiplier window covers from 3s to 10s → 7s at 2x vs. 1x baseline.
        // A simple model: 0-3s at 1x (30), 3-10s at 2x (140) → total 170.
        var start = DateTimeOffset.UtcNow.AddSeconds(-10);
        var end = DateTimeOffset.UtcNow;
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                [],
                [],
                [new ItemEvent(3000, "multi1", ItemKind.MULTI, 400, 540)]
            )
        );

        var score = _engine.Compute(req);
        Assert.Equal(170, score);
    }
}
