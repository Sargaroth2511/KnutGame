using KnutGame.Models;
using KnutGame.Services;
using Xunit;

namespace KnutGame.Server.Tests;

/// <summary>
/// Unit tests for Smart Anti-Cheat Service
/// Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3
/// </summary>
public class SmartAntiCheatServiceTests
{
    private readonly SmartAntiCheatService _smartAntiCheat;
    private readonly SubmitSessionRequest _baseRequest;

    public SmartAntiCheatServiceTests()
    {
        _smartAntiCheat = new SmartAntiCheatService();
        
        // Create a base valid request for testing
        _baseRequest = new SubmitSessionRequest(
            Guid.NewGuid(),
            800, // CanvasWidth
            600, // CanvasHeight
            DateTimeOffset.UtcNow.AddSeconds(-30),
            DateTimeOffset.UtcNow,
            new EventEnvelope(
                new List<MoveEvent>
                {
                    new(0, 400),
                    new(1000, 410),
                    new(2000, 420),
                    new(3000, 430)
                },
                new List<HitEvent>(),
                new List<ItemEvent>
                {
                    new(1500, "item1", ItemKind.POINTS, 405, 540, 540)
                }
            )
        );
    }

    [Fact]
    public void ValidateWithContext_ValidRequest_NoPerformanceIssues_ReturnsValid()
    {
        // Arrange
        var context = CreateGoodPerformanceContext();

        // Act
        var result = _smartAntiCheat.ValidateWithContext(_baseRequest, context);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.Confidence >= 0.8);
        Assert.False(result.PerformanceAdjusted);
        Assert.Null(result.Reason);
    }

    [Fact]
    public void ValidateWithContext_InvalidSpeed_NoPerformanceIssues_ReturnsInvalid()
    {
        // Arrange
        var invalidRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(100, 500) // Extremely fast movement
                }
            }
        };
        var context = CreateGoodPerformanceContext();

        // Act
        var result = _smartAntiCheat.ValidateWithContext(invalidRequest, context);

        // Assert
        Assert.False(result.IsValid);
        Assert.Equal("SpeedExceeded", result.Reason);
        Assert.False(result.PerformanceAdjusted);
    }

    [Fact]
    public void ValidateWithContext_InvalidSpeed_WithStutterEvents_AppliesPerformanceAdjustment()
    {
        // Arrange
        var invalidRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(100, 200) // Moderately fast movement that might be acceptable during stutters
                }
            }
        };
        
        var context = CreatePoorPerformanceContext();

        // Act
        var result = _smartAntiCheat.ValidateWithContext(invalidRequest, context);

        // Assert - Should be more lenient due to performance issues
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
        Assert.NotNull(result.AdjustmentDetails);
        Assert.True(result.AdjustmentDetails.SpeedToleranceMultiplier > 1.0);
    }

    [Fact]
    public void ValidateWithContext_ItemPickupTooFar_WithPerformanceIssues_AppliesAdjustment()
    {
        // Arrange
        var invalidRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Items = new List<ItemEvent>
                {
                    new(1000, "item1", ItemKind.POINTS, 500, 540) // Far from player at x=410
                }
            }
        };
        
        var context = CreatePoorPerformanceContext();

        // Act
        var result = _smartAntiCheat.ValidateWithContext(invalidRequest, context);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
        Assert.NotNull(result.AdjustmentDetails);
        Assert.True(result.AdjustmentDetails.ProximityToleranceMultiplier > 1.0);
    }

    [Fact]
    public void ValidateWithContext_LowConfidence_ReturnsInvalid()
    {
        // Arrange
        var context = CreateVeryPoorPerformanceContext();

        // Act
        var result = _smartAntiCheat.ValidateWithContext(_baseRequest, context);

        // Assert
        Assert.False(result.IsValid);
        Assert.Equal("LowConfidence", result.Reason);
        Assert.True(result.PerformanceAdjusted);
        Assert.True(result.Confidence < 0.8);
    }

    [Fact]
    public void GetPerformanceAdjustment_GoodPerformance_ReturnsMinimalAdjustment()
    {
        // Arrange
        var context = CreateGoodPerformanceContext();

        // Act
        var adjustment = _smartAntiCheat.GetPerformanceAdjustment(context);

        // Assert
        Assert.Equal(1.0, adjustment.SpeedToleranceMultiplier, 1);
        Assert.Equal(1.0, adjustment.ProximityToleranceMultiplier, 1);
        Assert.Equal(0, adjustment.TimeWindowExtensionMs, 1);
    }

    [Fact]
    public void GetPerformanceAdjustment_PoorPerformance_ReturnsSignificantAdjustment()
    {
        // Arrange
        var context = CreatePoorPerformanceContext();

        // Act
        var adjustment = _smartAntiCheat.GetPerformanceAdjustment(context);

        // Assert
        Assert.True(adjustment.SpeedToleranceMultiplier > 1.2);
        Assert.True(adjustment.ProximityToleranceMultiplier > 1.1);
        Assert.True(adjustment.TimeWindowExtensionMs > 50);
        Assert.True(adjustment.StutterToleranceMs > 100);
    }

    [Fact]
    public void GetPerformanceAdjustment_DisabledAdjustment_ReturnsNoAdjustment()
    {
        // Arrange
        var options = new AntiCheatOptions(PerformanceAdjustmentEnabled: false);
        var smartAntiCheat = new SmartAntiCheatService(options);
        var context = CreatePoorPerformanceContext();

        // Act
        var adjustment = smartAntiCheat.GetPerformanceAdjustment(context);

        // Assert
        Assert.Equal(0, adjustment.StutterToleranceMs);
        Assert.Equal(1.0, adjustment.SpeedToleranceMultiplier);
        Assert.Equal(1.0, adjustment.ProximityToleranceMultiplier);
        Assert.Equal(0, adjustment.TimeWindowExtensionMs);
    }

    [Fact]
    public void GetPerformanceAdjustment_ExtremePerformanceIssues_CapsAdjustments()
    {
        // Arrange
        var context = CreateExtremePerformanceContext();

        // Act
        var adjustment = _smartAntiCheat.GetPerformanceAdjustment(context);

        // Assert - Should be capped at maximum values
        Assert.True(adjustment.SpeedToleranceMultiplier <= 2.0);
        Assert.True(adjustment.ProximityToleranceMultiplier <= 1.8);
        Assert.True(adjustment.TimeWindowExtensionMs <= 500);
    }

    [Fact]
    public void CalculateConfidence_GoodPerformance_ReturnsHighConfidence()
    {
        // Arrange
        var context = CreateGoodPerformanceContext();

        // Act
        var confidence = InvokeCalculateConfidence(_baseRequest, context);

        // Assert
        Assert.True(confidence > 0.9);
    }

    [Fact]
    public void CalculateConfidence_PoorPerformance_ReturnsLowConfidence()
    {
        // Arrange
        var context = CreateVeryPoorPerformanceContext();

        // Act
        var confidence = InvokeCalculateConfidence(_baseRequest, context);

        // Assert
        Assert.True(confidence < 0.5);
    }

    [Fact]
    public void SetPerformanceThresholds_UpdatesOptions()
    {
        // Arrange
        var newOptions = new AntiCheatOptions(
            BaseSpeedTolerance: 1.5,
            ConfidenceThreshold: 0.9,
            StutterToleranceMs: 150
        );

        // Act
        _smartAntiCheat.SetPerformanceThresholds(newOptions);
        var retrievedOptions = _smartAntiCheat.GetPerformanceThresholds();

        // Assert
        Assert.Equal(1.5, retrievedOptions.BaseSpeedTolerance);
        Assert.Equal(0.9, retrievedOptions.ConfidenceThreshold);
        Assert.Equal(150, retrievedOptions.StutterToleranceMs);
    }

    [Fact]
    public void ValidateWithContext_MovementDuringStutter_IsMoreLenient()
    {
        // Arrange
        var stutterTime = 1000L;
        var invalidRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new((int)stutterTime, 180) // Movement during stutter
                },
                Items = new List<ItemEvent>
                {
                    new((int)stutterTime + 50, "item1", ItemKind.POINTS, 250, 540) // Item pickup during stutter
                }
            }
        };

        var context = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "high", stutterTime, 200, 30)
            },
            25, // Low FPS
            0,
            30, // Poor performance score
            5000,
            new List<long> { stutterTime }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(invalidRequest, context);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
    }

    private PerformanceContext CreateGoodPerformanceContext()
    {
        return new PerformanceContext(
            new List<PerformanceIssue>(),
            60, // Good FPS
            0, // No memory pressure
            95, // Good performance score
            5000,
            new List<long>()
        );
    }

    private PerformanceContext CreatePoorPerformanceContext()
    {
        return new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "medium", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 1000, 150, 40),
                new("low_fps", "medium", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 500, 0, 40)
            },
            25, // Low FPS
            1, // Some memory pressure
            40, // Poor performance score
            5000,
            new List<long>
            {
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 1000,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 500
            }
        );
    }

    private PerformanceContext CreateVeryPoorPerformanceContext()
    {
        return new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "high", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 1000, 300, 10),
                new("stutter", "high", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 500, 250, 10),
                new("memory_pressure", "high", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 200, 0, 10)
            },
            10, // Very low FPS
            3, // High memory pressure
            10, // Very poor performance score
            5000,
            new List<long>
            {
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 1000,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 500,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 200
            }
        );
    }

    private PerformanceContext CreateExtremePerformanceContext()
    {
        var issues = new List<PerformanceIssue>();
        var timestamps = new List<long>();
        
        // Create many performance issues
        for (int i = 0; i < 10; i++)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - (i * 100);
            issues.Add(new PerformanceIssue("stutter", "high", timestamp, 400, 5));
            timestamps.Add(timestamp);
        }

        return new PerformanceContext(
            issues,
            5, // Extremely low FPS
            5, // Very high memory pressure
            5, // Extremely poor performance score
            5000,
            timestamps
        );
    }

    // Helper method to invoke private CalculateConfidence method via reflection
    private double InvokeCalculateConfidence(SubmitSessionRequest req, PerformanceContext context)
    {
        var method = typeof(SmartAntiCheatService).GetMethod("CalculateConfidence", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        return (double)method!.Invoke(_smartAntiCheat, new object[] { req, context })!;
    }
}