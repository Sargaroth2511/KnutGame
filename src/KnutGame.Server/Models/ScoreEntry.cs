namespace KnutGame.Models;

public class ScoreEntry
{
    public int Id { get; set; }
    public Guid SessionId { get; set; }
    public int Score { get; set; }
    public int DurationMs { get; set; }
    public int ItemsCollected { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public string ClientIpHash { get; set; } = string.Empty;
}
