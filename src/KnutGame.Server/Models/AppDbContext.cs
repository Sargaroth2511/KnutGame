using Microsoft.EntityFrameworkCore;

namespace KnutGame.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<ScoreEntry> Scores { get; set; }
}
