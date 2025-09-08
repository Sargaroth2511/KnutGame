export type ScoreState = {
  score: number;
  multiplier: number;            // e.g., 1 or 2
  multiplierRemainingMs: number; // 0 when inactive
  slowMoRemainingMs: number;     // 0 when inactive
}

export const createScoreState = (): ScoreState => ({
  score: 0,
  multiplier: 1,
  multiplierRemainingMs: 0,
  slowMoRemainingMs: 0,
});

export const tickScore = (s: ScoreState, dtMs: number, basePtsPerSec: number): ScoreState => {
  const next: ScoreState = { ...s };
  const seconds = Math.max(0, dtMs) / 1000;
  next.score += Math.floor(seconds * basePtsPerSec * next.multiplier);
  if (next.multiplierRemainingMs > 0) next.multiplierRemainingMs = Math.max(0, next.multiplierRemainingMs - dtMs);
  if (next.multiplierRemainingMs === 0) next.multiplier = 1;
  if (next.slowMoRemainingMs > 0) next.slowMoRemainingMs = Math.max(0, next.slowMoRemainingMs - dtMs);
  return next;
};

export const applyPoints = (s: ScoreState, bonus: number): ScoreState => ({ ...s, score: s.score + bonus });

export const applyMultiplier = (s: ScoreState, factor: number, durationMs: number): ScoreState => ({
  ...s,
  multiplier: Math.max(1, factor),
  multiplierRemainingMs: Math.max(s.multiplierRemainingMs, durationMs),
});

export const applySlowMo = (s: ScoreState, durationMs: number): ScoreState => ({
  ...s,
  slowMoRemainingMs: Math.max(s.slowMoRemainingMs, durationMs),
});

export const slowMoFactor = (s: ScoreState, factor: number): number => (s.slowMoRemainingMs > 0 ? factor : 1);
