using System;
using KnutGame.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace KnutGame.Migrations
{
    [DbContext(typeof(AppDbContext))]
    public class AppDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "9.0.0");

            modelBuilder.Entity("KnutGame.Models.ScoreEntry", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("INTEGER");

                b.Property<string>("ClientIpHash")
                    .IsRequired()
                    .HasColumnType("TEXT");

                b.Property<DateTimeOffset>("CreatedUtc")
                    .HasColumnType("TEXT");

                b.Property<int>("DurationMs")
                    .HasColumnType("INTEGER");

                b.Property<int>("ItemsCollected")
                    .HasColumnType("INTEGER");

                b.Property<int>("Score")
                    .HasColumnType("INTEGER");

                b.Property<Guid>("SessionId")
                    .HasColumnType("TEXT");

                b.HasKey("Id");

                b.HasIndex("Score");

                b.ToTable("Scores");
            });
        }
    }
}

