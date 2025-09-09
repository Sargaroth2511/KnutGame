using KnutGame.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KnutGame.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public LeaderboardController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<object>> Get([FromQuery] int top = 50)
    {
        var scores = await _db.Scores
            .OrderByDescending(s => s.Score)
            .Take(top)
            .ToListAsync();

        var entries = scores.Select((s, index) => new LeaderboardEntry(index + 1, s.Score, s.CreatedUtc)).ToList();
        return Ok(new { entries });
    }
}

