using KnutGame.Options;
using Microsoft.Extensions.Options;

namespace KnutGame.Services;

public class StaticKiTextService : IKiTextService
{
    private readonly OpenAiOptions _options;

    public StaticKiTextService(IOptions<OpenAiOptions> options)
    {
        _options = options.Value;
    }

    public Task<(string Title, string Message)> GetGreetingAsync(string kind, CancellationToken ct = default)
    {
        // For M1: return a friendly static greeting. The options and prompt path
        // are wired for future OpenAI integration without code churn.
        var title = "Welcome!";
        var message = "Dodge falling trees, collect goodies, and have fun!";
        return Task.FromResult((title, message));
    }

    public Task<(string Title, string Message)> GetGameoverAsync(int score, int rank, int totalPlayers, double euros, int durationSec, int itemsCollected, CancellationToken ct = default)
    {
        var title = rank == 1 ? "Top of the Pines" : "Winter Wrap";
        var message = $"You scored {score} pts and placed {rank}/{totalPlayers}. €{euros:0.00} goes to a good cause • {durationSec}s survived • {itemsCollected} items.";
        return Task.FromResult((title, message));
    }
}
