/**
 * Smart Anti-Cheat System with Performance Awareness
 * Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3
 */

import type {
  PerformanceMetrics,
  PerformanceIssue,
} from "./PerformanceMonitor";

/**
 * Performance context for correlating performance with movement
 */
export interface PerformanceContext {
  stutterEvents: PerformanceIssue[];
  averageFPS: number;
  memoryPressureEvents: number;
  performanceScore: number;
  recentPerformanceWindow: number; // ms
  performanceIssueTimestamps: number[];
}

/**
 * Movement validation data structure
 */
export interface MovementValidation {
  timestamp: number;
  playerPosition: { x: number; y: number };
  expectedPosition: { x: number; y: number };
  deviation: number;
  performanceAdjustment: number;
}

/**
 * Performance-based adjustments for validation rules
 */
export interface PerformanceAdjustment {
  stutterTolerance: number;
  speedToleranceMultiplier: number;
  proximityToleranceMultiplier: number;
  timeWindowExtension: number;
}

/**
 * Validation result with confidence scoring
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  confidence: number;
  performanceAdjusted: boolean;
  adjustmentDetails?: PerformanceAdjustment;
}

/**
 * Anti-cheat validation options with performance thresholds
 */
export interface AntiCheatOptions {
  baseSpeedTolerance: number;
  baseProximityTolerance: number;
  baseTimeWindow: number;
  performanceAdjustmentEnabled: boolean;
  confidenceThreshold: number;
  stutterToleranceMs: number;
  lowFPSThreshold: number;
  memoryPressureThreshold: number;
}

/**
 * Default anti-cheat options
 */
export const DEFAULT_ANTICHEAT_OPTIONS: AntiCheatOptions = {
  baseSpeedTolerance: 1.5, // 50% over normal speed - more lenient
  baseProximityTolerance: 60, // pixels - more lenient
  baseTimeWindow: 500, // ms
  performanceAdjustmentEnabled: true,
  confidenceThreshold: 0.7, // Lower threshold for better performance-aware validation
  stutterToleranceMs: 150, // More lenient stutter tolerance
  lowFPSThreshold: 30,
  memoryPressureThreshold: 0.8,
};

/**
 * Smart Anti-Cheat Service interface
 */
export interface ISmartAntiCheat {
  validateWithContext(
    movementData: MovementValidation[],
    context: PerformanceContext
  ): ValidationResult;
  setOptions(options: Partial<AntiCheatOptions>): void;
  getOptions(): AntiCheatOptions;
  calculateConfidence(
    validation: MovementValidation,
    context: PerformanceContext
  ): number;
  getPerformanceAdjustment(context: PerformanceContext): PerformanceAdjustment;
}

/**
 * Performance Context Builder
 */
export class PerformanceContextBuilder {
  private stutterEvents: PerformanceIssue[] = [];
  private performanceMetrics: PerformanceMetrics | null = null;
  private windowMs: number = 5000; // 5 second window

  constructor(windowMs: number = 5000) {
    this.windowMs = windowMs;
  }

  addPerformanceIssue(issue: PerformanceIssue): void {
    this.stutterEvents.push(issue);

    // Keep only recent events within the window
    const now = performance.now();
    this.stutterEvents = this.stutterEvents.filter(
      (event) => now - event.timestamp <= this.windowMs
    );
  }

  setCurrentMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics = metrics;
  }

  build(): PerformanceContext {
    const now = performance.now();
    const recentStutters = this.stutterEvents.filter(
      (event) => now - event.timestamp <= this.windowMs
    );

    const memoryPressureEvents = recentStutters.filter(
      (event) => event.type === "memory_pressure"
    ).length;

    const performanceIssueTimestamps = recentStutters.map(
      (event) => event.timestamp
    );

    return {
      stutterEvents: recentStutters,
      averageFPS: this.performanceMetrics?.currentFPS || 60,
      memoryPressureEvents,
      performanceScore: this.performanceMetrics?.performanceScore || 100,
      recentPerformanceWindow: this.windowMs,
      performanceIssueTimestamps,
    };
  }

  clear(): void {
    this.stutterEvents = [];
    this.performanceMetrics = null;
  }
}

/**
 * Smart Anti-Cheat Service Implementation
 */
export class SmartAntiCheatService implements ISmartAntiCheat {
  private options: AntiCheatOptions;

  constructor(options: Partial<AntiCheatOptions> = {}) {
    this.options = { ...DEFAULT_ANTICHEAT_OPTIONS, ...options };
  }

  validateWithContext(
    movementData: MovementValidation[],
    context: PerformanceContext
  ): ValidationResult {
    if (movementData.length === 0) {
      return {
        isValid: true,
        confidence: 1.0,
        performanceAdjusted: false,
      };
    }

    const performanceAdjustment = this.getPerformanceAdjustment(context);
    let totalConfidence = 0;
    let validationCount = 0;
    let performanceAdjusted = false;

    // Validate each movement entry
    for (const movement of movementData) {
      const validation = this.validateSingleMovement(
        movement,
        context,
        performanceAdjustment
      );

      if (!validation.isValid) {
        return {
          isValid: false,
          reason: validation.reason,
          confidence: validation.confidence,
          performanceAdjusted: validation.performanceAdjusted,
          adjustmentDetails: performanceAdjustment,
        };
      }

      totalConfidence += validation.confidence;
      validationCount++;

      if (validation.performanceAdjusted) {
        performanceAdjusted = true;
      }
    }

    const averageConfidence =
      validationCount > 0 ? totalConfidence / validationCount : 1.0;

    // Check if we should consider this performance adjusted based on context
    const contextHasPerformanceIssues =
      context.stutterEvents.length > 0 ||
      context.averageFPS < this.options.lowFPSThreshold ||
      context.memoryPressureEvents > 0;

    const finalPerformanceAdjusted =
      performanceAdjusted ||
      (contextHasPerformanceIssues &&
        performanceAdjustment.speedToleranceMultiplier > 1.0);

    return {
      isValid: averageConfidence >= this.options.confidenceThreshold,
      confidence: averageConfidence,
      performanceAdjusted: finalPerformanceAdjusted,
      adjustmentDetails: finalPerformanceAdjusted
        ? performanceAdjustment
        : undefined,
    };
  }

  private validateSingleMovement(
    movement: MovementValidation,
    context: PerformanceContext,
    adjustment: PerformanceAdjustment
  ): ValidationResult {
    const baseConfidence = this.calculateConfidence(movement, context);

    // Check if movement occurred during a performance issue
    const wasPerformanceIssue = this.wasMovementDuringPerformanceIssue(
      movement.timestamp,
      context
    );

    let finalConfidence = baseConfidence;
    let performanceAdjusted = wasPerformanceIssue;

    // 1. Stutter tolerance validation
    const stutterValidation = this.validateStutterTolerance(
      movement,
      context,
      adjustment
    );
    if (!stutterValidation.isValid) {
      return {
        isValid: false,
        reason: stutterValidation.reason,
        confidence: stutterValidation.confidence,
        performanceAdjusted: true,
      };
    }
    finalConfidence = Math.min(finalConfidence, stutterValidation.confidence);

    // 2. Dynamic speed tolerance validation
    const speedValidation = this.validateDynamicSpeedTolerance(
      movement,
      context,
      adjustment
    );
    if (!speedValidation.isValid) {
      return {
        isValid: false,
        reason: speedValidation.reason,
        confidence: speedValidation.confidence,
        performanceAdjusted: true,
      };
    }
    finalConfidence = Math.min(finalConfidence, speedValidation.confidence);

    // 3. Proximity tolerance adjustment validation
    const proximityValidation = this.validateProximityToleranceAdjustment(
      movement,
      context,
      adjustment
    );
    if (!proximityValidation.isValid) {
      return {
        isValid: false,
        reason: proximityValidation.reason,
        confidence: proximityValidation.confidence,
        performanceAdjusted: true,
      };
    }
    finalConfidence = Math.min(finalConfidence, proximityValidation.confidence);

    // 4. Time window extension validation (always passes but provides context)
    const timeValidation = this.validateTimeWindowExtension(
      movement,
      context,
      adjustment
    );
    finalConfidence = Math.min(finalConfidence, timeValidation.confidence);

    // If any performance-aware validation was applied, mark as adjusted
    if (
      stutterValidation.confidence < 1.0 ||
      speedValidation.confidence < 1.0 ||
      proximityValidation.confidence < 1.0 ||
      timeValidation.timeExtension > 0
    ) {
      performanceAdjusted = true;
    }

    return {
      isValid: true,
      confidence: finalConfidence,
      performanceAdjusted,
    };
  }

  calculateConfidence(
    validation: MovementValidation,
    context: PerformanceContext
  ): number {
    let confidence = 1.0;

    // Reduce confidence based on performance issues
    const performanceImpact = Math.max(
      0,
      (100 - context.performanceScore) / 100
    );
    confidence -= performanceImpact * 0.3;

    // Reduce confidence for low FPS
    if (context.averageFPS < this.options.lowFPSThreshold) {
      const fpsImpact =
        (this.options.lowFPSThreshold - context.averageFPS) /
        this.options.lowFPSThreshold;
      confidence -= fpsImpact * 0.2;
    }

    // Reduce confidence for recent stutters
    const recentStutters = context.stutterEvents.filter(
      (event) =>
        event.type === "stutter" && performance.now() - event.timestamp <= 1000 // Last 1 second
    );

    if (recentStutters.length > 0) {
      confidence -= Math.min(0.4, recentStutters.length * 0.1);
    }

    // Reduce confidence for memory pressure
    if (context.memoryPressureEvents > 0) {
      confidence -= Math.min(0.2, context.memoryPressureEvents * 0.05);
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  getPerformanceAdjustment(context: PerformanceContext): PerformanceAdjustment {
    if (!this.options.performanceAdjustmentEnabled) {
      return {
        stutterTolerance: 0,
        speedToleranceMultiplier: 1.0,
        proximityToleranceMultiplier: 1.0,
        timeWindowExtension: 0,
      };
    }

    let speedMultiplier = 1.0;
    let proximityMultiplier = 1.0;
    let timeExtension = 0;
    let stutterTolerance = this.options.stutterToleranceMs;

    // Adjust based on performance score
    const performanceImpact = Math.max(
      0,
      (100 - context.performanceScore) / 100
    );
    speedMultiplier += performanceImpact * 1.2; // Up to 120% more lenient
    proximityMultiplier += performanceImpact * 0.8; // Up to 80% more lenient

    // Adjust based on FPS
    if (context.averageFPS < this.options.lowFPSThreshold) {
      const fpsImpact =
        (this.options.lowFPSThreshold - context.averageFPS) /
        this.options.lowFPSThreshold;
      speedMultiplier += fpsImpact * 0.4;
      proximityMultiplier += fpsImpact * 0.2;
      timeExtension += fpsImpact * 200; // Up to 200ms extension
    }

    // Adjust based on recent stutters
    const recentStutters = context.stutterEvents.filter(
      (event) => event.type === "stutter"
    );

    if (recentStutters.length > 0) {
      const stutterImpact = Math.min(1.0, recentStutters.length / 2); // More sensitive to stutters
      speedMultiplier += stutterImpact * 0.8; // More lenient for stutters
      proximityMultiplier += stutterImpact * 0.6; // More lenient for stutters
      stutterTolerance += stutterImpact * 200; // Longer tolerance window
    }

    // Adjust based on memory pressure
    if (context.memoryPressureEvents > 0) {
      const memoryImpact = Math.min(1.0, context.memoryPressureEvents / 3);
      speedMultiplier += memoryImpact * 0.2;
      proximityMultiplier += memoryImpact * 0.1;
    }

    return {
      stutterTolerance,
      speedToleranceMultiplier: Math.min(3.0, speedMultiplier), // Cap at 3x - more lenient
      proximityToleranceMultiplier: Math.min(2.5, proximityMultiplier), // Cap at 2.5x - more lenient
      timeWindowExtension: Math.min(500, timeExtension), // Cap at 500ms
    };
  }

  setOptions(options: Partial<AntiCheatOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): AntiCheatOptions {
    return { ...this.options };
  }

  private wasMovementDuringPerformanceIssue(
    timestamp: number,
    context: PerformanceContext
  ): boolean {
    // Check if movement occurred during any performance issue with enhanced tolerance
    return context.stutterEvents.some((issue) => {
      const timeDiff = Math.abs(timestamp - issue.timestamp);
      const adjustment = this.getPerformanceAdjustment(context);
      const extendedTolerance =
        this.options.stutterToleranceMs + adjustment.timeWindowExtension;

      // Check if within stutter tolerance window
      if (timeDiff <= extendedTolerance) {
        return true;
      }

      // Check if within the duration of the performance issue (with extension)
      if (issue.duration > 0) {
        const issueEndTime =
          issue.timestamp + issue.duration + adjustment.timeWindowExtension;
        return timestamp >= issue.timestamp && timestamp <= issueEndTime;
      }

      return false;
    });
  }

  private calculateMovementSpeed(movement: MovementValidation): number {
    // For this validation, we use the deviation as a proxy for speed
    // In a real implementation, this would be calculated from actual movement data
    // For now, we'll use a simple heuristic based on deviation
    // Use a more reasonable multiplier that doesn't make everything fail
    return movement.deviation * 2; // Convert deviation to approximate speed (more reasonable)
  }

  /**
   * Enhanced stutter tolerance validation
   * Checks if movement anomalies can be attributed to performance stutters
   */
  private validateStutterTolerance(
    movement: MovementValidation,
    context: PerformanceContext,
    adjustment: PerformanceAdjustment
  ): { isValid: boolean; reason?: string; confidence: number } {
    // Check for recent stutters that might affect this movement
    // Use a more lenient time window for stutter detection
    const stutterWindow = Math.max(
      adjustment.stutterTolerance,
      this.options.stutterToleranceMs
    );
    const recentStutters = context.stutterEvents.filter((issue) => {
      const timeDiff = Math.abs(movement.timestamp - issue.timestamp);
      return issue.type === "stutter" && timeDiff <= stutterWindow;
    });

    if (recentStutters.length === 0) {
      return { isValid: true, confidence: 1.0 };
    }

    // Calculate stutter impact on movement validation
    const stutterSeverityMultiplier = recentStutters.reduce((max, stutter) => {
      const severityValue =
        stutter.severity === "high" ? 3 : stutter.severity === "medium" ? 2 : 1;
      return Math.max(max, severityValue);
    }, 1);

    // More lenient validation during stutters
    const stutterAdjustedSpeedTolerance =
      this.options.baseSpeedTolerance *
      adjustment.speedToleranceMultiplier *
      stutterSeverityMultiplier;
    const stutterAdjustedProximityTolerance =
      this.options.baseProximityTolerance *
      adjustment.proximityToleranceMultiplier *
      stutterSeverityMultiplier;

    const speed = this.calculateMovementSpeed(movement);
    const baseSpeedLimit = 200; // More reasonable base speed limit

    // Check speed with stutter tolerance
    if (speed > baseSpeedLimit * stutterAdjustedSpeedTolerance) {
      return {
        isValid: false,
        reason: "SpeedExceededDespiteStutter",
        confidence: 0.3, // Low confidence due to stutter context
      };
    }

    // Check proximity with stutter tolerance
    if (movement.deviation > stutterAdjustedProximityTolerance) {
      return {
        isValid: false,
        reason: "PositionDeviationDespiteStutter",
        confidence: 0.4, // Low confidence due to stutter context
      };
    }

    return {
      isValid: true,
      confidence: Math.max(0.5, 1.0 - recentStutters.length * 0.1), // Reduced confidence with more stutters
    };
  }

  /**
   * Dynamic speed tolerance based on recent performance metrics
   */
  private validateDynamicSpeedTolerance(
    movement: MovementValidation,
    context: PerformanceContext,
    adjustment: PerformanceAdjustment
  ): { isValid: boolean; reason?: string; confidence: number } {
    const speed = this.calculateMovementSpeed(movement);
    const baseSpeedLimit = 200; // More reasonable base speed limit

    // Calculate dynamic tolerance based on performance metrics
    let dynamicSpeedMultiplier = adjustment.speedToleranceMultiplier;

    // Adjust based on FPS trend (more lenient for consistently low FPS)
    if (context.averageFPS < this.options.lowFPSThreshold) {
      const fpsRatio = context.averageFPS / this.options.lowFPSThreshold;
      dynamicSpeedMultiplier *= 2.0 - fpsRatio; // More lenient as FPS gets lower
    }

    // Adjust based on performance score trend
    const performanceRatio = context.performanceScore / 100;
    dynamicSpeedMultiplier *= 1.5 - performanceRatio * 0.5; // More lenient for poor performance

    // Cap the multiplier
    dynamicSpeedMultiplier = Math.min(3.0, dynamicSpeedMultiplier);

    const dynamicSpeedLimit =
      baseSpeedLimit * this.options.baseSpeedTolerance * dynamicSpeedMultiplier;

    if (speed > dynamicSpeedLimit) {
      return {
        isValid: false,
        reason: "DynamicSpeedExceeded",
        confidence: Math.max(0.2, performanceRatio), // Lower confidence for poor performance
      };
    }

    return {
      isValid: true,
      confidence: Math.min(1.0, 0.7 + performanceRatio * 0.3), // Higher confidence for better performance
    };
  }

  /**
   * Time window extensions during performance issues
   */
  private validateTimeWindowExtension(
    movement: MovementValidation,
    context: PerformanceContext,
    adjustment: PerformanceAdjustment
  ): {
    isValid: boolean;
    reason?: string;
    confidence: number;
    timeExtension: number;
  } {
    let totalTimeExtension = adjustment.timeWindowExtension;

    // Check for overlapping performance issues that might require extended time windows
    const overlappingIssues = context.stutterEvents.filter((issue) => {
      const issueStart = issue.timestamp;
      const issueEnd = issue.timestamp + (issue.duration || 0);
      const movementTime = movement.timestamp;

      // Check if movement is within or near the performance issue timeframe
      return (
        movementTime >= issueStart - adjustment.stutterTolerance &&
        movementTime <= issueEnd + adjustment.stutterTolerance
      );
    });

    if (overlappingIssues.length > 0) {
      // Extend time window based on severity and count of overlapping issues
      const severityExtension = overlappingIssues.reduce((total, issue) => {
        const severityMultiplier =
          issue.severity === "high"
            ? 2.0
            : issue.severity === "medium"
            ? 1.5
            : 1.0;
        return total + 50 * severityMultiplier; // Base 50ms per issue, scaled by severity
      }, 0);

      totalTimeExtension += severityExtension;

      // Cap the total extension
      totalTimeExtension = Math.min(1000, totalTimeExtension); // Max 1 second extension
    }

    // For this validation, we assume the movement is valid if we're applying time extensions
    // The actual time-based validation would be done by the calling system
    const confidence =
      overlappingIssues.length > 0
        ? Math.max(0.4, 1.0 - overlappingIssues.length * 0.15)
        : 1.0;

    return {
      isValid: true,
      confidence,
      timeExtension: totalTimeExtension,
    };
  }

  /**
   * Proximity tolerance adjustments for performance-related position deviations
   */
  private validateProximityToleranceAdjustment(
    movement: MovementValidation,
    context: PerformanceContext,
    adjustment: PerformanceAdjustment
  ): { isValid: boolean; reason?: string; confidence: number } {
    // Calculate dynamic proximity tolerance based on performance context
    let dynamicProximityMultiplier = adjustment.proximityToleranceMultiplier;

    // Adjust based on memory pressure (can cause position sync issues)
    if (context.memoryPressureEvents > 0) {
      const memoryPressureImpact = Math.min(
        2.0,
        1.0 + context.memoryPressureEvents * 0.2
      );
      dynamicProximityMultiplier *= memoryPressureImpact;
    }

    // Adjust based on recent performance issues near this timestamp
    const nearbyIssues = context.stutterEvents.filter((issue) => {
      const timeDiff = Math.abs(movement.timestamp - issue.timestamp);
      return timeDiff <= 500; // Within 500ms
    });

    if (nearbyIssues.length > 0) {
      const proximityImpact = Math.min(1.8, 1.0 + nearbyIssues.length * 0.15);
      dynamicProximityMultiplier *= proximityImpact;
    }

    // Cap the multiplier
    dynamicProximityMultiplier = Math.min(2.5, dynamicProximityMultiplier);

    const dynamicProximityTolerance =
      this.options.baseProximityTolerance * dynamicProximityMultiplier;

    if (movement.deviation > dynamicProximityTolerance) {
      return {
        isValid: false,
        reason: "DynamicProximityExceeded",
        confidence: Math.max(0.3, context.performanceScore / 100),
      };
    }

    return {
      isValid: true,
      confidence: Math.min(1.0, 0.8 + (context.performanceScore / 100) * 0.2),
    };
  }
}
