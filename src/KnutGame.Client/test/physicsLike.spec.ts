import { describe, it, expect } from 'vitest'
import { toppleTimeline, shouldDespawnGround } from '../src/systems/physicsLike'

describe('physics-like timelines', () => {
  it('toppleTimeline eases to ~-90deg', () => {
    const end = toppleTimeline(750, { durationMs: 750 });
    expect(end.angleDeg).toBeLessThanOrEqual(-89);
    expect(end.slidePx).toBeGreaterThan(0);
  });

  it('toppleTimeline clamps at bounds', () => {
    const start = toppleTimeline(-100, { durationMs: 750 });
    expect(start.angleDeg).toBeCloseTo(0);
    const after = toppleTimeline(10000, { durationMs: 750 });
    expect(after.angleDeg).toBeLessThanOrEqual(-89);
  });

  it('ground despawn respects config window', () => {
    expect(shouldDespawnGround(1000, { groundMs: 2000 })).toBe(false);
    expect(shouldDespawnGround(2000, { groundMs: 2000 })).toBe(true);
  });

  it('toppleTimeline follows cubic ease-out profile within tolerance', () => {
    const duration = 800
    const samples = [0, 0.25, 0.5, 0.75, 1]
    for (const p of samples) {
      const t = p * duration
      const out = toppleTimeline(t, { durationMs: duration })
      const eased = 1 - Math.pow(1 - p, 3)
      const expAngle = -90 * eased
      const expSlide = 12 * eased
      expect(Math.abs(out.angleDeg - expAngle)).toBeLessThan(1e-6)
      expect(Math.abs(out.slidePx - expSlide)).toBeLessThan(1e-6)
    }
  })
});
