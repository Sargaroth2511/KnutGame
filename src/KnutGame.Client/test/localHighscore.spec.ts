import { describe, it, expect } from 'vitest'
import { getHighscore, setHighscore, type KeyValueStorage } from '../src/services/localHighscore'

const memStore = (): KeyValueStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) }
  }
}

describe('localHighscore', () => {
  it('persists and retrieves best score', () => {
    const s = memStore();
    expect(getHighscore(s)).toBe(0);
    setHighscore(123, s);
    expect(getHighscore(s)).toBe(123);
  });

  it('ignores invalid stored values', () => {
    const s = memStore();
    (s as any).setItem('knut_highscore_v1', '"not a number"');
    expect(getHighscore(s)).toBe(0);
  });
});
