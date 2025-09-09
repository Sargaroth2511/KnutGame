using System.Threading;
using System.Threading.Tasks;

namespace KnutGame.Services;

public interface IKiTextService
{
    Task<(string Title, string Message)> GetGreetingAsync(string kind, CancellationToken ct = default);
}

