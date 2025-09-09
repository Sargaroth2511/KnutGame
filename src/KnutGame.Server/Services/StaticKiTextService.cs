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
}

