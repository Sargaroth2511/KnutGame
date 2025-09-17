using KnutGame.Game;
using KnutGame.Models;

namespace KnutGame.Services;

/// <summary>
/// Performance context for correlating performance with movement
/// Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3
/// </summary>
public record PerformanceContext(
    List<PerformanceIssue> StutterEvents,
    double AverageFPS,
    int MemoryPressureEvents,
    double PerformanceScore,
    int RecentPerformanceWindowMs,
    List<long> PerformanceIssueTimestamps
);

/// <summary>
/// Performance issue data structure
/// </summary>
public record PerformanceIssue(
    string Type, // "stutter", "low_fps", "memory_pressure"
    string Severity, // "low", "medium", "high"
    long Timestamp,
    double Duration,
    double PerformanceScore
);

/// <summary>
/// Performance-based adjustments for validation rules
/// </summary>
public record PerformanceAdjustment(
    double StutterToleranceMs,
    double SpeedToleranceMultiplier,
    double ProximityToleranceMultiplier,
    double TimeWindowExtensionMs
);

/// <summary>
/// Validation result with confidence scoring
/// </summary>
public record ValidationResult(
    bool IsValid,
    string? Reason,
    double Confidence,
    bool PerformanceAdjusted,
    PerformanceAdjustment? AdjustmentDetails = null
);

/// <summary>
/// Anti-cheat validation options with performance thresholds
/// </summary>
public record AntiCheatOptions(
    double BaseSpeedTolerance = 1.2,
    double BaseProximityTolerance = 48.0,
    double BaseTimeWindowMs = 500.0,
    bool PerformanceAdjustmentEnabled = true,
    double ConfidenceThreshold = 0.8,
    double StutterToleranceMs = 100.0,
    double LowFPSThreshold = 30.0,
    double MemoryPressureThreshold = 0.8
);

/// <summary>
/// Enhanced anti-cheat interface with performance awareness
/// </summary>
public interface ISmartAntiCheat : IAntiCheat
{
    ValidationResult ValidateWithContext(SubmitSessionRequest req, PerformanceContext context);
    void SetPerformanceThresholds(AntiCheatOptions options);
    AntiCheatOptions GetPerformanceThresholds();
}

/// <summary>
/// Smart Anti-Cheat Service that extends existing AntiCheatService with performance awareness
/// </summary>
public class SmartAntiCheatService : AntiCheatService, ISmartAntiCheat
{
    private AntiCheatOptions _options;

    public SmartAntiCheatService(AntiCheatOptions? options = null)
    {
        _options = options ?? new AntiCheatOptions();
    }

    /// <summary>
    /// Enhanced validation that considers performance context
    /// </summary>
    public ValidationResult ValidateWithContext(SubmitSessionRequest req, PerformanceContext context)
    {
        // First run the base validation
        var baseValidation = base.Validate(req);
        
        if (!baseValidation.Ok)
        {
            // Check if the failure might be performance-related
            var confidence = CalculateConfidence(req, context);
            var performanceAdjustment = GetPerformanceAdjustment(context);
            
            // If performance issues are detected, try performance-adjusted validation
            if (ShouldApplyPerformanceAdjustment(baseValidation.Reason, context))
            {
                var adjustedValidation = ValidateWithPerformanceAdjustment(req, context, performanceAdjustment);
                return new ValidationResult(
                    adjustedValidation.IsValid,
                    adjustedValidation.IsValid ? null : baseValidation.Reason,
                    confidence,
                    true,
                    performanceAdjustment
                );
            }

            return new ValidationResult(
                false,
                baseValidation.Reason,
                confidence,
                false
            );
        }

        // Base validation passed, calculate confidence
        var finalConfidence = CalculateConfidence(req, context);
        var wasAdjusted = context.StutterEvents.Count > 0 || context.AverageFPS < _options.LowFPSThreshold;

        return new ValidationResult(
            finalConfidence >= _options.ConfidenceThreshold,
            finalConfidence < _options.ConfidenceThreshold ? "LowConfidence" : null,
            finalConfidence,
            wasAdjusted,
            wasAdjusted ? GetPerformanceAdjustment(context) : null
        );
    }

    /// <summary>
    /// Validate with enhanced performance-adjusted thresholds
    /// </summary>
    private ValidationResult ValidateWithPerformanceAdjustment(
        SubmitSessionRequest req, 
        PerformanceContext context, 
        PerformanceAdjustment adjustment)
    {
        var confidenceScores = new List<double>();
        var performanceAdjusted = false;

        // Enhanced performance-adjusted speed check
        for (int i = 1; i < req.Events.Moves.Count; i++)
        {
            var prev = req.Events.Moves[i - 1];
            var curr = req.Events.Moves[i];
            var dt = curr.t - prev.t;
            if (dt <= 0) continue;

            var dx = Math.Abs(curr.x - prev.x);
            var speed = dx / dt * 1000; // px/s
            var deviation = dx; // Use dx as deviation for proximity checks
            
            // 1. Stutter tolerance validation
            var stutterValidation = ValidateStutterTolerance(curr.t, deviation, speed, context, adjustment);
            if (!stutterValidation.IsValid)
            {
                return new ValidationResult(false, stutterValidation.Reason, stutterValidation.Confidence, true, adjustment);
            }
            confidenceScores.Add(stutterValidation.Confidence);
            if (stutterValidation.Confidence < 1.0) performanceAdjusted = true;

            // 2. Dynamic speed tolerance validation
            var speedValidation = ValidateDynamicSpeedTolerance(speed, context, adjustment);
            if (!speedValidation.IsValid)
            {
                return new ValidationResult(false, speedValidation.Reason, speedValidation.Confidence, true, adjustment);
            }
            confidenceScores.Add(speedValidation.Confidence);
            if (speedValidation.Confidence < 1.0) performanceAdjusted = true;

            // 3. Proximity tolerance adjustment validation for movement
            var proximityValidation = ValidateProximityToleranceAdjustment(curr.t, deviation, context, adjustment);
            if (!proximityValidation.IsValid)
            {
                return new ValidationResult(false, proximityValidation.Reason, proximityValidation.Confidence, true, adjustment);
            }
            confidenceScores.Add(proximityValidation.Confidence);
            if (proximityValidation.Confidence < 1.0) performanceAdjusted = true;
        }

        // Enhanced performance-adjusted item proximity check
        foreach (var item in req.Events.Items)
        {
            // Find player x at item.t (interpolate from moves)
            float playerX = -1;
            for (int i = 0; i < req.Events.Moves.Count - 1; i++)
            {
                var m1 = req.Events.Moves[i];
                var m2 = req.Events.Moves[i + 1];
                if (m1.t <= item.t && item.t <= m2.t)
                {
                    var ratio = (item.t - m1.t) / (float)(m2.t - m1.t);
                    playerX = m1.x + ratio * (m2.x - m1.x);
                    break;
                }
            }
            if (playerX == -1) playerX = req.Events.Moves.LastOrDefault()?.x ?? req.CanvasWidth / 2f;

            var distance = Math.Abs(playerX - item.x);
            
            // Apply all performance-aware validations to item pickup
            var itemStutterValidation = ValidateStutterTolerance(item.t, distance, 0, context, adjustment);
            if (!itemStutterValidation.IsValid)
            {
                return new ValidationResult(false, $"Item{itemStutterValidation.Reason}", itemStutterValidation.Confidence, true, adjustment);
            }
            confidenceScores.Add(itemStutterValidation.Confidence);

            var itemProximityValidation = ValidateProximityToleranceAdjustment(item.t, distance, context, adjustment);
            if (!itemProximityValidation.IsValid)
            {
                return new ValidationResult(false, $"Item{itemProximityValidation.Reason}", itemProximityValidation.Confidence, true, adjustment);
            }
            confidenceScores.Add(itemProximityValidation.Confidence);
            
            if (itemStutterValidation.Confidence < 1.0 || itemProximityValidation.Confidence < 1.0)
            {
                performanceAdjusted = true;
            }
        }

        // Calculate final confidence as the minimum of all validations
        var finalConfidence = confidenceScores.Any() ? confidenceScores.Min() : CalculateConfidence(req, context);
        
        // Check if performance context indicates adjustment should be noted
        if (context.StutterEvents.Any() || context.AverageFPS < _options.LowFPSThreshold || context.MemoryPressureEvents > 0)
        {
            performanceAdjusted = true;
        }

        return new ValidationResult(true, null, finalConfidence, performanceAdjusted, performanceAdjusted ? adjustment : null);
    }

    /// <summary>
    /// Calculate confidence score based on performance context
    /// </summary>
    private double CalculateConfidence(SubmitSessionRequest req, PerformanceContext context)
    {
        double confidence = 1.0;

        // Reduce confidence based on performance score
        var performanceImpact = Math.Max(0, (100 - context.PerformanceScore) / 100);
        confidence -= performanceImpact * 0.3;

        // Reduce confidence for low FPS
        if (context.AverageFPS < _options.LowFPSThreshold)
        {
            var fpsImpact = (_options.LowFPSThreshold - context.AverageFPS) / _options.LowFPSThreshold;
            confidence -= fpsImpact * 0.2;
        }

        // Reduce confidence for recent stutters
        var recentStutters = context.StutterEvents
            .Where(e => e.Type == "stutter")
            .Count();
        
        if (recentStutters > 0)
        {
            confidence -= Math.Min(0.4, recentStutters * 0.1);
        }

        // Reduce confidence for memory pressure
        if (context.MemoryPressureEvents > 0)
        {
            confidence -= Math.Min(0.2, context.MemoryPressureEvents * 0.05);
        }

        return Math.Max(0.1, Math.Min(1.0, confidence));
    }

    /// <summary>
    /// Get performance-based adjustments for validation thresholds
    /// </summary>
    private PerformanceAdjustment GetPerformanceAdjustment(PerformanceContext context)
    {
        if (!_options.PerformanceAdjustmentEnabled)
        {
            return new PerformanceAdjustment(0, 1.0, 1.0, 0);
        }

        double speedMultiplier = 1.0;
        double proximityMultiplier = 1.0;
        double timeExtension = 0;
        double stutterTolerance = _options.StutterToleranceMs;

        // Adjust based on performance score
        var performanceImpact = Math.Max(0, (100 - context.PerformanceScore) / 100);
        speedMultiplier += performanceImpact * 0.5; // Up to 50% more lenient
        proximityMultiplier += performanceImpact * 0.3; // Up to 30% more lenient

        // Adjust based on FPS
        if (context.AverageFPS < _options.LowFPSThreshold)
        {
            var fpsImpact = (_options.LowFPSThreshold - context.AverageFPS) / _options.LowFPSThreshold;
            speedMultiplier += fpsImpact * 0.4;
            proximityMultiplier += fpsImpact * 0.2;
            timeExtension += fpsImpact * 200; // Up to 200ms extension
        }

        // Adjust based on recent stutters
        var recentStutters = context.StutterEvents.Where(e => e.Type == "stutter").Count();
        if (recentStutters > 0)
        {
            var stutterImpact = Math.Min(1.0, recentStutters / 5.0);
            speedMultiplier += stutterImpact * 0.3;
            proximityMultiplier += stutterImpact * 0.2;
            stutterTolerance += stutterImpact * 100;
        }

        // Adjust based on memory pressure
        if (context.MemoryPressureEvents > 0)
        {
            var memoryImpact = Math.Min(1.0, context.MemoryPressureEvents / 3.0);
            speedMultiplier += memoryImpact * 0.2;
            proximityMultiplier += memoryImpact * 0.1;
        }

        return new PerformanceAdjustment(
            stutterTolerance,
            Math.Min(2.0, speedMultiplier), // Cap at 2x
            Math.Min(1.8, proximityMultiplier), // Cap at 1.8x
            Math.Min(500, timeExtension) // Cap at 500ms
        );
    }

    /// <summary>
    /// Check if a validation failure should trigger performance adjustment
    /// </summary>
    private bool ShouldApplyPerformanceAdjustment(string? reason, PerformanceContext context)
    {
        if (!_options.PerformanceAdjustmentEnabled || reason == null)
            return false;

        // Apply performance adjustment for movement-related failures during performance issues
        var performanceRelatedReasons = new[] { "SpeedExceeded", "ItemPickupTooFar", "DurationMismatch" };
        var hasPerformanceIssues = context.StutterEvents.Count > 0 || 
                                  context.AverageFPS < _options.LowFPSThreshold ||
                                  context.MemoryPressureEvents > 0;

        return performanceRelatedReasons.Contains(reason) && hasPerformanceIssues;
    }

    /// <summary>
    /// Check if a movement occurred during a performance issue with enhanced tolerance
    /// </summary>
    private bool WasMovementDuringPerformanceIssue(int timestamp, PerformanceContext context)
    {
        var adjustment = GetPerformanceAdjustment(context);
        var extendedTolerance = _options.StutterToleranceMs + adjustment.TimeWindowExtensionMs;
        
        return context.StutterEvents.Any(issue =>
        {
            var timeDiff = Math.Abs(timestamp - issue.Timestamp);
            
            // Check if within extended stutter tolerance window
            if (timeDiff <= extendedTolerance)
                return true;
                
            // Check if within the duration of the performance issue (with extension)
            if (issue.Duration > 0)
            {
                var issueEndTime = issue.Timestamp + issue.Duration + adjustment.TimeWindowExtensionMs;
                return timestamp >= issue.Timestamp && timestamp <= issueEndTime;
            }
            
            return false;
        });
    }

    /// <summary>
    /// Enhanced stutter tolerance validation for movement anomalies
    /// </summary>
    private (bool IsValid, string? Reason, double Confidence) ValidateStutterTolerance(
        int timestamp, double deviation, double speed, PerformanceContext context, PerformanceAdjustment adjustment)
    {
        // Check for recent stutters that might affect this movement
        var recentStutters = context.StutterEvents
            .Where(issue => issue.Type == "stutter" && 
                           Math.Abs(timestamp - issue.Timestamp) <= adjustment.StutterToleranceMs)
            .ToList();

        if (!recentStutters.Any())
            return (true, null, 1.0);

        // Calculate stutter impact on movement validation
        var stutterSeverityMultiplier = recentStutters
            .Select(s => s.Severity switch { "high" => 3.0, "medium" => 2.0, _ => 1.0 })
            .Max();

        // More lenient validation during stutters
        var stutterAdjustedSpeedTolerance = _options.BaseSpeedTolerance * 
            adjustment.SpeedToleranceMultiplier * stutterSeverityMultiplier;
        var stutterAdjustedProximityTolerance = _options.BaseProximityTolerance * 
            adjustment.ProximityToleranceMultiplier * stutterSeverityMultiplier;

        var baseSpeedLimit = GameConfig.MOVE_SPEED;

        // Check speed with stutter tolerance
        if (speed > baseSpeedLimit * stutterAdjustedSpeedTolerance)
        {
            return (false, "SpeedExceededDespiteStutter", 0.3);
        }

        // Check proximity with stutter tolerance
        if (deviation > stutterAdjustedProximityTolerance)
        {
            return (false, "PositionDeviationDespiteStutter", 0.4);
        }

        var confidence = Math.Max(0.5, 1.0 - (recentStutters.Count * 0.1));
        return (true, null, confidence);
    }

    /// <summary>
    /// Dynamic speed tolerance based on recent performance metrics
    /// </summary>
    private (bool IsValid, string? Reason, double Confidence) ValidateDynamicSpeedTolerance(
        double speed, PerformanceContext context, PerformanceAdjustment adjustment)
    {
        var baseSpeedLimit = GameConfig.MOVE_SPEED;
        
        // Calculate dynamic tolerance based on performance metrics
        var dynamicSpeedMultiplier = adjustment.SpeedToleranceMultiplier;

        // Adjust based on FPS trend (more lenient for consistently low FPS)
        if (context.AverageFPS < _options.LowFPSThreshold)
        {
            var fpsRatio = context.AverageFPS / _options.LowFPSThreshold;
            dynamicSpeedMultiplier *= (2.0 - fpsRatio); // More lenient as FPS gets lower
        }

        // Adjust based on performance score trend
        var performanceRatio = context.PerformanceScore / 100.0;
        dynamicSpeedMultiplier *= (1.5 - (performanceRatio * 0.5)); // More lenient for poor performance

        // Cap the multiplier
        dynamicSpeedMultiplier = Math.Min(3.0, dynamicSpeedMultiplier);

        var dynamicSpeedLimit = baseSpeedLimit * _options.BaseSpeedTolerance * dynamicSpeedMultiplier;

        if (speed > dynamicSpeedLimit)
        {
            var confidence = Math.Max(0.2, performanceRatio);
            return (false, "DynamicSpeedExceeded", confidence);
        }

        var finalConfidence = Math.Min(1.0, 0.7 + (performanceRatio * 0.3));
        return (true, null, finalConfidence);
    }

    /// <summary>
    /// Proximity tolerance adjustments for performance-related position deviations
    /// </summary>
    private (bool IsValid, string? Reason, double Confidence) ValidateProximityToleranceAdjustment(
        int timestamp, double deviation, PerformanceContext context, PerformanceAdjustment adjustment)
    {
        // Calculate dynamic proximity tolerance based on performance context
        var dynamicProximityMultiplier = adjustment.ProximityToleranceMultiplier;

        // Adjust based on memory pressure (can cause position sync issues)
        if (context.MemoryPressureEvents > 0)
        {
            var memoryPressureImpact = Math.Min(2.0, 1.0 + (context.MemoryPressureEvents * 0.2));
            dynamicProximityMultiplier *= memoryPressureImpact;
        }

        // Adjust based on recent performance issues near this timestamp
        var nearbyIssues = context.StutterEvents
            .Where(issue => Math.Abs(timestamp - issue.Timestamp) <= 500) // Within 500ms
            .Count();

        if (nearbyIssues > 0)
        {
            var proximityImpact = Math.Min(1.8, 1.0 + (nearbyIssues * 0.15));
            dynamicProximityMultiplier *= proximityImpact;
        }

        // Cap the multiplier
        dynamicProximityMultiplier = Math.Min(2.5, dynamicProximityMultiplier);

        var dynamicProximityTolerance = _options.BaseProximityTolerance * dynamicProximityMultiplier;

        if (deviation > dynamicProximityTolerance)
        {
            var confidence = Math.Max(0.3, context.PerformanceScore / 100.0);
            return (false, "DynamicProximityExceeded", confidence);
        }

        var finalConfidence = Math.Min(1.0, 0.8 + ((context.PerformanceScore / 100.0) * 0.2));
        return (true, null, finalConfidence);
    }

    public void SetPerformanceThresholds(AntiCheatOptions options)
    {
        _options = options;
    }

    public AntiCheatOptions GetPerformanceThresholds()
    {
        return _options;
    }
}