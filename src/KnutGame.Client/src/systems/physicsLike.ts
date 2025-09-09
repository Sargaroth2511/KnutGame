export type ToppleConfig = { durationMs: number };
export type LingerConfig = { groundMs: number };

// Returns rotation angle (deg) and slide offset (px) for a topple animation at time t.
export function toppleTimeline(t: number, cfg: ToppleConfig) {
  const duration = Math.max(1, cfg.durationMs | 0);
  const clamped = Math.max(0, Math.min(duration, t));
  const p = clamped / duration; // 0..1
  // EaseOutCubic for a smooth finish
  const eased = 1 - Math.pow(1 - p, 3);
  const angleDeg = -90 * eased; // negative = rotate left by default
  const slidePx = 12 * eased;
  return { angleDeg, slidePx };
}

// Whether a ground item should despawn based on elapsed ground time.
export function shouldDespawnGround(tSinceGroundMs: number, cfg: LingerConfig) {
  return tSinceGroundMs >= Math.max(0, cfg.groundMs | 0);
}

