/**
 * Configuration options for score calculation and timing.
 * Defines the base scoring parameters and timing constants.
 */
interface ScoringConfig {
  /** Base points earned per second during normal gameplay */
  basePointsPerSecond: number;
  /** Default multiplier value when no bonus is active */
  defaultMultiplier: number;
  /** Slow motion factor applied when slow motion is active */
  slowMotionFactor: number;
}

/**
 * Represents the current state of the scoring system.
 * Tracks score, multipliers, and active effects over time.
 */
interface ScoreState {
  /** Current total score accumulated */
  score: number;
  /** Current score multiplier (e.g., 1, 2, 3) */
  multiplier: number;
  /** Remaining milliseconds for the current multiplier effect */
  multiplierRemainingMs: number;
  /** Remaining milliseconds for the slow motion effect */
  slowMoRemainingMs: number;
}

/**
 * Result of a score update operation.
 * Contains the new state and any additional information about the update.
 */
interface ScoreUpdateResult {
  /** The updated score state */
  state: ScoreState;
  /** Points added in this update (if applicable) */
  pointsAdded?: number;
  /** Whether a multiplier was applied */
  multiplierApplied?: boolean;
  /** Whether slow motion was activated */
  slowMotionActivated?: boolean;
}

/**
 * Manages game scoring with multipliers, slow motion effects, and time-based scoring.
 * Provides a centralized system for score calculation, effect management, and state tracking.
 * Follows the Single Responsibility Principle by handling only scoring-related logic.
 */
export class ScoringService {
  private config: ScoringConfig;
  private currentState: ScoreState;

  /**
   * Creates a new ScoringService instance
   * @param config - Configuration options for scoring behavior (optional, uses defaults if not provided)
   */
  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      basePointsPerSecond: 10,
      defaultMultiplier: 1,
      slowMotionFactor: 0.5,
      ...config
    };

    this.currentState = this.createInitialState();
  }

  /**
   * Creates the initial score state with default values
   * @returns A new ScoreState with all values reset to defaults
   */
  private createInitialState(): ScoreState {
    return {
      score: 0,
      multiplier: this.config.defaultMultiplier,
      multiplierRemainingMs: 0,
      slowMoRemainingMs: 0
    };
  }

  /**
   * Gets the current score state
   * @returns A copy of the current score state to prevent external mutation
   */
  getCurrentState(): ScoreState {
    return { ...this.currentState };
  }

  /**
   * Updates the score based on elapsed time and current multiplier
   * @param deltaTimeMs - Time elapsed since last update in milliseconds
   * @returns ScoreUpdateResult containing the new state and points added
   */
  tick(deltaTimeMs: number): ScoreUpdateResult {
    const seconds = Math.max(0, deltaTimeMs) / 1000;

    // Calculate points to add based on time, base rate, and multiplier
    const pointsToAdd = Math.floor(seconds * this.config.basePointsPerSecond * this.currentState.multiplier);

    // Update score
    this.currentState.score += pointsToAdd;

    // Update effect timers
    if (this.currentState.multiplierRemainingMs > 0) {
      this.currentState.multiplierRemainingMs = Math.max(0, this.currentState.multiplierRemainingMs - deltaTimeMs);
      // Reset multiplier when timer expires
      if (this.currentState.multiplierRemainingMs === 0) {
        this.currentState.multiplier = this.config.defaultMultiplier;
      }
    }

    if (this.currentState.slowMoRemainingMs > 0) {
      this.currentState.slowMoRemainingMs = Math.max(0, this.currentState.slowMoRemainingMs - deltaTimeMs);
    }

    return {
      state: this.getCurrentState(),
      pointsAdded: pointsToAdd
    };
  }

  /**
   * Adds bonus points to the current score
   * @param points - Number of points to add (must be non-negative)
   * @returns ScoreUpdateResult with the updated state
   * @throws Error if points is negative
   */
  addPoints(points: number): ScoreUpdateResult {
    if (points < 0) {
      throw new Error('Cannot add negative points');
    }

    const pointsToAdd = Math.floor(points * this.currentState.multiplier);
    this.currentState.score += pointsToAdd;

    return {
      state: this.getCurrentState(),
      pointsAdded: pointsToAdd
    };
  }

  /**
   * Applies a score multiplier for a specified duration
   * @param multiplier - Multiplier factor (must be >= 1)
   * @param durationMs - Duration in milliseconds (must be > 0)
   * @returns ScoreUpdateResult indicating multiplier was applied
   * @throws Error if multiplier or duration are invalid
   */
  applyMultiplier(multiplier: number, durationMs: number): ScoreUpdateResult {
    if (multiplier < 1) {
      throw new Error('Multiplier must be at least 1');
    }
    if (durationMs <= 0) {
      throw new Error('Duration must be positive');
    }

    this.currentState.multiplier = Math.max(this.currentState.multiplier, multiplier);
    this.currentState.multiplierRemainingMs = Math.max(this.currentState.multiplierRemainingMs, durationMs);

    return {
      state: this.getCurrentState(),
      multiplierApplied: true
    };
  }

  /**
   * Activates slow motion effect for a specified duration
   * @param durationMs - Duration in milliseconds (must be > 0)
   * @returns ScoreUpdateResult indicating slow motion was activated
   * @throws Error if duration is invalid
   */
  applySlowMotion(durationMs: number): ScoreUpdateResult {
    if (durationMs <= 0) {
      throw new Error('Duration must be positive');
    }

    this.currentState.slowMoRemainingMs = Math.max(this.currentState.slowMoRemainingMs, durationMs);

    return {
      state: this.getCurrentState(),
      slowMotionActivated: true
    };
  }

  /**
   * Calculates the current slow motion factor
   * @returns The slow motion factor (config.slowMotionFactor if active, 1.0 if inactive)
   */
  getSlowMotionFactor(): number {
    return this.currentState.slowMoRemainingMs > 0 ? this.config.slowMotionFactor : 1.0;
  }

  /**
   * Checks if slow motion effect is currently active
   * @returns True if slow motion is active, false otherwise
   */
  isSlowMotionActive(): boolean {
    return this.currentState.slowMoRemainingMs > 0;
  }

  /**
   * Checks if a multiplier is currently active
   * @returns True if multiplier is greater than default, false otherwise
   */
  isMultiplierActive(): boolean {
    return this.currentState.multiplier > this.config.defaultMultiplier;
  }

  /**
   * Gets the remaining time for the current multiplier in milliseconds
   * @returns Remaining milliseconds for multiplier effect
   */
  getMultiplierTimeRemaining(): number {
    return this.currentState.multiplierRemainingMs;
  }

  /**
   * Gets the remaining time for slow motion in milliseconds
   * @returns Remaining milliseconds for slow motion effect
   */
  getSlowMotionTimeRemaining(): number {
    return this.currentState.slowMoRemainingMs;
  }

  /**
   * Resets the scoring system to initial state
   * @returns The reset state
   */
  reset(): ScoreState {
    this.currentState = this.createInitialState();
    return this.getCurrentState();
  }

  /**
   * Updates the scoring configuration
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets the current configuration
   * @returns A copy of the current scoring configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }
}

// Legacy type exports for backward compatibility
export type { ScoreState };

// Legacy function exports for backward compatibility
/**
 * @deprecated Use ScoringService class instead for better encapsulation and error handling
 */
export const createScoreState = (): ScoreState => ({
  score: 0,
  multiplier: 1,
  multiplierRemainingMs: 0,
  slowMoRemainingMs: 0,
});

/**
 * @deprecated Use ScoringService.tick() method instead
 */
export const tickScore = (s: ScoreState, dtMs: number, basePtsPerSec: number): ScoreState => {
  const next: ScoreState = { ...s };
  const seconds = Math.max(0, dtMs) / 1000;
  next.score += Math.floor(seconds * basePtsPerSec * next.multiplier);
  if (next.multiplierRemainingMs > 0) next.multiplierRemainingMs = Math.max(0, next.multiplierRemainingMs - dtMs);
  if (next.multiplierRemainingMs === 0) next.multiplier = 1;
  if (next.slowMoRemainingMs > 0) next.slowMoRemainingMs = Math.max(0, next.slowMoRemainingMs - dtMs);
  return next;
};

/**
 * @deprecated Use ScoringService.addPoints() method instead
 */
export const applyPoints = (s: ScoreState, bonus: number): ScoreState => ({ ...s, score: s.score + bonus });

/**
 * @deprecated Use ScoringService.applyMultiplier() method instead
 */
export const applyMultiplier = (s: ScoreState, factor: number, durationMs: number): ScoreState => ({
  ...s,
  multiplier: Math.max(1, factor),
  multiplierRemainingMs: Math.max(s.multiplierRemainingMs, durationMs),
});

/**
 * @deprecated Use ScoringService.applySlowMotion() method instead
 */
export const applySlowMo = (s: ScoreState, durationMs: number): ScoreState => ({
  ...s,
  slowMoRemainingMs: Math.max(s.slowMoRemainingMs, durationMs),
});

/**
 * @deprecated Use ScoringService.getSlowMotionFactor() method instead
 */
export const slowMoFactor = (s: ScoreState, factor: number): number => (s.slowMoRemainingMs > 0 ? factor : 1);
