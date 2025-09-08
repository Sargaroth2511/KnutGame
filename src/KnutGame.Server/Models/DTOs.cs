namespace KnutGame.Models;

public record StartSessionResponse(Guid SessionId, DateTimeOffset IssuedUtc);

public record MoveEvent(int t, float x);
public enum ItemKind { POINTS, LIFE, SLOWMO, MULTI }
public record HitEvent(int t);
public record ItemEvent(int t, string id, ItemKind type, float x, float y);

public record SubmitSessionRequest(
    Guid SessionId,
    int CanvasWidth,
    int CanvasHeight,
    DateTimeOffset ClientStartUtc,
    DateTimeOffset ClientEndUtc,
    EventEnvelope Events
);
public record EventEnvelope(IReadOnlyList<MoveEvent> Moves, IReadOnlyList<HitEvent> Hits, IReadOnlyList<ItemEvent> Items);

public record SubmitSessionResponse(bool Accepted, string? RejectionReason, int? Score, int? Rank, int? TotalPlayers);

public record LeaderboardEntry(int Rank, int Score, DateTimeOffset CreatedUtc);
