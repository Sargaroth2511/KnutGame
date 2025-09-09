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
});

