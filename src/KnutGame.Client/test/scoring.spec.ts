import { describe, it, expect } from 'vitest'
import { createScoreState, tickScore, applyPoints, applyMultiplier, applySlowMo, slowMoFactor } from '../src/systems/scoring'

describe('scoring system', () => {
  it('ticks base score at 10 pts/sec', () => {
    let s = createScoreState();
    s = tickScore(s, 1000, 10);
    expect(s.score).toBe(10);
  });

  it('applies multiplier for limited duration', () => {
    let s = createScoreState();
    s = applyMultiplier(s, 2, 2000);
    s = tickScore(s, 1000, 10); // 1 sec * 10 * 2
    expect(s.score).toBe(20);
    s = tickScore(s, 2000, 10); // expires after total 3s, last second un-multiplied
    expect(s.multiplier).toBe(1);
  });

  it('adds points from POINTS item', () => {
    let s = createScoreState();
    s = applyPoints(s, 100);
    expect(s.score).toBe(100);
  });

  it('slowmo exposes factor when active', () => {
    let s = createScoreState();
    s = applySlowMo(s, 5000);
    expect(slowMoFactor(s, 0.5)).toBe(0.5);
    s = tickScore(s, 6000, 10);
    expect(slowMoFactor(s, 0.5)).toBe(1);
  });
});
