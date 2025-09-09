using System.Threading;
using System.Threading.Tasks;

namespace KnutGame.Services;

public interface IKiTextService
{
    Task<(string Title, string Message)> GetGreetingAsync(string kind, CancellationToken ct = default);
    Task<(string Title, string Message)> GetGameoverAsync(int score, int rank, int totalPlayers, double euros, int durationSec, int itemsCollected, CancellationToken ct = default);
}
