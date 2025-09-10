export interface ToppleConfig {
  durationMs: number;
}

export interface LingerConfig {
  groundMs: number;
}

export interface ToppleResult {
  angleDeg: number;
  slidePx: number;
}

/**
 * PhysicsTimeline provides utility functions for physics-based animations and timing
 * in the game, including topple animations and ground item despawn logic.
 */
export class PhysicsTimeline {
  /**
   * Calculates the rotation angle and slide offset for a topple animation at a given time.
   * Uses cubic ease-out for smooth animation finish.
   *
   * @param elapsedTimeMs - The elapsed time in milliseconds since animation start
   * @param config - Configuration for the topple animation
   * @returns Object containing angleDeg (rotation in degrees) and slidePx (horizontal offset in pixels)
   */
  static calculateToppleTimeline(elapsedTimeMs: number, config: ToppleConfig): ToppleResult {
    const duration = Math.max(1, config.durationMs | 0);
    const clamped = Math.max(0, Math.min(duration, elapsedTimeMs));
    const progress = clamped / duration; // 0..1

    // EaseOutCubic for a smooth finish
    const eased = 1 - Math.pow(1 - progress, 3);
    const angleDeg = -90 * eased; // negative = rotate left by default
    const slidePx = 12 * eased;

    return { angleDeg, slidePx };
  }

  /**
   * Determines whether a ground item should despawn based on elapsed ground time.
   *
   * @param timeSinceGroundMs - Time elapsed since the item hit the ground
   * @param config - Configuration for ground linger duration
   * @returns true if the item should despawn, false otherwise
   */
  static shouldDespawnGroundItem(timeSinceGroundMs: number, config: LingerConfig): boolean {
    return timeSinceGroundMs >= Math.max(0, config.groundMs | 0);
  }
}

// Legacy function exports for backward compatibility

/**
 * Returns rotation angle (deg) and slide offset (px) for a topple animation at time t.
 * @deprecated Use PhysicsTimeline.calculateToppleTimeline instead
 */
export function toppleTimeline(t: number, cfg: ToppleConfig): ToppleResult {
  return PhysicsTimeline.calculateToppleTimeline(t, cfg);
}

/**
 * Whether a ground item should despawn based on elapsed ground time.
 * @deprecated Use PhysicsTimeline.shouldDespawnGroundItem instead
 */
export function shouldDespawnGround(tSinceGroundMs: number, cfg: LingerConfig): boolean {
  return PhysicsTimeline.shouldDespawnGroundItem(tSinceGroundMs, cfg);
}
