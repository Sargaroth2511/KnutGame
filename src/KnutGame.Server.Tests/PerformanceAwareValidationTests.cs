using KnutGame.Models;
using KnutGame.Services;
using Xunit;

namespace KnutGame.Server.Tests;

/// <summary>
/// Unit tests for Performance-Aware Validation Rules
/// Requirements: 2.1, 2.2, 5.1, 5.2, 5.3, 5.4
/// </summary>
public class PerformanceAwareValidationTests
{
    private readonly SmartAntiCheatService _smartAntiCheat;
    private readonly SubmitSessionRequest _baseRequest;

    public PerformanceAwareValidationTests()
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
    public void ValidateWithContext_StutterTolerance_AllowsLargerDeviationsDuringStutters()
    {
        // Arrange
        var stutterTime = 1000L;
        var requestWithModerateSpeed = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new((int)stutterTime, 150) // 50px movement in 1000ms - normally borderline
                }
            }
        };

        var context = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "high", stutterTime, 200, 30) // High severity stutter
            },
            20, // Low FPS
            0,
            30, // Poor performance score
            5000,
            new List<long> { stutterTime }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(requestWithModerateSpeed, context);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
        Assert.NotNull(result.AdjustmentDetails);
    }

    [Fact]
    public void ValidateWithContext_StutterTolerance_RejectsExtremeDeviationsEvenDuringStutters()
    {
        // Arrange
        var stutterTime = 1000L;
        var requestWithExtremeSpeed = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new((int)stutterTime, 500) // 400px movement in 1000ms - extreme
                }
            }
        };

        var context = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "medium", stutterTime, 150, 40)
            },
            25, // Low FPS
            0,
            40, // Poor performance score
            5000,
            new List<long> { stutterTime }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(requestWithExtremeSpeed, context);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("DespiteStutter", result.Reason);
        Assert.True(result.PerformanceAdjusted);
    }

    [Fact]
    public void ValidateWithContext_DynamicSpeedTolerance_AdjustsBasedOnFPS()
    {
        // Arrange - Test with low FPS context
        var lowFpsRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(500, 160) // 60px in 500ms = 120px/s - moderately fast
                }
            }
        };

        var lowFpsContext = new PerformanceContext(
            new List<PerformanceIssue>(),
            15, // Very low FPS
            0,
            25, // Poor performance score
            5000,
            new List<long>()
        );

        // Act
        var lowFpsResult = _smartAntiCheat.ValidateWithContext(lowFpsRequest, lowFpsContext);

        // Test with good FPS context
        var goodFpsContext = new PerformanceContext(
            new List<PerformanceIssue>(),
            60, // Good FPS
            0,
            95, // Good performance score
            5000,
            new List<long>()
        );

        var goodFpsResult = _smartAntiCheat.ValidateWithContext(lowFpsRequest, goodFpsContext);

        // Assert
        Assert.True(lowFpsResult.IsValid); // Should be more lenient with low FPS
        Assert.True(lowFpsResult.PerformanceAdjusted);
        
        Assert.False(goodFpsResult.IsValid); // Should be stricter with good FPS
        Assert.Equal("DynamicSpeedExceeded", goodFpsResult.Reason);
    }

    [Fact]
    public void ValidateWithContext_DynamicSpeedTolerance_ScalesWithPerformanceScore()
    {
        // Arrange
        var moderateSpeedRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(400, 140) // 40px in 400ms = 100px/s - at base limit
                }
            }
        };

        var performanceScores = new[] { 95, 70, 40, 15 };
        var results = new List<ValidationResult>();

        // Act - Test with different performance scores
        foreach (var score in performanceScores)
        {
            var context = new PerformanceContext(
                new List<PerformanceIssue>(),
                30, // Consistent FPS
                0,
                score,
                5000,
                new List<long>()
            );

            results.Add(_smartAntiCheat.ValidateWithContext(moderateSpeedRequest, context));
        }

        // Assert - Lower performance scores should be more lenient
        Assert.False(results[0].IsValid); // High performance score - strict
        Assert.True(results[3].IsValid);  // Low performance score - lenient
        
        // Confidence should decrease with performance score
        for (int i = 1; i < results.Count; i++)
        {
            if (results[i].IsValid && results[i-1].IsValid)
            {
                Assert.True(results[i].Confidence <= results[i-1].Confidence);
            }
        }
    }

    [Fact]
    public void ValidateWithContext_TimeWindowExtensions_ExtendsToleranceForPerformanceIssues()
    {
        // Arrange
        var performanceIssueTime = 1000L;
        var requestWithMovementAfterIssue = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new((int)(performanceIssueTime + 150), 140) // Movement 150ms after issue
                }
            }
        };

        var context = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "high", performanceIssueTime, 100, 25) // Issue duration 100ms
            },
            25, // Low FPS
            0,
            25, // Poor performance
            5000,
            new List<long> { performanceIssueTime }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(requestWithMovementAfterIssue, context);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
        Assert.NotNull(result.AdjustmentDetails);
        Assert.True(result.AdjustmentDetails.TimeWindowExtensionMs > 0);
    }

    [Fact]
    public void ValidateWithContext_ProximityToleranceAdjustment_AdjustsForMemoryPressure()
    {
        // Arrange
        var requestWithItemPickup = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Items = new List<ItemEvent>
                {
                    new(1500, "item1", ItemKind.POINTS, 460, 540) // 50px from player at x=410
                }
            }
        };

        var contextWithMemoryPressure = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("memory_pressure", "high", 1400, 0, 35)
            },
            40, // Moderate FPS
            3, // High memory pressure events
            35, // Poor performance score
            5000,
            new List<long> { 1400 }
        );

        var contextWithoutMemoryPressure = new PerformanceContext(
            new List<PerformanceIssue>(),
            40, // Same FPS
            0, // No memory pressure
            80, // Good performance score
            5000,
            new List<long>()
        );

        // Act
        var resultWithMemoryPressure = _smartAntiCheat.ValidateWithContext(requestWithItemPickup, contextWithMemoryPressure);
        var resultWithoutMemoryPressure = _smartAntiCheat.ValidateWithContext(requestWithItemPickup, contextWithoutMemoryPressure);

        // Assert
        Assert.True(resultWithMemoryPressure.IsValid); // Should be lenient due to memory pressure
        Assert.True(resultWithMemoryPressure.PerformanceAdjusted);
        
        Assert.False(resultWithoutMemoryPressure.IsValid); // Should be strict without memory pressure
    }

    [Fact]
    public void ValidateWithContext_ProximityToleranceAdjustment_AdjustsForNearbyPerformanceIssues()
    {
        // Arrange
        var itemTime = 1500;
        var requestWithItemPickup = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Items = new List<ItemEvent>
                {
                    new(itemTime, "item1", ItemKind.POINTS, 460, 540) // 50px from expected player position
                }
            }
        };

        var contextWithNearbyIssue = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "medium", itemTime - 200, 100, 50) // Issue 200ms before item pickup
            },
            35, // Moderate FPS
            0,
            50, // Moderate performance score
            5000,
            new List<long> { itemTime - 200 }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(requestWithItemPickup, contextWithNearbyIssue);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
    }

    [Fact]
    public void ValidateWithContext_ProximityToleranceAdjustment_RejectsExtremeDeviations()
    {
        // Arrange - Even with maximum adjustments, extreme deviations should fail
        var requestWithExtremeItemPickup = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Items = new List<ItemEvent>
                {
                    new(1500, "item1", ItemKind.POINTS, 700, 540) // 290px from player - extreme
                }
            }
        };

        var extremeContext = CreateExtremePerformanceContext();

        // Act
        var result = _smartAntiCheat.ValidateWithContext(requestWithExtremeItemPickup, extremeContext);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("DynamicProximity", result.Reason);
        Assert.True(result.PerformanceAdjusted);
    }

    [Fact]
    public void ValidateWithContext_IntegratedValidation_CombinesAllRules()
    {
        // Arrange - Complex scenario with multiple performance issues
        var complexRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(1000, 140), // During stutter
                    new(2000, 170), // After memory pressure
                    new(3000, 190)  // Normal movement
                },
                Items = new List<ItemEvent>
                {
                    new(1500, "item1", ItemKind.POINTS, 180, 540), // During performance issues
                    new(2500, "item2", ItemKind.POINTS, 185, 540)  // After issues
                }
            }
        };

        var complexContext = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "high", 1000, 200, 25),
                new("memory_pressure", "medium", 1800, 0, 30),
                new("low_fps", "medium", 2000, 500, 35)
            },
            22, // Low FPS
            2, // Memory pressure events
            30, // Poor performance score
            5000,
            new List<long> { 1000, 1800, 2000 }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(complexRequest, complexContext);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
        Assert.NotNull(result.AdjustmentDetails);
        Assert.True(result.Confidence < 0.8); // Reduced confidence due to performance issues
        
        // Verify adjustments are applied
        Assert.True(result.AdjustmentDetails.SpeedToleranceMultiplier > 1.0);
        Assert.True(result.AdjustmentDetails.ProximityToleranceMultiplier > 1.0);
        Assert.True(result.AdjustmentDetails.TimeWindowExtensionMs > 0);
    }

    [Fact]
    public void ValidateWithContext_SecurityMaintenance_StillDetectsObviousCheating()
    {
        // Arrange - Obvious cheating attempt even during performance issues
        var cheatRequest = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(100, 700) // Teleportation - 600px in 100ms
                }
            }
        };

        var performanceContext = new PerformanceContext(
            new List<PerformanceIssue>
            {
                new("stutter", "high", 50, 200, 20)
            },
            15, // Very low FPS
            2, // Memory pressure
            20, // Very poor performance
            5000,
            new List<long> { 50 }
        );

        // Act
        var result = _smartAntiCheat.ValidateWithContext(cheatRequest, performanceContext);

        // Assert - Should still detect obvious cheating
        Assert.False(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
        Assert.True(result.Confidence < 0.5); // Low confidence but still detected
    }

    [Fact]
    public void ValidateWithContext_DisabledPerformanceAdjustment_UsesStandardValidation()
    {
        // Arrange
        var options = new AntiCheatOptions(PerformanceAdjustmentEnabled: false);
        var antiCheatWithoutAdjustment = new SmartAntiCheatService(options);
        
        var requestWithModerateSpeed = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Moves = new List<MoveEvent>
                {
                    new(0, 100),
                    new(500, 150) // 50px in 500ms - moderate speed
                }
            }
        };

        var poorPerformanceContext = CreatePoorPerformanceContext();

        // Act
        var result = antiCheatWithoutAdjustment.ValidateWithContext(requestWithModerateSpeed, poorPerformanceContext);

        // Assert - Should use standard validation without performance adjustments
        var adjustment = antiCheatWithoutAdjustment.GetPerformanceAdjustment(poorPerformanceContext);
        Assert.Equal(1.0, adjustment.SpeedToleranceMultiplier);
        Assert.Equal(1.0, adjustment.ProximityToleranceMultiplier);
        Assert.Equal(0, adjustment.TimeWindowExtensionMs);
    }

    [Fact]
    public void ValidateWithContext_CustomThresholds_UsesConfiguredValues()
    {
        // Arrange
        var customOptions = new AntiCheatOptions(
            BaseSpeedTolerance: 2.0, // Very lenient
            BaseProximityTolerance: 100.0, // Very lenient
            StutterToleranceMs: 200.0,
            LowFPSThreshold: 25.0,
            ConfidenceThreshold: 0.4 // Low threshold
        );
        var customAntiCheat = new SmartAntiCheatService(customOptions);

        var requestWithLargeDeviation = _baseRequest with
        {
            Events = _baseRequest.Events with
            {
                Items = new List<ItemEvent>
                {
                    new(1500, "item1", ItemKind.POINTS, 480, 540) // 70px from player
                }
            }
        };

        var context = CreatePoorPerformanceContext();

        // Act
        var result = customAntiCheat.ValidateWithContext(requestWithLargeDeviation, context);

        // Assert - Should pass with lenient custom settings
        Assert.True(result.IsValid);
        Assert.True(result.PerformanceAdjusted);
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

    private PerformanceContext CreateExtremePerformanceContext()
    {
        var issues = new List<PerformanceIssue>();
        var timestamps = new List<long>();
        
        // Create many severe performance issues
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
}