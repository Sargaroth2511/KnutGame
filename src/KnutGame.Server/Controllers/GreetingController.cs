using KnutGame.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KnutGame.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GreetingController : ControllerBase
{
    private readonly IKiTextService _ki;

    public GreetingController(IKiTextService ki)
    {
        _ki = ki;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<object>> Get([FromQuery] string kind = "start", CancellationToken ct = default)
    {
        var (title, message) = await _ki.GetGreetingAsync(kind, ct);
        return Ok(new { title, message });
    }
}

