using KnutGame.Models;
using Microsoft.EntityFrameworkCore;

namespace KnutGame.Services;

public interface IScoreService
{
    Task<(int Rank, int Total)> SaveAndRankAsync(Guid sessionId, int score, string clientIpHash, SubmitSessionRequest req);
}

public class ScoreService : IScoreService
{
    private readonly AppDbContext _db;

    public ScoreService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(int Rank, int Total)> SaveAndRankAsync(Guid sessionId, int score, string clientIpHash, SubmitSessionRequest req)
    {
        var durationMs = (int)(req.ClientEndUtc - req.ClientStartUtc).TotalMilliseconds;
        var itemsCollected = req.Events.Items.Count;

        var entry = new ScoreEntry
        {
            SessionId = sessionId,
            Score = score,
            DurationMs = durationMs,
            ItemsCollected = itemsCollected,
            CreatedUtc = DateTimeOffset.UtcNow,
            ClientIpHash = clientIpHash
        };

        _db.Scores.Add(entry);
        await _db.SaveChangesAsync();

        // Simple ranking: count how many have higher score
        var higherCount = await _db.Scores.CountAsync(s => s.Score > score);
        var total = await _db.Scores.CountAsync();

        return (higherCount + 1, total);
    }
}
