using KnutGame.Game;
using KnutGame.Models;

namespace KnutGame.Services;

public interface IScoringEngine
{
    int Compute(SubmitSessionRequest req);
}

public class ScoringEngine : IScoringEngine
{
    public int Compute(SubmitSessionRequest req)
    {
        var durationSec = (req.ClientEndUtc - req.ClientStartUtc).TotalSeconds;
        if (durationSec <= 0) return 0;

        // Collect all events
        var allEvents = new List<(int t, string type, object data)>();
        foreach (var move in req.Events.Moves) allEvents.Add((move.t, "move", move));
        foreach (var hit in req.Events.Hits) allEvents.Add((hit.t, "hit", hit));
        foreach (var item in req.Events.Items) allEvents.Add((item.t, "item", item));
        allEvents.Sort((a, b) => a.t.CompareTo(b.t));

        // Simulate scoring state
        int score = 0;
        int multiplier = 1;
        int multiplierRemainingMs = 0;
        int slowmoRemainingMs = 0;
        int lastT = 0;

        foreach (var evt in allEvents)
        {
            // Accrue score from lastT to evt.t
            var deltaSec = (evt.t - lastT) / 1000f;
            if (deltaSec > 0)
            {
                score += (int)(GameConfig.BASE_POINTS_PER_SEC * multiplier * deltaSec);
            }

            // Process event
            if (evt.type == "item")
            {
                var item = (ItemEvent)evt.data;
                if (item.type == ItemKind.POINTS)
                {
                    score += GameConfig.POINTS_ITEM_BONUS;
                }
                else if (item.type == ItemKind.MULTI)
                {
                    multiplier = GameConfig.MULTIPLIER_X;
                    multiplierRemainingMs = GameConfig.MULTIPLIER_MS;
                }
                else if (item.type == ItemKind.SLOWMO)
                {
                    slowmoRemainingMs = GameConfig.SLOWMO_MS;
                    // Slowmo affects physics but not scoring rate
                }
                else if (item.type == ItemKind.LIFE)
                {
                    // Life doesn't affect score directly
                }
            }

            // Update remaining times
            var deltaMs = evt.t - lastT;
            multiplierRemainingMs -= deltaMs;
            slowmoRemainingMs -= deltaMs;
            if (multiplierRemainingMs <= 0) multiplier = 1;

            lastT = evt.t;
        }

        // Accrue remaining time (clarify calculation and types)
        var msTotal = (req.ClientEndUtc - req.ClientStartUtc).TotalMilliseconds;
        var msRemaining = msTotal - lastT;
        var remainingSec = (float)(msRemaining / 1000.0);
        if (remainingSec > 0)
        {
            score += (int)(GameConfig.BASE_POINTS_PER_SEC * multiplier * remainingSec);
        }

        return score;
    }
}
