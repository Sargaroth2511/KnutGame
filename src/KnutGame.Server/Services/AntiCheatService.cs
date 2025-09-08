using KnutGame.Game;
using KnutGame.Models;

namespace KnutGame.Services;

public interface IAntiCheat
{
    (bool Ok, string? Reason) Validate(SubmitSessionRequest req);
}

public class AntiCheatService : IAntiCheat
{
    public (bool Ok, string? Reason) Validate(SubmitSessionRequest req)
    {
        // Time checks
        var duration = req.ClientEndUtc - req.ClientStartUtc;
        if (duration.TotalMilliseconds < 1000) return (false, "DurationTooShort");
        if (duration.TotalMilliseconds > 60 * 60 * 1000) return (false, "DurationTooLong");

        // Monotonic timestamps within each stream; allow interleaving across types
        int lastMoveT = -1;
        foreach (var move in req.Events.Moves)
        {
            if (move.t < lastMoveT) return (false, "NonMonotonicTime");
            lastMoveT = move.t;
        }
        int lastHitT = -1;
        foreach (var hit in req.Events.Hits)
        {
            if (hit.t < lastHitT) return (false, "NonMonotonicTime");
            lastHitT = hit.t;
        }
        int lastItemT = -1;
        foreach (var item in req.Events.Items)
        {
            if (item.t < lastItemT) return (false, "NonMonotonicTime");
            lastItemT = item.t;
        }

        // Last event time across all streams
        int lastT = Math.Max(lastMoveT, Math.Max(lastHitT, lastItemT));

        // Duplicate item IDs
        HashSet<string> seenItemIds = new();
        foreach (var item in req.Events.Items)
        {
            if (seenItemIds.Contains(item.id)) return (false, "DuplicateItem");
            seenItemIds.Add(item.id);
        }

        // Duration vs last event time
        var expectedDurationMs = duration.TotalMilliseconds;
        if (lastT > 0 && Math.Abs(lastT - expectedDurationMs) > 500) return (false, "DurationMismatch");

        // Speed check (simplified, only on moves)
        for (int i = 1; i < req.Events.Moves.Count; i++)
        {
            var prev = req.Events.Moves[i - 1];
            var curr = req.Events.Moves[i];
            var dt = curr.t - prev.t;
            if (dt <= 0) continue;
            var dx = Math.Abs(curr.x - prev.x);
            var speed = dx / dt * 1000; // px/s
            if (speed > GameConfig.MOVE_SPEED * 1.2f) return (false, "SpeedExceeded");
        }

        // Bounds
        foreach (var move in req.Events.Moves)
        {
            if (move.x < 0 || move.x > req.CanvasWidth) return (false, "OutOfBounds");
        }
        foreach (var item in req.Events.Items)
        {
            if (item.x < 0 || item.x > req.CanvasWidth || item.y < 0 || item.y > req.CanvasHeight) return (false, "OutOfBounds");
        }

        // Item proximity
        foreach (var item in req.Events.Items)
        {
            // Find player x at item.t (interpolate from moves)
            float playerX = -1;
            for (int i = 0; i < req.Events.Moves.Count - 1; i++)
            {
                var m1 = req.Events.Moves[i];
                var m2 = req.Events.Moves[i + 1];
                if (m1.t <= item.t && item.t <= m2.t)
                {
                    var ratio = (item.t - m1.t) / (float)(m2.t - m1.t);
                    playerX = m1.x + ratio * (m2.x - m1.x);
                    break;
                }
            }
            if (playerX == -1) playerX = req.Events.Moves.LastOrDefault()?.x ?? req.CanvasWidth / 2f;

            var distance = Math.Abs(playerX - item.x);
            if (distance > 48) return (false, "ItemPickupTooFar");

            // Y band: item should be near bottom lane (±64 from canvasHeight * 0.9)
            var playerYBand = req.CanvasHeight * 0.9f;
            if (item.y < playerYBand - 64 || item.y > playerYBand + 64) return (false, "ItemPickupWrongLane");
        }

        // Size limits
        if (req.Events.Moves.Count > 50000) return (false, "TooManyMoves");
        if (req.Events.Items.Count > 500) return (false, "TooManyItems");

        return (true, null);
    }
}
