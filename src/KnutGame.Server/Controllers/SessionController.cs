using KnutGame.Models;
using KnutGame.Options;
using KnutGame.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;

namespace KnutGame.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SessionController : ControllerBase
{
    private readonly IAntiCheat _antiCheat;
    private readonly IScoringEngine _scoring;
    private readonly IScoreService _scoreService;
    private readonly SecurityOptions _security;

    public SessionController(
        IAntiCheat antiCheat,
        IScoringEngine scoring,
        IScoreService scoreService,
        IOptions<SecurityOptions> securityOptions)
    {
        _antiCheat = antiCheat;
        _scoring = scoring;
        _scoreService = scoreService;
        _security = securityOptions.Value;
    }

    [HttpPost("start")]
    [AllowAnonymous]
    public ActionResult<StartSessionResponse> Start()
    {
        var sessionId = Guid.NewGuid();
        return Ok(new StartSessionResponse(sessionId, DateTimeOffset.UtcNow));
    }

    [HttpPost("submit")]
    [AllowAnonymous]
    public async Task<ActionResult<SubmitSessionResponse>> Submit([FromBody] SubmitSessionRequest req)
    {
        var validation = _antiCheat.Validate(req);
        if (!validation.Ok)
        {
            return Ok(new SubmitSessionResponse(false, validation.Reason, null, null, null));
        }

        var score = _scoring.Compute(req);

        var salt = _security.IpHashSalt ?? "default-salt";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var saltedIp = salt + ip;
        var ipHash = Convert.ToBase64String(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(saltedIp)));

        var (rank, total) = await _scoreService.SaveAndRankAsync(req.SessionId, score, ipHash, req);

        return Ok(new SubmitSessionResponse(true, null, score, rank, total));
    }
}

