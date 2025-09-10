using System;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using KnutGame.Controllers;
using KnutGame.Models;
using KnutGame.Options;
using KnutGame.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Xunit;

namespace KnutGame.Server.Tests;

public class SessionControllerTests
{
    private class StubAntiCheat : IAntiCheat
    {
        private readonly (bool Ok, string? Reason) _res;
        public StubAntiCheat(bool ok, string? reason = null) { _res = (ok, reason); }
        public (bool Ok, string? Reason) Validate(SubmitSessionRequest req) => _res;
    }

    private class StubScoring : IScoringEngine
    {
        private readonly int _score;
        public StubScoring(int score) { _score = score; }
        public int Compute(SubmitSessionRequest req) => _score;
    }

    private class CapturingScoreService : IScoreService
    {
        public (Guid SessionId, int Score, string IpHash, SubmitSessionRequest Req)? Last;
        private readonly (int Rank, int Total) _ret;
        public CapturingScoreService(int rank, int total) { _ret = (rank, total); }
        public Task<(int Rank, int Total)> SaveAndRankAsync(Guid sessionId, int score, string clientIpHash, SubmitSessionRequest req)
        {
            Last = (sessionId, score, clientIpHash, req);
            return Task.FromResult(_ret);
        }
    }

    private static ControllerContext CtxWithIp(string ip)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ip);
        return new ControllerContext { HttpContext = ctx };
    }

    [Fact]
    public async Task Submit_Returns_Failure_When_Validation_Fails()
    {
        var ctl = new SessionController(
            new StubAntiCheat(false, "Bad"),
            new StubScoring(0),
            new CapturingScoreService(0, 0),
            Microsoft.Extensions.Options.Options.Create(new SecurityOptions { IpHashSalt = "salt" })
        );
        ctl.ControllerContext = CtxWithIp("127.0.0.1");

        var req = new SubmitSessionRequest(Guid.NewGuid(), 800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-1), DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );

        var result = await ctl.Submit(req);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var resp = Assert.IsType<SubmitSessionResponse>(ok.Value);
        Assert.False(resp.Accepted);
        Assert.Equal("Bad", resp.RejectionReason);
        Assert.Null(resp.Score);
    }

    [Fact]
    public async Task Submit_Computes_IpHash_And_Delegates_To_ScoreService()
    {
        var scoreSvc = new CapturingScoreService(rank: 3, total: 10);
        var ctl = new SessionController(
            new StubAntiCheat(true),
            new StubScoring(123),
            scoreSvc,
            Microsoft.Extensions.Options.Options.Create(new SecurityOptions { IpHashSalt = "pepper" })
        );
        ctl.ControllerContext = CtxWithIp("10.0.0.5");

        var sessionId = Guid.NewGuid();
        var req = new SubmitSessionRequest(sessionId, 800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-2), DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );

        var result = await ctl.Submit(req);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var resp = Assert.IsType<SubmitSessionResponse>(ok.Value);

        Assert.True(resp.Accepted);
        Assert.Equal(123, resp.Score);
        Assert.Equal(3, resp.Rank);
        Assert.Equal(10, resp.TotalPlayers);

        Assert.NotNull(scoreSvc.Last);
        Assert.Equal(sessionId, scoreSvc.Last!.Value.SessionId);
        Assert.Equal(123, scoreSvc.Last!.Value.Score);

        // Expected base64(SHA256("pepper" + ip))
        var ip = "10.0.0.5";
        var expected = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes("pepper" + ip)));
        Assert.Equal(expected, scoreSvc.Last!.Value.IpHash);
    }

    [Fact]
    public async Task Submit_Uses_Unknown_When_Ip_Missing()
    {
        var scoreSvc = new CapturingScoreService(rank: 1, total: 1);
        var ctl = new SessionController(
            new StubAntiCheat(true),
            new StubScoring(5),
            scoreSvc,
            Microsoft.Extensions.Options.Options.Create(new SecurityOptions { IpHashSalt = "salt" })
        );
        // Do not set RemoteIpAddress
        ctl.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var req = new SubmitSessionRequest(Guid.NewGuid(), 800, 600,
            DateTimeOffset.UtcNow.AddSeconds(-1), DateTimeOffset.UtcNow,
            new EventEnvelope([], [], [])
        );
        _ = await ctl.Submit(req);
        var expected = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("salt" + "unknown")));
        Assert.Equal(expected, scoreSvc.Last!.Value.IpHash);
    }
}
