using KnutGame.Services;
using KnutGame.Models;
using Xunit;

namespace KnutGame.Server.Tests;

public class AntiCheatTests
{
    private readonly IAntiCheat _antiCheat = new AntiCheatService();

    [Fact]
    public void Validate_AcceptsValidStream()
    {
        var start = DateTimeOffset.UtcNow.AddMilliseconds(-1500);
        var end = start.AddMilliseconds(1500);
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                [new MoveEvent(0, 400), new MoveEvent(1400, 380)],
                [],
                []
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.True(result.Ok);
    }

    [Fact]
    public void Validate_RejectsNonMonotonicTime()
    {
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-10),
            DateTimeOffset.UtcNow,
            new EventEnvelope(
                [new MoveEvent(100, 400), new MoveEvent(50, 380)],
                [],
                []
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.False(result.Ok);
        Assert.Equal("NonMonotonicTime", result.Reason);
    }

    [Fact]
    public void Validate_AcceptsInterleavedEvents()
    {
        var start = DateTimeOffset.UtcNow.AddMilliseconds(-3000);
        var end = start.AddMilliseconds(3000);
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                [new MoveEvent(0, 400), new MoveEvent(2500, 380)],
                [new HitEvent(1000)],
                [new ItemEvent(1500, "i1", ItemKind.POINTS, 390, (int)(600 * 0.9))]
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.True(result.Ok);
    }

    [Fact]
    public void Validate_RejectsExcessiveSpeed()
    {
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            DateTimeOffset.UtcNow.AddMilliseconds(-1000),
            DateTimeOffset.UtcNow,
            new EventEnvelope(
                [new MoveEvent(0, 400), new MoveEvent(900, 150)], // dx=250, dt=900ms, speed=278 >240
                [],
                []
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.False(result.Ok);
        Assert.Equal("SpeedExceeded", result.Reason);
    }

    [Fact]
    public void Validate_RejectsDuplicateItem()
    {
        var start = DateTimeOffset.UtcNow.AddMilliseconds(-2500);
        var end = start.AddMilliseconds(2500);
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                [],
                [],
                [new ItemEvent(1000, "item1", ItemKind.POINTS, 400, 500), new ItemEvent(2400, "item1", ItemKind.POINTS, 400, 500)]
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.False(result.Ok);
        Assert.Equal("DuplicateItem", result.Reason);
    }

    [Fact]
    public void Validate_RejectsDurationMismatch()
    {
        var start = DateTimeOffset.UtcNow.AddMilliseconds(-3000);
        var end = start.AddMilliseconds(3000);
        // Last event at 2000ms, but duration is 3000ms -> mismatch > 500ms
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                [new MoveEvent(0, 400), new MoveEvent(2000, 420)],
                [],
                []
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.False(result.Ok);
        Assert.Equal("DurationMismatch", result.Reason);
    }

    [Fact]
    public void Validate_RejectsItemPickupTooFar()
    {
        var start = DateTimeOffset.UtcNow.AddMilliseconds(-2500);
        var end = start.AddMilliseconds(2500);
        // Player around x=400; item at x=460 passes; at x=500 (distance=100) should fail
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                // Ensure last move time <= item.t to satisfy global monotonic order in validator
                [new MoveEvent(0, 400), new MoveEvent(1800, 400)],
                [],
                [new ItemEvent(2000, "item_far", ItemKind.POINTS, 500, (int)(600 * 0.9))]
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.False(result.Ok);
        Assert.Equal("ItemPickupTooFar", result.Reason);
    }

    [Fact]
    public void Validate_RejectsItemPickupWrongLane()
    {
        var start = DateTimeOffset.UtcNow.AddMilliseconds(-2500);
        var end = start.AddMilliseconds(2500);
        // Item far above the player lane
        var wrongY = (int)(600 * 0.9) - 200; // outside ±64 band
        var req = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, 600,
            start,
            end,
            new EventEnvelope(
                [new MoveEvent(0, 400), new MoveEvent(1800, 400)],
                [],
                [new ItemEvent(2000, "item_wrong_lane", ItemKind.POINTS, 400, wrongY)]
            )
        );

        var result = _antiCheat.Validate(req);
        Assert.False(result.Ok);
        Assert.Equal("ItemPickupWrongLane", result.Reason);
    }
}
